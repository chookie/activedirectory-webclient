#!/usr/bin/env node

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const config = require('config');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const https = require('https');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');
const methodOverride = require('method-override');
const OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
const bunyan = require('bunyan');
const PrettyStream = require('bunyan-prettystream');
const OAuth = require('oauth');
const rp = require('request-promise');
const graph = require('msgraph-sdk-javascript');

const app = express();

if (config.env !== 'production') {
  app.use(morgan('dev'));
} else {
  // Combined uses Apache style logs
  app.use(morgan('combined'));
}


var prettyStdOut = process.stdout;
var prettyErrOut = process.stderr;
var streamType = 'stream';
if (config.env !== 'production') {
  prettyStdOut = new PrettyStream();
  prettyStdOut.pipe(process.stdout);
  prettyErrOut = new PrettyStream();
  prettyErrOut.pipe(process.stderr);
  streamType = 'raw';
}

var log = bunyan.createLogger({
  name: config.appName,
  streams: [{
    level: 'debug',
    type: streamType,
    stream: prettyStdOut
  }, {
    level: 'error',
    type: streamType,
    stream: prettyErrOut
  }]
});

var port = normalizePort(config.port);
app.set('port', port);
app.use(methodOverride()); // lets you use PUT and DELETE http methods
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/json' }));
app.use(allowCrossDomain);
app.use(express.static(path.join(__dirname, '/src/public')));
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(session({
  name: config.appName,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true }
}));

passport.use(new OIDCStrategy(config.credentials,
  function (iss, sub, profile, access_token, refresh_token, params, done) {
    done(null, {
      profile,
      api_token: params.id_token,
      graph_token: access_token
    })
  }
));

const users = {};
passport.serializeUser((user, done) => {
  const id = uuid.v4();
  users[id] = user;
  done(null, id);
});
passport.deserializeUser((id, done) => {
  const user = users[id];
  done(null, user)
});

app.use(passport.initialize());
app.use(passport.session());

const httpOptions = {
  key: fs.readFileSync('./src/tools/rsa-key.pem'),
  cert: fs.readFileSync('./src/tools/rsa-cert.pem')
};
var server = https.createServer(httpOptions, app);
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// Our Auth routes

//   After authenticating, the OpenID provider will redirect the user back to this application at /auth/openid/return
app.get('/auth/openid',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function (req, res) {
    log.info('Authentication was called in the Sample');
    res.redirect('/');
  });

app.get('/auth/openid/return',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  (req, res) => {
    log.debug('We received a Get return from AzureAD.');
    res.redirect('/');
  });

app.post('/auth/openid/return',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function (req, res) {
    console.log('We received a Post return from AzureAD.');
    res.redirect('/');
  });

// Routes
app.get('/', function (req, res) {
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function (req, res) {
  res.render('account', { user: req.user });
});

app.get('/login',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function (req, res) {
    log.info('Login was called in the Sample');
    res.redirect('/');
  });

app.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    req.logOut();
    res.redirect(config.destroySessionUrl);
  });
});

app.get('/webapi', ensureAuthenticated, function (req, res) {
  log.debug('Call /webapi', req.user.api_token);

  const options = {
    uri: `https://127.0.0.1:50000/helloSecure`,
    headers: {
      Authorization: 'Bearer ' + req.user.api_token,
      'X-Correlation-ID': req.user.graph_token
    },
    method: 'GET',
    rejectUnauthorized: false,
    requestCert: true,
    agent: false,
    json: true
  };

  rp(options)
    .then(function (repos) {
      res.send(repos);
    })
    .catch(function (err) {
      log.error('rp error ', err.message);
      res.send(err);
    });
});

app.get('/graph', ensureAuthenticated, function (req, res) {
  getUserData(res, req.user.graph_token);
});

function getUserData(res, accessToken) {
  log.debug('Calling graph SDK with access token',accessToken);
  var client = graph.Client.init({
    defaultVersion: 'v1.0',
    debugLogging: true,
    authProvider: function (done) {
       done(null, accessToken
       //'eyJ0eXAiOiJKV1QiLCJub25jZSI6IkFRQUJBQUFBQUFEUk5ZUlEzZGhSU3JtLTRLLWFkcENKbkJ5clJhZVA5bHNlMERqdWRSNmNTbkx1d21tUHBPZF9wR09DVkVqSTFIbXNSalJLNWdEMThxNkNOMG1ZVHhodTRZOHBleWxGa0w1bmtmNWZiRk42UXlBQSIsImFsZyI6IlJTMjU2IiwieDV0IjoiWTR1ZUsyb2FJTlFpUWI1WUVCU1lWeURjcEFVIiwia2lkIjoiWTR1ZUsyb2FJTlFpUWI1WUVCU1lWeURjcEFVIn0.eyJhdWQiOiJodHRwczovL2dyYXBoLm1pY3Jvc29mdC5jb20iLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC8yYjRkYTNiZC03MWQ0LTQ1NmMtYWQxYi02M2I3ODg3NzJhMGQvIiwiaWF0IjoxNDg1ODg5NjE2LCJuYmYiOjE0ODU4ODk2MTYsImV4cCI6MTQ4NTg5MzUxNiwiYWNyIjoiMSIsImFtciI6WyJwd2QiXSwiYXBwX2Rpc3BsYXluYW1lIjoiR3JhcGggZXhwbG9yZXIiLCJhcHBpZCI6ImRlOGJjOGI1LWQ5ZjktNDhiMS1hOGFkLWI3NDhkYTcyNTA2NCIsImFwcGlkYWNyIjoiMCIsImVfZXhwIjoxMDgwMCwiZmFtaWx5X25hbWUiOiJKb2huc3RvbiIsImdpdmVuX25hbWUiOiJBbGlzb24iLCJpcGFkZHIiOiIyMTcuMTM4LjE2LjgyIiwibmFtZSI6IkFsaXNvbiBKb2huc3RvbiIsIm9pZCI6IjJiOTg4MTI4LTZiYzYtNDQ5YS05YjcyLTEzYjYzODk3NTI0OSIsIm9ucHJlbV9zaWQiOiJTLTEtNS0yMS0zNjI3NTk0MzkxLTM4MzI0MTYzNDUtMjExNjk5NTk2Ny03OTg1IiwicGxhdGYiOiI1IiwicHVpZCI6IjEwMDMzRkZGOUI4Qzc5QUYiLCJzY3AiOiJDYWxlbmRhcnMuUmVhZFdyaXRlIENhbGVuZGFycy5SZWFkV3JpdGUuU2hhcmVkIENvbnRhY3RzLlJlYWRXcml0ZSBDb250YWN0cy5SZWFkV3JpdGUuU2hhcmVkIERpcmVjdG9yeS5BY2Nlc3NBc1VzZXIuQWxsIERpcmVjdG9yeS5SZWFkV3JpdGUuQWxsIEZpbGVzLlJlYWRXcml0ZSBGaWxlcy5SZWFkV3JpdGUuQWxsIEZpbGVzLlJlYWRXcml0ZS5BcHBGb2xkZXIgRmlsZXMuUmVhZFdyaXRlLlNlbGVjdGVkIEdyb3VwLlJlYWRXcml0ZS5BbGwgSWRlbnRpdHlSaXNrRXZlbnQuUmVhZC5BbGwgTWFpbC5SZWFkV3JpdGUgTWFpbC5SZWFkV3JpdGUuU2hhcmVkIE1haWwuU2VuZCBNYWlsLlNlbmQuU2hhcmVkIE1haWxib3hTZXR0aW5ncy5SZWFkV3JpdGUgTm90ZXMuQ3JlYXRlIE5vdGVzLlJlYWRXcml0ZSBOb3Rlcy5SZWFkV3JpdGUuQWxsIE5vdGVzLlJlYWRXcml0ZS5DcmVhdGVkQnlBcHAgU2l0ZXMuUmVhZFdyaXRlLkFsbCBUYXNrcy5SZWFkV3JpdGUgVGFza3MuUmVhZFdyaXRlLlNoYXJlZCBVc2VyLlJlYWQgVXNlci5SZWFkQmFzaWMuQWxsIFVzZXIuUmVhZFdyaXRlIFVzZXIuUmVhZFdyaXRlLkFsbCIsInNpZ25pbl9zdGF0ZSI6WyJpbmtub3dubnR3ayJdLCJzdWIiOiJ0TWxRM3dlNHcwVTR5cGJHdG5pb3ZyVUZKUnZoZ3dzZlRBQ0ZsSnY1U2pJIiwidGlkIjoiMmI0ZGEzYmQtNzFkNC00NTZjLWFkMWItNjNiNzg4NzcyYTBkIiwidW5pcXVlX25hbWUiOiJBLkpvaG5zdG9uQGNhcmRhbm8uY29tIiwidXBuIjoiQS5Kb2huc3RvbkBjYXJkYW5vLmNvbSIsInZlciI6IjEuMCJ9.AaoDAdyDoyoDD-lDvLtMA3qwcMhcvjYehKoW-JyarlyH-kEONFinVtbtpGa8XSzg-rBpnUpLcH2__3kPM-jn7u_ICHNhOmzhdk5jkGHyKeOgG_1UvQJPsSNxfT4QfauFfnM7r-gkB_YfjO1AnlV4byi5MidouGQnlbBz-riObI7ZXetqmlglJuWl84GDid7KKLhUQ1H85l9iMxYl8PnunSYebqH-1AhXwe4d6UJF2yqtKICWJl45Dtju8ih2X8u2KS5rkzB248b4SQQw8n9Xg_B-WhHHn3j_zq_UWWWx59HuzTEWEtmWNBc0eM1TpCAMEkQtjHjQH5tkOoZ4tcRmww'
      );
    }
  });
  client.api('/me').select(["displayName", "userPrincipalName"]).get((err, me) => {
    log.info('graph called');
    if (err) {
      log.error('graph error', err.message);
      res.status(err.statusCode).json({error: err});
      return;
    }
    if(!me) {
      log.warn('graph me is null');
      res.json({warn: 'graph me is null'});
      return;
    }
    log.info('graph success', me);
    res.json(me);;
  });
}

// Simple route middleware to ensure user is authenticated. (Section 4)
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

/**
 * Allow requestes to other servers
 */
function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  next();
};

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      log.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      log.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  log.info('Listening on ' + bind);
  log.info('Started on https://' + config.host + ':' + addr.port);
  console.info('Started on https://' + config.host + ':' + addr.port);
}

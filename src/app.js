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
        name: 'foo',
        streams: [{
            level: 'debug',
            type: streamType,
            stream: prettyStdOut
        },{
            level: 'error',
            type: streamType,
            stream: prettyErrOut
        }]
});

var port = normalizePort(config.server.port);
app.set('port', port);
app.use(methodOverride()); // lets you use PUT and DELETE http methods
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text());
app.use(bodyParser.json({ type: 'application/json'}));
app.use(allowCrossDomain);
app.use(express.static(path.join(__dirname, '/src/public')));
// app.engine('html', require('ejs').renderFile);
// app.set('view engine', 'html');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(session({
    name: 'ad-webclient',
    secret: config.server.sessionSecret,
    resave: false,
    saveUninitialized: false,
  	cookie: {secure: true}
}));
passport.use(new OIDCStrategy(config.credentials, (iss, sub, profile, access_token, refresh_token, params, done) => {
  done(null, {
    profile,
    access_token,
    refresh_token,
    id_token: params.id_token
  })
}));

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

// app.get('/', (req, res) => res.render('index'));

app.get('/', function(req, res) {
  res.render('index', { user: req.user });
});

// '/account' is only available to logged in user
app.get('/account', function(req, res) {
  res.render('account', { user: req.user });
});

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
  function(req, res) {
    log.info('Authentication was called in the Sample');
    res.redirect('/');
  });

// GET /auth/openid/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/openid/return',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('We received a Get return from AzureAD.');
    // console.log('get:code=' + req.query.code);
    getToken(req, res, req.query.code);
    // res.redirect('/');
  });
// app.get('/auth/openid/return',
//   (req, res) => {
//     log.debug('We received a Get return from AzureAD.');
//     log.info(req.query.code);
//     res.redirect('/');
//   });

const ACCESS_TOKEN_CACHE_KEY = 'ACCESS_TOKEN_CACHE_KEY';
const REFRESH_TOKEN_CACHE_KEY = 'REFRESH_TOKEN_CACHE_KEY';

function getToken(req, res, code) {
  if (code !== undefined) {
    getTokenFromCode(code, function (e, accessToken, refreshToken) {
      if (e === null) {
        console.log('access_token= ' + JSON.stringify(accessToken));
        console.log('access_code= ' + JSON.stringify(code));
        // cache the refresh token in a cookie and go back to index
        res.cookie(ACCESS_TOKEN_CACHE_KEY, accessToken);
        res.cookie(REFRESH_TOKEN_CACHE_KEY, refreshToken);
        res.redirect('/');
      } else {
        console.log(JSON.parse(e.data).error_description);
        res.status(500);
        res.send();
      }
    });
  } else {
    res.redirect('/login');
  }
}
function getTokenFromCode(code, callback) {
  var OAuth2 = OAuth.OAuth2;
  var oauth2 = new OAuth2(
    config.credentials.clientID,
    config.credentials.clientSecret,
    'https://login.microsoftonline.com/common',
    '/oauth2/authorize',
    '/oauth2/token'
  );

  oauth2.getOAuthAccessToken(
    code,
    {
      grant_type: 'authorization_code',
      redirect_uri: config.credentials.redirectUrl,
      response_mode: 'query'
    },
    function (e, accessToken, refreshToken) {
      callback(e, accessToken, refreshToken);
    }
  );
};

// POST /auth/openid/return
app.post('/auth/openid/return',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('We received a Post return from AzureAD.');
    console.log('post:code=' + req.body.code);
    res.redirect('/');
  });

// Routes
app.get('/', function(req, res){
  res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function(req, res) {
    log.info('Login was called in the Sample');
    res.redirect('/');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


// Simple route middleware to ensure user is authenticated. (Section 4)
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}


// Helper functions

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
  log.info('Started on http://localhost:' + addr.port);
  console.info('Started on http://localhost:' + addr.port);
}

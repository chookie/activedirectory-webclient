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

const app = express();

if (config.env !== 'production') {
  app.use(morgan('dev'));
} else {
  // Combined uses Apache style logs
  app.use(morgan('combined'));
}

var log = bunyan.createLogger({name: 'azure-ad-webclient'});

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
    log.info('We received a Get return from AzureAD.');
    res.redirect('/');
  });

// POST /auth/openid/return
app.post('/auth/openid/return',
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/login' }),
  function(req, res) {
    log.info('We received a Post return from AzureAD.');
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

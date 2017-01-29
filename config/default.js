// https://github.com/lorenwest/node-config

/* Create a local config file to override some values
    module.exports = {
        server: {
            port: process.env.port || 60000,
            sessionSecret: '1234567890'
        },
        credentials: {
            clientID: '1234567890',
            clientSecret: '1234567890'
        },
        issuer: [
          '1234567890',
          '1234567890'
        ]
    }
*/
var defer = require('config/defer').deferConfig;

module.exports = {
    server: {
        port: process.env.port || 8080,
        sessionSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
    },
    // https://github.com/AzureAD/passport-azure-ad
    // validateIssuer should be true for prod
    credentials: {
        clientID: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        clientSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        redirectUrl :  defer(function (cfg) {
          return `https://localhost:${cfg.server.port}/auth/openid/return`;
        }),
        identityMetadata: 'https://login.microsoftonline.com/common/.well-known/openid-configuration',
        responseType: 'code id_token',
        responseMode: 'form_post',
        passReqToCallback: false,
        validateIssuer: true,
        issuer: [
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
        ]
    }
}

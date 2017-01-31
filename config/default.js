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

// So we can get value for port in redirecturl.
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
        responseType: 'id_token code',
        grant_type: 'authorization_code',
        responseMode: 'query',
        passReqToCallback: false,
        validateIssuer: true,
        issuer: [
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
        ],
        loggingLevel: 'info'
        // scope: ['user_impersonation', 'User.Read', 'Mail.Send','Profile'],
        // //resource: 'https://graph.microsoft.com/'
        // resource: 'https://cardano.com/31793b90-057a-4994-84ad-e07b5d21a05f'
    }
}

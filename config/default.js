// https://github.com/lorenwest/node-config

/* Create a local config file to override some values
    module.exports = {
        port: process.env.port || 60000,
        sessionSecret: '1234567890'
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
    appName: 'azure-ad-webclient',
    env: process.env.NODE_ENV || 'development',
    port: process.env.port || 8080,
    host: 'localhost',
    sessionSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
    destroySessionUrl: defer(function (cfg) {
      return `https://login.microsoftonline.com/common/oauth2/logout?post_logout_redirect_uri=https://localhost:${cfg.port}`;
    }),
    // https://github.com/AzureAD/passport-azure-ad
    // validateIssuer should be true for prod
    credentials: {
        clientID: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        clientSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        redirectUrl :  defer(function (cfg) {
          return `https://localhost:${cfg.port}/auth/openid/return`;
        }),
        callbackURL :  defer(function (cfg) {
          return `https://localhost:${cfg.port}/auth/openid/return`;
        }),
        identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
        responseType: 'id_token code',
        // V2 requires form_post.  V1 works with query or form_post
        responseMode: 'form_post',
        passReqToCallback: false,
        validateIssuer: true,
        skipUserProfile: true,
        issuer: [
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
          '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
        ],
        loggingLevel: 'info',
        //scope: ['https://graph.windows.net/offline_access','https://graph.windows.net/offline_access'],
        scope: ['offline_access', 'User.Read','Profile'],
        // scope: ['User.Read', 'Mail.Send','Profile'],
        // scope: ['Profile', 'openid','User.Read','User.ReadWrite','User.ReadBasic.All','Mail.ReadWrite','Mail.ReadWrite.Shared','Mail.Send','Mail.Send.Shared','Calendars.ReadWrite','Calendars.ReadWrite.Shared','Contacts.ReadWrite','Contacts.ReadWrite.Shared','MailboxSettings.ReadWrite','Files.ReadWrite','Files.ReadWrite.All','Files.ReadWrite.Selected','Files.ReadWrite.AppFolder','Notes.ReadWrite','Notes.ReadWrite.All','Notes.ReadWrite.CreatedByApp','Notes.Create','Tasks.ReadWrite','Tasks.ReadWrite.Shared','Sites.ReadWrite.All'],
        // resource: 'https://graph.microsoft.com/'
        // resource: 'https://graph.windows.net'
        // resource: 'https://cardano.com/31793b90-057a-4994-84ad-e07b5d21a05f'
    }
}

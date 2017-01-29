/* Create a local config file to override some values
    module.exports = {
        server: {
            port: process.env.port || 60000,
            sessionSecret: '1234567890'
        },
        credentials: {
            clientID: '1234567890',
            clientSecret: '1234567890'
        }
    }
*/

const port = process.env.port || 8080;

module.exports = {
    server: {
        port: port,
        sessionSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
    },
    // https://github.com/AzureAD/passport-azure-ad
    // TODO: validateIssuer should not be false for prod
    credentials: {
        clientID: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        clientSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        redirectUrl: `https://localhost:${port}/auth/openid/return`,
        identityMetadata: 'https://login.microsoftonline.com/common/.well-known/openid-configuration',
        responseType: 'code id_token',
        responseMode: 'form_post',
        passReqToCallback: true,
        validateIssuer: false
    }
}

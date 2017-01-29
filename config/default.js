/* Create a local config file to override some values
    module.exports = {
        server: {
            port: process.env.port || 60000
        },
        credentials: {
            clientID: '1234567890',
            clientSecret: '1234567890'
        }
    }
*/

module.exports = {
    server: {
        port: process.env.port || 8080
    },
    credentials: {
        clientID: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***',
        clientSecret: '*** Do not past here.  Put in local file and DO NOT COMMIT.  ***'
    }
}
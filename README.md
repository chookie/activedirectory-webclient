# Azure Active Directory Web Client

## RSA certificate
* Generate aRSA certificate and place the cert.pem and keys.pem files  in the tools folder.
* Make sure the Common Name is 'localhost'
* This will ask you for a 4 character passphrase
```bash
openssl req -x509 -newkey rsa:2048 -keyout rsa-key.pem -out rsa-cert.pem -days 365
```

If you get problems then generate one without a passphrase
```bash
openssl req -x509 -newkey rsa:2048 -keyout rsa-key.pem -out rsa-cert.pem -days 365 -nodes 
```

## Local Configuration
* Create a file /config/local-development.js.
* Replace the clientID and clientSecret with those from your registered app.
* By default the service will run on port 8080.  Change it here if 8080 is already in use.
```javascript
module.exports = {
    server: {
        port: process.env.port || <optional-port></optional-port>
    },
    credentials: {
        clientID: '<your-client-id>',
        clientSecret: '<your-client-secret>
    }
}
```
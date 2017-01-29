/* eslint-disable */
var exec = require('child_process').exec;

exec('node -v', function (err, stdout) {
  if (err) {
    throw err;
  }

  var minVersion = 6.0;
  if (parseFloat(stdout.slice(1)) < minVersion) {
    throw new Error("React Slingshot requires node " + minVersion + " or greater.");
  }
});

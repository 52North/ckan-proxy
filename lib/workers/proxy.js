var cluster = require('cluster');
var config = require('../config');
var Proxy = require('../proxy');
var log = require('../logging')('proxy-worker');

log.info("Starting Worker...");

var proxy = new Proxy(config.proxy);
// set up the initial whitelist
proxy.whitelist.set(config.whitelist.domains);
// listen for whitelist changes
process.on('message', function(message) {
  if (message.cmd === 'whitelist.update') {
    log.debug('Whitelist changed.');
    proxy.whitelist.set(message.whitelist);
  }
});
log.info("Starting server on port " + config.proxy.port);

// start the server
proxy.start().on('error', function(e) {
  if (e.code === 'EADDRINUSE') {
    log.error("Address in use, stopping");
    cluster.worker.kill();
  }
});

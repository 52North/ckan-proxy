var cluster = require('cluster');
var config = require('../config');
var Whitelist = require('../whitelist');
var log = require('../logging')('whitelist-worker');

log.info("Starting Worker...");

Whitelist.Manager
  .create(config.whitelist)
  .on('update', function(wl) {
    whitelist = wl;
    log.debug('Whitelist changed.');
    // send the whitelist to the workers
    process.send({
      cmd: 'whitelist.update',
      whitelist: whitelist.get()
    });
  });
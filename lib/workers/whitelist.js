var config = require('../config');
var WhitelistManager = require('../whitelist').Manager;
var log = require('../logging')('whitelist-worker');

log.info("Starting Worker...");

WhitelistManager
  .create(config.whitelist)
  .on('update', function(whitelist) {
    log.trace('Sending whitelist to master');
    process.send({
      cmd: 'whitelist.update',
      whitelist: whitelist.get()
    });
  });
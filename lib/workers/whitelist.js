#!/usr/bin/env node

var cluster = require('cluster');
var config = require('../config');
var Whitelist = require('../whitelist');
var log = require('../logging')('whitelist-worker');

log.info("Starting Worker...");

var manager = Whitelist.Manager.create(config.whitelist);
var whitelist;


manager.on('update', function(wl) {
  whitelist = wl;
  log.debug('Whitelist changed.');
  // send the whitelist to the workers
  sendWhitelist();
});

cluster.on('online', sendWhitelist);

function sendWhitelist(worker) {
  var id, message;
  if (whitelist) {
    message = {
      cmd: 'whitelist.update',
      whitelist: whitelist.get()
    };
    if (worker) {
      worker.send(message);
    } else {
      for (id in cluster.workers) {
        cluster.workers[id].send(message);
      }
    }
  }
}

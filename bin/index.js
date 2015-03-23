#!/usr/bin/env node
var log = require('../lib/logging')('main');
var Proxy = require('../lib/proxy');
var cluster = require('cluster');
var hub = require('clusterhub');
var WhitelistManager = require('../lib/whitelist').Manager;
var Whitelist = require('../lib/whitelist').Whitelist;
//var WhitelistManager = require('../lib/whitelist-dummy');


if (cluster.isMaster) {

  WhitelistManager.create({
    url: 'http://demo.ckan.org',
    updateInterval: 0,
    rowsPerRequest: 500,
    domains: [ 'localhost', 'jamaika', 'zoidberg', 'requestb.in', '127.0.0.1' ]
  }).on('update', function(whitelist) {
    log.debug('[MASTER] Whitelist changed.');
    hub.emit('whitelist.update', whitelist.get());
  });

  var cpus = require('os').cpus().length;
  for (var i = 0; i < cpus; ++i) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
    if (!worker.suicide) cluster.fork();
  });

} else {

  var proxy = Proxy.create({})

  hub.on('whitelist.update', function(whitelist) {
    log.debug('[WORKER] Setting changed.');
    proxy.whitelist.set(whitelist);
  });

  log.info("Starting server on port 9090");
  proxy.server.listen(9090);
}

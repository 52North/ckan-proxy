#!/usr/bin/env node

var cluster = require('cluster');
var hub = require('clusterhub');
var os = require('os');

var log = require('../lib/logging')('main');
var config = require('../lib/config');
var Whitelist = require('../lib/whitelist');
var Proxy = require('../lib/proxy');

if (cluster.isMaster) {
  createMaster();
} else {
  createWorker();
}

function createMaster() {
  var cpus = os.cpus().length;

  Whitelist.Manager.create(config.whitelist)
      .on('update', function(whitelist) {
        var newdomains = whitelist.get();
        // maintain additional domains across updates
        log.debug('[MASTER] Whitelist changed.');
        // send the whitelist to the workers
        hub.emit('whitelist.update', newdomains);
      });

  cluster.on('exit', function(worker, code, signal) {
    log.info('worker ' + worker.process.pid + ' died');
    // restart a work if it wasn't suicide
    if (!worker.suicide) cluster.fork();
  });

  for (var i = 0; i < cpus; ++i) {
    cluster.fork();
  }
}

function createWorker() {
  var proxy = new Proxy(config.proxy);
  // set up the initial whitelist
  proxy.whitelist.set(config.whitelist.domains);
  // listen for whitelist changes
  hub.on('whitelist.update', function(whitelist) {
    log.debug('[WORKER] Whitelist changed.');
    proxy.whitelist.set(whitelist);
  });
  log.info("Starting server on port " + config.proxy.port);

  // start the server
  proxy.start();
}

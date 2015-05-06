#!/usr/bin/env node

var cluster = require('cluster');
var os = require('os');
var log = require('../lib/logging')('master');

var whitelist;
var workers = {
  whitelist: null,
  proxy: {}
};

cluster.on('exit', restart);
start();

function start() {
  log.info("Forking...");
  var cpus = os.cpus().length;
  forkWhitelistWorker();
  for (var i = 0; i < cpus; ++i) {
    forkProxyWorker();
  }
}

function noWorkersLeft() {
  var count = 0;
  for (var id in workers.proxy) {
    if (workers.proxy.hasOwnProperty(id)) {
      ++count;
    }
  }
  return count > 0;
}

function restart(worker, code, signal) {
  log.info('worker ' + worker.process.pid + ' died:', signal || code);

  // respect that...
  if (worker.suicide) {
    if (noWorkersLeft()) {
      return process.exit(1);
    } else {
      return;
    }
  }

  if (worker.id === workers.whitelist.id) {
    forkWhitelistWorker();
  } else {
    delete workers.proxy[worker.id];
    forkProxyWorker();
  }
}

function forkWhitelistWorker() {
  cluster.setupMaster({
    exec: require.resolve('../lib/workers/whitelist')
  });
  // keep track of the whitelist worker
  workers.whitelist = cluster.fork();
  workers.whitelist.on('message', function(message) {
    log.info("Received message from whitelist worker", message);
    if (message.cmd === 'whitelist.update') {
      // save the whitelist for newly created proxy workers
      whitelist = message.whitelist;
      // propagate whitelist to proxy workers
      for (var id in workers.proxy) {
        log.info('Sending message to worker', id);
        workers.proxy[id].send(message);
      }
    }
  });
  return workers.whitelist;
}

function forkProxyWorker() {
  cluster.setupMaster({
    exec: require.resolve('../lib/workers/proxy')
  });
  var worker = cluster.fork();
  // keep track of the proxy worker
  workers.proxy[worker.id] = worker;
  // send whitelist to new worker
  worker.on('online', function() {
    log.info('Worker', worker.id, 'is online');
    if (whitelist) {
      log.info('Sending message to worker', worker.id);
      worker.send({
        cmd: 'whitelist.updated',
        whitelist: whitelist
      });
    }
  });
  return worker;
}

#!/usr/bin/env node

var cluster = require('cluster');
var os = require('os');
var log = require('../lib/logging')('master');


var proxyWorkers = {};
var whitelistWorker;

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
  for (var id in proxyWorkers) {
    if (proxyWorkers.hasOwnProperty(id)) {
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

  if (worker.id === whitelistWorker.id) {
    forkWhitelistWorker();
  } else {
    delete proxyWorkers[worker.id];
    forkProxyWorker();
  }
}

function forkWhitelistWorker() {
  cluster.setupMaster({
    exec: require.resolve('../lib/workers/whitelist')
  });
  whitelistWorker = cluster.fork();
  return whitelistWorker;
}

function forkProxyWorker() {
  cluster.setupMaster({
    exec: require.resolve('../lib/workers/proxy')
  });
  var worker = cluster.fork();
  proxyWorkers[worker.id] = worker;
  return worker;
}

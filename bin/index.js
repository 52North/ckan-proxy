#!/usr/bin/env node
var log = require('../lib/logging')('main');
var Proxy = require('../lib/proxy');
var cluster = require('cluster');
var hub = require('clusterhub');
//var WhitelistManager = require('../lib/whitelist').Manager;
var Whitelist = require('../lib/whitelist').Whitelist;
var WhitelistManager = require('../lib/whitelist-dummy').Manager;

var domains = [
  'localhost',
  'jamaika',
  'zoidberg',
  'requestb.in',
  '127.0.0.1',
  'sensorweb.demo.52north.org',
  'google.com',
  'facebook.com',
  'amazon.com',
  'twitter.com',
  'github.com',
  'cdnjs.cloudflare.com',
  'maxcdn.bootstrapcdn.com',
  'code.jquery.com',
  'ajax.googleapis.com'
];

if (cluster.isMaster) {

  WhitelistManager.create({
    url: 'http://demo.ckan.org',
    updateInterval: 0,
    rowsPerRequest: 500,
    domains: domains
  }).on('update', function(whitelist) {
    var newdomains = whitelist.get();
    Array.prototype.push.apply(newdomains, domains);
    log.debug('[MASTER] Whitelist changed.');
    hub.emit('whitelist.update', newdomains);
  });

  var cpus = require('os').cpus().length;
  for (var i = 0; i < cpus; ++i) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    log.info('worker ' + worker.process.pid + ' died');
    if (!worker.suicide) cluster.fork();
  });

} else {

  var proxy = Proxy.create({});
  proxy.whitelist.set(domains);

  hub.on('whitelist.update', function(whitelist) {
    log.debug('[WORKER] Setting changed.');
    proxy.whitelist.set(whitelist);
  });

  log.info("Starting server on port 9090");
  proxy.server.listen(9090);
}

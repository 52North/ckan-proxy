var log = require('../lib/logging')('main');
var Proxy = require('../lib/proxy');

//var Whitelist = require('../lib/whitelist');
var Whitelist = require('../lib/whitelist-dummy');


var whitelistOptions = {
  url: 'http://demo.ckan.org',
  updateInterval: 0,
  rowsPerRequest: 500,
  domains: [
    'localhost',
    'jamaika',
    'requestb.in',
    '127.0.0.1'
  ]
};

var proxyOptions = {};

Whitelist.create(whitelistOptions)
  .then(function(whitelist) {
    proxyOptions.whitelist = whitelist;
    return Proxy.create(proxyOptions);
  })
  .then(function(server) {
    log.info("Starting server on port 9090");
    server.listen(9090);
  })
  .done();

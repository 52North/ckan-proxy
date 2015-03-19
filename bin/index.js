var log = require('../lib/logging')('main');
var Whitelist = require('../lib/whitelist');
var Proxy     = require('../lib/proxy');

var whitelistOptions = {
  url: 'http://demo.ckan.org',
  updateInterval: 0,
  rowsPerRequest: 500
};

var proxyOptions = {

};
/*
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
*/

proxyOptions.whitelist = {
  _domains: {
    'localhost': true,
    'jamaika': true,
    'requestb.in': true
  },
  get: function() {
    return Whitelist.prototype.get.apply(proxyOptions.whitelist);
  },
  contains: function() {
    return Whitelist.prototype.contains.apply(proxyOptions.whitelist, arguments);
  }
};
log.info("Starting server on port 9090");
Proxy.create(proxyOptions).listen(9090);

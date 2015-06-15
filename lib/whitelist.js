var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var EventEmitter = require('events').EventEmitter;
var isArray = require('util').isArray;

var log = require('./logging')('whitelist');

function WhitelistManager(config) {
  EventEmitter.call(this);
  this.config = config;
  this.whitelist = new Whitelist(config.domains);

  process.nextTick(this.refresh.bind(this));
}

WhitelistManager.prototype = Object.create(EventEmitter.prototype);

WhitelistManager.prototype.refresh = function() {

  if (!this.config.ckan.enabled) return;

  log.info('Updating WhitelistManager');

  Bluebird.all([
    this.fetch('gjson'),
    this.fetch('GeoJSON'),
    this.fetch('WMS')
  ]).bind(this)
  .then(function(results) {
      // merge the objects to a single array
      if (!results.length) return [];
      var domains = results[0];
      var i, key;
      for (i = 1; i < results.length; ++i) {
        for (key in results[i]) {
          domains[key] = true;
        }
      }
      return Object.keys(domains);
  })
  .then(function(domains) {
    log.info('Updated whitelist with', domains.length, 'domains.');

    // add the additional configured domains
    Array.prototype.push.apply(domains, this.config.domains);

    this.whitelist.set(domains);
    this.emit('update', this.whitelist);
    this.schedule();
  }, function(err) {
    log.error({err: err}, 'Error updating');
  });
};

WhitelistManager.prototype.schedule= function() {
  if (!this.config.ckan.enabled) return;
  var interval = this.config.ckan.updateInterval;
  if (interval) {
    Bluebird // schedule a refresh
      .delay(interval * 60 * 1000)
      .then(this.refresh.bind(this));
  }
};

WhitelistManager.prototype.fetch = function(format) {
  var self = this;

  return new Bluebird(function(resolve, reject) {
    var options = {
      url: self.config.ckan.url + '/api/3/action/resource_search',
      json: true,
      qs: {
        order_by: 'id',
        limit: self.config.ckan.rowsPerRequest,
        offset: 0,
        query: 'format:' + format
      }
    };

    var domains = {};

    logRequest(options);

    request(options)
      .then(function onResponse(body) {
        if (body && body.success && body.result) {
          extractDomains(body, domains);
          if (body.result.count > (options.qs.offset + options.qs.limit)) {
            options.qs.offset += options.qs.limit;
            logRequest(options);
            request(options).then(onResponse, reject);
          } else {
            resolve(domains);
          }
        }
      }, reject);

    function extractDomains(body, domains) {
      if (!body.result.results) return domains;

      var urls = [];
      body.result.results.forEach(function(p) {
        // resources may contain false positives

        if (p && p.format && p.format.toUpperCase() === format.toUpperCase()) {
          if (p.url) urls.push(p.url);
          //p.resources.forEach(function(r) {
          //  if (r.url) urls.push(r.url);
          //});
        }
      });

      urls.forEach(function(url) {
        if (!url) return;
        try {
          var domain = URL.parse(url).host;
          if (!domain) return;
          domain = domain.toLowerCase();
          if (!domains[domain])
            domains[domain] = true;
        } catch (e) {
          log.warn("Error parsing domain", e);
        }
      });
      return domains;
    }

    function logRequest(options) {
      var url = options.url;
      if (options.qs) {
        url += '?' + Object.keys(options.qs).map(function(key) {
          return key + '=' + encodeURIComponent(options.qs[key]);
        }).join('&');
      }
      log.debug('Requesting', url);
    }

  }).bind(this);
};

WhitelistManager.create = function(options) {
  return new WhitelistManager(options);
};

function Whitelist(domains) {
  this.set(domains);
}

Whitelist.prototype.get = function() {
  return Object.keys(this._domains);
};

Whitelist.prototype.set = function(domains) {
  if (!domains) {
    this._domains = {};
  }else if (isArray(domains)) {
    this._domains = domains.reduce(function(o, x) {
                      o[x] = true; return o; }, {});
  } else if (domains instanceof Whitelist) {
    this.set(domains.get());
  } else {
    this._domains = domains;
  }
};

Whitelist.prototype.contains = function(domain) {
  return domain && !!this._domains[domain];
};

module.exports = Whitelist;
module.exports.Manager = WhitelistManager;

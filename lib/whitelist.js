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

  this.fetch()
    .then(function(domains) {
      log.info('Updated whitelist with', domains.length, ' domains.');

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
      .bind(this).call('refresh');
  }
};

WhitelistManager.prototype.fetch = function() {
  var self = this;

  return new Bluebird(function(resolve, reject) {
    var options = {
      url: self.config.ckan.url + '/api/3/action/package_search',
      json: true,
      qs: {
        sort: 'id asc',
        rows: self.config.ckan.rowsPerRequest,
        start: 0
      }
    };
    var domains = {};

    function logRequest() {
      var url = options.url;
      if (options.qs) {
        url += '?' + Object.keys(options.qs).map(function(key) {
          return key + '=' + encodeURIComponent(options.qs[key]);
        }).join('&');
      }
      log.debug('Requesting', url);
    }

    logRequest();
    request(options)
      .then(onResponse, reject);

    function onResponse(body) {
      if (body.success && body.result) {
        extractDomains(body);
        if (body.result.count > (options.qs.start + options.qs.rows)) {
          options.qs.start += options.qs.rows;
          logRequest();
          request(options).then(onResponse, reject);
        } else {
          resolve(Object.keys(domains));
        }
      }
    }

    function extractDomains(body) {
      if (!body.result.results) return;

      var urls = [];
      body.result.results.forEach(function(p) {
        if (p.url) urls.push(p.url);
        p.resources.forEach(function(r) {
          if (r.url) urls.push(r.url);
        });
      });

      urls.forEach(function(url) {
        if (!url) return;
        try {
          var domain = URL.parse(url).host;
          if (!domain) return;
          domain = domain.toLowerCase();
          if (!domains[domain])
            domains[domain] = true;
        } catch (e) {}
      });
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

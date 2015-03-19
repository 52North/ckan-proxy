var log = require('./logging')('whitelist');
var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');

function Whitelist(options) {
  options = options || {};
  if (options.domains) {
    this._domains = options.domains
        .reduce(function(o, x) {
            o[x] = true; return o;
          }, {});
  } else {
    this._domains = {};
  }
  this.url = options.url || 'http://demo.ckan.org';
  if (!options.updateInterval || options.updateInterval < 0) {
    this.updateInterval = 0;
  } else {
    this.updateInterval = options.updateInterval * 60 * 1000;
  }
  if (!options.updateInterval || options.updateInterval < 0) {
    this.rowsPerRequest = 500;
  } else {
    this.rowsPerRequest = options.rowsPerRequest;
  }
  this._promise = this.refresh();
}

Whitelist.prototype.contains = function(domain) {
  log.info('Checking domain %s', domain);
  return domain && !!this._domains[domain];
};

Whitelist.prototype.get = function() {
  return Object.keys(this._domains);
};

Whitelist.prototype.promise = function() {
  return this._promise;
};

Whitelist.prototype.refresh = function() {
  log.info('Updating whitelist');
  var p = this.fetch()
    .then(function(domains) {
      this._domains = domains;
      log.info('Updated whitelist with', this.get().length, ' domains.');
      return this;
    });

  if (this.updateInterval) {
    p.then(function() {
      Bluebird // schedule a refresh
        .delay(this.updateInterval)
        .bind(this)
        .call('refresh');
    });
  }
  return p;
};

Whitelist.prototype.fetch = function() {
  var self = this;
  return new Bluebird(function(resolve, reject) {
    var options = {
      url: self.url + '/api/3/action/package_search',
      json: true,
      qs: {
        sort: 'id asc',
        rows: self.rowsPerRequest,
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
          if (!domains[domain]) domains[domain] = true;
        } catch (e) {}
      });
    }

    function onResponse(body) {
      if (body.success && body.result) {
        extractDomains(body);
        if (body.result.count > (options.qs.start + options.qs.rows)) {
          options.qs.start += options.qs.rows;
          logRequest();
          request(options).then(onResponse, reject);
        } else {
          resolve(domains);
        }
      }
    }
    logRequest();
    request(options).then(onResponse, reject);
  }).bind(this);
};

Whitelist.create = function(options) {
  return new Whitelist(options).promise();
};

module.exports = Whitelist;

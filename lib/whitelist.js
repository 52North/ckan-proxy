var log = require('./logging')('whitelist');
var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var EventEmitter = require('events').EventEmitter;
var isArray = require('util').isArray;

function getIntOption(options, name, def) {
  if (!options[name] || options[name] < 0) {
    return def;
  } else {
    return options[name];
  }
}

function WhitelistManager(options) {
  EventEmitter.call(this);
  options = options || {};
  this.whitelist = new Whitelist(options.domains);
  this.url = options.url || 'http://demo.ckan.org';
  this.interval = getIntOption(options, 'updateInterval', 0) * 60 * 1000;
  this.rowsPerRequest = getIntOption(options, 'rowsPerRequest', 500);
  this.refresh();
}

WhitelistManager.prototype = Object.create(EventEmitter.prototype);

WhitelistManager.prototype.refresh = function() {
  log.info('Updating WhitelistManager');
  this.fetch().then(function(domains) {
      this.whitelist.set(domains);
      log.info('Updated whitelist with', domains.length, ' domains.');
      this.emit('update', this.whitelist);
      if (this.interval) {
        Bluebird // schedule a refresh
          .delay(this.interval)
          .bind(this).call('refresh');
      }
    }, function(err) {
      log.error({err: err}, 'Error updating');
    });
};

WhitelistManager.prototype.fetch = function() {
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
          resolve(Object.keys(domains));
        }
      }
    }
    logRequest();
    request(options).then(onResponse, reject);
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
  } else {
    this._domains = domains;
  }
};

Whitelist.prototype.contains = function(domain) {
  log.info('Checking domain %s', domain);
  return domain && !!this._domains[domain];
};

module.exports.Manager = WhitelistManager;
module.exports.Whitelist = Whitelist;

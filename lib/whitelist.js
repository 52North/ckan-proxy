var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var EventEmitter = require('events').EventEmitter;
var isArray = require('util').isArray;

var globalConfig = require('./config');
var writer = require('./writer');
var log = require('./logging')('whitelist');

var storedWhitelist;
try {
    storedWhitelist = require(globalConfig.whitelist.storageDir || '../data/whitelist.json');
}
catch (err) {
    log.warn("No stored whitelist found: "+ err);
}

function WhitelistManager(config) {
    EventEmitter.call(this);
    this.config = config;
  
    log.info("Whitelist config: ", JSON.stringify(this.config));
  
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
                // add the additional configured domains
        Array.prototype.push.apply(domains, this.config.domains);

        log.info("Fetched domains: "+domains.length);
        this.whitelist.set(domains);
        this.emit('update', this.whitelist);
        this.schedule();
    
        var currentDomains = this.whitelist.get();
        writer.write(this.config.storageDir || "data/whitelist.json", currentDomains);
        log.info('Updated whitelist with', Object.keys(currentDomains).length, 'domains.');
    }, function(err) {
        log.error({err: err}, 'Error updating');
        this.schedule();
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
    log.info("scheduled new update in", interval, "minutes");
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
        var maxErrorCount = self.config.ckan.maxErrorCount || 5;
        var errorCount = 0;

        function onResponse(body) {
            if (body && body.success && body.result) {
                extractDomains(body, domains);
                if (body.result.count > (options.qs.offset + options.qs.limit)) {
                    options.qs.offset += options.qs.limit;
            
                    logRequest(options);
                    request(options).then(onResponse, decideOnFailure);
                } else {
                    resolve(domains);
                }
            }
        };
    
        function decideOnFailure(err) {
            if (++errorCount === maxErrorCount) {
                log.warn("Too many errors:", errorCount, "! Cancelling whitelist update");
                reject(err);
            }
            else {
                log.info("Error count:", errorCount, "- Continuing update");
                logRequest(options);
                request(options)
                        .then(onResponse, decideOnFailure);
            }
        };

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
    
        //do the first request!
        logRequest(options);
        request(options).then(onResponse, decideOnFailure);

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
    if (isArray(domains)) {
        if (!this._domains) {
            this._domains = domains.reduce(function(o, x) {
                o[x] = true; return o;
            }, {});
        
            this.mergeWithStoredDomains();
        }
        else {
            this._domains = domains.reduce(function(o, x) {
                o[x] = true; return o;
            }, this._domains);
        }
    }
    else if (domains instanceof Whitelist) {
        this.set(domains.get());
    }
    else {
        this._domains = domains || {};
        this.mergeWithStoredDomains();
    }
  
};

Whitelist.prototype.mergeWithStoredDomains = function() {
    if (storedWhitelist) {
        this._domains = storedWhitelist.reduce(function(o, x) {
            o[x] = true; return o;
        }, this._domains);
    }
};

Whitelist.prototype.add = function(domain) {
    if (this._domains) {
        this._domains[domain] = true;
    }
};

Whitelist.prototype.contains = function(domain) {
    return domain && !!this._domains[domain];
};

module.exports = Whitelist;
module.exports.Manager = WhitelistManager;

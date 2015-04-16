var http = require('http');
var https = require('https');
var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var os = require('os');

var log = require('./logging')('proxy');
var Whitelist = require('./whitelist');

function Proxy(config) {
  this.whitelist = new Whitelist();
  this.config = config;
  this.allowedHeaders = config.cors.allowedHeaders.join(', ');
  this.allowedMethods = config.cors.allowedMethods.join(', ');
  this.server = http.createServer(this.handle.bind(this));
}

Proxy.prototype.getTarget = function(req) {
  var target = URL.parse(req.url).query;
  if (!target) return null;
  target = URL.parse(decodeURIComponent(target));
  return {
    port: target.port,
    host: target.host,
    protocol: target.protocol,
    hostname: target.hostname,
    path: target.path
  };
};

Proxy.prototype.start = function() {
  return this.server.listen(this.config.port);
};

Proxy.prototype.accepts = function(target) {
  return this.whitelist.contains(target.host);
};

Proxy.prototype.addXFFHeader = function(headers, req) {
  var address;
   if (req.connection && req.connection.remoteAddress) {
    return req.connection.remoteAddress;
  } else if (req.socket && req.socket.remoteAddress) {
    return req.socket.remoteAddress;
  } else if (req.connection && req.connection.socket) {
    return req.connection.socket;
  }
  this.appendOrCreateHeader(headers, 'x-forwarded-for', address);
};

Proxy.prototype.addCorsHeaders = function(headers, req) {
  headers['access-control-allow-origin'] = req.headers.origin || '*';
  headers['access-control-expose-headers'] = Object.keys(headers).join(',');
  return headers;
};

Proxy.prototype.addViaHeader = function(headers) {
  this.appendOrCreateHeader(headers, 'via', os.hostname());
};

Proxy.prototype.appendOrCreateHeader = function(headers, name, value) {
  if (value) headers[name] = headers[name] ? headers[name] + ', ' + value : value;
};

Proxy.prototype.createRequest = function(options, req, cb) {
  options.headers = req.headers;
  delete options.headers.connection;
  delete options.headers.upgrade;
  delete options.headers.host;
  this.addViaHeader(options.headers);
  this.addXFFHeader(options.headers, req);
  options.method = req.method;
  if (options.protocol === 'https:') {
    return https.request(options, cb);
  } else {
    return http.request(options, cb);
  }
};

Proxy.prototype.proxyRequest = function(target, req, res) {
  var self = this;
  var preq = this.createRequest(target, req, function onResponse(pres) {
    self.addViaHeader(pres.headers);
    //self.addXFFHeader(pres.headers, preq);
    self.addCorsHeaders(pres.headers, req);
    if (pres.headers.location) {
      pres.headers.location = URL.parse(req.url).path + '?' +
                      encodeURIComponent(pres.headers.location);
    }

    res.writeHead(pres.statusCode, pres.headers);
    log.debug('Piping response');
    pres.on('error', function onEnd() { res.end(); });
    pres.pipe(res);
  });

  preq.on('error', function onError(e) {
    // calls res.end()
    self.sendServerError(req, res, e);
  });

  req.on('close', function onClose() { if (preq) preq.abort(); });
  res.on('close', function onClose() { if (preq) preq.abort(); });
  log.debug('Piping request');
  req.pipe(preq);
};

Proxy.prototype.rejectRequest = function(target, req, res) {
  res.statusCode = 403;
  var headers = this.addCorsHeaders({}, req);
  for (var key in headers) {
    res.setHeader(key, headers[key]);
  }
  res.end('Not whitelisted domain name: ' + target.host + '\n', 'utf8');
};

Proxy.prototype.checkForCorsPreflight = function(req, res) {
  if (req.method !== 'OPTIONS' || !req.headers.origin) {
    return false;
  }
  log.debug('Handling CORS preflight request');
  res.writeHead(200, {
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-max-age': this.config.cors.maxAge,
    'access-control-allow-credentials': this.config.cors.allowCredentials,
    'access-control-allow-methods': req.headers['access-control-request-method'] || this.allowedMethods,
    'access-control-allow-headers': req.headers['access-control-request-headers'] || this.allowedHeaders
  });
  res.end();
  return true;
};

Proxy.prototype.handle = function(req, res) {
  try {
    log.debug({url: req.url}, 'Incoming request');
    var target = this.getTarget(req);
    if (!target) {
      res.statusCode = 400;
      res.end();
      return;
    }
    if (!this.checkForCorsPreflight(req, res)) {
      if (this.accepts(target)) {
        log.debug('Domain %s is whitelisted', target.host);
        this.proxyRequest(target, req, res);
      } else {
        log.debug('Domain %s is not whitelisted', target.host);
        this.rejectRequest(target, req, res);
      }
    }
  } catch(e) {
    this.sendServerError(req, res, e);
  }
};

Proxy.prototype.sendServerError = function(req, res, e) {
  var headers = this.addCorsHeaders({}, req);
  for (var key in headers) {
    res.setHeader(key, headers[key]);
  }
  log.error(e); res.statusCode = 500; res.end();
};

module.exports = Proxy;
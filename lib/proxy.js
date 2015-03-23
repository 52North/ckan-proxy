var log = require('./logging')('proxy');
var http = require('http');
var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var Whitelist = require('./whitelist').Whitelist;
var os = require('os');

var DEFAULT_ALLOWED_HEADERS = [ 'accept', 'accept-charset', 'accept-encoding',
  'accept-language', 'authorization', 'content-length', 'content-type', 'host',
  'origin', 'proxy-connection', 'referer', 'user-agent', 'x-requested-with' ].join(', ');
var DEFAULT_ALLOWED_METHODS = [ 'HEAD', 'POST', 'GET', 'PUT', 'PATCH', 'DELETE' ].join(', ');

function ProxyHandler(options) {
  this.whitelist = new Whitelist();
}

ProxyHandler.prototype.createServer = function() {
  this.server = http.createServer(this.handle.bind(this));
  return this;
};

ProxyHandler.prototype.getTarget = function(req) {
  var target = URL.parse(req.url).query;
  if (!target) target = '';
  target = decodeURIComponent(target);
  return URL.parse(target);
};

ProxyHandler.prototype.accepts = function(target) {
  return this.whitelist && this.whitelist.contains(target.host);
};

ProxyHandler.prototype.addXFFHeader = function(headers, req) {
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

ProxyHandler.prototype.addCorsHeaders = function(headers, req) {
  headers['access-control-allow-origin'] = req.headers['origin'] || '*';
  headers['access-control-expose-headers'] = Object.keys(headers).join(',');
  return headers;
};

ProxyHandler.prototype.addViaHeader = function(headers) {
  this.appendOrCreateHeader(headers, 'via', os.hostname());
};

ProxyHandler.prototype.appendOrCreateHeader = function(headers, name, value) {
  if (value) headers[name] = headers[name] ? headers[name] + ', ' + value : value;
};

ProxyHandler.prototype.createRequest = function(target, req) {
  var key, options = {};
  for (key in target) options[key] = target[key];
  options.headers = req.headers;
  options.headers.host = target.host;
  this.addViaHeader(options.headers);
  this.addXFFHeader(options.headers, req);
  options.method = req.method;
  return http.request(options);
};

ProxyHandler.prototype.proxyRequest = function(target, req, res) {
  var preq = this.createRequest(target, req);
  preq.on('error', onError.bind(this));
  req.on('close', onClose);
  res.on('close', onClose);
  preq.on('response', onResponse.bind(this));
  log.info('Piping request');
  req.pipe(preq, {end: true});

  function onError(e) { this.sendServerError(res, e); }
  function onClose() { if (preq) preq.abort(); }
  function onResponse(pres) {
    this.addViaHeader(pres.headers);
    //this.addXFFHeader(pres.headers, preq);
    this.addCorsHeaders(pres.headers, req);
    res.writeHead(pres.statusCode, pres.headers);
    log.info('Piping response');
    pres.pipe(res, {end: true});
  }
};

ProxyHandler.prototype.rejectRequest = function(target, req, res) {
  res.statusCode = 403;
  res.end('Not whitelisted domain name: ' + target.host + '\n', 'utf8');
};

ProxyHandler.prototype.checkForCorsPreflight = function(req, res) {
  if (req.method === 'OPTIONS' && req.headers.origin) {
    log.debug('Handling CORS preflight request');
    res.writeHead(200, {
      'access-control-allow-origin': req.headers.origin || '*',
      'access-control-max-age': 86400,
      'access-control-allow-credentials': true,
      'access-control-allow-methods':
          req.headers['access-control-request-method'] || DEFAULT_ALLOWED_METHODS,
      'access-control-allow-headers':
          req.headers['access-control-request-headers'] || DEFAULT_ALLOWED_HEADERS
    });
    res.end();
    return true;
  }
  return false;
};

ProxyHandler.prototype.handle = function(req, res) {
  try {
    log.info({req: req}, 'Incoming request');
    var target = this.getTarget(req);
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
    this.sendServerError(res, e);
  }
};

ProxyHandler.prototype.sendServerError = function(res, e) {
  log.error(e); res.statusCode = 500; res.end();
};

module.exports = {
  create: function(options) {
    return new ProxyHandler(options || {}).createServer();
  }
};

var log = require('./logging')('proxy');
var http = require('http');
var request = require('request-promise');
var Bluebird = require('bluebird');
var URL = require('url');
var os = require('os');

var DEFAULT_ALLOWED_HEADERS = [
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'authorization',
  'content-length',
  'content-type',
  'host',
  'origin',
  'proxy-connection',
  'referer',
  'user-agent',
  'x-requested-with'
].join(', ');


function withCORS(headers, request) {
  headers['access-control-allow-origin'] = '*';
  if (request.headers['access-control-request-method']) {
    headers['access-control-allow-methods'] = request.headers['access-control-request-method'];
    delete request.headers['access-control-request-method'];
  }
  if (request.headers['access-control-request-headers']) {
    headers['access-control-allow-headers'] = request.headers['access-control-request-headers'];
    delete request.headers['access-control-request-headers'];
  }

  headers['access-control-expose-headers'] = Object.keys(headers).join(',');

  return headers;
}

function ProxyHandler(options) {
  this.server = null;
  this.whitelist = options.whitelist;
}

ProxyHandler.prototype.createServer = function() {
  if (this.server) return;
  this.server = http.createServer(this.handle.bind(this));
  return this.server;
};

ProxyHandler.prototype.getTarget = function(req) {
  var target = URL.parse(req.url).query;
  if (!target) target = '';
  target = decodeURIComponent(target);
  return URL.parse(target);
};

ProxyHandler.prototype.accepts = function(target) {
  return this.whitelist.contains(target.host);
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

ProxyHandler.prototype.addViaHeader = function(headers) {
  this.appendOrCreateHeader(headers, 'via', os.hostname());
};

ProxyHandler.prototype.appendOrCreateHeader = function(headers, name, value) {
  if (value) {
    headers[name] = headers[name] ? headers[name] + ', ' + value : value;
  }
};

ProxyHandler.prototype.proxyRequest = function(target, req, res) {

  function createRequestOptions() {
    var key, options = {};
    for (key in target) options[key] = target[key];
    options.headers = req.headers;
    options.headers.host = target.host;
    options.method = req.method;
    this.addViaHeader(options.headers);
    this.addXFFHeader(options.headers, req);
    return options;
  }

  function onProxyResponse(pres) {
    this.addViaHeader(pres.headers);
    this.addXFFHeader(pres.headers, preq);
    res.writeHead(pres.statusCode, pres.headers);
    log.info('Piping response');
    /*
    pres.on('data', function(chunk) {
      log.debug('got %d bytes of response data', chunk.length);
    });
    */
    pres.pipe(res, {end: true});
  }

  function onClose() {
    if (preq) preq.abort();
  }
  function onError(e) {
    log.error(e);
  }

  var preq = http.request(createRequestOptions.call(this, req));

  preq.on('response', onProxyResponse.bind(this));
  req.on('close', onClose);
  res.on('close', onClose);
  preq.on('error', onError);
  log.info('Piping request');

  /*
  req.on('data', function(chunk) {
    log.debug('got %d bytes of request data', chunk.length);
  });
  */
  req.pipe(preq, {end: true});
};

ProxyHandler.prototype.rejectRequest = function(target, req, res) {
  res.statusCode = 403;
  res.write('Not whitelisted domain name: ' + target.host + '\n', 'utf8');
  res.end();
};

ProxyHandler.prototype.checkForCorsPreflight = function(req, res) {
  if (req.method === 'OPTIONS' && req.headers.origin) {
    var corsHeaders = {
      'access-control-allow-methods'     : 'HEAD, POST, GET, PUT, PATCH, DELETE',
      'access-control-max-age'           : 86400,
      'access-control-allow-headers'     : req.headers['access-control-request-headers'] || DEFAULT_ALLOWED_HEADERS,
      'access-control-allow-credentials' : true,
      'access-control-allow-origin'      : req.headers.origin || '*',
    };
    res.writeHead(200, corsHeaders);
    res.end();
    return true;
  }
  return false;
};

ProxyHandler.prototype.handle = function(req, res) {
  try {
    log.info({req: req}, 'Incoming request');
    var target = this.getTarget(req);
    if (this.checkForCorsPreflight(req, res)) {
      return;
    } else if (this.accepts(target)) {
      log.debug('Domain %s is whitelisted', target.host);
      this.proxyRequest(target, req, res);
    } else {
      log.debug('Domain %s is not whitelisted', target.host);
      this.rejectRequest(target, req, res);
    }
  } catch(e) {
    log.error(e);
    res.statusCode = 500;
    res.end();
  }
};


module.exports = {
  create: function(options) {
    return new ProxyHandler(options || {}).createServer();
  }
};

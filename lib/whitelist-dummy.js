var WhitelistManager = require('./whitelist').Manager;
var Whitelist = require('./whitelist').Whitelist;
var Bluebird = require('bluebird');

function WhitelistDummyManager(options) {
  this._domains = options.domains;
  WhitelistManager.call(this, options);
}

WhitelistDummyManager.prototype = Object.create(WhitelistManager.prototype);

WhitelistDummyManager.prototype.fetch = function() {
  return Bluebird.resolve(this._domains).bind(this);
};

WhitelistDummyManager.create = function(options) {
  return new WhitelistDummyManager(options);
};

module.exports.Manager = WhitelistDummyManager;
module.exports.Whitelist = Whitelist;

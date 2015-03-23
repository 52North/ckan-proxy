var WhitelistManager = require('./whitelist').Manager;
var Bluebird = require('bluebird')

function WhitelistDummy(options) {
  WhitelistManager.call(this, options);
  this._domains = options.domains;
}
WhitelistDummy.prototype = Object.create(WhitelistManager.prototype);
WhitelistDummy.prototype.fetch = function() {
  return Bluebird.resolve(this._domains).bind(this); };
WhitelistDummy.create = function(options) {
  return new WhitelistDummy(options); };
module.exports = WhitelistDummy;

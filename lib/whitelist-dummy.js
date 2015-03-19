var Whitelist = require('./whitelist');
var Bluebird = require('bluebird')

function WhitelistDummy(options) {
  Whitelist.call(this, options);
}
WhitelistDummy.prototype = Object.create(Whitelist.prototype);
WhitelistDummy.prototype.fetch = function() {
  return Bluebird.resolve(this._domains).bind(this); };
WhitelistDummy.create = function(options) {
  return new WhitelistDummy(options).promise(); };
module.exports = WhitelistDummy;

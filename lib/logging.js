
var bunyan = require('bunyan');

var main = bunyan.createLogger({
  name: 'ckan-proxy',
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [{
    level: 'debug',
    stream: process.stdout
  }]
});

module.exports = function(category) {
  return category ? main.child({ category: category }) : main;
};
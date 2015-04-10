
var bunyan = require('bunyan');
var config = require('./config');

var main = bunyan.createLogger({
  name: 'ckan-proxy',
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [{
    level: config.logging.level,
    stream: process.stdout
  }]
});

module.exports = function(category) {
  return category ? main.child({ category: category }) : main;
};

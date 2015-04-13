
var bunyan = require('bunyan');
var config = require('./config').logging;

function createStreamConfig(config) {
  var stream = { level: config.level };
  if (config.stream) {
    for (var key in config.stream) {
      stream[key] = config.stream[key];
    }
  } else {
    stream.stream = process.stdout;
  }
  return stream;
}

var main = bunyan.createLogger({
  name: 'ckan-proxy',
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [ createStreamConfig(config) ]
});

module.exports = function createLogger(category) {
  return category ? main.child({ category: category }) : main;
};

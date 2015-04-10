
var bunyan = require('bunyan');
var config = require('./config').logging;


var stream = { level: config.level };

if (config.stream) {
	for (var key in config.stream) {
		stream[key] = config.stream[key];
	}
} else {
	stream.stream = process.stdout;
}

var main = bunyan.createLogger({
  name: 'ckan-proxy',
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [stream]
});

module.exports = function(category) {
  return category ? main.child({ category: category }) : main;
};

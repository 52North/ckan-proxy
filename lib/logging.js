
var bunyan = require('bunyan');
var config = require('./config').logging;


var logStream = { level: config.level };

if (config.stream) {
	for (var key in config.stream) {
		logStream[key] = config.stream[key];
	}
} else {
	logStream.stream = process.stdout;
}

var main = bunyan.createLogger({
  name: 'ckan-proxy',
  src: false,
  serializers: bunyan.stdSerializers,
  streams: [logStream]
});

module.exports = function(category) {
  return category ? main.child({ category: category }) : main;
};

var extend = require('extend');
var fs = require('fs');

var defaultOptions = {
    logging: {level: 'info'},
    proxy: {
      port: 9090,
      cors: {
        allowedHeaders: [
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
        ],
        allowedMethods: [
          'HEAD',
          'POST',
          'GET',
          'PUT',
          'PATCH',
          'DELETE'
        ]
      }
    },
    whitelist: {
        ckan: {
            enabled: false,
            url: "http://demo.ckan.org",
            updateInterval: 0,
            rowsPerRequest: 500
        },
        domains: []
    }
};

function readConfig(file) {
  var json, options = {};

  extend(true, options, defaultOptions);

  try {
    json = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
    extend(true, options, json);
  } catch(e) {}

  return options;
}

function getPath() {
  if (process.argv.length > 2) {
    return process.argv[2];
  } else {
    return process.cwd() + '/config.json';
  }
}

module.exports = readConfig(getPath());

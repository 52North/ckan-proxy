#!/usr/bin/env node

var cluster = require('cluster');

var type;
if (cluster.isMaster) {
  type = 'master';
} else {
  type = process.env.WORKER_TYPE;
}

require('../lib/workers/' + type)();




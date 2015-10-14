var cluster = require('cluster');
var os = require('os');
var log = require('../logging')('master');

var whitelist;
var workers = {
    whitelist: null,
    proxy: {}
};

function start() {
    log.info('Forking...');
    var cpus = os.cpus().length;
    forkWhitelistWorker();
    for (var i = 0; i < cpus; ++i) {
        forkProxyWorker();
    }
}

function hasProxyWorkers() {
    for (var id in workers.proxy) {
        if (workers.proxy.hasOwnProperty(id)) {
            return true;
        }
    }
    return false;
}

function restart(worker, code, signal) {
    log.info('worker ' + worker.process.pid + ' died:', signal || code);
    
    // respect that...
    if (worker.suicide) {
        if (!hasProxyWorkers()) {
            return process.exit(1);
        } else {
            return;
        }
    }
    
    if (worker.id === workers.whitelist.id) {
        forkWhitelistWorker();
    } else {
        delete workers.proxy[worker.id];
        forkProxyWorker();
    }
}

function forkWhitelistWorker() {
    // keep track of the whitelist worker
    workers.whitelist = cluster.fork({ WORKER_TYPE: 'whitelist' });
    workers.whitelist.on('message', function(message) {
        log.trace('Received message from whitelist worker');
        if (message && message.cmd === 'whitelist.update') {
            // save the whitelist for newly created proxy workers
            whitelist = message.whitelist;
            // propagate whitelist to proxy workers
            for (var id in workers.proxy) {
                log.trace('Sending message to worker', id);
                workers.proxy[id].send(message);
            }
        }
    });
    return workers.whitelist;
}

function forkProxyWorker() {
    var worker = cluster.fork({ WORKER_TYPE: 'proxy' });
    // keep track of the proxy worker
    workers.proxy[worker.id] = worker;
    // send whitelist to new worker
    worker.on('listening', function() {
        log.trace('Worker', worker.id, 'is online');
        if (whitelist) {
            log.trace('Sending message to worker', worker.id);
            worker.send({
                cmd: 'whitelist.updated',
                whitelist: whitelist
            });
        }
    });
    
    worker.on('message', function(message) {
        if (message && message.cmd === 'whitelist.newredirectdomain') {
            log.trace("received new redirect domain");
            for (var id in workers.proxy) {
                log.trace('Sending message to worker', id);
                workers.proxy[id].send(message);
            }
        }
    });
    return worker;
}

module.exports = function() {
    cluster.on('exit', restart);
    start();
};
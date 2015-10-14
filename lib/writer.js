var fs = require('fs');
var path = require('path');

var log = require('./logging')('writer');

function write(filename, json, sync) {
    var abs = path.resolve(filename);
    log.info("trying to store file at", abs);
    if (sync) {
        try {
            fs.writeFileSync(filename, JSON.stringify(json, null, 4));
            log.info("The file was saved to " + abs);
        } catch (e) {
            log.warn(e);
        }
    }
    else {
        fs.writeFile(filename, JSON.stringify(json, null, 4), function(err) {
            if (err) {
                log.warn(err);
                return;
            }

            log.info("The file was saved to " + abs);
        });         
    }
}

// Functions which will be available to external callers
exports.write = write;

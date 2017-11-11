'use strict';

const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));

function prepareRedis() {
    return new Promise((resolve, reject) => {
        const client = redis.createClient();

        client.on("ready", function () {
            resolve(client);
        });

        /* istanbul ignore next */
        client.on("error", function (err) {
            reject(err);
        });
    })
}

function teardownRedis(client) {
    client.quit();
}

module.exports = {
    prepare: prepareRedis,
    teardown: teardownRedis
};

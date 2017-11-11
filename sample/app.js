"use strict";

// app.js for sample.
// Copyright (c) 2017 hirowaki https://github.com/hirowaki

const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs");
const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));
const bodyParser = require('body-parser');

const controller = require('./controller');
const service = require('./service');

// using body parser.
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// setting up the views folder.
app.set('views', path.join(__dirname, 'views'));

// using ejs. I like it.
app.engine('ejs',ejs.renderFile);

// register controller.
controller.register(app);

let redisCli = null;

function prepareRedis() {
    // prepare redis.
    return new Promise((resolve, reject) => {
        redisCli = redis.createClient();

        redisCli.on("ready", function () {
            /* eslint-disable no-console */
            console.log("redis client got ready to go!");
            /* eslint-enable no-console */
            resolve();
        });
        redisCli.on("error", function (err) {
            reject(err);
        });
    });
}

function initializeService() {
    return service.initialize(redisCli);
}

function startListening() {
    // start listening.
    return new Promise((resolve, reject) => {
        try {
            const server = app.listen(8080, function () {
                /* eslint-disable no-console */
                console.log("server is listening to PORT:" + server.address().port);
                /* eslint-enable no-console */
                resolve();
            });
        }
        catch(err) {
            reject(err);
        }
    });
}

prepareRedis()
.then(() => {
    // initialize leaderboard service..
    return initializeService();
})
.then(() => {
    return startListening();
});

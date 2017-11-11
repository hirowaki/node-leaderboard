"use strict";

// Copyright (c) 2017 hirowaki https://github.com/hirowaki

const Promise = require('bluebird');
const Leaderboard = require('../index').LeaderboardScoreDesc;

const pageSize = 10;

class LeaderboardService {
    static initialize(redis) {
        return Leaderboard.create(redis, "lbTest")
        .then((_lb) => {
            this._instance = _lb;
            this._nameSeed = 1;

            return this._instance.clear()
            .then(() => {
                // At first, insert 10 * pageSize users to the board.
                return this.insertRandom(pageSize * 10);
            });
        });
    }

    static clear() {
        return this._instance.clear();
    }

    static insertRandom(num) {
        const promises = [];
        for (let i = 0; i < num; ++i) {
            const name = 'player' + LeaderboardService._nameSeed++;
            const score = (Math.random() * 1000 | 0);

            promises.push(this._instance.setScore(name, score));
        }
        return Promise.all(promises);
    }

    static getList(page) {
        return this._instance.getList(page, pageSize);
    }

    static remove(name) {
        return this._instance.remove(name);
    }

    static modifyScore(name, delta) {
        return this._instance.modifyScore(name, delta);
    }
}

// static fields.
LeaderboardService._instance = null;
LeaderboardService._nameSeed = 1;

module.exports = LeaderboardService;

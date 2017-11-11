"use strict";

// Copyright (c) 2017 hirowaki https://github.com/hirowaki

const _ = require('lodash');
const Promise = require('bluebird');
const lured = require('lured');

/**
 * base class for Leaderboard.
 * @description You have to extends and override onGetLuaScripts function .
 */
class LeaderboardBase {
    /**
     * Create leaderboard. This is a static factory method.
     * @public
     * @param {Object} redis - the instance of redis client
     * @param {string} lbname - leaderborad name. Would be used as a redis key.
     * @return {Promise<Object>} - leaderboard instance.
     */
    static create(redis, lbname) {
        const Ctor = this;

        const board = new Ctor;
        board._redis = redis;
        board._lbname = lbname;  // database name.

        return board._registerScript()
        .then(() => {
            return board;
        });
    }

    /**
     * Get redis client.
     * @public
     * @return {Object} redis-client.
     * @description getter for _redis.
     */
    get redis() {
        return this._redis;
    }

    /**
     * Get leaderboard name.
     * @public
     * @return {string} leaderboard name.
     * @description getter for _lbname.
     */
    get lbname() {
        return this._lbname;
    }

    /**
     * Get scripts information.
     * @public
     * @return {Object} scripts
     * @description getter for _scripts. Generally only private functions would care of this.
     */
    get scripts() {
        return this._scripts;
    }

    /**
     * onGetLuaScripts callback.
     * @protected
     * @return {Object} script object.
     * @description You have to override this function. The default implementation will throw an exception.
     * The return value should be like this.
     * ```
     * {
     *     "lb_score_rank": {
     *         script: lua script in UTF8 string.
     *     },
     *     "lb_rank": {
     *         script: lua script in UTF8 string.
     *     },
     *     "lb_pos": {
     *         script: lua script in UTF8 string.
     *     },
     *     "lb_range": {
     *         script: lua script in UTF8 string.
     *     }
     * }
     * ```
     * See static fields, too.
     * ```
     * LeaderboardBase.lua = {
     *     getScoreRank: "lb_score_rank",
     *     getRank: "lb_rank",
     *     getPosition: "lb_pos",
     *     getRange: "lb_range"
     * };
     * ```
     */
    onGetLuaScripts() {
        throw new Error("Please override this function.");
    }

    /**
     * _scriptSHA.
     * @private
     * @param {string} tag - _scripts.key
     * @return {string} sha string to determine which lua script we'll run.
     */
    _scriptSHA(tag) {
        const script = this.scripts[tag];
        if (!script || !script.sha) {
            return null;
        }
        return script.sha;
    }

    /**
     * _registerScript.
     * @private
     * @return {Promise}
     */
    _registerScript() {
        return Promise.resolve()
        .then(() => {
            this._scripts = this.onGetLuaScripts();

            const _lured = lured.create(this.redis, this.scripts);
            return Promise.promisify(_lured.load).call(_lured);
        })
        .catch((err) => {
            return Promise.reject(err);
        });
    }

    /**
     * _clear.
     * @private
     * @return {Promise}
     */
    _clear() {
        return this.redis.delAsync(this.lbname);
    }

    /**
     * _count.
     * @private
     * @return {Promise}
     */
    _count() {
        return this.redis.zcardAsync(this.lbname);
    }

    /**
     * _remove.
     * @private
     * @param {string} name - player name
     * @return {Promise}
     */
    _remove(name) {
        return this.redis.zremAsync(this.lbname, name);
    }

    /**
     * _setScore.
     * @private
     * @param {string} name - player name
     * @param {number} score - score
     * @return {Promise}
     */
    _setScore(name, score) {
        return this.redis.zaddAsync(this.lbname, score, name);
    }

    /**
     * _modifyScore.
     * @private
     * @param {string} name - player name
     * @param {number} delta - delta to modify the score
     * @return {Promise}
     */
    _modifyScore(name, delta) {
        return this.redis.zincrbyAsync(this.lbname, delta, name);
    }

    /**
     * _getPosition.
     * @private
     * @param {string} name - player name
     * @return {Promise<number>} - rank
     */
    _getPosition(name) {
        const luaSha = this._scriptSHA(LeaderboardBase.lua.getPosition);

        return this.redis.evalshaAsync(luaSha, 1, this.lbname, name)
        .then((rank) => {
            if (typeof rank === 'number') {
                return rank;    // 0 origin.
            }
            return null;
        });
    }

    /**
     * _getScoreAndRank.
     * @private
     * @param {string} name - player name
     * @return {Promise<Array>} - [score, rank]
     */
    _getScoreAndRank(name) {
        const luaSha = this._scriptSHA(LeaderboardBase.lua.getScoreRank);

        return this.redis.evalshaAsync(luaSha, 1, this.lbname, name)
        .then((res) => {
            if (res[0]) {
                return [
                    parseInt(res[0], 10),
                    res[1] + 1
                ];
            }
            return null;
        });
    }

    /**
     * _getScoreAndRank.
     * @private
     * @param {number} score - player name
     * @return {Promise<number>} - rank
     */
    _getRankFromScore(score) {
        const luaSha = this._scriptSHA(LeaderboardBase.lua.getRank);

        return this.redis.evalshaAsync(luaSha, 1, this.lbname, score)
        .then((count) => {
            return count + 1;
        });
    }

    /**
     * _getRange. Query players between (start <= players <= end).
     * @private
     * @param {number} start
     * @param {number} end
     * @return {Promise<Array>} - e.g.) [ 'Michael', '300', 'Bryan', '250', 'Scott', '200']
     */
    _getRange(start, end) {
        const luaSha = this._scriptSHA(LeaderboardBase.lua.getRange);

        // the result would be like
        // [ 'Michael', '300', 'Bryan', '250', 'Scott', '200', 'Eric', '150', 'John', '100' ].
        return this.redis.evalshaAsync(luaSha, 1, this.lbname, start, end)
        .then((res) => {
            return {
                range: res
            };
        });
    }

    /**
     * _getRange. Query players between (start <= players <= end) and total numbers of players in the board.
     * @private
     * @param {number} start
     * @param {number} end
     * @return {Promise<Object>} - e.g.) {total: number, range: Array['Michael', '300', 'Bryan', '250, ...]}
     */
    _getRangeAndTotal(start, end) {
        const luaSha = this._scriptSHA(LeaderboardBase.lua.getRange);

        return this.redis.multi()
        .zcard(this.lbname)
        .evalsha(luaSha, 1, this.lbname, start, end)
        .execAsync()
        .then((res) => {
            return {
                total: res[0],
                range: res[1]
            };
        });
    }

    /**
     * _rangeToList.
     * @private
     * @param {Array} range - [ 'Michael', '300', 'Jon', '100']
     * @return {Promise<Array>} - e.g.)[{name: "Michael", score: 300, rank: 1}, {name: "Jon", score: 100, rank: 2}]
     */
    _rangeToList(range) {
        // the range would be like
        // [ 'Michael', '300', 'Bryan', '250', 'Scott', '200', 'Eric', '150', 'John', '100' ].
        // let's group by like
        // [ ['Michael', 300], ['Bryan', 250], ['Scott', 200], ['Eric', 150], ['John', 100] ].

        // 1. groupBy by couples.
        //  (make sure lodash.groupBy had a major change in v4.0).
        //  https://github.com/lodash/lodash/issues/2238
        // 2. make it array.
        // 3. mapping score to integer.

        let index = 0;
        const obj = _.groupBy(range, (_) => {
            void(_);
            return index++ >> 1;
        });
        range = _.toArray(obj).map((e) => {
            return [e[0], +e[1]];
        });

        // settle rankings.
        return this._settleRank(range)
        .then((ranks) => {
            // zipping range and rank.
            const zipped = _.zipWith(range, ranks, (range, rank) => {
                return {
                    name: range[0],
                    score: range[1],
                    rank: rank
                };
            });

            // re-order.
            return _.orderBy(zipped, ['rank', 'name'], ['asc', 'asc']);
        })
    }

    /**
     * _settleRank.
     * @private
     * @param {Array} data - [ ['Michael', 300], ['Bryan', 250], ['Scott', 200], ...]
     * @return {Promise<Array>} - rank arrays. e.g.)[1, 2, 3...]
     */
    _settleRank(data) {
        let score = null;
        let counter = null;
        let attempt = 0;

        const res = [];
        return data.reduce((p, e) => {
            return p.then(() => {
                const _score = e[1];
                // same score. Then let's just push the same one before.
                if (_score === score) {
                    res.push(_.last(res));
                    if (counter !== null) {
                        ++counter;
                    }
                    return res;
                }

                score = _score;

                // if local counter has valid number,
                // then we can use it instead of hitting redis.
                if (counter !== null) {
                    res.push(++counter);
                    return res;
                }

                return this._getRankFromScore(_score)
                .then((rank) => {
                    res.push(rank);
                    if (++attempt >= 2) {
                        // after second attempt to hit redis,
                        // we can now using local counter to fix the rank.
                        counter = rank;
                    }
                    return res;
                });
            });
        }, Promise.resolve());
    }

    /**
     * clear.
     * @pubilc
     * @return {Promise}
     */
    clear() {
        return this._clear();
    }

    /**
     * count.
     * @pubilc
     * @return {Promise}
     */
    count() {
        return this._count();
    }

    /**
     * remove.
     * @public
     * @param {string} name - player name
     * @return {Promise}
     */
    remove(name) {
        return this._remove(name);
    }

    /**
     * setScore.
     * @public
     * @param {string} name - player name
     * @param {number} score - score
     * @return {Promise}
     */
    setScore(name, score) {
        return this._setScore(name, score);
    }

    /**
     * modifyScore.
     * @public
     * @param {string} name - player name
     * @param {number} delta - delta to modify the score
     * @return {Promise}
     */
    modifyScore(name, delta) {
        return this._modifyScore(name, delta);
    }

    /**
     * getScoreAndRank.
     * @public
     * @param {number} score - player name
     * @return {Promise<Object>} - ```return Promise({Object. see above description});```
     * @description - getScoreAndRank will provide you name's score and rank.
     * - The result would be an object contains
     *    ```
     *    {
     *        name: string,
     *        score: number,
     *        rank number
     *    }
     *    ```
     */
    getScoreAndRank(name) {
        return this._getScoreAndRank(name)
        .then((data) => {
            if (data === null) {
                return null;
            }
            return {
                name: name,
                score: data[0],
                rank: data[1]
            }
        });
    }

    /**
     * getNeighbors.
     * @public
     * @param {string} name - player name
     * @param {number} count - player counts to be picked.
     * @return {Promise<Object>} - ```return Promise({Object. see above description});```
     * @description - getNeighbors will pick up players (name's rank - count <= players <= name's rank + count).
     * - The result would be an object contains
     *    ```
     *    {
     *        list: [
     *            {name: string, score: number, rank: number},
     *            {name: string, score: number, rank: number},
     *            {name: string, score: number, rank: number},
     *            ...,
     *        ]
     *    }
     *    ```
     */
    getNeighbors(name, count) {
        return this._getPosition(name)
        .then((rank) => {
            if (rank === null) {
                return [];
            }
            // private._getPosition gives us a 0-origin rank.

            let start = rank - count;
            let end = rank + count;
            // revise.
            if (start < 0) {
                start = 0;
                end = count << 1;
            }

            return this._getRange(start, end)
            .then((res) => {
                return this._rangeToList(res.range);
            });
        })
        .then((res) => {
            return {
                list: res
            }
        })
    }

    /**
     * getList.
     * @public
     * @param {number} number - page index starting from 1.
     * @param {number} size - page size. The numbers of players in a page.
     * @return {Promise<Object>} - ```return Promise({Object. see above description});```
     * @description - You can get the list by using this function.
     * - The result would be an object contains
     *    ```
     *    {
     *        page: page number starting from 1.
     *        maxPage: max page number.
     *        total: total player numbers in the board.
     *        list: [
     *            {name: string, score: number, rank: number},
     *            {name: string, score: number, rank: number},
     *            {name: string, score: number, rank: number},
     *            ...,
     *        ]
     *    }
     *    ```
     */
    getList(number, size) {
        number = Math.max(0, number - 1);
        size = Math.max(size, 1);

        const start = size * number;
        const end = start + size - 1;

        return this._getRangeAndTotal(start, end)
        .then((res) => {
            return this._rangeToList(res.range)
            .then((list) => {
                return {
                    page: parseInt(number) + 1,
                    maxPage: Math.ceil(res.total / size),
                    total: res.total,
                    list: list
                };
            });
        });
    }
}

// static field.
LeaderboardBase.lua = {
    getScoreRank: "lb_score_rank",
    getRank: "lb_rank",
    getPosition: "lb_pos",
    getRange: "lb_range"
};


module.exports = LeaderboardBase;

'use strict';

const assert = require('assert');
const Promise = require('bluebird');
const sinon = require('sinon');
const PrepareRedis = require('./prepareRedis');

// in this test let's using LeaderboardScoreDesc.
const Leaderboard = require('../index').LeaderboardScoreDesc;

describe('LeaderboardScoreDesc', function () {
    let redis, sandbox;

    before(function () {
        sandbox = sinon.sandbox.create();

        return PrepareRedis.prepare()
        .then((_redis) => {
            redis = _redis;
        });
    });

    after(function () {
        PrepareRedis.teardown(redis);
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('test scenario running.', function () {
        let lb;

        before(function () {
            return Leaderboard.create(redis, "lbTest")
            .then((_lb) => {
                lb = _lb;
            })
        });

        after(function () {
            return lb.clear()
            .then(() => {
                return redis.flushdbAsync();
            });
        });

        beforeEach(function () {
            // setup.
            // 1. Michael 300 pts.
            // 2. Bryan 250 pts.
            // 3. Scott 200 pts.
            // 4. Eric 150 pts.
            // 5. John 100 pts.

            return Promise.all([
                lb.setScore("John", 100),
                lb.setScore("Michael", 300),
                lb.setScore("Scott", 200),
                lb.setScore("Eric", 150),
                lb.setScore("Bryan", 250)
            ]);
        });

        afterEach(function () {
            return lb.clear()
        });

        describe('getScoreAndRank.', function () {
            it('make sure it works as we designed.', function () {
                const spyCallBack = sandbox.spy(lb, "_getScoreAndRank");

                return Promise.resolve()
                .then(() => {
                    return lb.getScoreAndRank("Scott")
                    .then((res) => {
                        assert.strictEqual(spyCallBack.callCount, 1);
                        assert.strictEqual(spyCallBack.args[0].length, 1);
                        assert.strictEqual(spyCallBack.args[0][0], "Scott");

                        assert.deepEqual(res, { name: 'Scott', score: 200, rank: 3 });
                    })
                })
                .then(() => {
                    return lb.getScoreAndRank("Michael")
                    .then((res) => {
                        assert.strictEqual(spyCallBack.callCount, 2);
                        assert.strictEqual(spyCallBack.args[1].length, 1);
                        assert.strictEqual(spyCallBack.args[1][0], "Michael");

                        assert.deepEqual(res, { name: 'Michael', score: 300, rank: 1 });
                    });
                })
                .then(() => {
                    // Adam is not in yet.
                    return lb.getScoreAndRank("Adam")
                    .then((res) => {
                        assert.strictEqual(spyCallBack.callCount, 3);
                        assert.strictEqual(spyCallBack.args[2].length, 1);
                        assert.strictEqual(spyCallBack.args[2][0], "Adam");

                        assert.strictEqual(res, null);
                    });
                });
            });
        });

        describe('getNeighbors.', function () {
            it('make sure it works as we designed.', function () {
                const spyGetPosition = sandbox.spy(lb, "_getPosition");
                const spyGetRange = sandbox.spy(lb, "_getRange");

                return lb.getNeighbors("Scott", 2)
                .then((res) => {
                    assert.strictEqual(spyGetPosition.callCount, 1);
                    assert.strictEqual(spyGetPosition.args[0].length, 1);
                    assert.strictEqual(spyGetPosition.args[0][0], "Scott");

                    assert.strictEqual(spyGetRange.callCount, 1);
                    assert.strictEqual(spyGetRange.args[0].length, 2);
                    assert.strictEqual(spyGetRange.args[0][0], 0);
                    assert.strictEqual(spyGetRange.args[0][1], 4);

                    assert.deepEqual(res, {
                        list: [
                            { name: 'Michael', score: 300, rank: 1 },
                            { name: 'Bryan', score: 250, rank: 2 },
                            { name: 'Scott', score: 200, rank: 3 },
                            { name: 'Eric', score: 150, rank: 4 },
                            { name: 'John', score: 100, rank: 5 }
                        ]
                    });
                });
            });

            it('make sure it works as we designed. case clipped.', function () {
                const spyGetPosition = sandbox.spy(lb, "_getPosition");
                const spyGetRange = sandbox.spy(lb, "_getRange");

                return lb.getNeighbors("Michael", 1)
                .then((res) => {
                    assert.strictEqual(spyGetPosition.callCount, 1);
                    assert.strictEqual(spyGetPosition.args[0].length, 1);
                    assert.strictEqual(spyGetPosition.args[0][0], "Michael");

                    assert.strictEqual(spyGetRange.callCount, 1);
                    assert.strictEqual(spyGetRange.args[0].length, 2);
                    assert.strictEqual(spyGetRange.args[0][0], 0);
                    assert.strictEqual(spyGetRange.args[0][1], 2);

                    assert.deepEqual(res, {
                        list: [
                            {name: 'Michael', score: 300, rank: 1},
                            {name: 'Bryan', score: 250, rank: 2},
                            {name: 'Scott', score: 200, rank: 3}
                        ]
                    });
                });
            });

            it('make sure it works as we designed. case no such name in the list.', function () {
                const spyGetPosition = sandbox.spy(lb, "_getPosition");
                const spyGetRange = sandbox.spy(lb, "_getRange");

                // no Chris in the list.
                return lb.getNeighbors("Chris", 1)
                .then((res) => {
                    assert.strictEqual(spyGetPosition.callCount, 1);
                    assert.strictEqual(spyGetPosition.args[0].length, 1);
                    assert.strictEqual(spyGetPosition.args[0][0], "Chris");

                    assert.strictEqual(spyGetRange.callCount, 0);

                    assert.deepEqual(res.list, []);  // empty list.
                });
            });
        });

        describe('getList.', function () {
            it('make sure it works as we designed.', function () {
                const spyGetRange = sandbox.spy(lb, "_getRangeAndTotal");

                // get the first page when 5 names in each.
                return lb.getList(1, 5)
                .then((res) => {
                    assert.strictEqual(spyGetRange.callCount, 1);
                    assert.strictEqual(spyGetRange.args[0].length, 2);
                    assert.strictEqual(spyGetRange.args[0][0], 0);
                    assert.strictEqual(spyGetRange.args[0][1], 4);

                    assert.deepEqual(res, {
                        page: 1,
                        maxPage: 1,
                        total: 5,
                        list: [
                            { name: 'Michael', score: 300, rank: 1 },
                            { name: 'Bryan', score: 250, rank: 2 },
                            { name: 'Scott', score: 200, rank: 3 },
                            { name: 'Eric', score: 150, rank: 4 },
                            { name: 'John', score: 100, rank: 5 }
                        ]
                    });
                });
            });

            it('make sure it works as we designed. case clipped.', function () {
                const spyGetRange = sandbox.spy(lb, "_getRangeAndTotal");

                // get the first page when 3 names in each.
                return lb.getList(1, 3)
                .then((res) => {
                    assert.strictEqual(spyGetRange.callCount, 1);
                    assert.strictEqual(spyGetRange.args[0].length, 2);
                    assert.strictEqual(spyGetRange.args[0][0], 0);
                    assert.strictEqual(spyGetRange.args[0][1], 2);

                    assert.deepEqual(res, {
                        page: 1,
                        maxPage: 2,
                        total: 5,
                        list: [
                            {name: 'Michael', score: 300, rank: 1},
                            {name: 'Bryan', score: 250, rank: 2},
                            {name: 'Scott', score: 200, rank: 3}
                        ]
                    });
                });
            });

            it('make sure it works as we designed. case no such name in the list.', function () {
                const spyGetRange = sandbox.spy(lb, "_getRangeAndTotal");

                // get the third page when 3 names in each.
                // since total names are only 5m result would be empty.
                return lb.getList(3, 3)
                .then((res) => {
                    assert.strictEqual(spyGetRange.callCount, 1);
                    assert.strictEqual(spyGetRange.args[0].length, 2);
                    assert.strictEqual(spyGetRange.args[0][0], 6);
                    assert.strictEqual(spyGetRange.args[0][1], 8);

                    assert.deepEqual(res, {
                        page: 3,
                        maxPage: 2,
                        total: 5,
                        list: []
                    });
                });
            });
        });
    });
});

'use strict';

const assert = require('assert');
const Promise = require('bluebird');
const fs = require('fs');
const sinon = require('sinon');
const lured = require('lured');
const PrepareRedis = require('./prepareRedis');
const LeaderboardBase = require('../index').LeaderboardBase;

describe('LeaderboardBase', function () {
    let redis, sandbox;

    before(function () {
        sandbox = sinon.sandbox.create();

        return PrepareRedis.prepare()
        .then((_redis) => {
            redis = _redis;
        });
    });

    after(function () {
        // teardown.
        PrepareRedis.teardown(redis);
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('Exception should have thrown when the leaderboard does not have onGetLuaScripts overridden.', function () {
        it('test it!.', function () {
            return LeaderboardBase.create(redis, "lbTest")
            .then(() => {
                assert.ok(false);   // should not come here.
            })
            .catch((err) => {
                assert.ok(true);    // should come here!
                assert.strictEqual(err.message, "Please override this function.");
            });
        });
    });

    describe('unit tests using TestLeaderboard.', function () {
        // TestLeaderboard class for testing.
        class TestLeaderboard extends LeaderboardBase {
            onGetLuaScripts() {
                function __readScript(filename) {
                    return fs.readFileSync(__dirname + '/../lib/scripts' + filename, 'utf8')
                }

                const scripts = {};
                scripts[LeaderboardBase.lua.getScoreRank] = {script: __readScript('/desc/getScoreRank.lua') };
                scripts[LeaderboardBase.lua.getRank] = {script: __readScript('/desc/getRank.lua') };
                scripts[LeaderboardBase.lua.getPosition] = {script: __readScript('/desc/getPosition.lua') };
                scripts[LeaderboardBase.lua.getRange] = {script: __readScript('/desc/getRange.lua') };

                return scripts;
            }
        }

        describe('factory.', function () {
            it('create.', function () {
                const spyRegister = sandbox.stub(TestLeaderboard.prototype, '_registerScript');
                spyRegister.callsFake(function () {
                    return Promise.resolve();
                });

                return TestLeaderboard.create(redis, "TEST")
                .then((instance) => {
                    assert.ok(instance instanceof TestLeaderboard);

                    assert.strictEqual(instance._redis, redis);
                    assert.strictEqual(instance._lbname,  "TEST");

                    assert.strictEqual(spyRegister.callCount, 1);
                });
            });
        });

        describe('lua scipt upload framework.', function () {
            let lb;

            before(function () {
                return TestLeaderboard.create(redis, "lbTest")
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

            describe('scripts on redis.', function () {
                it('_scriptSHA.', function () {
                    assert.strictEqual(lb._scriptSHA('lb_rank'), lb._scripts.lb_rank.sha);

                    assert.strictEqual(lb._scriptSHA('TEST'), null);
                });

                it('_registerScript.', function () {
                    const spyScripts = sandbox.stub(lb, 'onGetLuaScripts');
                    spyScripts.callsFake(function () {
                        return {
                            test: {
                                script: "ABCDEFG"
                            }
                        };
                    });

                    let loadCalled = 0;
                    const spyLured = sandbox.stub(lured, 'create');
                    spyLured.callsFake(function () {
                        return {
                            load: function (cb) {
                                ++loadCalled;
                                cb(null);
                            }
                        }
                    });

                    return lb._registerScript()
                    .then(() => {
                        assert.strictEqual(spyScripts.callCount, 1);
                        assert.strictEqual(spyLured.callCount, 1);
                        assert.strictEqual(spyLured.args[0].length, 2);
                        assert.strictEqual(spyLured.args[0][0], lb._redis);
                        assert.strictEqual(spyLured.args[0][1], lb._scripts);
                        assert.strictEqual(loadCalled, 1);

                        assert.deepEqual(lb._scripts, {
                            test: {
                                script: "ABCDEFG"
                            }
                        });
                    });
                });
            });
        });

        describe('unit tests / functions.', function () {
            let lb;

            before(function () {
                return TestLeaderboard.create(redis, "lbTest")
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

            describe('unit tests / protected functions.', function () {
                describe('_clear.', function () {
                    it('make sure it works fine.', function () {
                        return lb._clear()
                        .then(() => {
                            // nobody in already.
                            return lb._count()
                            .then((count) => {
                                assert.strictEqual(count, 0);
                            });
                        });
                    });
                });

                describe('_count.', function () {
                    it('make sure it works fine.', function () {
                        return lb._count()
                        .then((count) => {
                            assert.strictEqual(count, 5);
                        });
                    });
                });

                describe('_remove.', function () {
                    it('make sure it works fine.', function () {
                        return lb._remove("Michael")
                        .then(() => {
                            return lb._count()
                            .then((count) => {
                                assert.strictEqual(count, 4);

                                return lb._getPosition("Michael")
                            })
                            .then((res) => {
                                // make sure Michael has gone.
                                assert.strictEqual(res, null);
                            });
                        });
                    });
                });

                describe('_setScore.', function () {
                    it('make sure the score properly set.', function () {
                        return Promise.resolve()
                        .then(() => {
                            return lb._setScore("Adam", 50)
                            .then(() => {
                                return lb._getScoreAndRank("Adam")
                            })
                            .then((res) => {
                                assert.strictEqual(res[0], 50);

                                return lb._count();
                            })
                            .then((count) => {
                                assert.strictEqual(count, 6);
                            });
                        })
                        .then(() => {
                            return lb._setScore("Adam", 80)
                            .then(() => {
                                return lb._getScoreAndRank("Adam");
                            })
                            .then((res) => {
                                assert.strictEqual(res[0], 80);

                                return lb._count();
                            })
                            .then((count) => {
                                assert.strictEqual(count, 6);
                            });
                        });
                    });
                });

                describe('_modifyScore.', function () {
                    it('case delta positive.', function () {
                        return lb._modifyScore("Michael", 50)
                        .then(() => {
                            return lb._getScoreAndRank("Michael")
                            .then((res) => {
                                assert.strictEqual(res[0], 350);
                            });
                        });
                    });

                    it('case delta negative.', function () {
                        return lb._modifyScore("Michael", -50)
                        .then(() => {
                            return lb._getScoreAndRank("Michael")
                            .then((res) => {
                                assert.strictEqual(res[0], 250);
                            });
                        });
                    });
                });

                describe('_getPosition.', function () {
                    it('make sure it works fine.', function () {
                        return Promise.all([
                            lb._getPosition("John"),
                            lb._getPosition("Michael"),
                            lb._getPosition("Scott"),
                            lb._getPosition("Eric"),
                            lb._getPosition("Bryan"),
                            lb._getPosition("Jason")     // no Jason in the leaderboard yet.
                        ])
                        .then((res) => {
                            // 1. Michael 300 pts.
                            // 2. Bryan 250 pts.
                            // 3. Scott 200 pts.
                            // 4. Eric 150 pts.
                            // 5. John 100 pts.
                            // null . Jason not in the leaderboard.

                            // position here means just an index. 0 origin.
                            assert.deepEqual(res, [4, 0, 2, 3, 1, null]);
                        });
                    });
                });

                describe('_getScoreAndRank.', function () {
                    it('make sure it works fine.', function () {
                        return Promise.all([
                            lb._getScoreAndRank("John"),
                            lb._getScoreAndRank("Michael"),
                            lb._getScoreAndRank("Scott"),
                            lb._getScoreAndRank("Eric"),
                            lb._getScoreAndRank("Bryan"),
                            lb._getScoreAndRank("Jason")     // no Jason in the leaderboard yet.
                        ])
                        .then((res) => {
                            assert.deepEqual(res, [
                                [ 100, 5 ], // John
                                [ 300, 1 ], // Michael
                                [ 200, 3 ], // Scott
                                [ 150, 4 ], // Eric
                                [ 250, 2 ], // Bryan
                                null    // no Jason in the leaderboard yet.
                            ]);
                        });
                    });
                });

                describe('_getRankFromScore.', function () {
                    it('make sure it works fine.', function () {
                        return Promise.resolve()
                        .then(() => {
                            return lb._getRankFromScore(200)
                            .then((rank) => {
                                assert.strictEqual(rank, 3);
                            });
                        })
                        .then(() => {
                            return lb._getRankFromScore(300)
                            .then((rank) => {
                                assert.strictEqual(rank, 1);
                            });
                        });
                    });
                });

                describe('_getRange.', function () {
                    it('make sure it works as we expected.', function () {
                        return lb._getRange(0, 4)
                        .then((res) => {
                            assert.deepEqual(res, {
                                range: [
                                    "Michael", 300,
                                    "Bryan", 250,
                                    "Scott", 200,
                                    "Eric", 150,
                                    "John", 100
                                ]
                            });
                        });
                    });

                    it('make sure it works as we expected. clipped.', function () {
                        return lb._getRange(3, 10)
                        .then((res) => {
                            // 2 to 10 would be clipped to 3 to 4.
                            assert.deepEqual(res, {
                                range: [
                                    "Eric", 150,
                                    "John", 100
                                ]
                            });
                        });
                    });

                    it('make sure it works as we expected. case out of range.', function () {
                        return lb._getRange(10, 10)
                        .then((res) => {
                            // 10 to 10. only 5 users in the list.
                            // the result should be an empty array.
                            assert.deepEqual(res, {
                                range: []
                            });
                        });
                    });
                });

                describe('_getRangeAndTotal.', function () {
                    it('make sure it works as we expected.', function () {
                        return lb._getRangeAndTotal(0, 2)
                        .then((res) => {
                            assert.deepEqual(res, {
                                total: 5,
                                range: [
                                    "Michael" , 300,
                                    "Bryan", 250,
                                    "Scott", 200
                                ]
                            });
                        });
                    });

                    it('make sure it works as we expected. case out of the range.', function () {
                        // There are only 5 entries in the list now.
                        // When we try to query the third page (2/2, 0-origin, 5 entries each),
                        // we would not list up anybody.
                        return lb._getRangeAndTotal(10, 5)
                        .then((res) => {
                            assert.deepEqual(res, {
                                total: 5,
                                range: []
                            });
                        });
                    });
                });

                describe('_settleRank.', function () {
                    it('make sure it works as we expected.', function () {
                        return lb._settleRank([
                            ["Michael", 300],
                            ["Bryan", 250],
                            ["Scott", 200],
                            ["Eric", 150],
                            ["John", 100]
                        ])
                        .then((res) => {
                            assert.deepEqual(res, [
                                1, 2, 3, 4, 5
                            ]);
                        });
                    });

                    it('case a couple of people in the same place.', function () {
                        return Promise.all([
                            lb.setScore("Michael", 300),
                            lb.setScore("John", 200),
                            lb.setScore("Scott", 200),
                            lb.setScore("Eric", 200),
                            lb.setScore("Bryan", 100)
                        ])
                        .then(() => {
                            return lb._settleRank([
                                ["Michael", 300],
                                ["John", 200],
                                ["Scott", 200],
                                ["Eric", 100],
                                ["Bryan", 100]
                            ])
                            .then((res) => {
                                assert.deepEqual(res, [
                                    1, 2, 2, 4, 4
                                ]);
                            });
                        });
                    });

                    it('case a couple of people in the same place.', function () {
                        return Promise.all([
                            lb.setScore("Michael", 300),
                            lb.setScore("John", 300),
                            lb.setScore("Scott", 300),
                            lb.setScore("Eric", 200),
                            lb.setScore("Bryan", 100)
                        ])
                        .then(() => {
                            return lb._settleRank([
                                ["Michael", 300],
                                ["John", 300],
                                ["Scott", 300],
                                ["Eric", 200],
                                ["Bryan", 100]
                            ])
                            .then((res) => {
                                assert.deepEqual(res, [
                                    1, 1, 1, 4, 5
                                ]);
                            });
                        });
                    });
                });
            });

            describe('public functions.', function () {
                describe('clear.', function () {
                    it('make sure it works as we designed.', function () {
                        const spyPrivate = sandbox.spy(lb, "_clear");

                        return lb.count()
                        .then((count) => {
                            assert.strictEqual(count, 5);
                        })
                        .then(() => {
                            return lb.clear();
                        })
                        .then(() => {
                            // make sure the private function was surely called.
                            assert.strictEqual(spyPrivate.callCount, 1);
                            // there should have been no arguments.
                            assert.strictEqual(spyPrivate.args[0].length, 0);

                            // nobody in already.
                            return lb.count()
                            .then((count) => {
                                assert.strictEqual(count, 0);
                            });
                        });
                    });
                });

                describe('count.', function () {
                    it('make sure it works as we designed.', function () {
                        const spyPrivate = sandbox.spy(lb, "_count");

                        return lb.count()
                        .then((count) => {
                            // make sure the private function was surely called.
                            assert.strictEqual(spyPrivate.callCount, 1);
                            // there should have been no arguments.
                            assert.strictEqual(spyPrivate.args[0].length, 0);

                            assert.strictEqual(count, 5);
                        });
                    });
                });

                describe('remove.', function () {
                    it('make sure it works as we designed.', function () {
                        const spyPrivate = sandbox.spy(lb, "_remove");

                        return lb.remove("Michael")
                        .then(() => {
                            // make sure the private function was surely called.
                            assert.strictEqual(spyPrivate.callCount, 1);
                            assert.strictEqual(spyPrivate.args[0].length, 1);
                            assert.strictEqual(spyPrivate.args[0][0], "Michael");

                            return lb.count()
                            .then((count) => {
                                assert.strictEqual(count, 4);
                            });
                        });
                    });
                });

                describe('setScore.', function () {
                    it('make sure it works as we designed.', function () {
                        const spyPrivate = sandbox.spy(lb, "_setScore");

                        return Promise.resolve()
                        .then(() => {
                            // Let's make Scott No.1.
                            return lb.setScore("Scott", 500)
                            .then(() => {
                                assert.strictEqual(spyPrivate.callCount, 1);
                                assert.strictEqual(spyPrivate.args[0].length, 2);
                                assert.strictEqual(spyPrivate.args[0][0], "Scott");
                                assert.strictEqual(spyPrivate.args[0][1], 500);

                                return lb.getScoreAndRank("Scott")
                                .then((res) => {
                                    assert.deepEqual(res, { name: 'Scott', score: 500, rank: 1 });
                                });
                            });
                        })
                        .then(() => {
                            // Then let's demote Scott to the 5th place...
                            return lb.setScore("Scott", 50)
                            .then(() => {
                                assert.strictEqual(spyPrivate.callCount, 2);
                                assert.strictEqual(spyPrivate.args[1].length, 2);
                                assert.strictEqual(spyPrivate.args[1][0], "Scott");
                                assert.strictEqual(spyPrivate.args[1][1], 50);

                                return lb.getScoreAndRank("Scott")
                                .then((res) => {
                                    assert.deepEqual(res, { name: 'Scott', score: 50, rank: 5 });
                                });
                            });
                        });
                    });
                });

                describe('modifyScore.', function () {
                    it('make sure it works as we designed.', function () {
                        const spyPrivate = sandbox.spy(lb, "_modifyScore");

                        return Promise.resolve()
                        .then(() => {
                            // Let's make Scott No.1. (200 + 200 = 400).
                            return lb.modifyScore("Scott", 200)
                            .then(() => {
                                assert.strictEqual(spyPrivate.callCount, 1);
                                assert.strictEqual(spyPrivate.args[0].length, 2);
                                assert.strictEqual(spyPrivate.args[0][0], "Scott");
                                assert.strictEqual(spyPrivate.args[0][1], 200);

                                return lb.getScoreAndRank("Scott")
                                .then((res) => {
                                    assert.deepEqual(res, { name: 'Scott', score: 400, rank: 1 });
                                });
                            });
                        })
                        .then(() => {
                            // Then let's demote Scott to the 5th place...
                            return lb.modifyScore("Scott", -350)
                            .then(() => {
                                assert.strictEqual(spyPrivate.callCount, 2);
                                assert.strictEqual(spyPrivate.args[1].length, 2);
                                assert.strictEqual(spyPrivate.args[1][0], "Scott");
                                assert.strictEqual(spyPrivate.args[1][1], -350);

                                return lb.getScoreAndRank("Scott")
                                .then((res) => {
                                    assert.deepEqual(res, { name: 'Scott', score: 50, rank: 5 });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});

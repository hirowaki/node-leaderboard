"use strict";

// very simple leaderboard using redis.
// Copyright (c) 2017 hirowaki https://github.com/hirowaki

// This leaderboard considers lower score is better ranking.
//
// rank   score
//    1      10
//    2      50
//    3      100
//    4      150

const fs = require('fs');
const LeaderboardBase = require('./leaderboardBase');

/**
 * @extends LeaderboardBase
 * @description
 * - Class Leaderboard which considers less score should be given better rank.
 *
 * | rank | score |
 * | --- | --- |
 * | 1 | 10 |
 * | 2 | 50 |
 * | 3 | 100 |
 * | 4 | 150 |
 *
 */
class LeaderboardScoreAsc extends LeaderboardBase {
    /**
     * onGetLuaScripts callback.
     * @protected
     * @return {Object} script object which considers less score should be given better rank.
     */
    onGetLuaScripts() {
        function __readScript(filename) {
            return fs.readFileSync(__dirname + '/scripts' + filename, 'utf8')
        }

        const scripts = {};
        scripts[LeaderboardBase.lua.getScoreRank] = {script: __readScript('/asc/getScoreRank.lua') };
        scripts[LeaderboardBase.lua.getRank] = {script: __readScript('/asc/getRank.lua') };
        scripts[LeaderboardBase.lua.getPosition] = {script: __readScript('/asc/getPosition.lua') };
        scripts[LeaderboardBase.lua.getRange] = {script: __readScript('/asc/getRange.lua') };

        return scripts;
    }
}

module.exports = LeaderboardScoreAsc;

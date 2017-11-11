"use strict";

// very simple leaderboard using redis.
// Copyright (c) 2017 hirowaki https://github.com/hirowaki

// This leaderboard considers higher score is better ranking.
//
// rank   score
//    1      150
//    2      100
//    3      50
//    4      10

const fs = require('fs');
const LeaderboardBase = require('./leaderboardBase');

/**
 * @extends LeaderboardBase
 * @description
 * - Class Leaderboard which considers bigger score should be given better rank.
 *
 * | rank | score |
 * | --- | --- |
 * | 1 | 150 |
 * | 2 | 100 |
 * | 3 | 50 |
 * | 4 | 10 |
 *
 */
class LeaderboardScoreDesc extends LeaderboardBase {
    /**
     * onGetLuaScripts callback.
     * @protected
     * @return {Object} script object which considers bigger score should be given better rank.
     */
    onGetLuaScripts() {
        function __readScript(filename) {
            return fs.readFileSync(__dirname + '/scripts' + filename, 'utf8')
        }

        const scripts = {};
        scripts[LeaderboardBase.lua.getScoreRank] = {script: __readScript('/desc/getScoreRank.lua') };
        scripts[LeaderboardBase.lua.getRank] = {script: __readScript('/desc/getRank.lua') };
        scripts[LeaderboardBase.lua.getPosition] = {script: __readScript('/desc/getPosition.lua') };
        scripts[LeaderboardBase.lua.getRange] = {script: __readScript('/desc/getRange.lua') };

        return scripts;
    }
}

module.exports = LeaderboardScoreDesc;

"use strict";

// Copyright (c) 2017 hirowaki https://github.com/hirowaki

const LeaderboardService = require('./service');

class LeaderboardController {
    static register(app) {
        app.get('/', this.list);
        app.post("/clear", this.clear);
        app.post("/insert", this.insert);
        app.post("/modify", this.modify);
        app.post("/remove", this.remove);
    }

    static list(req, res) {
        const page = +req.query.page || 1;

        return LeaderboardService.getList(page)
        .then((list) => {
            res.render('index.ejs', {
                page: list.page,
                maxPage: list.maxPage,
                total: list.total,
                list: list.list
            });
        });
    }

    static clear(req, res) {
        void(req);

        return LeaderboardService.clear()
        .then(() => {
            res.json({});
        });
    }

    static insert(req, res) {
        const num = +req.body.num || 1;

        return LeaderboardService.insertRandom(num)
        .then(() => {
            res.json({});
        });
    }

    static remove(req, res) {
        const name = req.body.name || "";

        return LeaderboardService.remove(name)
        .then(() => {
            res.json({});
        })
        .catch(() => {
            res.status(400).send('maybe wrong request.');
        });
    }

    static modify(req, res) {
        const name = req.body.name || "";
        const delta = +req.body.delta || 1;

        return LeaderboardService.modifyScore(name, delta)
        .then(() => {
            res.json({});
        })
        .catch(() => {
            res.status(400).send('maybe wrong request.');
        });
    }
}

module.exports = LeaderboardController;

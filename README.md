# node-leaderboard

[![Build Status](https://travis-ci.org/hirowaki/node-leaderboard.svg?branch=master)](https://travis-ci.org/hirowaki/node-leaderboard)

### Feature
* The **very simple** leaderboard using redis.
* ES6.class using Promise ([bluebird](https://www.npmjs.com/package/bluebird)).
* **LeaderboardScoreDesc**
   * Bigger score presents better rank.


   | rank | name | score |
   | :---:  | :--- | :---: |
   |   1   | Michael | 1000 |
   |   2   | Scott | 900 |
   |   2   | Jason | 900 |
   |   4   | James | 500 |



* **LeaderboardScoreAsc**
   * Smaller score presents better rank.


   | rank | name | score |
   | :---:  | :--- | :---: |
   |   1   | Michael | 500 |
   |   2   | Scott | 800 |
   |   2   | Jason | 800 |
   |   4   | James | 1000 |


### Reference
* [See here.](https://hirowaki.github.io/node-leaderboard/index.html)

### public functions
* static create(redis, lbname)
* clear()
* count()
* remove(name)
* setScore(name, score)
* modifyScore(name, delta)
* getScoreAndRank(score)
* getNeighbors(name, count)
* getList(number, size)

* [For details, see here.](https://hirowaki.github.io/node-leaderboard/index.html)

### Running sample web page.
1. clone the repo.
2. make sure redis is running on your local machine.
3. open console and type `$ make server`.
4. open `localhost:8080` on your browser.

##### Sample web page would be like this.
---
![SampleWeb](https://raw.githubusercontent.com/wiki/hirowaki/node-leaderboard/SampleWeb.png)
---

##### npm install
```
$ make install
```

##### test (using [mocha](https://www.npmjs.com/package/mocha))
```
$ npm test
```

##### linting
```
$ npm run lint
```


## LICENSE

The MIT License (MIT)

Copyright (c) 2017 hirowaki (https://github.com/hirowaki).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

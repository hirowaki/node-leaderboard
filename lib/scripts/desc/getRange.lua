return redis.call("ZREVRANGE", KEYS[1], ARGV[1], ARGV[2], "withscores")

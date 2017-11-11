return redis.call("ZRANGE", KEYS[1], ARGV[1], ARGV[2], "withscores")

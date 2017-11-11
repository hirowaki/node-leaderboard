return redis.call("ZREVRANK", KEYS[1], ARGV[1])

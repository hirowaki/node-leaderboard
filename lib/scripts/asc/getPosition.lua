return redis.call("ZRANK", KEYS[1], ARGV[1])

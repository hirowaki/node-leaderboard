return redis.call("ZCOUNT", KEYS[1], '('..ARGV[1], '+inf')

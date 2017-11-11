return redis.call("ZCOUNT", KEYS[1], '-inf', '('..ARGV[1])

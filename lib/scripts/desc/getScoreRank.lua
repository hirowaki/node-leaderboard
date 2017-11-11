local res = {}
res[1] = redis.call("ZSCORE", KEYS[1], ARGV[1])
res[2] = false;
if res[1] then
    res[2] = redis.call("ZCOUNT", KEYS[1], '('..res[1], '+inf')
end
return res

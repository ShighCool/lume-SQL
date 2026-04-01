生成 `src-tauri/src/commands/redis.rs`，实现以下 Tauri 命令：
- test_redis_connection(host, port, password, db) -> Result<bool, String>
- connect_redis(conn_id, host, port, password, db) -> Result<bool, String>
- disconnect_redis(conn_id) -> Result<bool, String>
- get_redis_keys(conn_id, pattern) -> Result<Vec<String>, String>
- get_redis_value(conn_id, key) -> Result<String, String>

使用 redis 库，用 lazy_static + Mutex<HashMap<String, redis::Connection>> 管理连接。
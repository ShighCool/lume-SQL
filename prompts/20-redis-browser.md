## 任务：为 QueryDB 实现 Redis 浏览器

### 后端命令（添加到 src-tauri/src/commands/redis.rs）

实现以下命令：
- `get_redis_keys(conn_id: String, pattern: String) -> Result<Vec<String>, String>`
- `get_redis_value(conn_id: String, key: String) -> Result<String, String>`
- `set_redis_value(conn_id: String, key: String, value: String, ttl: Option<i64>) -> Result<bool, String>`
- `delete_redis_key(conn_id: String, key: String) -> Result<bool, String>`
- `get_redis_ttl(conn_id: String, key: String) -> Result<i64, String>`

### 前端

创建 `src/components/RedisBrowser.tsx`：
- 左侧：Key 列表（支持搜索）
- 右侧：Key 的值编辑器
- 支持 String/Hash/List/Set/ZSet 类型
- 显示 TTL，支持修改
- 支持添加/删除 Key

修改 `src/App.tsx`：当连接类型为 redis 时显示 RedisBrowser

生成完整代码，不要 TODO。
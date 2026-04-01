生成 `src-tauri/src/commands/mongodb.rs`，实现以下 Tauri 命令：
- test_mongodb_connection(host, port, username, password, database) -> Result<bool, String>
- connect_mongodb(conn_id, host, port, username, password, database) -> Result<bool, String>
- disconnect_mongodb(conn_id) -> Result<bool, String>
- get_mongodb_collections(conn_id) -> Result<Vec<String>, String>
- find_mongodb_documents(conn_id, collection, filter) -> Result<String, String>

使用 mongodb 库，用 lazy_static + Mutex<HashMap<String, mongodb::Client>> 管理连接。
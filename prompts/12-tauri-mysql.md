生成 `src-tauri/src/commands/mysql.rs`，实现以下 Tauri 命令：
- test_mysql_connection(host, port, user, password, database) -> Result<bool, String>
- connect_mysql(conn_id, host, port, user, password, database) -> Result<bool, String>
- disconnect_mysql(conn_id) -> Result<bool, String>
- execute_mysql_query(conn_id, sql) -> Result<Vec<Vec<String>>, String>
- get_mysql_tables(conn_id) -> Result<Vec<String>, String>

使用 mysql 库，用 lazy_static + Mutex<HashMap<String, Pool>> 管理连接池。
## 任务：为 QueryDB 实现 MySQL 数据库/表浏览功能

### 后端命令（添加到 src-tauri/src/commands/mysql.rs）

实现以下命令：
- `get_mysql_databases(conn_id: String) -> Result<Vec<String>, String>`
- `get_mysql_tables(conn_id: String, database: String) -> Result<Vec<String>, String>`
- `get_mysql_table_data(conn_id: String, database: String, table: String, page: u32, page_size: u32) -> Result<TableData, String>`
- `get_mysql_table_schema(conn_id: String, database: String, table: String) -> Result<Vec<ColumnInfo>, String>`

### 前端

创建 `src/components/MySQLBrowser.tsx`：
- 三列布局：数据库列表 | 表列表 | 数据展示
- 点击数据库显示表列表
- 点击表显示数据
- 顶部有 SQL 编辑器（Monaco Editor）和执行按钮

修改 `src/App.tsx`：当连接类型为 mysql 时显示 MySQLBrowser

生成完整代码，不要 TODO。
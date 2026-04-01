## 任务：为 QueryDB 实现 MongoDB 浏览器

### 后端命令（添加到 src-tauri/src/commands/mongodb.rs）

实现以下命令：
- `get_mongodb_collections(conn_id: String) -> Result<Vec<String>, String>`
- `find_mongodb_documents(conn_id: String, collection: String, filter: String, page: u32, page_size: u32) -> Result<String, String>`
- `insert_mongodb_document(conn_id: String, collection: String, document: String) -> Result<bool, String>`
- `update_mongodb_document(conn_id: String, collection: String, filter: String, update: String) -> Result<bool, String>`
- `delete_mongodb_document(conn_id: String, collection: String, filter: String) -> Result<bool, String>`

### 前端

创建 `src/components/MongoDBBrowser.tsx`：
- 左侧：集合列表
- 右侧：文档表格
- 支持 JSON 过滤查询
- 支持添加/编辑/删除文档

修改 `src/App.tsx`：当连接类型为 mongodb 时显示 MongoDBBrowser

生成完整代码，不要 TODO。
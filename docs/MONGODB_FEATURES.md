# MongoDB 浏览器功能规划

## 当前进度：40% 完整度

---

## 📋 功能列表

### ✅ 已完成功能

- [x] 连接测试
- [x] 连接管理
- [x] 浏览集合列表
- [x] 查看集合文档
- [x] JSON 过滤查询
- [x] 动态列生成
- [x] 添加文档
- [x] 删除文档

---

## 🎯 高优先级功能（必须实现）

### 1. 数据库管理

#### 1.1 列出所有数据库
- **优先级**: P0
- **后端命令**: `get_mongodb_databases`
- **前端功能**:
  - 显示所有数据库列表
  - 数据库选择器
  - 切换当前数据库
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_databases(conn_id: String) -> Result<Vec<String>, String>
  ```

#### 1.2 数据库统计信息
- **优先级**: P0
- **后端命令**: `get_mongodb_db_stats`
- **前端功能**:
  - 显示数据库大小
  - 显示集合数量
  - 显示文档总数
  - 显示存储使用情况
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_db_stats(conn_id: String, database: String) -> Result<String, String>
  ```

#### 1.3 删除数据库
- **优先级**: P0
- **后端命令**: `drop_mongodb_database`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn drop_mongodb_database(conn_id: String, database: String) -> Result<bool, String>
  ```

### 2. 文档操作

#### 2.1 更新单个文档
- **优先级**: P0
- **后端命令**: `update_one_mongodb_document`
- **前端功能**:
  - 编辑文档对话框
  - JSON 编辑器
  - 保存并更新
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn update_one_mongodb_document(
      conn_id: String,
      collection: String,
      filter: String,
      update: String
  ) -> Result<bool, String>
  ```

#### 2.2 查找去重
- **优先级**: P0
- **后端命令**: `distinct_mongodb`
- **前端功能**:
  - 指定字段去重
  - 显示唯一值列表
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn distinct_mongodb(
      conn_id: String,
      collection: String,
      field: String,
      filter: String
  ) -> Result<String, String>
  ```

#### 2.3 文档统计
- **优先级**: P0
- **后端命令**: `count_mongodb_documents`
- **前端功能**:
  - 显示集合文档总数
  - 显示当前查询结果数量
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn count_mongodb_documents(
      conn_id: String,
      collection: String,
      filter: String
  ) -> Result<i64, String>
  ```

### 3. 索引管理

#### 3.1 创建索引
- **优先级**: P0
- **后端命令**: `create_mongodb_index`
- **前端功能**:
  - 索引创建对话框
  - 选择字段和类型
  - 设置索引选项（唯一、稀疏等）
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn create_mongodb_index(
      conn_id: String,
      collection: String,
      keys: String,
      options: String
  ) -> Result<String, String>
  ```

#### 3.2 查看索引
- **优先级**: P0
- **后端命令**: `get_mongodb_indexes`
- **前端功能**:
  - 显示所有索引列表
  - 显示索引详情（字段、类型、选项）
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_indexes(
      conn_id: String,
      collection: String
  ) -> Result<String, String>
  ```

#### 3.3 删除索引
- **优先级**: P0
- **后端命令**: `drop_mongodb_index`
- **前端功能**:
  - 确认删除对话框
  - 支持删除单个索引
  - 支持删除所有索引（除 _id）
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn drop_mongodb_index(
      conn_id: String,
      collection: String,
      index_name: String
  ) -> Result<bool, String>
  ```

### 4. 分页查询

#### 4.1 分页支持
- **优先级**: P0
- **后端命令**: `find_mongodb_documents_with_pagination`
- **前端功能**:
  - 分页控件
  - 每页数量选择
  - 页码导航
  - 显示总数和当前页
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn find_mongodb_documents_with_pagination(
      conn_id: String,
      collection: String,
      filter: String,
      skip: i64,
      limit: i64,
      sort: String
  ) -> Result<String, String>
  ```

### 5. 聚合管道

#### 5.1 聚合查询
- **优先级**: P0
- **后端命令**: `aggregate_mongodb`
- **前端功能**:
  - 聚合管道编辑器
  - 支持常见阶段（$match、$group、$sort、$limit、$project 等）
  - 结果展示
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn aggregate_mongodb(
      conn_id: String,
      collection: String,
      pipeline: String
  ) -> Result<String, String>
  ```

---

## 🚀 中优先级功能（重要功能）

### 6. 高级查询

#### 6.1 排序支持
- **优先级**: P1
- **后端命令**: 已集成在分页查询中
- **前端功能**:
  - 点击列头排序
  - 多字段排序
  - 升序/降序切换

#### 6.2 投影字段选择
- **优先级**: P1
- **后端命令**: 已集成在查询中
- **前端功能**:
  - 字段选择器
  - 排除字段
  - 包含字段

#### 6.3 全文搜索
- **优先级**: P1
- **后端命令**: `text_search_mongodb`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn text_search_mongodb(
      conn_id: String,
      collection: String,
      text: String,
      filter: String
  ) -> Result<String, String>
  ```

#### 6.4 地理空间查询
- **优先级**: P1
- **后端命令**: `geo_search_mongodb`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn geo_search_mongodb(
      conn_id: String,
      collection: String,
      operation: String,
      coordinates: Vec<f64>,
      distance: f64
  ) -> Result<String, String>
  ```

### 7. 数据管理

#### 7.1 导出数据
- **优先级**: P1
- **后端命令**: `export_mongodb_collection`
- **前端功能**:
  - 支持 JSON 格式
  - 支持 CSV 格式
  - 批量导出
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn export_mongodb_collection(
      conn_id: String,
      collection: String,
      filter: String,
      format: String
  ) -> Result<String, String>
  ```

#### 7.2 导入数据
- **优先级**: P1
- **后端命令**: `import_mongodb_collection`
- **前端功能**:
  - 支持 JSON 文件
  - 支持 CSV 文件
  - 批量导入
  - 显示导入进度
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn import_mongodb_collection(
      conn_id: String,
      collection: String,
      data: String,
      format: String
  ) -> Result<i64, String>
  ```

#### 7.3 批量删除文档
- **优先级**: P1
- **后端命令**: 已有 `delete_mongodb_document` 支持批量
- **前端功能**:
  - 多选文档
  - 批量删除确认

#### 7.4 重命名字段
- **优先级**: P1
- **后端命令**: 使用 $rename 操作符
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn rename_mongodb_field(
      conn_id: String,
      collection: String,
      filter: String,
      old_name: String,
      new_name: String
  ) -> Result<bool, String>
  ```

### 8. 性能分析

#### 8.1 执行计划
- **优先级**: P1
- **后端命令**: `explain_mongodb_query`
- **前端功能**:
  - 显示查询执行计划
  - 索引使用情况
  - 查询统计信息
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn explain_mongodb_query(
      conn_id: String,
      collection: String,
      filter: String,
      sort: String
  ) -> Result<String, String>
  ```

#### 8.2 慢查询分析
- **优先级**: P1
- **后端命令**: `get_mongodb_slow_queries`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_slow_queries(
      conn_id: String,
      database: String
  ) -> Result<String, String>
  ```

#### 8.3 索引使用统计
- **优先级**: P1
- **后端命令**: `get_mongodb_index_stats`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_index_stats(
      conn_id: String,
      collection: String
  ) -> Result<String, String>
  ```

### 9. 集合管理

#### 9.1 创建集合
- **优先级**: P1
- **后端命令**: `create_mongodb_collection`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn create_mongodb_collection(
      conn_id: String,
      collection: String,
      options: String
  ) -> Result<bool, String>
  ```

#### 9.2 删除集合
- **优先级**: P1
- **后端命令**: `drop_mongodb_collection`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn drop_mongodb_collection(
      conn_id: String,
      collection: String
  ) -> Result<bool, String>
  ```

#### 9.3 集合统计信息
- **优先级**: P1
- **后端命令**: `get_mongodb_collection_stats`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_collection_stats(
      conn_id: String,
      collection: String
  ) -> Result<String, String>
  ```

#### 9.4 重命名集合
- **优先级**: P1
- **后端命令**: `rename_mongodb_collection`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn rename_mongodb_collection(
      conn_id: String,
      old_name: String,
      new_name: String
  ) -> Result<bool, String>
  ```

---

## 💡 低优先级功能（增强功能）

### 10. 用户管理

#### 10.1 创建用户
- **优先级**: P2
- **后端命令**: `create_mongodb_user`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn create_mongodb_user(
      conn_id: String,
      username: String,
      password: String,
      roles: String
  ) -> Result<bool, String>
  ```

#### 10.2 查看用户列表
- **优先级**: P2
- **后端命令**: `get_mongodb_users`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn get_mongodb_users(conn_id: String) -> Result<String, String>
  ```

#### 10.3 删除用户
- **优先级**: P2
- **后端命令**: `delete_mongodb_user`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn delete_mongodb_user(
      conn_id: String,
      username: String
  ) -> Result<bool, String>
  ```

### 11. 备份恢复

#### 11.1 数据库备份
- **优先级**: P2
- **后端命令**: `backup_mongodb_database`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn backup_mongodb_database(
      conn_id: String,
      database: String
  ) -> Result<String, String>
  ```

#### 11.2 数据恢复
- **优先级**: P2
- **后端命令**: `restore_mongodb_database`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn restore_mongodb_database(
      conn_id: String,
      database: String,
      backup_data: String
  ) -> Result<bool, String>
  ```

### 12. 事务和会话

#### 12.1 事务支持
- **优先级**: P2
- **后端命令**: `start_mongodb_transaction`, `commit_mongodb_transaction`, `abort_mongodb_transaction`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn start_mongodb_transaction(conn_id: String) -> Result<String, String>
  
  #[tauri::command]
  pub async fn commit_mongodb_transaction(conn_id: String, session_id: String) -> Result<bool, String>
  
  #[tauri::command]
  pub async fn abort_mongodb_transaction(conn_id: String, session_id: String) -> Result<bool, String>
  ```

#### 12.2 会话管理
- **优先级**: P2
- **后端命令**: `list_mongodb_sessions`, `kill_mongodb_session`
- **接口**:
  ```rust
  #[tauri::command]
  pub async fn list_mongodb_sessions(conn_id: String) -> Result<String, String>
  
  #[tauri::command]
  pub async fn kill_mongodb_session(conn_id: String, session_id: String) -> Result<bool, String>
  ```

---

## 📊 实施计划

### 第一阶段：数据库管理（预计 2 天）
1. 列出所有数据库
2. 数据库统计信息
3. 删除数据库
4. 创建/删除/重命名集合
5. 集合统计信息

### 第二阶段：文档操作增强（预计 2-3 天）
1. 更新单个文档
2. 查找去重
3. 文档统计
4. 批量删除文档
5. 重命名字段

### 第三阶段：分页和排序（预计 2 天）
1. 分页支持
2. 排序功能
3. 投影字段选择

### 第四阶段：索引管理（预计 2-3 天）
1. 创建索引
2. 查看索引
3. 删除索引
4. 索引使用统计

### 第五阶段：聚合查询（预计 2-3 天）
1. 聚合管道支持
2. 聚合管道编辑器
3. 常用聚合阶段实现

### 第六阶段：性能分析（预计 2 天）
1. 执行计划
2. 慢查询分析
3. 查询优化建议

### 第七阶段：数据导入导出（预计 2 天）
1. 导出数据（JSON/CSV）
2. 导入数据
3. 批量操作

### 第八阶段：高级功能（预计 2-3 天）
1. 全文搜索
2. 地理空间查询
3. 用户管理
4. 备份恢复

---

## 🎯 完成目标

- **短期目标（1周）**: 完成高优先级功能，达到 70% 完整度
- **中期目标（2周）**: 完成中优先级功能，达到 85% 完整度
- **长期目标（3周）**: 完成所有功能，达到 95% 完整度

---

## 📝 注意事项

1. 所有异步操作需要正确处理错误
2. 大数据量操作需要添加分页
3. 批量操作需要显示进度
4. 敏感操作需要添加确认对话框
5. 所有命令需要添加详细的错误提示
6. UI 需要支持加载状态
7. 需要添加操作日志记录
8. 聚合管道需要提供常用模板
9. 索引创建需要提供最佳实践建议
10. 查询性能需要实时反馈
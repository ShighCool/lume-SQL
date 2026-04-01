# Redis 浏览器功能规划

## 当前进度：35% 完整度

---

## 📋 功能列表

### ✅ 已完成功能

- [x] 连接测试
- [x] 连接管理
- [x] 浏览 Keys 列表
- [x] 搜索 Keys（支持通配符）
- [x] 查看 Key 详情
- [x] 查看 Key 类型（string、hash、list、set、zset）
- [x] 查看 TTL
- [x] 读取所有数据类型的值
- [x] 删除 Key
- [x] 修改并保存值

---

## 🎯 高优先级功能（必须实现）

### 1. Key 管理功能

#### 1.1 设置/修改过期时间
- **优先级**: P0
- **后端命令**: `set_redis_key_ttl`
- **前端功能**: 
  - 在 Key 详情页显示 TTL 设置器
  - 支持设置秒数
  - 支持设置为永不过期
- **接口**:
  ```rust
  #[tauri::command]
  pub fn set_redis_key_ttl(conn_id: String, key: String, ttl: i64) -> Result<bool, String>
  ```

#### 1.2 批量删除 Keys
- **优先级**: P0
- **后端命令**: `delete_redis_keys_batch`
- **前端功能**:
  - 支持选择多个 Keys
  - 批量删除确认对话框
- **接口**:
  ```rust
  #[tauri::command]
  pub fn delete_redis_keys_batch(conn_id: String, keys: Vec<String>) -> Result<i64, String>
  ```

#### 1.3 数据库信息统计
- **优先级**: P0
- **后端命令**: `get_redis_db_info`
- **前端功能**:
  - 显示当前数据库索引
  - 显示 Keys 总数
  - 显示内存使用情况
- **接口**:
  ```rust
  #[tauri::command]
  pub fn get_redis_db_info(conn_id: String) -> Result<RedisDbInfo, String>
  ```

#### 1.4 切换数据库
- **优先级**: P0
- **后端命令**: `select_redis_database`
- **前端功能**:
  - 数据库选择器（0-15）
  - 显示当前选中数据库
- **接口**:
  ```rust
  #[tauri::command]
  pub fn select_redis_database(conn_id: String, db_index: i64) -> Result<bool, String>
  ```

### 2. 数据类型特有操作

#### 2.1 Hash 字段编辑器
- **优先级**: P0
- **后端命令**:
  - `add_hash_field`
  - `update_hash_field`
  - `delete_hash_field`
- **前端功能**:
  - 表格形式显示字段和值
  - 添加新字段
  - 编辑字段值
  - 删除字段
  - 保存所有更改
- **接口**:
  ```rust
  #[tauri::command]
  pub fn add_hash_field(conn_id: String, key: String, field: String, value: String) -> Result<bool, String>
  
  #[tauri::command]
  pub fn update_hash_field(conn_id: String, key: String, field: String, value: String) -> Result<bool, String>
  
  #[tauri::command]
  pub fn delete_hash_field(conn_id: String, key: String, field: String) -> Result<bool, String>
  ```

#### 2.2 List 元素编辑器
- **优先级**: P0
- **后端命令**:
  - `push_list_element`
  - `pop_list_element`
  - `set_list_element`
  - `delete_list_element`
- **前端功能**:
  - 索引列表显示
  - 在头部/尾部添加元素
  - 编辑指定索引的元素
  - 删除指定索引的元素
  - 弹出头部/尾部元素
- **接口**:
  ```rust
  #[tauri::command]
  pub fn push_list_element(conn_id: String, key: String, value: String, position: String) -> Result<i64, String>
  
  #[tauri::command]
  pub fn pop_list_element(conn_id: String, key: String, position: String) -> Result<String, String>
  
  #[tauri::command]
  pub fn set_list_element(conn_id: String, key: String, index: i64, value: String) -> Result<bool, String>
  
  #[tauri::command]
  pub fn delete_list_element(conn_id: String, key: String, index: i64) -> Result<bool, String>
  ```

#### 2.3 Set 成员管理
- **优先级**: P0
- **后端命令**:
  - `add_set_members`
  - `remove_set_members`
  - `check_set_member`
- **前端功能**:
  - 成员列表显示
  - 批量添加成员
  - 批量删除成员
  - 检查成员是否存在
- **接口**:
  ```rust
  #[tauri::command]
  pub fn add_set_members(conn_id: String, key: String, members: Vec<String>) -> Result<i64, String>
  
  #[tauri::command]
  pub fn remove_set_members(conn_id: String, key: String, members: Vec<String>) -> Result<i64, String>
  
  #[tauri::command]
  pub fn check_set_member(conn_id: String, key: String, member: String) -> Result<bool, String>
  ```

#### 2.4 ZSet 分数编辑器
- **优先级**: P0
- **后端命令**:
  - `add_zset_member`
  - `update_zset_score`
  - `remove_zset_member`
  - `increment_zset_score`
- **前端功能**:
  - 成员和分数表格显示
  - 添加新成员和分数
  - 修改成员分数
  - 删除成员
  - 增加分数
- **接口**:
  ```rust
  #[tauri::command]
  pub fn add_zset_member(conn_id: String, key: String, member: String, score: f64) -> Result<bool, String>
  
  #[tauri::command]
  pub fn update_zset_score(conn_id: String, key: String, member: String, score: f64) -> Result<bool, String>
  
  #[tauri::command]
  pub fn remove_zset_member(conn_id: String, key: String, member: String) -> Result<bool, String>
  
  #[tauri::command]
  pub fn increment_zset_score(conn_id: String, key: String, member: String, delta: f64) -> Result<f64, String>
  ```

---

## 🚀 中优先级功能（重要功能）

### 3. Key 操作

#### 3.1 重命名 Key
- **优先级**: P1
- **后端命令**: `rename_redis_key`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn rename_redis_key(conn_id: String, old_key: String, new_key: String) -> Result<bool, String>
  ```

#### 3.2 查看 Key 内存占用
- **优先级**: P1
- **后端命令**: `get_redis_key_memory`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn get_redis_key_memory(conn_id: String, key: String) -> Result<i64, String>
  ```

#### 3.3 Key 序列化/反序列化
- **优先级**: P1
- **后端命令**: `dump_redis_key`, `restore_redis_key`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn dump_redis_key(conn_id: String, key: String) -> Result<String, String>
  
  #[tauri::command]
  pub fn restore_redis_key(conn_id: String, key: String, value: String, ttl: i64) -> Result<bool, String>
  ```

### 4. 自定义命令执行

#### 4.1 命令执行器
- **优先级**: P1
- **后端命令**: `execute_redis_command`
- **前端功能**:
  - 命令输入框
  - 命令历史记录
  - 结果展示
- **接口**:
  ```rust
  #[tauri::command]
  pub fn execute_redis_command(conn_id: String, command: String) -> Result<String, String>
  ```

### 5. 数据导入导出

#### 5.1 导出数据
- **优先级**: P1
- **后端命令**: `export_redis_data`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn export_redis_data(conn_id: String, pattern: String) -> Result<String, String>
  ```

#### 5.2 导入数据
- **优先级**: P1
- **后端命令**: `import_redis_data`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn import_redis_data(conn_id: String, data: String) -> Result<i64, String>
  ```

---

## 💡 低优先级功能（增强功能）

### 6. String 高级操作

#### 6.1 增量操作
- **优先级**: P2
- **后端命令**: `incr_redis_value`, `decr_redis_value`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn incr_redis_value(conn_id: String, key: String, delta: i64) -> Result<i64, String>
  
  #[tauri::command]
  pub fn decr_redis_value(conn_id: String, key: String, delta: i64) -> Result<i64, String>
  ```

#### 6.2 追加操作
- **优先级**: P2
- **后端命令**: `append_redis_value`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn append_redis_value(conn_id: String, key: String, value: String) -> Result<i64, String>
  ```

### 7. Set 集合运算

#### 7.1 集合运算
- **优先级**: P2
- **后端命令**: `set_intersect`, `set_union`, `set_diff`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn set_intersect(conn_id: String, keys: Vec<String>) -> Result<Vec<String>, String>
  
  #[tauri::command]
  pub fn set_union(conn_id: String, keys: Vec<String>) -> Result<Vec<String>, String>
  
  #[tauri::command]
  pub fn set_diff(conn_id: String, keys: Vec<String>) -> Result<Vec<String>, String>
  ```

### 8. 服务器信息

#### 8.1 服务器信息
- **优先级**: P2
- **后端命令**: `get_redis_server_info`
- **接口**:
  ```rust
  #[tauri::command]
  pub fn get_redis_server_info(conn_id: String, section: String) -> Result<String, String>
  ```

---

## 📊 实施计划

### 第一阶段：核心管理功能（预计 2-3 天）
1. 设置/修改过期时间
2. 批量删除 Keys
3. 数据库信息统计
4. 切换数据库

### 第二阶段：数据类型编辑器（预计 3-4 天）
1. Hash 字段编辑器
2. List 元素编辑器
3. Set 成员管理
4. ZSet 分数编辑器

### 第三阶段：高级操作（预计 2-3 天）
1. 重命名 Key
2. 查看 Key 内存占用
3. 自定义命令执行器
4. 数据导入导出

### 第四阶段：增强功能（预计 2-3 天）
1. String 高级操作
2. Set 集合运算
3. 服务器信息

---

## 🎯 完成目标

- **短期目标（1周）**: 完成高优先级功能，达到 70% 完整度
- **中期目标（2周）**: 完成中优先级功能，达到 85% 完整度
- **长期目标（3周）**: 完成所有功能，达到 95% 完整度

---

## 📝 注意事项

1. 所有异步操作需要正确处理错误
2. 批量操作需要考虑性能优化
3. 大数据量操作需要添加分页或限制
4. 敏感操作需要添加确认对话框
5. 所有命令需要添加详细的错误提示
6. UI 需要支持加载状态
7. 需要添加操作日志记录
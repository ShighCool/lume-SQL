# Redis 浏览器功能规划

## 当前进度：85% 完整度

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
- [x] 设置/修改过期时间
- [x] 批量删除 Keys
- [x] 数据库信息统计
- [x] 切换数据库（0-15）
- [x] Hash 字段管理（添加/更新/删除）
- [x] List 元素管理（添加/编辑/删除/弹出）
- [x] Set 成员管理（添加/删除/检查）
- [x] ZSet 分数管理（添加/更新/删除/增加）
- [x] 重命名 Key
- [x] 查看 Key 内存占用
- [x] Key 序列化/反序列化（dump/restore）
- [x] 自定义命令执行器
- [x] 导出数据
- [x] 导入数据
- [x] 服务器信息
- [x] 慢日志
- [x] 客户端信息
- [x] 统计信息
- [x] 监控数据
- [x] Bit 操作（set/get/bitcount/bitop/bitpos）
- [x] Geo 操作（geoadd/geodist/geohash/geopos/georadius/georadiusbymember）

---

## 🎯 已实现功能

### 1. Key 管理功能 ✅

#### 1.1 设置/修改过期时间 ✅
- **状态**: 已实现
- **后端命令**: `set_redis_key_ttl`
- **前端功能**:
  - 在 Key 详情页显示 TTL 设置器
  - 支持设置秒数
  - 支持设置为永不过期

#### 1.2 批量删除 Keys ✅
- **状态**: 已实现
- **后端命令**: `delete_redis_keys_batch`
- **前端功能**:
  - 支持选择多个 Keys
  - 批量删除确认对话框

#### 1.3 数据库信息统计 ✅
- **状态**: 已实现
- **后端命令**: `get_redis_db_info`
- **前端功能**:
  - 显示当前数据库索引
  - 显示 Keys 总数
  - 显示内存使用情况

#### 1.4 切换数据库 ✅
- **状态**: 已实现
- **后端命令**: `select_redis_database`
- **前端功能**:
  - 数据库选择器（0-15）
  - 显示当前选中数据库

### 2. 数据类型特有操作 ✅

#### 2.1 Hash 字段编辑器 ✅
- **状态**: 已实现
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
  pub fn delete_hash_field(conn_id: String, key: String, field: String) -> Result<bool, String>
  ```

#### 2.2 List 元素编辑器 ✅
- **状态**: 已实现
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

#### 2.3 Set 成员管理 ✅
- **状态**: 已实现
- **后端命令**:
  - `add_set_members`
  - `remove_set_members`
  - `check_set_member`
- **前端功能**:
  - 成员列表显示
  - 批量添加成员
  - 批量删除成员
  - 检查成员是否存在

#### 2.4 ZSet 分数编辑器 ✅
- **状态**: 已实现
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

---

## 🚀 已实现功能（中优先级）

### 3. Key 操作 ✅

#### 3.1 重命名 Key ✅
- **状态**: 已实现
- **后端命令**: `rename_redis_key`

#### 3.2 查看 Key 内存占用 ✅
- **状态**: 已实现
- **后端命令**: `get_redis_key_memory_usage`

#### 3.3 Key 序列化/反序列化 ✅
- **状态**: 已实现
- **后端命令**: `dump_redis_key`, `restore_redis_key`

### 4. 自定义命令执行 ✅

#### 4.1 命令执行器 ✅
- **状态**: 已实现
- **后端命令**: `execute_redis_command`
- **前端功能**:
  - 命令输入框
  - 命令历史记录
  - 结果展示

### 5. 数据导入导出 ✅

#### 5.1 导出数据 ✅
- **状态**: 已实现
- **后端命令**: `export_redis_keys`

#### 5.2 导入数据 ✅
- **状态**: 已实现
- **后端命令**: `import_redis_keys`

---

## 💡 低优先级功能（增强功能）

### 6. String 高级操作 ❌

#### 6.1 增量操作 ❌
- **状态**: 未实现（使用 incr_redis_value, decr_redis_value）
- **说明**: 可通过自定义命令执行器实现

#### 6.2 追加操作 ❌
- **状态**: 未实现（使用 append_redis_value）
- **说明**: 可通过自定义命令执行器实现

### 7. Set 集合运算 ❌

#### 7.1 集合运算 ❌
- **状态**: 未实现
- **后端命令**: `set_intersect`, `set_union`, `set_diff`
- **说明**: 可通过自定义命令执行器实现

### 8. 服务器信息 ✅

#### 8.1 服务器信息 ✅
- **状态**: 已实现
- **后端命令**: `get_redis_info`, `get_redis_slowlog`, `get_redis_clients`, `get_redis_stats`, `get_redis_monitor_data`

### 9. Bit 操作 ✅

#### 9.1 Bit 操作 ✅
- **状态**: 已实现
- **后端命令**: `set_redis_bit`, `get_redis_bit`, `bitcount_redis`, `bitop_redis`, `bitpos_redis`

### 10. Geo 操作 ✅

#### 10.1 Geo 操作 ✅
- **状态**: 已实现
- **后端命令**: `geoadd_redis`, `geodist_redis`, `geohash_redis`, `geopos_redis`, `georadius_redis`, `georadiusbymember_redis`

---

## 📊 实施计划

### 第一阶段：核心管理功能 ✅ 已完成
1. ✅ 设置/修改过期时间
2. ✅ 批量删除 Keys
3. ✅ 数据库信息统计
4. ✅ 切换数据库

### 第二阶段：数据类型编辑器 ✅ 已完成
1. ✅ Hash 字段编辑器
2. ✅ List 元素编辑器
3. ✅ Set 成员管理
4. ✅ ZSet 分数编辑器

### 第三阶段：高级操作 ✅ 已完成
1. ✅ 重命名 Key
2. ✅ 查看 Key 内存占用
3. ✅ 自定义命令执行器
4. ✅ 数据导入导出

### 第四阶段：增强功能 ✅ 已完成
1. ✅ 服务器信息
2. ✅ Bit 操作
3. ✅ Geo 操作
4. ✅ 监控数据

---

## 🎯 完成目标

- ✅ **短期目标**: 已完成高优先级功能，达到 70% 完整度
- ✅ **中期目标**: 已完成中优先级功能，达到 85% 完整度
- ✅ **当前状态**: 已完成 85% 功能，剩余为可选增强功能

---

## 📝 注意事项

1. ✅ 所有异步操作需要正确处理错误
2. ✅ 批量操作需要考虑性能优化
3. ✅ 大数据量操作需要添加分页或限制
4. ✅ 敏感操作需要添加确认对话框
5. ✅ 所有命令需要添加详细的错误提示
6. ✅ UI 需要支持加载状态
7. ✅ 需要添加操作日志记录
# API 文档

## Tauri 命令参考

QueryDB 通过 Tauri 命令与后端通信。所有命令都是异步的，返回 JSON 格式的结果。

---

## MySQL 命令

### 连接管理

#### `test_mysql_connection`

测试 MySQL 连接是否成功。

**参数**:
```typescript
{
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

**示例**:
```typescript
const result = await invoke('test_mysql_connection', {
  config: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'test'
  }
});
```

#### `connect_mysql`

建立 MySQL 连接。

**参数**:
```typescript
{
  id: string;
  name: string;
  type: 'mysql';
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `disconnect_mysql`

断开 MySQL 连接。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据库和表管理

#### `get_mysql_databases`

获取所有数据库列表。

**返回**:
```typescript
{
  databases: string[];
}
```

#### `get_mysql_tables`

获取指定数据库的表列表。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  tables: string[];
}
```

#### `get_mysql_table_schema`

获取表结构。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    key: string;
    default: string | null;
    extra: string;
  }[];
}
```

#### `get_table_ddl`

获取表的 DDL 语句。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  ddl: string;
}
```

#### `get_table_indexes`

获取表的索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  indexes: {
    name: string;
    columns: string[];
    unique: boolean;
    type: string;
  }[];
}
```

#### `get_table_foreign_keys`

获取表的外键。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  foreign_keys: {
    name: string;
    column: string;
    referenced_table: string;
    referenced_column: string;
    on_delete: string;
    on_update: string;
  }[];
}
```

### 数据操作

#### `get_mysql_table_data`

获取表数据。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  limit?: number;
  offset?: number;
}
```

**返回**:
```typescript
{
  columns: string[];
  rows: any[];
  total: number;
}
```

#### `execute_mysql_query`

执行 SQL 查询。

**参数**:
```typescript
{
  connectionId: string;
  sql: string;
}
```

**返回**:
```typescript
{
  columns: string[];
  rows: any[];
  affectedRows: number;
  executionTime: number; // 毫秒
}
```

#### `export_table_data`

导出表数据为 CSV。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  csv: string;
}
```

#### `export_table_structure`

导出表结构为 JSON。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  structure: any;
}
```

#### `generate_random_data`

生成测试数据。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  count: number;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 表操作

#### `drop_table`

删除表。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `copy_table`

复制表。

**参数**:
```typescript
{
  connectionId: string;
  sourceDatabase: string;
  sourceTable: string;
  targetDatabase: string;
  targetTable: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 列管理

#### `get_table_structure`

获取表的详细结构。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  columns: Column[];
}
```

#### `save_table_structure`

保存表结构修改。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  columns: Column[];
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `modify_column`

修改列定义。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  columnName: string;
  columnDef: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `add_column`

添加新列。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  columnName: string;
  columnDef: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_column`

删除列。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  columnName: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 索引管理

#### `add_index`

添加索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  indexName: string;
  columns: string[];
  unique: boolean;
  indexType?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_index`

删除索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  indexName: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 外键管理

#### `add_foreign_key`

添加外键。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  constraintName: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: string;
  onUpdate: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_foreign_key`

删除外键。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  constraintName: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 视图管理

#### `get_views`

获取所有视图。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  views: string[];
}
```

#### `get_view_definition`

获取视图定义。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  view: string;
}
```

**返回**:
```typescript
{
  definition: string;
}
```

#### `create_view`

创建视图。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  viewName: string;
  definition: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_view`

删除视图。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  view: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 存储过程和函数

#### `get_routines`

获取所有存储过程和函数。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  routines: {
    name: string;
    type: 'PROCEDURE' | 'FUNCTION';
  }[];
}
```

#### `get_routine_definition`

获取存储过程/函数定义。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  routine: string;
}
```

**返回**:
```typescript
{
  definition: string;
}
```

#### `create_routine`

创建存储过程/函数。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  routineName: string;
  definition: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_routine`

删除存储过程/函数。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  routine: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 性能分析

#### `explain_query`

获取查询执行计划。

**参数**:
```typescript
{
  connectionId: string;
  sql: string;
}
```

**返回**:
```typescript
{
  explain: any[];
}
```

#### `get_slow_queries`

获取慢查询日志。

**参数**:
```typescript
{
  connectionId: string;
  limit?: number;
}
```

**返回**:
```typescript
{
  slowQueries: {
    query: string;
    timestamp: string;
    duration: number;
  }[];
}
```

### 用户权限管理

#### `get_users`

获取所有用户。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  users: {
    user: string;
    host: string;
    privileges: string[];
  }[];
}
```

#### `create_user`

创建用户。

**参数**:
```typescript
{
  connectionId: string;
  username: string;
  host: string;
  password: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_user`

删除用户。

**参数**:
```typescript
{
  connectionId: string;
  username: string;
  host: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `grant_privilege`

授予权限。

**参数**:
```typescript
{
  connectionId: string;
  username: string;
  host: string;
  privilege: string;
  database?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `revoke_privilege`

撤销权限。

**参数**:
```typescript
{
  connectionId: string;
  username: string;
  host: string;
  privilege: string;
  database?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据库备份和恢复

#### `backup_database`

备份数据库。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  backupPath: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `restore_database`

恢复数据库。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  backupPath: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 事务管理

#### `begin_transaction`

开始事务。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `commit_transaction`

提交事务。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `rollback_transaction`

回滚事务。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据同步和对比

#### `get_replication_status`

获取主从复制状态。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  status: {
    slave_io_running: string;
    slave_sql_running: string;
    seconds_behind_master: number;
    last_error: string;
  };
}
```

#### `compare_table_structure`

对比表结构差异。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
}
```

**返回**:
```typescript
{
  differences: {
    addedColumns: Column[];
    modifiedColumns: {
      old: Column;
      new: Column;
    }[];
    removedColumns: string[];
    // ...
  };
}
```

#### `compare_table_data`

对比表数据。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  table: string;
  comparisonData: any;
}
```

**返回**:
```typescript
{
  differences: {
    added: any[];
    modified: {
      old: any;
      new: any;
    }[];
    removed: any[];
  };
}
```

### ER 图和监控

#### `get_er_diagram`

获取 ER 图数据。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  nodes: {
    id: string;
    label: string;
    // ...
  }[];
  edges: {
    from: string;
    to: string;
    label: string;
  }[];
}
```

#### `get_mysql_monitor_data`

获取实时监控数据。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  qps: number;
  connections: number;
  queryCacheHitRate: number;
  slowQueries: number;
}
```

#### `get_mysql_monitor_history`

获取监控历史数据。

**参数**:
```typescript
{
  connectionId: string;
  startTime: string;
  endTime: string;
}
```

**返回**:
```typescript
{
  metrics: {
    qps: number[];
    connections: number[];
    queryCacheHitRate: number[];
    slowQueries: number[];
  };
}
```

### 审计日志

#### `check_audit_log_table_exists`

检查审计日志表是否存在。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  exists: boolean;
}
```

#### `create_audit_log_table`

创建审计日志表。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `get_audit_logs`

获取审计日志。

**参数**:
```typescript
{
  connectionId: string;
  limit?: number;
  offset?: number;
}
```

**返回**:
```typescript
{
  logs: {
    id: number;
    timestamp: string;
    user: string;
    action: string;
    object: string;
    details: string;
  }[];
  total: number;
}
```

#### `clear_audit_logs`

清空审计日志。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

---

## Redis 命令

### 连接管理

#### `test_redis_connection`

测试 Redis 连接。

**参数**:
```typescript
{
  host: string;
  port: number;
  password?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `connect_redis`

建立 Redis 连接。

**参数**:
```typescript
{
  id: string;
  name: string;
  type: 'redis';
  host: string;
  port: number;
  password?: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `disconnect_redis`

断开 Redis 连接。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### Key 操作

#### `get_redis_keys`

获取所有 keys。

**参数**:
```typescript
{
  connectionId: string;
  pattern?: string;
}
```

**返回**:
```typescript
{
  keys: string[];
}
```

#### `get_redis_key_type`

获取 key 类型。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
}
```

**返回**:
```typescript
{
  type: 'string' | 'list' | 'set' | 'zset' | 'hash' | 'none';
}
```

#### `get_redis_value`

获取 key 的值。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
}
```

**返回**:
```typescript
{
  value: string | number | null;
  type: string;
}
```

#### `set_redis_value`

设置 key 的值。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  value: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `delete_redis_key`

删除 key。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `get_redis_key_ttl`

获取 key 的 TTL。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
}
```

**返回**:
```typescript
{
  ttl: number; // 秒，-1 表示永不过期，-2 表示不存在
}
```

#### `set_redis_key_ttl`

设置 key 的 TTL。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  ttl: number;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `rename_redis_key`

重命名 key。

**参数**:
```typescript
{
  connectionId: string;
  oldKey: string;
  newKey: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 批量操作

#### `delete_redis_keys_batch`

批量删除 keys。

**参数**:
```typescript
{
  connectionId: string;
  keys: string[];
}
```

**返回**:
```typescript
{
  success: boolean;
  deleted: number;
}
```

#### `export_redis_keys`

导出 keys 为 JSON。

**参数**:
```typescript
{
  connectionId: string;
  keys: string[];
}
```

**返回**:
```typescript
{
  data: Record<string, any>;
}
```

#### `import_redis_keys`

导入 keys。

**参数**:
```typescript
{
  connectionId: string;
  data: Record<string, any>;
}
```

**返回**:
```typescript
{
  success: boolean;
  imported: number;
}
```

### Hash 操作

#### `add_hash_field`

添加 hash 字段。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  field: string;
  value: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `update_hash_field`

更新 hash 字段。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  field: string;
  value: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `delete_hash_field`

删除 hash 字段。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  field: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### List 操作

#### `push_list_element`

向 list 左侧添加元素。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  value: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `pop_list_element`

从 list 左侧弹出元素。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  value: string;
}
```

#### `set_list_element`

设置 list 元素。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  index: number;
  value: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `delete_list_element`

删除 list 元素。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  index: number;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### Set 操作

#### `add_set_members`

添加 set 成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  members: string[];
}
```

**返回**:
```typescript
{
  success: boolean;
  added: number;
}
```

#### `remove_set_members`

删除 set 成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  members: string[];
}
```

**返回**:
```typescript
{
  success: boolean;
  removed: number;
}
```

#### `check_set_member`

检查 set 是否包含成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
}
```

**返回**:
```typescript
{
  isMember: boolean;
}
```

### ZSet 操作

#### `add_zset_member`

添加 zset 成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
  score: number;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `update_zset_score`

更新 zset 成员分数。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
  score: number;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `remove_zset_member`

删除 zset 成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `increment_zset_score`

增加 zset 成员分数。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
  increment: number;
}
```

**返回**:
```typescript
{
  newScore: number;
}
```

### GEO 操作

#### `geoadd_redis`

添加地理坐标。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  longitude: number;
  latitude: number;
  member: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `geodist_redis`

计算两点距离。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member1: string;
  member2: string;
  unit?: 'm' | 'km' | 'mi' | 'ft';
}
```

**返回**:
```typescript
{
  distance: number;
}
```

#### `geohash_redis`

获取地理坐标的 GeoHash。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
}
```

**返回**:
```typescript
{
  geohash: string;
}
```

#### `geopos_redis`

获取地理坐标。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
}
```

**返回**:
```typescript
{
  longitude: number;
  latitude: number;
}
```

#### `georadius_redis`

在圆范围内查找成员。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  longitude: number;
  latitude: number;
  radius: number;
  unit?: 'm' | 'km';
  withCoordinates?: boolean;
  withDistances?: boolean;
}
```

**返回**:
```typescript
{
  members: Array<{
    member: string;
    distance?: number;
    longitude?: number;
    latitude?: number;
  }>;
}
```

#### `georadiusbymember_redis`

在圆范围内查找成员（基于成员）。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  member: string;
  radius: number;
  unit?: 'm' | 'km';
  withCoordinates?: boolean;
  withDistances?: boolean;
}
```

**返回**:
```typescript
{
  members: Array<{
    member: string;
    distance?: number;
    longitude?: number;
    latitude?: number;
  }>;
}
```

### 位操作

#### `set_redis_bit`

设置位。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  offset: number;
  value: number; // 0 或 1
}
```

**返回**:
```typescript
{
  previousValue: number;
}
```

#### `get_redis_bit`

获取位值。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  offset: number;
}
```

**返回**:
```typescript
{
  value: number;
}
```

#### `bitcount_redis`

计算位的数量。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  start?: number;
  end?: number;
}
```

**返回**:
```typescript
{
  count: number;
}
```

#### `bitop_redis`

位操作（AND/OR/XOR/NOT）。

**参数**:
```typescript
{
  operation: 'AND' | 'OR' | 'XOR' | 'NOT';
  destKey: string;
  sourceKeys: string[];
}
```

**返回**:
```typescript
{
  result: number;
}
```

#### `bitpos_redis`

查找第一个设置或未设置的位。

**参数**:
```typescript
{
  connectionId: string;
  key: string;
  bit: number;
  start?: number;
  end?: number;
}
```

**返回**:
```typescript
{
  position: number;
}
```

### 服务器信息

#### `get_redis_info`

获取服务器信息。

**参数**:
```typescript
{
  connectionId: string;
  section?: 'server' | 'clients' | 'memory' | 'persistence' | 'stats' | 'replication' | 'cpu' | 'cluster' | 'keyspace';
}
```

**返回**:
```typescript
{
  info: Record<string, string>;
}
```

#### `get_redis_db_info`

获取数据库信息。

**参数**:
```typescript
{
  connectionId: string;
  db: number;
}
```

**返回**:
```typescript
{
  info: {
    keys: number;
    hits: number;
    misses: number;
    evictions: number;
  };
}
```

#### `get_redis_stats`

获取统计数据。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  stats: {
    connected_clients: number;
    used_memory: number;
    total_commands_processed: number;
    instantaneous_ops_per_sec: number;
    // ...
  };
}
```

#### `get_redis_slowlog`

获取慢查询日志。

**参数**:
```typescript
{
  connectionId: string;
  count?: number;
  // ...
}
```

**返回**:
```typescript
{
  slowlogs: Array<{
    id: number;
    timestamp: number;
    executionTime: number;
    command: string;
  }>;
}
```

#### `get_redis_clients`

获取客户端列表。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  clients: Array<{
    id: number;
    address: string;
    age: number;
    idle: number;
    flags: string;
  }>;
}
```

### 查询执行

#### `execute_redis_command`

执行任意 Redis 命令。

**参数**:
```typescript
{
  connectionId: string;
  command: string;
  args?: string[];
}
```

**返回**:
```typescript
{
  result: any;
}
```

---

## MongoDB 命令

### 连接管理

#### `test_mongodb_connection`

测试 MongoDB 连接。

**参数**:
```typescript
{
  uri: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `connect_mongodb`

建立 MongoDB 连接。

**参数**:
```typescript
{
  id: string;
  name: string;
  type: 'mongodb';
  uri: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `disconnect_mongodb`

断开 MongoDB 连接。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据库和集合管理

#### `get_mongodb_databases`

获取所有数据库。

**参数**:
```typescript
{
  connectionId: string;
}
```

**返回**:
```typescript
{
  databases: string[];
}
```

#### `get_mongodb_collections`

获取数据库中的集合。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  collections: string[];
}
```

#### `create_mongodb_collection`

创建集合。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_mongodb_collection`

删除集合。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `rename_mongodb_collection`

重命名集合。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  oldCollection: string;
  newCollection: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_mongodb_database`

删除数据库。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 文档操作

#### `get_mongodb_database_stats`

获取数据库统计信息。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
}
```

**返回**:
```typescript
{
  stats: {
    db: string;
    collections: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    totalIndexSize: number;
    // ...
  };
}
```

#### `get_mongodb_collection_stats`

获取集合统计信息。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
}
```

**返回**:
```typescript
{
  stats: {
    collection: string;
    count: number;
    size: number;
    avgObjSize: number;
    storageSize: number;
    totalIndexSize: number;
    // ...
  };
}
```

#### `count_mongodb_documents`

统计文档数量。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  filter?: any;
}
```

**返回**:
```typescript
{
  count: number;
}
```

#### `find_mongodb_documents`

查询文档。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  filter?: any;
  projection?: any;
  sort?: any;
  limit?: number;
  skip?: number;
}
```

**返回**:
```typescript
{
  documents: any[];
  total: number;
}
```

#### `find_mongodb_documents_paginated`

分页查询文档。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  page: number;
  pageSize: number;
  filter?: any;
  projection?: any;
  sort?: any;
}
```

**返回**:
```typescript
{
  documents: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

#### `insert_mongodb_document`

插入文档。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  document: any;
}
```

**返回**:
```typescript
{
  success: boolean;
  insertedId: string;
  message: string;
}
```

#### `update_mongodb_document`

更新文档。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  filter: any;
  update: any;
  options?: {
    upsert?: boolean;
    multi?: boolean;
  };
}
```

**返回**:
```typescript
{
  success: boolean;
  modifiedCount: number;
  matchedCount: number;
}
```

#### `delete_mongodb_document`

删除文档。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  filter: any;
  options?: {
    multi?: boolean;
  };
}
```

**返回**:
```typescript
{
  success: boolean;
  deletedCount: number;
  acknowledged: boolean;
}
```

### 索引管理

#### `get_mongodb_indexes`

获取集合的索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
}
```

**返回**:
```typescript
{
  indexes: {
    name: string;
    key: Record<string, number>;
    unique: boolean;
  }[];
}
```

#### `create_mongodb_index`

创建索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  key: Record<string, number>;
  options?: {
    unique?: boolean;
    name?: string;
    sparse?: boolean;
  };
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

#### `drop_mongodb_index`

删除索引。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  indexName: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  message: string;
}
```

### 数据导入导出

#### `export_mongodb_collection`

导出集合为 JSON/CSV。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  format: 'json' | 'csv';
  exportPath: string;
}
```

**返回**:
```typescript
{
  success: boolean;
  exported: number;
}
```

#### `import_mongodb_collection`

导入集合。

**参数**:
```typescript
{
  connectionId: string;
  database: string;
  collection: string;
  importPath: string;
  format: 'json' | 'csv';
}
```

**返回**:
```typescript
{
  success: boolean;
  imported: number;
}
```

---

## 通用命令

### 系统命令

#### `greet`

问候命令。

**参数**:
```typescript
{
  name: string;
}
```

**返回**:
```typescript
{
  message: string;
}
```

---

## 错误处理

所有命令可能返回以下错误：

```typescript
{
  error: string;
  message: string;
}
```

常见的错误类型：

1. **连接错误**：`Connection failed`
2. **认证错误**：`Authentication failed`
3. **语法错误**：`Syntax error in SQL`
4. **权限错误**：`Access denied`
5. **资源错误**：`Resource not found`

示例：

```typescript
try {
  const result = await invoke('get_mysql_tables', {
    connectionId: 'xxx',
    database: 'test'
  });
  console.log(result);
} catch (error) {
  console.error('执行失败:', error);
  // error 包含错误信息
}
```

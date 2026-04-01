# 架构设计文档

## 系统架构

QueryDB 采用前后端分离的架构，使用 Tauri 框架将 Web 技术与原生性能相结合。

### 架构分层

```
┌─────────────────────────────────────┐
│         Presentation Layer          │  React + TypeScript
├─────────────────────────────────────┤
│         State Management             │  Zustand
├─────────────────────────────────────┤
│         Communication Layer         │  Tauri Commands
├─────────────────────────────────────┤
│         Business Logic Layer         │  Rust
├─────────────────────────────────────┤
│         Data Access Layer            │  Database Drivers
└─────────────────────────────────────┘
```

---

## 前端架构

### 组件层次结构

```
App
├── Sidebar
├── DatabaseSidebar
├── Header
│   └── ThemeToggle
├── Main Content
│   ├── MySQLBrowser
│   │   ├── DatabaseTree
│   │   ├── TableList
│   │   ├── DataGrid
│   │   └── Tabs
│   │       ├── Query
│   │       ├── Monitor
│   │       ├── Log
│   │       └── ...
│   ├── RedisBrowser
│   └── MongoDBBrowser
├── ConnectionForm (Dialog)
└── Various Panels (Dialog/Overlay)
```

### 状态管理

#### ConnectionStore

```typescript
interface ConnectionStore {
  connections: Connection[];
  activeConnectionId: string | null;
  activeDatabase: string | null;
  activeTable: string | null;

  // Actions
  addConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, connection: Connection) => void;
  setActiveConnection: (id: string) => void;
  setActiveDatabase: (database: string) => void;
  setActiveTable: (table: string) => void;
}
```

#### ThemeStore

```typescript
interface ThemeStore {
  theme: 'light' | 'dark';

  // Actions
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}
```

---

## 后端架构

### 模块设计

#### commands/mod.rs

定义各数据库命令模块：

```rust
mod mysql;
mod redis;
mod mongodb;
```

#### 命令注册

所有 Tauri 命令在 `lib.rs` 中注册：

```rust
invoke_handler(tauri::generate_handler![
    // MySQL Commands
    commands::mysql::test_mysql_connection,
    commands::mysql::connect_mysql,
    // ... 更多命令

    // Redis Commands
    commands::redis::test_redis_connection,
    commands::redis::connect_redis,
    // ... 更多命令

    // MongoDB Commands
    commands::mongodb::test_mongodb_connection,
    commands::mongodb::connect_mongodb,
    // ... 更多命令
])
```

---

## 数据流

### MySQL 数据流程

```
User Action
    ↓
React Component
    ↓
Tauri Command Call
    ↓
MySQL Command Handler
    ↓
MySQL Connection
    ↓
Database Operation
    ↓
Result Response
    ↓
React Component Update
```

### 连接管理流程

```
ConnectionForm
    ↓
validateConnection()
    ↓
test_mysql_connection()
    ↓
connect_mysql()
    ↓
saveConnection()
    ↓
ConnectionStore Update
    ↓
UI Refresh
```

---

## 数据库驱动集成

### MySQL 集成

使用 `mysql` crate (v25.0)：

```rust
use mysql::Pool;

pub struct MySqlConnection {
    pool: Pool,
}

impl MySqlConnection {
    pub fn new(config: MysqlConfig) -> Result<Self, mysql::Error> {
        let pool = Pool::new(config.to_url())?;
        Ok(MySqlConnection { pool })
    }

    pub fn query(&self, sql: &str) -> Result<Vec<Row>, mysql::Error> {
        let mut conn = self.pool.get_conn()?;
        let mut stmt = conn.prepare(sql)?;
        let result = stmt.query(())?;
        Ok(result.collect())
    }
}
```

### Redis 集成

使用 `redis` crate (v0.27)：

```rust
use redis::AsyncCommands;

pub struct RedisConnection {
    client: redis::Client,
    con: redis::aio::Connection,
}

impl RedisConnection {
    pub async fn new(config: RedisConfig) -> Result<Self, redis::Error> {
        let client = redis::Client::open(config.to_url())?;
        let con = client.get_multiplexed_async_connection().await?;
        Ok(RedisConnection { client, con })
    }

    pub async fn get(&mut self, key: &str) -> Result<Option<String>, redis::Error> {
        let mut con = self.con.clone();
        con.get(key).await
    }
}
```

### MongoDB 集成

使用 `mongodb` crate (v3.0)：

```rust
use mongodb::{options::ClientOptions, Client};

pub struct MongoDbConnection {
    client: Client,
}

impl MongoDbConnection {
    pub async fn new(config: MongoConfig) -> Result<Self, mongodb::error::Error> {
        let options = ClientOptions::parse(config.uri).await?;
        let client = Client::with_options(options)?;
        Ok(MongoDbConnection { client })
    }

    pub async fn find_documents(
        &self,
        db: &str,
        collection: &str,
        filter: bson::Document,
    ) -> Result<Vec<Document>, mongodb::error::Error> {
        let collection = self.client.database(db).collection(collection);
        let cursor = collection.find(filter, None).await?;
        let documents = cursor.try_collect().await?;
        Ok(documents)
    }
}
```

---

## 安全设计

### 连接安全

- 使用参数化查询防止 SQL 注入
- 支持 SSL/TLS 加密连接
- 密码加密存储（建议）

### 权限控制

- 基于数据库角色的权限管理
- 用户级别的操作限制
- 审计日志记录敏感操作

---

## 性能优化

### 前端优化

1. **虚拟滚动**：大数据表格使用虚拟滚动
2. **懒加载**：按需加载组件和数据
3. **缓存策略**：本地存储连接配置
4. **防抖节流**：搜索和输入操作优化

### 后端优化

1. **连接池**：数据库连接复用
2. **异步操作**：充分利用 Tokio 异步运行时
3. **批处理**：批量操作优化
4. **查询优化**：使用索引和执行计划

---

## 错误处理

### 错误类型

```rust
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection failed: {0}")]
    ConnectionError(#[from] mysql::Error),
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::Error),
    #[error("MongoDB error: {0}")]
    MongoError(#[from] mongodb::error::Error),
    #[error("Unknown error: {0}")]
    Unknown(String),
}
```

### 错误传播

使用 `Result<T, DatabaseError>` 传递错误到前端，前端统一处理 UI 反馈。

---

## 扩展性设计

### 插件化架构

预留插件接口，支持：
- 数据源扩展
- 功能模块扩展
- 自定义命令

### 配置驱动

- Tauri 配置文件
- 连接配置文件
- 功能开关配置

---

## 测试策略

### 单元测试

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mysql_connection() {
        // 测试连接逻辑
    }

    #[test]
    fn test_redis_connection() {
        // 测试连接逻辑
    }
}
```

### 集成测试

使用 Tauri 的测试框架和 React Testing Library。

---

## 部署架构

### 构建流程

```bash
# 1. 前端构建
npm run build

# 2. Rust 代码编译
cd src-tauri
cargo build --release

# 3. 打包
cargo tauri build
```

### 输出产物

- **Windows**: .msi 安装包
- **macOS**: .dmg 安装包
- **Linux**: .AppImage / .deb / .rpm

---

## 监控和日志

### 应用日志

使用 `log` crate 记录应用日志：

```rust
use log::{info, error, debug};

pub fn connect_database(config: &Config) -> Result<(), Error> {
    debug!("Attempting to connect to database with config: {:?}", config);
    info!("Database connection successful");
    Ok(())
}
```

### 数据库日志

记录数据库操作：

- SQL 执行日志
- 查询性能日志
- 错误日志
- 审计日志

---

## 维护指南

### 依赖更新

定期更新依赖库：
```bash
npm update
cargo update
```

### 代码审查

- 定期进行代码审查
- 关注安全漏洞
- 性能优化建议

---

## 参考文档

- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [React 文档](https://react.dev/)
- [Rust 文档](https://doc.rust-lang.org/)
- [MySQL Rust Driver](https://github.com/black-byte/rust-mysql-driver)
- [Redis Rust Driver](https://github.com/redis-rs/redis-rs)

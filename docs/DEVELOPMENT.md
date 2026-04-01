# 开发指南

## 开发环境搭建

### 必需工具

1. **Node.js** (v18.0.0+)
   ```bash
   node -v  # 验证安装
   ```

2. **Rust** (1.70.0+)
   ```bash
   rustc --version
   cargo --version
   ```

3. **Git**
   ```bash
   git --version
   ```

### 推荐工具

- **VS Code** + 扩展：
  - Tauri (v2)
  - Rust Analyzer
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier

---

## 项目初始化

### 克隆项目

```bash
git clone https://github.com/yourusername/querydb.git
cd querydb
```

### 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Rust 依赖
cd src-tauri
cargo build
cd ..
```

### 运行开发模式

```bash
npm run tauri dev
```

这会同时启动前端开发服务器和后端编译。

---

## 开发工作流

### 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 2. 开发功能

#### 前端开发

在 `src/components/` 或 `src/stores/` 中修改代码。

#### 后端开发

在 `src-tauri/src/commands/` 中添加 Rust 函数。

### 3. 测试功能

运行开发模式进行测试：
```bash
npm run tauri dev
```

### 4. 提交更改

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 5. 推送并创建 PR

```bash
git push origin feature/your-feature-name
```

---

## 编码规范

### Rust 代码规范

1. **命名约定**
   ```rust
   // 函数：camelCase
   fn get_table_data() {}

   // 结构体：PascalCase
   struct MySqlConnection {}

   // 常量：SCREAMING_SNAKE_CASE
   const MAX_CONNECTIONS: usize = 10;

   // 私有项：前缀下划线
   fn _private_helper() {}
   ```

2. **错误处理**
   ```rust
   // 使用 Result 和 thiserror
   pub fn connect() -> Result<MySqlConnection, DatabaseError> {
       // 实现逻辑
       Ok(MySqlConnection {})
   }
   ```

3. **文档注释**
   ```rust
   /// 连接 MySQL 数据库
   ///
   /// # 参数
   /// * `config` - 数据库配置
   ///
   /// # 返回
   /// 返回连接对象或错误
   pub fn connect(config: MysqlConfig) -> Result<Self, DatabaseError> {
       // 实现
   }
   ```

### TypeScript 代码规范

1. **类型定义**
   ```typescript
   interface Connection {
     id: string;
     name: string;
     type: 'mysql' | 'redis' | 'mongodb';
     // ...
   }

   type DatabaseType = 'mysql' | 'redis' | 'mongodb';
   ```

2. **组件命名**
   ```typescript
   // 组件：PascalCase
   export function MySQLBrowser() {}

   // 工具函数：camelCase
   export function formatDate(date: Date): string {}
   ```

3. **常量命名**
   ```typescript
   // 常量：UPPER_SNAKE_CASE
   const API_BASE_URL = 'http://localhost:3000';
   const MAX_RETRIES = 3;
   ```

4. **导入顺序**
   ```typescript
   // 1. React 和其他库
   import React, { useState, useEffect } from 'react';

   // 2. 第三方库
   import { Button } from '@/components/ui/button';

   // 3. 本地组件
   import { ConnectionForm } from './ConnectionForm';

   // 4. 类型
   import type { Connection } from '@/types';
   ```

---

## 代码示例

### 添加新的 Tauri 命令

#### 1. 在命令文件中实现

`src-tauri/src/commands/mysql.rs`:

```rust
use crate::commands::mysql::MysqlConfig;
use mysql::Pool;
use serde::Serialize;

#[tauri::command]
pub async fn get_mysql_user_count(config: MysqlConfig) -> Result<usize, String> {
    // 初始化连接
    let url = config.to_url();
    let pool = Pool::new(url).map_err(|e| e.to_string())?;

    // 执行查询
    let mut conn = pool.get_conn()
        .map_err(|e| e.to_string())?;

    let result: usize = conn.query_map(
        "SELECT COUNT(*) FROM mysql.user",
        |row| row.take(1),
    ).map_err(|e| e.to_string())?
    .next()
    .unwrap_or(0);

    Ok(result)
}

// 定义返回类型
#[derive(Serialize)]
pub struct UserCountResult {
    count: usize,
}
```

#### 2. 在 lib.rs 中注册命令

```rust
use commands::mysql::get_mysql_user_count;

invoke_handler(tauri::generate_handler![
    // ... 其他命令
    commands::mysql::get_mysql_user_count,
])
```

#### 3. 在前端调用

`src/components/MySQLBrowser.tsx`:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

async function getUserCount() {
  try {
    const count = await invoke('get_mysql_user_count', {
      config: connectionConfig
    });
    console.log('用户数量:', count);
  } catch (error) {
    console.error('获取用户数量失败:', error);
  }
}
```

### 添加新的 React 组件

```typescript
import { useState, useEffect } from 'react';

interface MyComponentProps {
  title: string;
}

export function MyComponent({ title }: MyComponentProps) {
  const [data, setData] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const result = await invoke('get_data_command');
      setData(result as string[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>加载中...</div>;

  return (
    <div>
      <h2>{title}</h2>
      <ul>
        {data.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 调试技巧

### 前端调试

1. **浏览器开发者工具**
   ```bash
   # 按 F12 或右键 -> 检查
   ```

2. **React DevTools**
   ```bash
   npm install -D @types/react@18
   ```

3. **Zustand DevTools**
   ```bash
   npm install zustand/middleware
   ```

### 后端调试

1. **打印调试信息**
   ```rust
   log::info!("Debug: Something happened");
   log::error!("Error: Something failed");
   ```

2. **使用 `println!`**
   ```rust
   println!("Debug: {:?}", data);
   ```

3. **条件编译调试**
   ```rust
   #[cfg(debug_assertions)]
   println!("Debug mode is active");
   ```

### 混合调试

1. **Tauri DevTools**
   ```bash
   # 打开开发者工具
   # Alt+Shift+I 或 Cmd+Shift+I
   ```

2. **后端日志**
   ```rust
   // 在 tauri.conf.json 中配置
   "bundle": {
     "resources": ["debug.log"]
   }
   ```

---

## 常见问题

### 问题 1: Rust 编译错误

**症状**:
```
error[E0277]: the trait bound ... is not satisfied
```

**解决**:
```bash
# 清理并重新编译
cd src-tauri
cargo clean
cargo build --release
```

### 问题 2: 前端无法连接后端

**症状**:
```
Failed to fetch command
```

**解决**:
```bash
# 确保后端服务正在运行
npm run tauri dev

# 检查 tauri.conf.json 中的 URL 配置
```

### 问题 3: 模块未找到

**症状**:
```
Module not found: Can't resolve '@/components/...'
```

**解决**:
```bash
# 安装所有依赖
npm install

# 检查 tsconfig.json 中的路径别名
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 代码审查清单

### 前端代码

- [ ] 类型定义完整
- [ ] 组件职责单一
- [ ] 错误处理完善
- [ ] 代码可读性高
- [ ] 符合命名规范
- [ ] 添加必要的注释

### 后端代码

- [ ] 错误处理规范
- [ ] 性能优化考虑
- [ ] 日志记录完整
- [ ] 安全性检查
- [ ] 文档注释完整
- [ ] 符合 Rust 规范

---

## 性能优化建议

### 前端优化

1. **虚拟滚动**
   ```typescript
   import { useVirtualizer } from '@tanstack/react-virtual';

   const virtualizer = useVirtualizer({
     count: data.length,
     getScrollElement: () => parentRef.current,
     estimateSize: () => 50,
   });
   ```

2. **防抖搜索**
   ```typescript
   import { useDebouncedCallback } from 'use-debounce';

   const debouncedSearch = useDebouncedCallback(
     (value) => search(value),
     300
   );
   ```

3. **代码分割**
   ```typescript
   const HeavyComponent = lazy(() => import('./HeavyComponent'));
   ```

### 后端优化

1. **连接池**
   ```rust
   use mysql::Pool;

   let pool = Pool::new(url).map_err(|e| e.to_string())?;
   // 复用连接，避免频繁创建
   ```

2. **异步操作**
   ```rust
   // 使用 async/await
   async fn async_operation() -> Result<T, Error> {
       // 异步逻辑
   }
   ```

3. **批量操作**
   ```rust
   // 批量插入而不是逐条插入
   ```

---

## 测试

### 前端测试

```bash
# 运行测试
npm test

# 监视模式
npm run test:watch
```

### 后端测试

```bash
# 运行测试
cd src-tauri
cargo test

# 指定测试
cargo test --test mysql_test
```

---

## 发布流程

### 构建生产版本

```bash
# 前端构建
npm run build

# 后端构建
cd src-tauri
cargo tauri build
```

### 更新版本号

1. 修改 `package.json`:
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. 修改 `src-tauri/Cargo.toml`:
   ```toml
   [package]
   version = "1.0.0"
   ```

3. 提交更改并创建标签:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

---

## 获取帮助

- [Tauri 文档](https://tauri.app/v1/guides/)
- [React 文档](https://react.dev/)
- [Rust 文档](https://doc.rust-lang.org/)
- [项目 Issues](https://github.com/yourusername/querydb/issues)

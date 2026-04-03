# 贡献指南

感谢你对 Lume SQL 项目的关注！我们欢迎任何形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 修复 Bug
- ✨ 开发新功能
- 🌍 翻译文档
- 🎨 改进 UI/UX

---

## 开始之前

在开始贡献之前，请确保：

1. **阅读项目文档**
   - [README.md](README.md) - 项目概述
   - [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - 开发指南
   - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - 架构设计

2. **检查现有 Issues**
   - 在 [Issues](https://github.com/ShighCool/lume-SQL/issues) 中搜索相关问题
   - 如果问题已存在，可以在 Issue 中评论补充信息

3. **与团队沟通**
   - 对于大型功能或破坏性更改，建议先创建 Issue 讨论
   - 我们鼓励在开发前进行讨论，避免重复工作

---

## 开发环境搭建

### 前置要求

- **Node.js** >= 18.0.0
- **Rust** >= 1.70.0
- **Git**
- **推荐**: VS Code + Tauri 插件

### 克隆和初始化

```bash
# 1. Fork 项目到你的 GitHub 账号

# 2. 克隆你的 Fork
git clone https://github.com/yourusername/lume-SQL.git
cd lume-SQL

# 3. 安装依赖
npm install

# 4. 验证环境
node --version    # 应 >= 18.0.0
rustc --version   # 应 >= 1.70.0
```

### 运行开发模式

```bash
npm run tauri dev
```

应用将自动编译并在本地运行。

---

## 开发流程

### 1. 创建分支

从 `main` 分支创建新分支：

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
# 或
git checkout -b docs/your-doc-change
```

### 分支命名规范

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关
- `chore/` - 构建/工具链相关

### 2. 开发功能

#### 前端开发（React + TypeScript）

在 `src/` 目录下开发：

- **组件**: `src/components/`
- **状态管理**: `src/stores/`
- **类型定义**: `src/types/`
- **样式**: 组件目录内或 `src/App.css`

#### 后端开发（Rust）

在 `src-tauri/src/` 目录下开发：

- **MySQL 命令**: `src-tauri/src/commands/mysql.rs`
- **Redis 命令**: `src-tauri/src/commands/redis.rs`
- **MongoDB 命令**: `src-tauri/src/commands/mongodb.rs`
- **命令注册**: `src-tauri/src/lib.rs`

### 3. 测试你的更改

```bash
# 运行开发模式测试
npm run tauri dev

# 检查 TypeScript 类型
npm run build

# 运行后端测试
cd src-tauri
cargo test
```

### 4. 提交更改

使用清晰的提交信息：

```bash
git add .
git commit -m "feat: 添加 MongoDB 查询历史功能"
```

### 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更改
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（不是新功能也不是修复）
- `test`: 添加测试
- `chore`: 构建/工具链相关
- `perf`: 性能优化

**示例**:
```
feat(mysql): 添加数据库备份功能

实现了 MySQL 数据库的备份和恢复功能：
- 支持完整备份和增量备份
- 备份文件支持压缩
- 恢复时验证备份完整性

Closes #123
```

### 5. 推送到远程

```bash
git push origin feature/your-feature-name
```

### 6. 创建 Pull Request

1. 访问你的 GitHub Fork 页面
2. 点击 "Contribute" → "Open pull request"
3. 填写 PR 模板
4. 等待代码审查

---

## 代码规范

### TypeScript 代码规范

#### 命名约定

```typescript
// 组件: PascalCase
export function MySQLBrowser() {}

// 函数/变量: camelCase
const fetchData = async () => {}

// 常量: UPPER_SNAKE_CASE
const MAX_RETRIES = 3

// 类型/接口: PascalCase
interface ConnectionConfig {}
type DatabaseType = 'mysql' | 'redis' | 'mongodb'

// 私有成员: 前缀下划线
private _internalState = {}
```

#### 代码组织

```typescript
// 1. React 和库导入
import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

// 2. UI 组件导入
import { Button } from '@/components/ui/button'

// 3. 本地组件导入
import { ConnectionForm } from './ConnectionForm'

// 4. 类型导入
import type { Connection } from '@/types'

// 5. 接口定义
interface Props {
  title: string
}

// 6. 组件实现
export function MyComponent({ title }: Props) {
  // ...
}
```

#### 错误处理

```typescript
// 始终处理 Promise 错误
try {
  const result = await invoke('some_command', { param })
  // 处理结果
} catch (error) {
  console.error('命令执行失败:', error)
  // 用户友好的错误提示
  showErrorToast('操作失败，请稍后重试')
}
```

### Rust 代码规范

#### 命名约定

```rust
// 函数: snake_case
fn get_table_data() {}

// 结构体/枚举: PascalCase
struct MySqlConnection {}
enum DatabaseError {}

// 常量: SCREAMING_SNAKE_CASE
const MAX_CONNECTIONS: usize = 10

// 私有项: 前缀下划线
fn _private_helper() {}
```

#### 文档注释

```rust
/// 连接到 MySQL 数据库
///
/// # 参数
/// * `config` - 数据库连接配置
///
/// # 返回
/// 返回连接对象或错误
///
/// # 示例
/// ```no_run
/// let conn = connect_mysql(config)?;
/// ```
pub fn connect_mysql(config: MysqlConfig) -> Result<MySqlConnection, DatabaseError> {
    // 实现
}
```

#### 错误处理

```rust
// 使用 Result 类型
pub fn execute_query(&self, sql: &str) -> Result<Vec<Row>, DatabaseError> {
    let mut conn = self.pool.get_conn()
        .map_err(|e| DatabaseError::ConnectionError(e.to_string()))?;

    let result = conn.query(sql)
        .map_err(|e| DatabaseError::QueryError(e.to_string()))?;

    Ok(result)
}
```

---

## 添加新功能

### 添加新的 Tauri 命令

#### 1. 实现命令函数

在 `src-tauri/src/commands/mysql.rs` 中：

```rust
use serde::Serialize;

#[tauri::command]
pub async fn get_user_count(config: MysqlConfig) -> Result<usize, String> {
    // 实现
    Ok(count)
}

// 可选：定义返回结构体
#[derive(Serialize)]
pub struct UserInfo {
    id: u32,
    username: String,
    email: String,
}

#[tauri::command]
pub async fn get_user_info(config: MysqlConfig, user_id: u32) -> Result<UserInfo, String> {
    // 实现
    Ok(UserInfo { id, username, email })
}
```

#### 2. 注册命令

在 `src-tauri/src/lib.rs` 中：

```rust
.invoke_handler(tauri::generate_handler![
    // 现有命令
    commands::mysql::test_mysql_connection,
    commands::mysql::connect_mysql,

    // 新命令
    commands::mysql::get_user_count,
    commands::mysql::get_user_info,
])
```

#### 3. 前端调用

在 `src/components/` 中：

```typescript
import { invoke } from '@tauri-apps/api/core'

async function getUserCount() {
  try {
    const count = await invoke<number>('get_user_count', {
      config: connectionConfig
    })
    console.log('用户数量:', count)
  } catch (error) {
    console.error('获取失败:', error)
  }
}
```

### 添加新的 React 组件

#### 1. 创建组件文件

```typescript
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { Connection } from '@/types'

interface MyComponentProps {
  connection: Connection
  onAction?: () => void
}

export function MyComponent({ connection, onAction }: MyComponentProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (connection.id) {
      fetchData()
    }
  }, [connection.id])

  async function fetchData() {
    setLoading(true)
    try {
      const result = await invoke('get_data_command', {
        connectionId: connection.id
      })
      setData(result as any[])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>加载中...</div>

  return (
    <div className="my-component">
      {/* 组件内容 */}
    </div>
  )
}
```

#### 2. 导出和使用

```typescript
// 在主组件中导入
import { MyComponent } from './MyComponent'

// 使用
<MyComponent connection={activeConnection} onAction={handleAction} />
```

---

## Pull Request 检查清单

提交 PR 前，请确保：

### 代码质量

- [ ] 代码通过 TypeScript 类型检查 (`npm run build`)
- [ ] Rust 代码通过 `cargo clippy` 检查
- [ ] 代码格式正确（使用 Prettier 和 rustfmt）
- [ ] 添加了必要的注释和文档
- [ ] 没有调试代码（console.log、println! 等）

### 功能测试

- [ ] 在开发模式下测试通过
- [ ] 新功能有相应的测试
- [ ] 现有功能没有被破坏
- [ ] 边界情况已处理

### 文档

- [ ] 更新了相关文档
- [ ] 添加了必要的注释
- [ ] README 或 CHANGELOG 需要更新

### PR 描述

- [ ] PR 标题清晰描述更改
- [ ] PR 描述详细说明更改内容和原因
- [ ] 关联了相关的 Issue
- [ ] 添加了截图（适用于 UI 更改）

---

## 问题报告

### Bug 报告模板

```markdown
**问题描述**
简要描述遇到的问题

**复现步骤**
1. 打开应用
2. 点击某个按钮
3. 发生错误

**预期行为**
描述应该发生什么

**实际行为**
描述实际发生了什么

**环境信息**
- 操作系统: [e.g. Windows 10]
- Node.js 版本: [e.g. 18.0.0]
- Rust 版本: [e.g. 1.70.0]
- 应用版本: [e.g. 0.1.0]

**截图/日志**
如果适用，添加截图或错误日志

**附加信息**
任何其他相关信息
```

### 功能请求模板

```markdown
**功能描述**
简要描述希望添加的功能

**问题/动机**
这个功能解决了什么问题？为什么需要它？

**建议的解决方案**
描述你认为应该如何实现这个功能

**替代方案**
描述你考虑过的其他替代方案

**附加信息**
任何其他相关信息或示例
```

---

## 代码审查

### 审查流程

1. **自动检查**: CI/CD 会自动运行测试和代码检查
2. **人工审查**: 维护者会审查代码并提供反馈
3. **修改**: 根据反馈修改代码
4. **批准**: 审查通过后合并

### 审查标准

- **代码质量**: 代码清晰、可维护、符合规范
- **功能正确**: 实现符合需求，没有明显 Bug
- **性能**: 不会引入明显的性能问题
- **安全性**: 没有安全漏洞或风险
- **文档**: 有适当的文档和注释
- **测试**: 有足够的测试覆盖

---

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 使用包容性语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 专注于对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化语言或图像
- 恶意攻击、侮辱或贬损评论
- 骚扰或威胁他人
- 发布他人隐私信息
- 其他不专业或不适当的行为

---

## 获取帮助

如果你在贡献过程中遇到问题：

1. **查看文档**: 首先查看 [docs/](docs/) 目录下的文档
2. **搜索 Issues**: 在 [Issues](https://github.com/ShighCool/lume-SQL/issues) 中搜索类似问题
3. **创建 Issue**: 如果找不到答案，创建一个新的 Issue
4. **联系团队**: 通过邮件 56893016@qq.com 联系

---

## 许可证

通过贡献代码，你同意你的贡献将在 [MIT License](LICENSE) 下发布。

---

## 致谢

感谢所有贡献者！你的贡献让 Lume SQL 变得更好。

---

<div align="center">

**再次感谢你的贡献！**

Made with ❤️ by Lume SQL Team

</div>
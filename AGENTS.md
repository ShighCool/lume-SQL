# QueryDB 项目文档

## 项目概述

**项目名称**: querydb  
**版本**: 0.1.0  
**项目类型**: Tauri 桌面应用程序

QueryDB 是一个基于 Tauri 的桌面应用程序模板，结合了现代 Web 技术栈和原生桌面应用能力。该项目使用 React + TypeScript 作为前端框架，Rust 作为后端运行时，通过 Tauri 框架实现跨平台桌面应用开发。

### 主要技术栈

**前端技术**:
- **React**: 19.1.0 - 用于构建用户界面
- **TypeScript**: 5.8.3 - 提供静态类型检查
- **Vite**: 7.0.4 - 快速的构建工具和开发服务器
- **Tauri API**: 2.0 - 前端与 Rust 后端通信的桥梁

**后端技术**:
- **Rust**: 2021 Edition - 系统级编程语言
- **Tauri**: 2.0 - 桌面应用框架
- **Serde**: 1.0 - 序列化/反序列化框架
- **Serde JSON**: 1.0 - JSON 处理库

### 项目架构

```
querydb/
├── src/                    # React + TypeScript 前端代码
│   ├── main.tsx           # 应用入口文件
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 应用样式
│   └── assets/            # 静态资源
├── src-tauri/             # Rust 后端代码
│   ├── src/
│   │   ├── main.rs        # 应用入口（调用 lib.rs 的 run 函数）
│   │   └── lib.rs         # 核心逻辑和 Tauri 命令定义
│   ├── Cargo.toml         # Rust 依赖配置
│   ├── tauri.conf.json    # Tauri 应用配置
│   └── capabilities/      # 权限配置
├── public/                # 公共静态资源
├── package.json           # Node.js 依赖和脚本
├── tsconfig.json          # TypeScript 配置
└── vite.config.ts         # Vite 构建配置
```

### 应用配置

- **应用标识符**: com.querydb.app
- **默认窗口大小**: 800x600 像素
- **开发服务器端口**: 1420
- **热模块替换端口**: 1421

## 构建和运行

### 前置要求

在开发之前，请确保已安装以下工具：

1. **Node.js** (推荐最新 LTS 版本) - 用于前端开发
2. **Rust** (最新稳定版) - 用于后端开发
3. **系统依赖**:
   - Windows: Microsoft Visual C++ Build Tools
   - macOS: Xcode Command Line Tools
   - Linux: WebView2 (Linux), libwebkit2gtk-4.0-dev, libssl-dev, libgtk-3-dev, libayatana-appindicator3-dev

### 开发模式

运行开发服务器，支持热重载：

```bash
npm run tauri dev
```

该命令会：
1. 启动 Vite 开发服务器（监听 http://localhost:1420）
2. 编译 Rust 代码
3. 启动 Tauri 应用窗口

### 构建生产版本

构建可分发的应用程序：

```bash
npm run tauri build
```

构建产物将输出到 `src-tauri/target/release/` 目录（根据平台不同）。

### 仅前端开发

如果只想开发前端部分，可以运行：

```bash
npm run dev
```

这将启动 Vite 开发服务器，但不会启动 Tauri 窗口。

### 预览生产构建

预览构建后的前端应用：

```bash
npm run build      # 构建前端
npm run preview    # 预览
```

### 其他有用的命令

```bash
# 安装依赖
npm install

# 检查 TypeScript 类型
npm run build

# 使用 Tauri CLI
npm run tauri <command>
```

## 开发约定

### 前端开发（React + TypeScript）

**代码风格**:
- 使用函数组件和 Hooks
- 遵循 React 19 最佳实践
- TypeScript 严格模式已启用（`strict: true`）
- 启用了额外的 linting 规则：
  - `noUnusedLocals`: 未使用的局部变量会报错
  - `noUnusedParameters`: 未使用的参数会报错
  - `noFallthroughCasesInSwitch`: switch 语句必须有 break 或 return

**调用 Rust 命令**:
使用 `@tauri-apps/api/core` 的 `invoke` 函数调用后端命令：

```typescript
import { invoke } from "@tauri-apps/api/core";

// 调用名为 "greet" 的 Rust 命令，传递参数 { name: "World" }
const result = await invoke("greet", { name: "World" });
```

**组件结构**:
- 主要组件位于 `src/` 目录
- 样式文件使用 CSS 模块或全局样式（App.css）
- 静态资源放在 `src/assets/` 或 `public/` 目录

### 后端开发（Rust）

**代码风格**:
- 使用 Rust 2021 Edition
- 遵循 Rust 标准代码风格
- 使用 `#[tauri::command]` 宏定义可从前端调用的命令

**添加新的 Tauri 命令**:

在 `src-tauri/src/lib.rs` 中定义命令：

```rust
#[tauri::command]
fn my_command(param: String) -> Result<String, String> {
    Ok(format!("Received: {}", param))
}
```

然后在 `invoke_handler` 中注册：

```rust
.invoke_handler(tauri::generate_handler![greet, my_command])
```

**项目结构**:
- `main.rs`: 应用程序入口，调用 `lib.rs` 的 `run()` 函数
- `lib.rs`: 核心应用逻辑，定义 Tauri 命令和应用配置

### 构建配置

**Vite 配置**（`vite.config.ts`）:
- 使用 React 插件
- 开发服务器固定端口 1420
- 忽略 `src-tauri` 目录的文件监视
- 支持热模块替换（HMR）

**Tauri 配置**（`src-tauri/tauri.conf.json`）:
- 应用名称：querydb
- 窗口默认尺寸：800x600
- 构建前端命令：`npm run build`
- 开发模式前端命令：`npm run dev`

### 权限管理

Tauri 应用权限配置位于 `src-tauri/capabilities/default.json`：

当前权限：
- `core:default`: 核心功能默认权限
- `opener:default`: 打开外部链接的权限

添加新权限需要在此文件中声明。

## 常见任务

### 添加新的前端依赖

```bash
npm install <package-name>
# 对于 TypeScript 类型
npm install --save-dev @types/<package-name>
```

### 添加新的 Rust 依赖

编辑 `src-tauri/Cargo.toml`，在 `[dependencies]` 部分添加：

```toml
[dependencies]
your-crate = "1.0.0"
```

然后运行：

```bash
cd src-tauri
cargo build
```

### 调试

**前端调试**:
- 使用浏览器开发者工具（Tauri 应用会自动嵌入 DevTools）
- 或在浏览器中访问 http://localhost:1420（仅前端开发时）

**后端调试**:
- 使用 `println!` 或 `eprintln!` 输出日志
- 日志会显示在运行 `npm run tauri dev` 的终端中

### 测试

当前项目未配置测试框架。建议添加：

**前端测试**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

**后端测试**:
Rust 内置测试支持，在 `src-tauri/src/lib.rs` 中添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        assert_eq!(greet("Test"), "Hello, Test! You've been greeted from Rust!");
    }
}
```

## 项目状态

这是一个基于 Tauri 官方模板的初始项目，目前包含：
- ✅ 基础项目结构
- ✅ React + TypeScript 前端配置
- ✅ Rust 后端配置
- ✅ 示例命令：`greet` - 从 Rust 向前端发送问候消息
- 🚧 需要实现实际的数据库查询功能（根据项目名称 "QueryDB" 推测）

## 下一步建议

根据项目名称 "QueryDB"，建议以下开发方向：

1. **添加数据库支持**:
   - Rust 端：集成 SQLite、PostgreSQL 或其他数据库
   - 前端：设计查询界面和结果展示

2. **完善 UI**:
   - 替换示例界面
   - 添加查询表单
   - 实现结果表格或图表展示

3. **添加更多功能**:
   - SQL 查询编辑器
   - 查询历史记录
   - 导出功能（CSV、JSON 等）

4. **增强安全性**:
   - 添加数据库连接加密
   - 实现权限管理
   - 输入验证和 SQL 注入防护

## 参考资料

- [Tauri 官方文档](https://tauri.app/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vite 官方文档](https://vite.dev/)
- [Rust 官方文档](https://www.rust-lang.org/)
## 任务
生成 `src/components/SQLEditor.tsx`

## 要求
- 使用 @monaco-editor/react 作为 SQL 编辑器
- 配置 SQL 语法高亮，语言设置为 'sql'
- 主题跟随系统深色/浅色模式（使用 useThemeStore）
- 包含执行按钮，点击执行 SQL（暂时用 console.log 输出 SQL，后续替换为 Tauri 命令）
- 使用 shadcn/ui 的 Button
- 使用 @tanstack/react-table 展示查询结果
- 结果表格支持分页
- 布局：编辑器占 50% 高度，结果表格占 50% 高度

## 输出
只输出ok,不要额外解释。
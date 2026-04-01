## 任务
生成 `src/components/ConnectionForm.tsx`

## 要求
- 使用 shadcn/ui 的 Dialog、Tabs、Input、Label、Button 组件
- 支持 MySQL、Redis、MongoDB 三种数据库类型
- 使用 Tabs 组件切换数据库类型
- MySQL 表单字段：名称、主机、端口、用户名、密码、默认数据库
- Redis 表单字段：名称、主机、端口、密码、数据库索引
- MongoDB 表单字段：名称、主机、端口、用户名、密码、认证数据库
- 点击保存时调用 useConnectionStore 的 addConnection 方法
- 生成唯一 ID（使用 Date.now() 或 crypto.randomUUID()）

## 输出
只输出完整的代码文件内容，不要额外解释。
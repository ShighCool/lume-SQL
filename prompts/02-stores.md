## 任务
生成 `src/stores/connectionStore.ts`

## 要求
- 使用 zustand 创建 store
- 使用 persist 中间件持久化到 localStorage（key 为 'db-connections'）
- 包含以下状态：connections（连接数组）、activeConnectionId、activeTab
- 包含以下方法：addConnection、updateConnection、removeConnection、setConnectionStatus、setActiveConnection、setActiveTab

## 输出
只输出完整的代码文件内容，不要额外解释。
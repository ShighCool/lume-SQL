修改 `src/stores/connectionStore.ts`，添加以下方法：
- connectConnection(id: string): Promise<void> - 调用后端 connect 命令
- disconnectConnection(id: string): Promise<void> - 调用后端 disconnect 命令
- testConnection(config): Promise<boolean> - 调用后端 test 命令
- 添加 connectingIds: Set<string> 状态

使用 invoke 调用 Tauri 命令。
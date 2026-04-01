修改 `src/components/Sidebar.tsx`：

- 每个连接项右侧添加"连接"/"断开"按钮
- 根据 status 显示：'disconnected' 显示"连接"，'connected' 显示"断开"
- status 为 'connecting' 时显示 loading 图标
- 点击连接按钮调用 connectConnection
- 点击断开按钮调用 disconnectConnection
- 状态指示用彩色圆点

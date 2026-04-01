## 任务
生成 `src/App.tsx`

## 要求
- 整体布局：flex，高度 100vh
- 左侧：Sidebar 组件
- 右侧：主内容区
  - 顶部栏：显示当前连接的名称 + ThemeToggle 组件
  - 内容区：根据当前激活连接的数据库类型显示不同组件
    - mysql：显示 SQLEditor 组件
    - redis：显示 RedisBrowser 组件
    - mongodb：显示 MongoDBBrowser 组件
  - 如果没有激活连接，显示空状态提示
- 使用 shadcn/ui 组件
- 添加 useEffect 监听主题变化，在 document.documentElement 上设置 class

## 输出
只输出ok,不要额外解释。
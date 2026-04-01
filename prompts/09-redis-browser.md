## 任务
生成 `src/components/RedisBrowser.tsx`

## 要求
- 左右布局：左侧显示 Key 列表，右侧显示 Key 的值
- 左侧：搜索框（过滤 keys）、Key 列表（使用 ScrollArea）
- 右侧：根据 Key 类型显示不同编辑器
  - String：普通输入框
  - Hash：键值对表格
  - List/Set：列表形式
  - ZSet：带分数的列表
- 支持添加新 Key、编辑值、删除 Key
- 显示 TTL 信息
- 操作暂时用 console.log 模拟

## 输出
只输出ok,不要额外解释。
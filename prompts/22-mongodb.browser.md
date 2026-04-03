## 任务：为 MongoDBBrowser 添加 Database Client 级别的完整功能

### 当前文件
`src/components/MongoDBBrowser.tsx`

### 需要添加的功能

#### 1. 集合右键菜单
- 使用 shadcn/ui 的 ContextMenu
- 菜单项：刷新、重命名、删除、复制名称、查看统计信息
- 右键点击集合列表中的项时显示

#### 2. 文档视图切换
- 添加 Tabs 组件：表格视图 / 树形视图 / JSON 视图
- 表格视图：当前实现
- 树形视图：嵌套文档可展开（类似文件树）
- JSON 视图：显示原始 JSON 格式（Monaco Editor）

#### 3. 文档内联编辑
- 双击单元格进入编辑模式
- 支持直接修改值
- 保存时调用 update 命令

#### 4. 批量操作
- 每行添加复选框
- 全选/取消全选
- 批量删除选中文档
- 批量导出选中文档

#### 5. 导出功能
- 导出当前查询结果为 CSV/JSON
- 支持导出全部或选中文档
- 使用文件下载对话框

#### 6. 增强查询
- 添加"查询"对话框，支持：
  - Filter（JSON）
  - Projection（选择返回字段）
  - Sort（排序）
  - Limit（限制数量）
- 保存查询历史
- 可视化构建查询（可选）

#### 7. 字段控制
- 添加"列显示"下拉菜单
- 可以勾选/取消勾选显示的字段
- 记住用户的字段选择

#### 8. 文档详情面板
- 点击文档行，右侧弹出详情面板
- 显示完整文档内容（格式化的 JSON）
- 支持复制、编辑

#### 9. 状态栏增强
- 显示当前数据库名、集合名
- 显示文档总数
- 显示查询耗时
- 显示选中文档数

#### 10. 性能优化
- 虚拟滚动（文档数量多时）
- 分页加载（每页 50 条）

### 后端命令需要实现
确保以下 Tauri 命令存在：
- `get_mongodb_databases` - 获取数据库列表
- `get_mongodb_collections` - 获取集合列表
- `find_mongodb_documents` - 查询文档（支持 filter, projection, sort, limit）
- `count_mongodb_documents` - 统计文档数
- `insert_mongodb_document` - 插入文档
- `update_mongodb_document` - 更新文档
- `delete_mongodb_document` - 删除文档
- `create_mongodb_collection` - 创建集合
- `drop_mongodb_collection` - 删除集合
- `rename_mongodb_collection` - 重命名集合
- `get_mongodb_indexes` - 获取索引列表
- `create_mongodb_index` - 创建索引
- `drop_mongodb_index` - 删除索引

### UI 组件需要安装
```bash
npx shadcn@latest add context-menu
npx shadcn@latest add dropdown-menu
npx shadcn@latest add checkbox
npx shadcn@latest add tabs
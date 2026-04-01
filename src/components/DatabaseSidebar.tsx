import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Database, Table, RefreshCw, Copy, Download, Trash2, Settings, Eye, FileText, Database as DatabaseIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from '../lib/utils';
import { useConnectionStore } from '../stores/connectionStore';

interface DatabaseSidebarProps {
  connectionId: string | null;
}

export function DatabaseSidebar({ connectionId }: DatabaseSidebarProps) {
  const {
    connections,
    activeDatabase,
    activeTable,
    setActiveDatabase,
    setActiveTable,
    setShowSchemaDialog,
    setShowTableDesignDialog
  } = useConnectionStore();
  
  const connection = connections.find((c) => c.id === connectionId);
  const advancedOptions = connection?.config.mysql?.advancedOptions;

  const [databases, setDatabases] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 右键菜单相关状态
  const [contextMenuTable, setContextMenuTable] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [showDdlDialog, setShowDdlDialog] = useState(false);
  const [ddlContent, setDdlContent] = useState('');
  const [showCopyTableDialog, setShowCopyTableDialog] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [showRandomDataDialog, setShowRandomDataDialog] = useState(false);
  const [randomDataCount, setRandomDataCount] = useState(10);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deleteTableName, setDeleteTableName] = useState('');

  // 系统数据库列表
  const systemDatabases = ['information_schema', 'mysql', 'performance_schema', 'sys'];

  // 过滤后的数据库列表
  const filteredDatabases = databases.filter(db => {
    if (advancedOptions?.hideSystemDatabases && systemDatabases.includes(db)) {
      return false;
    }
    if (advancedOptions?.allowedDatabases) {
      const allowedList = advancedOptions.allowedDatabases
        .split(',')
        .map(db => db.trim())
        .filter(db => db);
      if (allowedList.length > 0) {
        return allowedList.includes(db);
      }
    }
    return true;
  });

  // 加载数据库列表
  const loadDatabases = async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const result: string[] = await invoke('get_mysql_databases', { connId: connectionId });
      setDatabases(result);
    } catch (error) {
      console.error('加载数据库列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载表列表
  const loadTables = async (database: string) => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const result: string[] = await invoke('get_mysql_tables', { connId: connectionId, database });
      setTables(result);
      
      // 加载视图
      try {
        const viewResult: string[] = await invoke('get_views', { connId: connectionId, database });
        setViews(viewResult);
      } catch (error) {
        console.error('加载视图列表失败:', error);
        setViews([]);
      }
      
      // 加载存储过程和函数
      try {
        const routineResult: any[] = await invoke('get_routines', { connId: connectionId, database });
        setRoutines(routineResult);
      } catch (error) {
        console.error('加载存储过程/函数列表失败:', error);
        setRoutines([]);
      }
    } catch (error) {
      console.error('加载表列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 选择数据库（单击仅选中高亮）
  const handleSelectDatabase = (database: string) => {
    setSelectedDatabase(database);
  };

  // 双击数据库（加载表列表）
  const handleDoubleClickDatabase = (database: string) => {
    setActiveDatabase(database);
    setSelectedTable(null);
  };

  // 选择表（单击仅选中高亮）
  const handleSelectTable = (table: string) => {
    setSelectedTable(table);
  };

  // 双击表（加载表数据）
  const handleDoubleClickTable = (table: string) => {
    setActiveTable(table);
  };

  // 复制表名
  const handleCopyTableName = async () => {
    if (contextMenuTable) {
      try {
        await navigator.clipboard.writeText(contextMenuTable);
      } catch (err) {
        console.error('复制失败:', err);
      }
    }
  };

  // 查看表 DDL
  const handleViewTableDdl = async () => {
    if (!contextMenuTable || !connectionId || !activeDatabase) return;
    try {
      const ddl: string = await invoke('get_table_ddl', {
        connId: connectionId,
        database: activeDatabase,
        table: contextMenuTable,
      });
      setDdlContent(ddl);
      setShowDdlDialog(true);
    } catch (error) {
      console.error('获取表 DDL 失败:', error);
      alert(`获取表 DDL 失败: ${error}`);
    }
  };

  // 设计表（打开表结构）
  const handleDesignTable = () => {
    if (contextMenuTable) {
      setActiveTable(contextMenuTable);
      setShowTableDesignDialog(true);
    }
  };

  // 导出表结构
  const handleExportStructure = async () => {
    if (!contextMenuTable || !connectionId || !activeDatabase) return;
    try {
      const sql: string = await invoke('export_table_structure', {
        connId: connectionId,
        database: activeDatabase,
        table: contextMenuTable,
      });
      downloadSqlFile(contextMenuTable, sql, 'structure');
    } catch (error) {
      console.error('导出表结构失败:', error);
      alert(`导出表结构失败: ${error}`);
    }
  };

  // 导出表结构和数据
  const handleExportData = async () => {
    if (!contextMenuTable || !connectionId || !activeDatabase) return;
    try {
      const sql: string = await invoke('export_table_data', {
        connId: connectionId,
        database: activeDatabase,
        table: contextMenuTable,
      });
      downloadSqlFile(contextMenuTable, sql, 'data');
    } catch (error) {
      console.error('导出表数据失败:', error);
      alert(`导出表数据失败: ${error}`);
    }
  };

  // 下载 SQL 文件
  const downloadSqlFile = (tableName: string, content: string, type: 'structure' | 'data') => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableName}_${type}_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 生成随机数据
  const handleGenerateRandomData = async () => {
    if (!contextMenuTable || !connectionId || !activeDatabase) return;
    try {
      const count: number = await invoke('generate_random_data', {
        connId: connectionId,
        database: activeDatabase,
        table: contextMenuTable,
        rowCount: randomDataCount,
      });
      alert(`成功生成 ${count} 条随机数据`);
      setShowRandomDataDialog(false);
      setRandomDataCount(10);
      loadTables(activeDatabase);
    } catch (error) {
      console.error('生成随机数据失败:', error);
      alert(`生成随机数据失败: ${error}`);
    }
  };

  // 删除表
  const handleDropTable = async () => {
    if (!deleteTableName || !connectionId || !activeDatabase) return;
    try {
      await invoke('drop_table', {
        connId: connectionId,
        database: activeDatabase,
        table: deleteTableName,
      });
      alert(`表 ${deleteTableName} 已删除`);
      setShowDeleteConfirmDialog(false);
      setDeleteTableName('');
      if (activeTable === deleteTableName) {
        setActiveTable(null);
      }
      loadTables(activeDatabase);
    } catch (error) {
      console.error('删除表失败:', error);
      alert(`删除表失败: ${error}`);
    }
  };

  // 复制表
  const handleCopyTable = async () => {
    if (!contextMenuTable || !connectionId || !activeDatabase || !newTableName.trim()) return;
    try {
      await invoke('copy_table', {
        connId: connectionId,
        database: activeDatabase,
        table: contextMenuTable,
        newTableName: newTableName.trim(),
      });
      alert(`表已成功复制为 ${newTableName}`);
      setShowCopyTableDialog(false);
      setNewTableName('');
      loadTables(activeDatabase);
    } catch (error) {
      console.error('复制表失败:', error);
      alert(`复制表失败: ${error}`);
    }
  };

  // 刷新表列表
  const handleRefreshTables = () => {
    if (activeDatabase) {
      loadTables(activeDatabase);
    }
  };

  useEffect(() => {
    if (connectionId) {
      loadDatabases();
    }
  }, [connectionId]);

  useEffect(() => {
    if (activeDatabase && connectionId) {
      loadTables(activeDatabase);
    }
  }, [activeDatabase, connectionId]);

  return (
    <div className="flex h-full">
      {/* 数据库列表 */}
      <div className="w-40 border-r flex flex-col h-full sidebar-transition">
        <div className="p-2 border-b flex items-center justify-between shrink-0">
          <h3 className="text-xs font-semibold transition-smooth">数据库</h3>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={loadDatabases}
            disabled={loading}
            className="transition-smooth"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-1 space-y-0.5">
            {loading && filteredDatabases.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (
              filteredDatabases.map((db) => (
                <button
                  key={db}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
                    selectedDatabase === db || activeDatabase === db
                      ? "bg-primary/20 text-primary font-medium"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleSelectDatabase(db)}
                  onDoubleClick={() => handleDoubleClickDatabase(db)}
                  title={db}
                >
                  <Database className="h-3 w-3 shrink-0 transition-transform duration-200" />
                  <span className="truncate transition-opacity duration-200">{db}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 表列表 */}
      <div className="w-40 border-r flex flex-col h-full main-content-transition">
        <div className="p-2 border-b shrink-0">
          <h3 className="text-xs font-semibold transition-smooth">表</h3>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-1 space-y-0.5">
            {loading && tables.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (
              tables.map((table) => (
              <ContextMenu key={table} onOpenChange={(open) => {
                if (open) {
                  setContextMenuTable(table);
                }
              }}>
                <ContextMenuTrigger asChild>
                  <button
                    className={cn(
                      "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all duration-200 min-h-[28px] cursor-pointer",
                      selectedTable === table || activeTable === table
                        ? "bg-primary/20 text-primary font-medium"
                        : "hover:bg-muted"
                    )}
                    onClick={() => handleSelectTable(table)}
                    onDoubleClick={() => handleDoubleClickTable(table)}
                    title={table}
                  >
                    <Table className="h-3 w-3 shrink-0 transition-transform duration-200" />
                    <span className="truncate transition-opacity duration-200">{table}</span>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[180px]">
                  <ContextMenuItem onClick={handleCopyTableName}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    复制名称
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleDesignTable}>
                    <Settings className="h-3.5 w-3.5 mr-2" />
                    设计表
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleViewTableDdl}>
                    <Eye className="h-3.5 w-3.5 mr-2" />
                    查看表 DDL
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={handleExportStructure}>
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    导出表结构
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleExportData}>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    导出表结构和数据
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => { setShowRandomDataDialog(true); }}>
                    <DatabaseIcon className="h-3.5 w-3.5 mr-2" />
                    生成随机数据
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => { setDeleteTableName(table); setShowDeleteConfirmDialog(true); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-2 text-destructive" />
                    删除
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={() => { setShowCopyTableDialog(true); }}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    复制表
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleRefreshTables}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    刷新
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>
      </div>

      {/* 视图列表 */}
      {views.length > 0 && (
        <div className="w-40 border-r flex flex-col h-full main-content-transition">
          <div className="p-2 border-b shrink-0">
            <h3 className="text-xs font-semibold transition-smooth">视图</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-1 space-y-0.5">
              {views.map((view) => (
                <ContextMenu key={view} onOpenChange={(open) => {
                  if (open) {
                    setContextMenuTable(view);
                  }
                }}>
                  <ContextMenuTrigger asChild>
                    <button
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all duration-200 min-h-[28px] cursor-pointer",
                        selectedTable === view || activeTable === view
                          ? "bg-primary/20 text-primary font-medium"
                          : "hover:bg-muted"
                      )}
                      onClick={() => handleSelectTable(view)}
                      onDoubleClick={() => handleDoubleClickTable(view)}
                      title={view}
                    >
                      <DatabaseIcon className="h-3 w-3 shrink-0 transition-transform duration-200" />
                      <span className="truncate transition-opacity duration-200">{view}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-[180px]">
                    <ContextMenuItem onClick={handleCopyTableName}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      复制名称
                    </ContextMenuItem>
                    <ContextMenuItem onClick={handleViewTableDdl}>
                      <Eye className="h-3.5 w-3.5 mr-2" />
                      查看视图 DDL
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 存储过程/函数列表 */}
      {routines.length > 0 && (
        <div className="w-40 border-r flex flex-col h-full main-content-transition">
          <div className="p-2 border-b shrink-0">
            <h3 className="text-xs font-semibold transition-smooth">存储过程/函数</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-1 space-y-0.5">
              {routines.map((routine: any, idx: number) => (
                <ContextMenu key={idx} onOpenChange={(open) => {
                  if (open) {
                    setContextMenuTable(routine.name);
                  }
                }}>
                  <ContextMenuTrigger asChild>
                    <button
                      className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all duration-200 min-h-[28px] hover:bg-muted cursor-pointer"
                      onClick={() => handleSelectTable(routine.name)}
                      title={routine.name}
                    >
                      <DatabaseIcon className="h-3 w-3 shrink-0 transition-transform duration-200" />
                      <span className="truncate transition-opacity duration-200">{routine.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto transition-opacity duration-200">
                        {routine.routine_type === 'PROCEDURE' ? 'P' : 'F'}
                      </span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-[180px]">
                    <ContextMenuItem onClick={handleCopyTableName}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      复制名称
                    </ContextMenuItem>
                    <ContextMenuItem onClick={handleViewTableDdl}>
                      <Eye className="h-3.5 w-3.5 mr-2" />
                      查看定义
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DDL 查看对话框 */}
      <Dialog open={showDdlDialog} onOpenChange={setShowDdlDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '700px', maxWidth: '700px' }}>
          <DialogHeader>
            <DialogTitle>表 DDL: {contextMenuTable}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4">
            <pre className="text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[500px]">
              {ddlContent}
            </pre>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (ddlContent) {
                  navigator.clipboard.writeText(ddlContent);
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>
            <Button onClick={() => setShowDdlDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 复制表对话框 */}
      <Dialog open={showCopyTableDialog} onOpenChange={setShowCopyTableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>复制表: {contextMenuTable}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newTableName">新表名</Label>
              <Input
                id="newTableName"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="输入新表名"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              将创建一个新表，复制原表的结构和所有数据。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyTableDialog(false)}>取消</Button>
            <Button onClick={handleCopyTable} disabled={!newTableName.trim()}>复制</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 生成随机数据对话框 */}
      <Dialog open={showRandomDataDialog} onOpenChange={setShowRandomDataDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成随机数据: {contextMenuTable}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rowCount">生成行数</Label>
              <Input
                id="rowCount"
                type="number"
                min="1"
                max="10000"
                value={randomDataCount}
                onChange={(e) => setRandomDataCount(Number(e.target.value))}
                placeholder="输入要生成的行数"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              将根据表结构生成指定数量的随机测试数据。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRandomDataDialog(false)}>取消</Button>
            <Button onClick={handleGenerateRandomData}>生成</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              确定要删除表 <strong>{deleteTableName}</strong> 吗？
            </p>
            <p className="text-sm text-destructive">
              此操作不可逆！表中的所有数据将被永久删除。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDropTable}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, RefreshCw, ChevronRight, ChevronDown, Plus, Trash2, Edit, Search, Settings, Columns, Copy, ZoomIn, Download, LayoutTemplate, Check, Clock, Layout, X, BarChart3, Database, GitCompare, History, Table } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';
import { useConnectionStore } from '../stores/connectionStore';
import { TableDesignDialog } from './TableDesignDialog';
import DataComparisonDialog from './DataComparisonDialog';
import QueryHistoryDialog, { addQueryToHistory } from './QueryHistoryDialog';
import AuditLogPanel from './AuditLogPanel';
import ERDiagramPanel from './ERDiagramPanel';
import DatabaseMonitorPanel from './DatabaseMonitorPanel';
import SQLLogPanel from './SQLLogPanel';
import { useLogStore } from '../stores/logStore';

interface MySQLBrowserProps {
  connectionId: string | null;
  database: string | null;
  table: string | null;
}

interface TableData {
  columns: string[];
  rows: string[][];
  total: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: string;
  key: string;
  default: string;
  extra: string;
}

export function MySQLBrowser({ connectionId, database, table }: MySQLBrowserProps) {
  const { showSchemaDialog, setShowSchemaDialog, showTableDesignDialog, setShowTableDesignDialog } = useConnectionStore();
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [tableSchema, setTableSchema] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState<TableData | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [showCreateTableDialog, setShowCreateTableDialog] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [addFormData, setAddFormData] = useState<Record<string, string>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createTableSql, setCreateTableSql] = useState('');
  const [viewCellData, setViewCellData] = useState<{ value: string; columnName: string } | null>(null);
  const [viewFormat, setViewFormat] = useState<'text' | 'json' | 'html' | 'yaml' | 'sql'>('text');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportFileName, setExportFileName] = useState('');
  const [queryExecutionTime, setQueryExecutionTime] = useState<number | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deleteSqlPreview, setDeleteSqlPreview] = useState('');
  const [deleteCount, setDeleteCount] = useState(0);
  const [schemaEditing, setSchemaEditing] = useState(false);
  const [schemaEditMode, setSchemaEditMode] = useState<'modify' | 'add' | 'delete'>('modify');
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [editColumnForm, setEditColumnForm] = useState({ name: '', definition: '' });
  const [showSchemaEditDialog, setShowSchemaEditDialog] = useState(false);
  const [showExplainDialog, setShowExplainDialog] = useState(false);
  const [explainResult, setExplainResult] = useState<string[][]>([]);
  const [explainLoading, setExplainLoading] = useState(false);
  const [showSlowQueryDialog, setShowSlowQueryDialog] = useState(false);
  const [slowQueryConfig, setSlowQueryConfig] = useState<string[][]>([]);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [backupSql, setBackupSql] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [inTransaction, setInTransaction] = useState(false);
  const [showDataComparisonDialog, setShowDataComparisonDialog] = useState(false);
  const [showQueryHistoryDialog, setShowQueryHistoryDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'logs' | 'er' | 'monitor'>('data');

  const detectFormat = (value: string): 'text' | 'json' | 'html' | 'yaml' | 'sql' => {
    if (!value || value.trim() === '') return 'text';

    // 检测 JSON
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(value);
        return 'json';
      } catch {
        // 不是有效的 JSON，继续检测其他格式
      }
    }

    // 检测 SQL
    const sqlKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i;
    if (sqlKeywords.test(value)) {
      return 'sql';
    }

    // 检测 HTML
    const htmlPattern = /<[a-z][\s\S]*>/i;
    if (htmlPattern.test(value) && value.includes('</')) {
      return 'html';
    }

    // 检测 YAML (包含 key: value 格式)
    const yamlPattern = /^\s*[a-zA-Z_][a-zA-Z0-9_-]*\s*:\s*.+$/m;
    if (yamlPattern.test(value) && value.includes('\n')) {
      return 'yaml';
    }

    return 'text';
  };

  const formatValue = (value: string, format: string): string => {
    if (!value) return '';
    
    switch (format) {
      case 'json':
        try {
          const parsed = JSON.parse(value);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return value;
        }
      case 'html':
        try {
          const formatted = value
            .replace(/</g, '\n<')
            .replace(/>/g, '>\n')
            .replace(/\n\s*\n/g, '\n')
            .split('\n')
            .map(line => {
              const indent = line.match(/^\s*/)?.[0].length || 0;
              return '  '.repeat(indent / 2) + line.trim();
            })
            .join('\n')
            .trim();
          return formatted || value;
        } catch {
          return value;
        }
      case 'yaml':
        try {
          const lines = value.split('\n');
          const formatted = lines.map(line => {
            if (line.startsWith('  ')) {
              return '  ' + line.trim();
            }
            return line;
          }).join('\n');
          return formatted;
        } catch {
          return value;
        }
      case 'sql':
        try {
          return value
            .replace(/\s+/g, ' ')
            .replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|OUTER JOIN|ON|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|ASC|DESC)\b/gi, '\n$1')
            .replace(/\n\s*\n/g, '\n')
            .trim();
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const currentData = queryResult || tableData;
  const currentColumns = currentData?.columns || [];

  const loadTableData = useCallback(async () => {
    if (!connectionId || !database || !table) return;
    setLoading(true);
    const startTime = Date.now();
    try {
      const result: TableData = await invoke('get_mysql_table_data', {
        connId: connectionId,
        database,
        table,
        page,
        pageSize,
        sortField: undefined,
      });
      const endTime = Date.now();
      setQueryExecutionTime(endTime - startTime);
      setTableData(result);
      setQueryResult(null);
      setSelectedRows(new Set());
      setExpandedRows(new Set());
      const visibility: Record<string, boolean> = {};
      result.columns.forEach(col => visibility[col] = true);
      setColumnVisibility(visibility);
      setSqlQuery(`SELECT * FROM ${database}.${table} LIMIT ${pageSize}`);
    } catch (error) {
      console.error('加载表数据失败:', error);
      alert(`加载表数据失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, table, page, pageSize]);

  const loadTableSchema = useCallback(async () => {
    if (!connectionId || !database || !table) return;
    setSchemaLoading(true);
    try {
      const result: ColumnInfo[] = await invoke('get_mysql_table_schema', {
        connId: connectionId,
        database,
        table,
      });
      setTableSchema(result);
    } catch (error) {
      console.error('加载表结构失败:', error);
      alert(`加载表结构失败: ${error}`);
    } finally {
      setSchemaLoading(false);
    }
  }, [connectionId, database, table]);

  const addLog = useLogStore((state) => state.addLog);

  const executeQuery = async () => {
    if (!connectionId || !sqlQuery.trim()) return;
    setLoading(true);
    const startTime = Date.now();
    try {
      const rows: string[][] = await invoke('execute_mysql_query', { connId: connectionId, sql: sqlQuery });
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      setQueryExecutionTime(executionTime);
      
      // 记录成功日志
      addLog({
        sql: sqlQuery,
        status: 'success',
        result: 'Query executed successfully',
        affectedRows: rows.length > 0 ? rows.length - 1 : 0,
        duration: executionTime,
        connectionId,
        database: database || undefined,
      });
      
      // 保存到查询历史
      addQueryToHistory(
        sqlQuery,
        connectionId,
        database,
        executionTime,
        rows.length > 0 ? rows.length - 1 : 0
      );
      
      if (rows.length > 0) {
        const columns = rows[0];
        const dataRows = rows.slice(1);
        setQueryResult({ columns, rows: dataRows, total: dataRows.length });
        setSelectedRows(new Set());
        setExpandedRows(new Set());
        const visibility: Record<string, boolean> = {};
        columns.forEach(col => visibility[col] = true);
        setColumnVisibility(visibility);
      } else {
        setQueryResult(null);
        setQueryExecutionTime(executionTime);
        alert('查询结果为空');
      }
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // 记录错误日志
      addLog({
        sql: sqlQuery,
        status: 'error',
        result: String(error),
        duration: executionTime,
        connectionId,
        database: database || undefined,
      });
      
      console.error('执行查询失败:', error);
      alert(`执行查询失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const explainQuery = async () => {
    if (!connectionId || !sqlQuery.trim()) return;
    setExplainLoading(true);
    try {
      const result: string[][] = await invoke('explain_query', { connId: connectionId, sql: sqlQuery });
      setExplainResult(result);
      setShowExplainDialog(true);
    } catch (error) {
      console.error('执行 EXPLAIN 失败:', error);
      alert(`执行 EXPLAIN 失败: ${error}`);
    } finally {
      setExplainLoading(false);
    }
  };

  const loadSlowQueryConfig = async () => {
    try {
      const result: string[][] = await invoke('get_slow_queries', { connId: connectionId || '' });
      setSlowQueryConfig(result);
      setShowSlowQueryDialog(true);
    } catch (error) {
      console.error('加载慢查询配置失败:', error);
      alert(`加载慢查询配置失败: ${error}`);
    }
  };

  const handleBackup = async () => {
    if (!connectionId || !database) return;
    setBackupLoading(true);
    try {
      const result: string = await invoke('backup_database', { connId: connectionId, database });
      setBackupSql(result);
      setShowBackupDialog(true);
    } catch (error) {
      console.error('备份数据库失败:', error);
      alert(`备份数据库失败: ${error}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([backupSql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${database}_backup_${Date.now()}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBeginTransaction = async () => {
    if (!connectionId) return;
    try {
      await invoke('begin_transaction', { connId: connectionId });
      setInTransaction(true);
      alert('事务已开始');
    } catch (error) {
      console.error('开始事务失败:', error);
      alert(`开始事务失败: ${error}`);
    }
  };

  const handleCommitTransaction = async () => {
    if (!connectionId) return;
    try {
      await invoke('commit_transaction', { connId: connectionId });
      setInTransaction(false);
      alert('事务已提交');
      if (table) {
        loadTableData();
      }
    } catch (error) {
      console.error('提交事务失败:', error);
      alert(`提交事务失败: ${error}`);
    }
  };

  const handleRollbackTransaction = async () => {
    if (!connectionId) return;
    try {
      await invoke('rollback_transaction', { connId: connectionId });
      setInTransaction(false);
      alert('事务已回滚');
      if (table) {
        loadTableData();
      }
    } catch (error) {
      console.error('回滚事务失败:', error);
      alert(`回滚事务失败: ${error}`);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(currentData!.rows.map((_, i) => i)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (rowIndex: number, checked: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(rowIndex);
      } else {
        newSet.delete(rowIndex);
      }
      return newSet;
    });
  };

  const handleToggleExpand = (rowIndex: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  const handleToggleColumn = (columnName: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnName]: !prev[columnName] }));
  };

  const handleDeleteSelected = () => {
    if (!table || selectedRows.size === 0) return;
    const idColumn = currentColumns[0];
    const selectedIds = Array.from(selectedRows).map(i => currentData!.rows[i][currentColumns.indexOf(idColumn)]);
    const deleteSql = `DELETE FROM ${table} WHERE ${idColumn} IN (${selectedIds.map(() => '?').join(',')})`;
    setDeleteSqlPreview(deleteSql);
    setDeleteCount(selectedRows.size);
    setShowDeleteConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    executeSql(deleteSqlPreview);
    setShowDeleteConfirmDialog(false);
    setDeleteSqlPreview('');
    setDeleteCount(0);
  };

  const handleEditColumn = (index: number) => {
    const col = tableSchema[index];
    setEditingColumnIndex(index);
    setEditColumnForm({ name: col.name, definition: `${col.type} ${col.nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.default ? `DEFAULT ${col.default}` : ''} ${col.key === 'PRI' ? 'PRIMARY KEY' : ''} ${col.extra}`.trim() });
    setSchemaEditMode('modify');
    setShowSchemaEditDialog(true);
  };

  const handleAddColumn = () => {
    setEditColumnForm({ name: '', definition: 'VARCHAR(255)' });
    setSchemaEditMode('add');
    setShowSchemaEditDialog(true);
  };

  const handleDeleteColumn = (index: number) => {
    const col = tableSchema[index];
    if (confirm(`确定要删除字段 "${col.name}" 吗？\n此操作不可逆！`)) {
      invoke('drop_column', {
        connId: connectionId,
        database,
        table,
        columnName: col.name,
      }).then(() => {
        alert('字段删除成功');
        loadTableSchema();
      }).catch((error) => {
        alert(`删除字段失败: ${error}`);
      });
    }
  };

  const handleSaveColumnEdit = () => {
    if (!editColumnForm.name.trim()) {
      alert('请输入字段名');
      return;
    }
    if (!editColumnForm.definition.trim()) {
      alert('请输入字段定义');
      return;
    }

    const action = schemaEditMode === 'modify' ? '修改' : '添加';
    if (confirm(`确定要${action}字段吗？\n\n字段名: ${editColumnForm.name}\n定义: ${editColumnForm.definition}`)) {
      const command = schemaEditMode === 'modify' ? 'modify_column' : 'add_column';
      invoke(command, {
        connId: connectionId,
        database,
        table,
        columnName: editColumnForm.name,
        columnDefinition: editColumnForm.definition,
      }).then(() => {
        alert(`字段${action}成功`);
        setShowSchemaEditDialog(false);
        setEditColumnForm({ name: '', definition: '' });
        loadTableSchema();
      }).catch((error) => {
        alert(`${action}字段失败: ${error}`);
      });
    }
  };

  const executeSql = async (sql: string) => {
    setLoading(true);
    try {
      await invoke('execute_mysql_query', { connId: connectionId, sql });
      alert('执行成功');
      if (table) {
        loadTableData();
      }
    } catch (error) {
      console.error('执行失败:', error);
      alert(`执行失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = (rowIndex: number) => {
    setEditingRow(rowIndex);
    const rowData: Record<string, string> = {};
    currentColumns.forEach((col, i) => {
      rowData[col] = currentData!.rows[rowIndex][i];
    });
    setEditFormData(rowData);
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!table || editingRow === null) return;
    const setParts = currentColumns.map(col => `${col} = ?`).join(', ');
    const updateSql = `UPDATE ${table} SET ${setParts} WHERE ${currentColumns[0]} = ?`;
    if (confirm(`确定要更新这条记录吗？\n\nSQL: ${updateSql}`)) {
      executeSql(updateSql);
      setShowEditDialog(false);
    }
  };

  const handleOpenAddDialog = () => {
    const emptyData: Record<string, string> = {};
    currentColumns.forEach(col => emptyData[col] = '');
    setAddFormData(emptyData);
    setShowAddDialog(true);
  };

  const handleSaveAdd = () => {
    if (!table) return;
    const columns = currentColumns.join(', ');
    const placeholders = currentColumns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
    if (confirm(`确定要新增这条记录吗？\n\nSQL: ${insertSql}`)) {
      executeSql(insertSql);
      setShowAddDialog(false);
    }
  };

  const handleSearch = () => {
    if (!table || !searchKeyword.trim()) return;
    const conditions = currentColumns.map(col => `${col} LIKE ?`).join(' OR ');
    const searchSql = `SELECT * FROM ${table} WHERE ${conditions}`;
    setSqlQuery(searchSql);
    executeQuery();
    setShowSearchDialog(false);
  };

  const handleCreateTable = () => {
    if (!createTableSql.trim()) return;
    if (!confirm(`确定要执行以下 SQL 创建表吗？\n\n${createTableSql}`)) return;
    executeSql(createTableSql);
    setShowCreateTableDialog(false);
    setCreateTableSql('');
  };

  const exportToCSV = () => {
    if (!currentData || currentData.rows.length === 0) {
      alert('没有数据可导出');
      return;
    }

    // 添加 BOM 以支持 Excel 正确显示中文
    const BOM = '\uFEFF';
    const header = currentData.columns.join(',');
    const rows = currentData.rows.map(row => {
      return row.map(cell => {
        // 处理包含逗号、引号或换行符的字段
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
    }).join('\n');

    const csvContent = BOM + header + '\n' + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName || table || 'data'}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (!currentData || currentData.rows.length === 0) {
      alert('没有数据可导出');
      return;
    }

    const jsonData = currentData.rows.map(row => {
      const obj: Record<string, string> = {};
      currentColumns.forEach((col, i) => {
        obj[col] = row[i] || '';
      });
      return obj;
    });

    const jsonContent = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName || table || 'data'}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      exportToCSV();
    } else {
      exportToJSON();
    }
    setShowExportDialog(false);
    setExportFileName('');
  };

  useEffect(() => {
    if (database && table) {
      loadTableData();
    }
  }, [database, table, loadTableData]);

  const visibleColumns = currentColumns.filter(col => columnVisibility[col] !== false);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="w-full justify-start border-b rounded-none h-10 px-3">
          <TabsTrigger value="data" className="data-[state=active]:bg-background">
            数据
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-background">
            日志
          </TabsTrigger>
          <TabsTrigger value="er" className="data-[state=active]:bg-background">
            ER 图
          </TabsTrigger>
          <TabsTrigger value="monitor" className="data-[state=active]:bg-background">
            监控
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
          <TooltipProvider>
            {/* 工具栏容器：固定高度，禁止压缩，支持横向滚动 */}
            <div className="flex-shrink-0 border-b">
              {/* 第一行：主要操作按钮 */}
              <div className="px-3 py-2 flex items-center gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap min-w-max">
                {/* 第一组：新增、删除 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleOpenAddDialog} disabled={!table}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      新增
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>新增一条记录</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleDeleteSelected} disabled={selectedRows.size === 0}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      删除
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>删除选中的记录</TooltipContent>
                </Tooltip>

                {/* 分隔线 */}
                <div className="w-px h-4 bg-border mx-1 shrink-0" />

                {/* 第二组：设计表、复制表 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => setShowTableDesignDialog(true)} disabled={!table}>
                      <Layout className="h-3.5 w-3.5 mr-1.5" />
                      设计表
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>设计表结构</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => alert('复制表功能开发中')} disabled={!table}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      复制表
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>复制表结构和数据</TooltipContent>
                </Tooltip>

                {/* 分隔线 */}
                <div className="w-px h-4 bg-border mx-1 shrink-0" />

                {/* 第三组：导出、刷新 */}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" disabled={!currentData || currentData.rows.length === 0}>
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          导出
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>导出数据</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setShowExportDialog(true); setExportFormat('csv'); }}>
                      导出为 CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setShowExportDialog(true); setExportFormat('json'); }}>
                      导出为 JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={loadTableData} disabled={!table}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      刷新
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>刷新数据</TooltipContent>
                </Tooltip>

                {/* 分隔线 */}
                <div className="w-px h-4 bg-border mx-1 shrink-0" />

                {/* 第四组：开始事务、提交、回滚 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleBeginTransaction} disabled={!connectionId || inTransaction}>
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                      开始事务
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>开始新事务</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleCommitTransaction} disabled={!inTransaction}>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      提交
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>提交当前事务</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleRollbackTransaction} disabled={!inTransaction}>
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      回滚
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>回滚当前事务</TooltipContent>
                </Tooltip>

                {/* 事务状态指示器 */}
                {inTransaction && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs shrink-0">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    事务进行中
                  </div>
                )}
              </div>

              {/* 第二行：高级功能 */}
              <div className="px-3 py-1.5 bg-muted/30 flex items-center gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap min-w-max">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={loadSlowQueryConfig} disabled={!connectionId} className="text-xs h-6">
                      <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                      慢查询分析
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>分析慢查询日志</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={handleBackup} disabled={!database} className="text-xs h-6">
                      <Database className="h-3.5 w-3.5 mr-1.5" />
                      备份数据库
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>备份数据库</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => setShowDataComparisonDialog(true)} disabled={!connectionId || !table} className="text-xs h-6">
                      <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                      数据对比
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>对比数据差异</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="ghost" onClick={() => setShowQueryHistoryDialog(true)} className="text-xs h-6">
                      <History className="h-3.5 w-3.5 mr-1.5" />
                      查询历史
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>查看查询历史</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>

      {/* SQL 编辑器：固定高度 200px，禁止压缩 */}
      <div className="flex-shrink-0 p-3 border-b h-[80px]">
        <div className="flex gap-2 h-full">
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="输入 SQL 查询..."
            className="flex-1 h-full p-2 text-sm border rounded-md resize-none font-mono"
          />
          <div className="flex flex-col gap-2">
            <Button onClick={executeQuery} disabled={loading || !sqlQuery.trim()}>
              <Play className="h-4 w-4 mr-2" />
              执行
            </Button>
            <Button onClick={explainQuery} disabled={loading || !sqlQuery.trim()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              执行计划
            </Button>
          </div>
        </div>
      </div>

      {/* 结果表格区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!loading && currentData && (
          <>
            {/* 统计信息栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
              <h3 className="text-sm font-semibold">
                {queryResult ? '查询结果' : `数据: ${database}.${table}`}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>共 {currentData.total} 条</span>
                {queryExecutionTime !== null && (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-primary">查询耗时: {queryExecutionTime} ms</span>
                  </>
                )}
                <ChevronRight className="h-4 w-4" />
                <span>已选 {selectedRows.size} 条</span>
              </div>
            </div>
            
            {/* 表格滚动区域 - 固定高度 680px（15条数据+表头） */}
            <div className="overflow-auto p-4 border rounded-md shrink-0" style={{ height: '680px', minHeight: '680px', maxWidth: '100%' }}>
              <table className="text-sm border-collapse" style={{ width: '100%', tableLayout: 'fixed' }}>
                <colgroup>
                  <col className="w-10" />
                  {visibleColumns.map((col) => (
                    <col key={col} className="w-[150px]" />
                  ))}
                  <col className="w-20" />
                </colgroup>
                <thead className="sticky top-0 bg-background z-20 shadow-sm">
                  <tr>
                    <th className="px-2 py-2 border-b border-r font-semibold bg-background text-left">
                      <Checkbox
                        checked={selectedRows.size === currentData.rows.length && currentData.rows.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    {visibleColumns.map((col) => (
                      <th key={col} className="px-4 py-2 border-b border-r font-semibold text-left whitespace-nowrap bg-background overflow-hidden">
                        {col}
                      </th>
                    ))}
                    <th className="px-2 py-2 border-b font-semibold text-left bg-background">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.rows.map((row, rowIndex) => {
                    const isExpanded = expandedRows.has(rowIndex);
                    const isSelected = selectedRows.has(rowIndex);
                    return (
                      <React.Fragment key={rowIndex}>
                        <tr className={cn("hover:bg-muted/50", isSelected && "bg-primary/5")}>
                          <td className="px-2 py-2 border-b border-r sticky left-0 bg-background z-10">
                            <div className="flex items-center gap-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectRow(rowIndex, checked as boolean)}
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleToggleExpand(rowIndex)}
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </Button>
                            </div>
                          </td>
                          {visibleColumns.map((col) => {
                            const colIndex = currentColumns.indexOf(col);
                            return (
                              <td key={col} className="px-4 py-2 border-b border-r overflow-hidden sticky bg-background group relative">
                                <div className="truncate" title={row[colIndex] || ''}>
                                  {row[colIndex] || ''}
                                </div>
                                <button
                                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted cursor-pointer"
                                  onClick={() => {
                                    const value = row[colIndex] || '';
                                    setViewCellData({ value, columnName: col });
                                    setViewFormat(detectFormat(value));
                                  }}
                                >
                                  <ZoomIn className="h-3 w-3" />
                                </button>
                              </td>
                            );
                          })}
                          <td className="px-2 py-2 border-b sticky right-0 bg-background z-10">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleOpenEditDialog(rowIndex)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td className="border-b border-r bg-muted/30 sticky left-0 z-10"></td>
                            <td colSpan={visibleColumns.length + 1} className="border-b">
                              <div className="p-4">
                                <pre className="text-xs font-mono bg-background p-3 rounded border overflow-auto">
                                  {JSON.stringify(
                                    Object.fromEntries(currentColumns.map((col, i) => [col, row[i]])),
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页按钮栏 */}
            {!queryResult && tableData && (
              <div className="flex items-center justify-between px-4 py-2 border-t shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  {Math.ceil(tableData.total / pageSize)} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= tableData.total}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}

        {!loading && !currentData && (
          <div className="flex-1 flex items-center justify-center">
            请选择一个表或执行 SQL 查询
          </div>
        )}
      </div>

      {/* 状态栏：固定高度 28px */}
      <div className="flex-shrink-0 border-t px-3 py-1 flex items-center justify-between bg-muted/30 text-xs text-muted-foreground h-7">
        <div className="flex items-center gap-4">
          {connectionId && (
            <span className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              {connectionId}
            </span>
          )}
          {database && (
            <span className="flex items-center gap-1">
              <Table className="h-3 w-3" />
              {database}
            </span>
          )}
          {table && (
            <span className="flex items-center gap-1">
              <Columns className="h-3 w-3" />
              {table}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {queryExecutionTime !== null && (
            <span>耗时: {queryExecutionTime}ms</span>
          )}
          {currentData && (
            <span>记录: {currentData.total}</span>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="logs" className="flex-1 m-0 p-0 overflow-hidden">
          <AuditLogPanel connectionId={connectionId} database={database} />
        </TabsContent>

        <TabsContent value="er" className="flex-1 m-0 p-0 overflow-hidden">
          <ERDiagramPanel connectionId={connectionId} database={database} />
        </TabsContent>

        <TabsContent value="monitor" className="flex-1 m-0 p-0 overflow-hidden">
          <DatabaseMonitorPanel connectionId={connectionId || ''} databaseType="mysql" />
        </TabsContent>
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>编辑记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {currentColumns.map((col) => (
              <div key={col} className="space-y-1">
                <Label htmlFor={`edit-${col}`}>{col}</Label>
                <Input
                  id={`edit-${col}`}
                  value={editFormData[col] || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, [col]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>新增记录</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {currentColumns.map((col) => (
              <div key={col} className="space-y-1">
                <Label htmlFor={`add-${col}`}>{col}</Label>
                <Input
                  id={`add-${col}`}
                  value={addFormData[col] || ''}
                  onChange={(e) => setAddFormData({ ...addFormData, [col]: e.target.value })}
                  placeholder={`输入 ${col}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleSaveAdd}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>搜索数据</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>搜索关键词</Label>
              <Input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="输入关键词，将在所有字段中搜索"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              将在以下字段中搜索：{visibleColumns.join(', ')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSearchDialog(false)}>取消</Button>
            <Button onClick={handleSearch} disabled={!searchKeyword.trim()}>搜索</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSchemaDialog} onOpenChange={setShowSchemaDialog}>
        <DialogContent className="max-h-[80vh] overflow-auto" style={{ width: '1200px', maxWidth: '1200px' }}>
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>表结构: {database}.{table}</DialogTitle>
              <Button size="sm" onClick={handleAddColumn}>
                <Plus className="h-4 w-4 mr-2" />
                添加字段
              </Button>
            </div>
          </DialogHeader>
          {schemaLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr>
                    <th className="px-4 py-2 text-left border-b min-w-[120px]">字段名</th>
                    <th className="px-4 py-2 text-left border-b min-w-[120px]">类型</th>
                    <th className="px-4 py-2 text-left border-b min-w-[80px]">允许空</th>
                    <th className="px-4 py-2 text-left border-b min-w-[80px]">键</th>
                    <th className="px-4 py-2 text-left border-b min-w-[120px]">默认值</th>
                    <th className="px-4 py-2 text-left border-b min-w-[120px]">额外信息</th>
                    <th className="px-4 py-2 text-left border-b min-w-[150px]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tableSchema.map((col, i) => (
                    <tr key={i} className="hover:bg-muted/50">
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.name}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.type}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.nullable}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.key}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.default}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">{col.extra}</td>
                      <td className="px-4 py-2 border-b whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon-xs" onClick={() => handleEditColumn(i)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon-xs" onClick={() => handleDeleteColumn(i)} className="text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSchemaDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateTableDialog} onOpenChange={setShowCreateTableDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>创建表</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CREATE TABLE SQL 语句</Label>
              <textarea
                value={createTableSql}
                onChange={(e) => setCreateTableSql(e.target.value)}
                placeholder="CREATE TABLE table_name (id INT PRIMARY KEY, name VARCHAR(255))"
                className="w-full min-h-[200px] p-3 text-sm border rounded-md resize-none font-mono"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              示例：CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTableDialog(false)}>取消</Button>
            <Button onClick={handleCreateTable} disabled={!createTableSql.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewCellData !== null} onOpenChange={() => setViewCellData(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewCellData?.columnName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={viewFormat} onValueChange={(v) => setViewFormat(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="yaml">YAML</TabsTrigger>
                <TabsTrigger value="sql">SQL</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="bg-muted/50 rounded-lg p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[500px]">
                {formatValue(viewCellData?.value || '', viewFormat)}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (viewCellData?.value) {
                  navigator.clipboard.writeText(viewCellData.value);
                }
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              复制
            </Button>
            <Button onClick={() => setViewCellData(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              导出数据 - {exportFormat === 'csv' ? 'CSV' : 'JSON'} 格式
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exportFileName">文件名</Label>
              <Input
                id="exportFileName"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder={table || 'data'}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {exportFormat === 'csv' 
                ? '导出为 CSV 格式，可用 Excel 打开，支持中文显示'
                : '导出为 JSON 格式，包含所有列名和数据'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>取消</Button>
            <Button onClick={handleExport}>导出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              确定要删除选中的 <strong>{deleteCount}</strong> 条记录吗？
            </p>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-mono text-muted-foreground mb-2">将要执行的 SQL：</p>
              <pre className="text-xs font-mono break-all">{deleteSqlPreview}</pre>
            </div>
            <p className="text-sm text-destructive">
              此操作不可逆！删除后数据将无法恢复。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirmDialog(false)}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSchemaEditDialog} onOpenChange={setShowSchemaEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {schemaEditMode === 'modify' ? '修改字段' : '添加字段'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">字段名</Label>
              <Input
                id="column-name"
                value={editColumnForm.name}
                onChange={(e) => setEditColumnForm({ ...editColumnForm, name: e.target.value })}
                placeholder="输入字段名"
                disabled={schemaEditMode === 'modify'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="column-definition">字段定义</Label>
              <textarea
                id="column-definition"
                value={editColumnForm.definition}
                onChange={(e) => setEditColumnForm({ ...editColumnForm, definition: e.target.value })}
                placeholder="例如: VARCHAR(255) NOT NULL DEFAULT 'test'"
                className="w-full min-h-[100px] p-3 text-sm border rounded-md resize-none font-mono"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold mb-2">示例字段定义：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>INT NOT NULL AUTO_INCREMENT PRIMARY KEY</li>
                <li>VARCHAR(255) NOT NULL</li>
                <li>TEXT</li>
                <li>DATETIME DEFAULT CURRENT_TIMESTAMP</li>
                <li>DECIMAL(10, 2) DEFAULT 0.00</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSchemaEditDialog(false)}>取消</Button>
            <Button onClick={handleSaveColumnEdit}>
              {schemaEditMode === 'modify' ? '保存修改' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TableDesignDialog
        open={showTableDesignDialog}
        onOpenChange={setShowTableDesignDialog}
        connectionId={connectionId || ''}
        database={database || ''}
        table={table || ''}
        onSaved={() => {
          if (table) {
            loadTableData();
            loadTableSchema();
          }
        }}
      />

      <DataComparisonDialog
        open={showDataComparisonDialog}
        onOpenChange={setShowDataComparisonDialog}
        connectionId={connectionId || ''}
        database={database || ''}
        table={table || ''}
      />

      <QueryHistoryDialog
        open={showQueryHistoryDialog}
        onOpenChange={setShowQueryHistoryDialog}
        onSelectQuery={(sql) => setSqlQuery(sql)}
        connectionId={connectionId}
        database={database}
      />

      {/* EXPLAIN 执行计划对话框 */}
      <Dialog open={showExplainDialog} onOpenChange={setShowExplainDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '1000px', maxWidth: '1000px' }}>
          <DialogHeader>
            <DialogTitle>查询执行计划</DialogTitle>
          </DialogHeader>
          {explainLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">id</th>
                    <th className="px-4 py-2 text-left border-b">select_type</th>
                    <th className="px-4 py-2 text-left border-b">table</th>
                    <th className="px-4 py-2 text-left border-b">partitions</th>
                    <th className="px-4 py-2 text-left border-b">type</th>
                    <th className="px-4 py-2 text-left border-b">possible_keys</th>
                    <th className="px-4 py-2 text-left border-b">key</th>
                    <th className="px-4 py-2 text-left border-b">key_len</th>
                    <th className="px-4 py-2 text-left border-b">ref</th>
                    <th className="px-4 py-2 text-left border-b">rows</th>
                    <th className="px-4 py-2 text-left border-b">filtered</th>
                    <th className="px-4 py-2 text-left border-b">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {explainResult.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/50">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2 border-b">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowExplainDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 慢查询分析对话框 */}
      <Dialog open={showSlowQueryDialog} onOpenChange={setShowSlowQueryDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto" style={{ width: '800px', maxWidth: '800px' }}>
          <DialogHeader>
            <DialogTitle>慢查询配置</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr>
                  <th className="px-4 py-2 text-left border-b">配置项</th>
                  <th className="px-4 py-2 text-left border-b">值</th>
                </tr>
              </thead>
              <tbody>
                {slowQueryConfig.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/50">
                    <td className="px-4 py-2 border-b font-semibold">{row[0]}</td>
                    <td className="px-4 py-2 border-b">{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm">
            <p className="font-semibold mb-2">慢查询配置说明：</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>slow_query_log</strong>: 是否开启慢查询日志</li>
              <li><strong>slow_query_log_file</strong>: 慢查询日志文件路径</li>
              <li><strong>long_query_time</strong>: 慢查询时间阈值（秒）</li>
              <li><strong>log_queries_not_using_indexes</strong>: 是否记录未使用索引的查询</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSlowQueryDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 数据备份对话框 */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '1200px', maxWidth: '1200px' }}>
          <DialogHeader>
            <DialogTitle>数据库备份 - {database}</DialogTitle>
          </DialogHeader>
          {backupLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              <div className="mb-4 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">备份 SQL 语句</span>
                <Button size="sm" onClick={handleDownloadBackup}>
                  <Download className="h-4 w-4 mr-2" />
                  下载备份文件
                </Button>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[500px]">
                  {backupSql}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowBackupDialog(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, RefreshCw, ChevronRight, ChevronDown, Plus, Trash2, Edit, Search, Settings, Columns, Copy, ZoomIn, Download, LayoutTemplate, Check, Clock, Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { cn } from '../lib/utils';
import { useConnectionStore } from '../stores/connectionStore';
import { TableDesignDialog } from './TableDesignDialog';
import { ERDiagramDialog } from './ERDiagramDialog';
import { DataSyncDialog } from './DataSyncDialog';
import { DataComparisonDialog } from './DataComparisonDialog';
import { AuditLogDialog } from './AuditLogDialog';
import { ApiManagerDialog } from './ApiManagerDialog';
import { QueryHistoryDialog, addQueryToHistory } from './QueryHistoryDialog';
import { DataSyncPanel } from './DataSyncPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { ERDiagramPanel } from './ERDiagramPanel';

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
  const [showERDiagramDialog, setShowERDiagramDialog] = useState(false);
  const [showDataSyncDialog, setShowDataSyncDialog] = useState(false);
  const [showDataComparisonDialog, setShowDataComparisonDialog] = useState(false);
  const [showAuditLogDialog, setShowAuditLogDialog] = useState(false);
  const [showApiManagerDialog, setShowApiManagerDialog] = useState(false);
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

  const executeQuery = async () => {
    if (!connectionId || !sqlQuery.trim()) return;
    setLoading(true);
    const startTime = Date.now();
    try {
      const rows: string[][] = await invoke('execute_mysql_query', { connId: connectionId, sql: sqlQuery });
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      setQueryExecutionTime(executionTime);
      
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

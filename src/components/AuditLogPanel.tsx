import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Trash2, Download, RefreshCw } from 'lucide-react';

interface AuditLog {
  id: number;
  timestamp: string;
  user: string;
  host: string;
  operation_type: string;
  database: string | null;
  table: string | null;
  sql: string | null;
  result: string;
  error_message: string | null;
  execution_time_ms: number | null;
}

interface AuditLogPanelProps {
  connectionId: string | null;
  database: string | null;
}

export default function AuditLogPanel({ connectionId, database }: AuditLogPanelProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filterDatabase, setFilterDatabase] = useState('');
  const [filterOperationType, setFilterOperationType] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');
  const [tableCreated, setTableCreated] = useState(false);
  const [tableExists, setTableExists] = useState(false);

  useEffect(() => {
    if (connectionId) {
      checkTableExists();
    }
  }, [connectionId]);

  const checkTableExists = async () => {
    if (!connectionId) return;

    try {
      const exists = await invoke<boolean>('check_audit_log_table_exists', {
        connId: connectionId,
        database: database || '',
      });
      setTableExists(exists);
      if (exists) {
        loadLogs();
      }
    } catch (error) {
      console.error('检查审计日志表失败:', error);
      setTableExists(false);
    }
  };

  useEffect(() => {
    if (connectionId && tableExists) {
      loadLogs();
    }
  }, [connectionId, page, filterDatabase, filterOperationType, filterStartTime, filterEndTime, tableExists]);

  const loadLogs = async () => {
    if (!connectionId) return;

    setLoading(true);
    try {
      const result = await invoke<[AuditLog[], number]>('get_audit_logs', {
        connId: connectionId,
        database: filterDatabase || null,
        operation_type: filterOperationType || null,
        start_time: filterStartTime || null,
        end_time: filterEndTime || null,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setLogs(result[0]);
      setTotal(result[1]);
      // 加载成功说明表存在
      if (!tableExists) {
        setTableExists(true);
      }
      setTableCreated(true);
    } catch (error) {
      console.error('加载审计日志失败:', error);
      // 不要设置 tableCreated = false，因为表可能已经存在只是没有数据
    } finally {
      setLoading(false);
    }
  };

  const createTable = async () => {
    if (!connectionId) return;

    try {
      await invoke('create_audit_log_table', {
        connId: connectionId,
        database: database || '',
      });
      setTableExists(true);
      setTableCreated(true);
      loadLogs();
    } catch (error) {
      console.error('创建审计日志表失败:', error);
      alert('创建审计日志表失败: ' + error);
    }
  };

  const clearLogs = async () => {
    if (!confirm('确定要清除所有审计日志吗？')) return;
    if (!connectionId) return;

    try {
      await invoke('clear_audit_logs', {
        connId: connectionId,
        database: database || '',
        before_date: null,
      });
      loadLogs();
    } catch (error) {
      console.error('清除审计日志失败:', error);
      alert('清除审计日志失败: ' + error);
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['ID', '时间', '用户', '主机', '操作类型', '数据库', '表', 'SQL', '结果', '错误信息', '执行时间'].join(','),
      ...logs.map(log => [
        log.id,
        log.timestamp,
        log.user,
        log.host,
        log.operation_type,
        log.database || '',
        log.table || '',
        log.sql?.replace(/"/g, '""') || '',
        log.result,
        log.error_message?.replace(/"/g, '""') || '',
        log.execution_time_ms || '',
      ].map(field => `"${field}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getOperationTypeBadge = (type: string) => {
    const typeMap: Record<string, { color: string; label: string }> = {
      CONNECT: { color: 'bg-blue-100 text-blue-800', label: '连接' },
      DISCONNECT: { color: 'bg-gray-100 text-gray-800', label: '断开' },
      QUERY: { color: 'bg-purple-100 text-purple-800', label: '查询' },
      INSERT: { color: 'bg-green-100 text-green-800', label: '插入' },
      UPDATE: { color: 'bg-yellow-100 text-yellow-800', label: '更新' },
      DELETE: { color: 'bg-red-100 text-red-800', label: '删除' },
      CREATE: { color: 'bg-indigo-100 text-indigo-800', label: '创建' },
      DROP: { color: 'bg-red-100 text-red-800', label: '删除' },
      ALTER: { color: 'bg-orange-100 text-orange-800', label: '修改' },
    };

    const style = typeMap[type] || { color: 'bg-gray-100 text-gray-800', label: type };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${style.color}`}>
        {style.label}
      </span>
    );
  };

  const getResultBadge = (result: string) => {
    return result === 'SUCCESS' ? (
      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
        成功
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
        失败
      </span>
    );
  };

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        请先连接数据库
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
        <p className="text-gray-500 text-center">
          审计日志表尚未创建。创建审计日志表后，系统将自动记录所有数据库操作。
        </p>
        <Button onClick={createTable}>创建审计日志表</Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">审计日志</h2>
        <div className="flex gap-2">
          <Button onClick={loadLogs} disabled={loading} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={clearLogs} variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            清除
          </Button>
          <Button onClick={exportLogs} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="grid grid-cols-4 gap-4">
        <div>
          <Label>数据库</Label>
          <Input
            value={filterDatabase}
            onChange={(e) => setFilterDatabase(e.target.value)}
            placeholder="输入数据库名称"
          />
        </div>
        <div>
          <Label>操作类型</Label>
          <Input
            value={filterOperationType}
            onChange={(e) => setFilterOperationType(e.target.value)}
            placeholder="输入操作类型"
          />
        </div>
        <div>
          <Label>开始时间</Label>
          <Input
            type="datetime-local"
            value={filterStartTime}
            onChange={(e) => setFilterStartTime(e.target.value)}
          />
        </div>
        <div>
          <Label>结束时间</Label>
          <Input
            type="datetime-local"
            value={filterEndTime}
            onChange={(e) => setFilterEndTime(e.target.value)}
          />
        </div>
      </div>

      {/* 统计信息 */}
      <div className="text-sm text-gray-500">
        共 {total} 条记录
      </div>

      {/* 日志表格 */}
      <ScrollArea className="flex-1 border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">时间</TableHead>
              <TableHead className="w-24">用户</TableHead>
              <TableHead className="w-24">主机</TableHead>
              <TableHead className="w-24">操作类型</TableHead>
              <TableHead className="w-24">数据库</TableHead>
              <TableHead className="w-24">表</TableHead>
              <TableHead>SQL</TableHead>
              <TableHead className="w-20">结果</TableHead>
              <TableHead className="w-24">执行时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  加载中...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500">
                  没有找到审计日志
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell className="text-sm">{log.user}</TableCell>
                  <TableCell className="text-sm">{log.host}</TableCell>
                  <TableCell>{getOperationTypeBadge(log.operation_type)}</TableCell>
                  <TableCell className="text-sm">{log.database || '-'}</TableCell>
                  <TableCell className="text-sm">{log.table || '-'}</TableCell>
                  <TableCell className="text-sm max-w-xs">
                    <div className="truncate" title={log.sql || ''}>
                      {log.sql || '-'}
                    </div>
                  </TableCell>
                  <TableCell>{getResultBadge(log.result)}</TableCell>
                  <TableCell className="text-sm">{log.execution_time_ms || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* 分页 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          第 {page} 页，共 {Math.ceil(total / pageSize)} 页
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            variant="outline"
            size="sm"
          >
            上一页
          </Button>
          <Button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / pageSize) || loading}
            variant="outline"
            size="sm"
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
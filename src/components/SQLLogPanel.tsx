import React, { useState, useEffect } from 'react';
import { useLogStore } from '../stores/logStore';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Trash2, Download, Search, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface SQLLogPanelProps {
  connectionId: string;
  database?: string;
}

export default function SQLLogPanel({ connectionId, database }: SQLLogPanelProps) {
  const logs = useLogStore((state) => state.logs);
  const addLog = useLogStore((state) => state.addLog);
  const clearLogs = useLogStore((state) => state.clearLogs);
  const exportLogs = useLogStore((state) => state.exportLogs);
  const getLogsByConnection = useLogStore((state) => state.getLogsByConnection);
  const getLogsByDatabase = useLogStore((state) => state.getLogsByDatabase);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');

  const filteredLogs = logs.filter(log => {
    const matchConnection = !connectionId || log.connectionId === connectionId;
    const matchDatabase = !database || log.database === database;
    const matchKeyword = !searchKeyword || log.sql.toLowerCase().includes(searchKeyword.toLowerCase());
    const matchStatus = filterStatus === 'all' || log.status === filterStatus;
    return matchConnection && matchDatabase && matchKeyword && matchStatus;
  });

  const handleExport = () => {
    const content = exportLogs();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sql_logs_${Date.now()}.txt`;
    link.click();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const stats = {
    total: filteredLogs.length,
    success: filteredLogs.filter(l => l.status === 'success').length,
    error: filteredLogs.filter(l => l.status === 'error').length,
    avgDuration: filteredLogs.length > 0 
      ? (filteredLogs.reduce((sum, l) => sum + l.duration, 0) / filteredLogs.length).toFixed(2)
      : '0.00',
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-lg font-semibold">SQL 执行日志</h3>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={clearLogs}
            disabled={filteredLogs.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            清空
          </Button>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              总日志数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              成功执行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              执行失败
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.error}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              平均耗时
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDuration}ms</div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和过滤 */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex-1">
          <Input
            placeholder="搜索 SQL 语句..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label>状态：</Label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'success' | 'error')}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">全部</option>
            <option value="success">成功</option>
            <option value="error">失败</option>
          </select>
        </div>
      </div>

      {/* 日志列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-2">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              暂无日志记录
            </div>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      {log.database && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                          {log.database}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {log.duration}ms
                      {log.affectedRows !== undefined && ` · ${log.affectedRows} 行`}
                    </div>
                  </div>
                  <div className="font-mono text-sm bg-muted p-2 rounded-md overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all">{log.sql}</pre>
                  </div>
                  {log.status === 'error' && log.result && (
                    <div className="mt-2 text-xs text-red-600">
                      {log.result}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
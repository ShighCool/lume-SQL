import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { RefreshCw, Check, X } from 'lucide-react';

interface ReplicationMasterStatus {
  file: string;
  position: string;
  binlog_do_db: string;
  binlog_ignore_db: string;
}

interface ReplicationSlaveStatus {
  slave_io_state: string;
  slave_io_running: boolean;
  slave_sql_running: boolean;
  last_error: string;
  seconds_behind_master: number;
  master_host: string;
  master_port: number;
  master_log_file: string;
  master_log_pos: string;
}

interface ReplicationStatus {
  master_status: ReplicationMasterStatus;
  slave_status: ReplicationSlaveStatus;
}

interface DataSyncPanelProps {
  connectionId: string | null;
  database: string | null;
  table: string | null;
}

export default function DataSyncPanel({ connectionId, database, table }: DataSyncPanelProps) {
  const [replicationStatus, setReplicationStatus] = useState<ReplicationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<any>(null);

  useEffect(() => {
    if (connectionId) {
      loadReplicationStatus();
    }
  }, [connectionId]);

  const loadReplicationStatus = async () => {
    if (!connectionId) return;

    setLoading(true);
    try {
      const result = await invoke<ReplicationStatus>('get_replication_status', {
        connId: connectionId,
      });
      setReplicationStatus(result);
    } catch (error) {
      console.error('获取复制状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConsistency = async () => {
    if (!connectionId || !table) {
      alert('请先选择一个表');
      return;
    }

    setLoading(true);
    try {
      const result = await invoke('check_data_consistency', {
        connId: connectionId,
        database,
        table,
      });
      setConsistencyResult(result);
    } catch (error) {
      console.error('检查数据一致性失败:', error);
      alert('检查失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-6 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">主从同步状态</h2>
        <Button onClick={loadReplicationStatus} disabled={loading} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {replicationStatus ? (
        <div className="space-y-6">
          {/* 主库状态 */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              主库状态
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Binlog 文件:</span>
                <span className="ml-2 font-mono">{replicationStatus.master_status.file || '未配置'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">位置:</span>
                <span className="ml-2 font-mono">{replicationStatus.master_status.position || '未配置'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">复制的数据库:</span>
                <span className="ml-2 font-mono">{replicationStatus.master_status.binlog_do_db || '无'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">忽略的数据库:</span>
                <span className="ml-2 font-mono">{replicationStatus.master_status.binlog_ignore_db || '无'}</span>
              </div>
            </div>
          </div>

          {/* 从库状态 */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                replicationStatus.slave_status.slave_io_running && replicationStatus.slave_status.slave_sql_running
                  ? 'bg-green-500'
                  : replicationStatus.slave_status.last_error
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}></span>
              从库状态
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">IO 线程:</span>
                <span className="ml-2">
                  {replicationStatus.slave_status.slave_io_running ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-4 w-4" /> 运行中
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <X className="h-4 w-4" /> 已停止
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">SQL 线程:</span>
                <span className="ml-2">
                  {replicationStatus.slave_status.slave_sql_running ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="h-4 w-4" /> 运行中
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <X className="h-4 w-4" /> 已停止
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">延迟时间:</span>
                <span className={`ml-2 font-semibold ${
                  replicationStatus.slave_status.seconds_behind_master > 10
                    ? 'text-red-600'
                    : replicationStatus.slave_status.seconds_behind_master > 0
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}>
                  {replicationStatus.slave_status.seconds_behind_master} 秒
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">主库主机:</span>
                <span className="ml-2 font-mono">
                  {replicationStatus.slave_status.master_host}:{replicationStatus.slave_status.master_port}
                </span>
              </div>
            </div>
            {replicationStatus.slave_status.last_error && (
              <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                错误: {replicationStatus.slave_status.last_error}
              </div>
            )}
          </div>

          {/* 数据一致性检查 */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">数据一致性检查</h3>
            <div className="flex gap-2">
              <Button onClick={checkConsistency} disabled={loading || !table} size="sm">
                检查数据一致性
              </Button>
            </div>
            {consistencyResult && (
              <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
                {typeof consistencyResult === 'string' ? consistencyResult : JSON.stringify(consistencyResult, null, 2)}
              </div>
            )}
          </div>

          {/* 说明 */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">主从同步说明</h3>
            <ul className="text-sm space-y-1 text-gray-700">
              <li>• 主库负责处理写操作，从库负责处理读操作</li>
              <li>• 数据通过 binlog 从主库同步到从库</li>
              <li>• IO 线程负责从主库读取 binlog</li>
              <li>• SQL 线程负责执行 binlog 中的事件</li>
              <li>• 延迟时间表示从库落后主库的时间</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          {loading ? '加载中...' : '暂无同步状态数据'}
        </div>
      )}
    </div>
  );
}
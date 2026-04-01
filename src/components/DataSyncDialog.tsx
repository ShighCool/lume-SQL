import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react';

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

interface DataSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  table: string;
}

export function DataSyncDialog({ open, onOpenChange, connectionId, database, table }: DataSyncDialogProps) {
  const [replicationStatus, setReplicationStatus] = useState<ReplicationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<string>('');
  const [consistencyLoading, setConsistencyLoading] = useState(false);

  useEffect(() => {
    if (open && connectionId) {
      loadReplicationStatus();
    }
  }, [open, connectionId]);

  const loadReplicationStatus = async () => {
    setLoading(true);
    try {
      const data = await invoke('get_replication_status', { connId: connectionId });
      setReplicationStatus(data as ReplicationStatus);
    } catch (error) {
      console.error('加载复制状态失败:', error);
      alert(`加载复制状态失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const checkConsistency = async () => {
    if (!database || !table) return;
    setConsistencyLoading(true);
    try {
      const result = await invoke('check_data_consistency', {
        connId: connectionId,
        database,
        table,
      });
      setConsistencyResult(result as string);
    } catch (error) {
      console.error('检查数据一致性失败:', error);
      alert(`检查数据一致性失败: ${error}`);
    } finally {
      setConsistencyLoading(false);
    }
  };

  const getStatusColor = (running: boolean, error: string) => {
    if (error) return 'text-red-500';
    if (running) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getStatusIcon = (running: boolean, error: string) => {
    if (error) return <XCircle className="h-4 w-4" />;
    if (running) return <CheckCircle className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto" style={{ width: '1000px', maxWidth: '1000px' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>数据同步 - {database}</DialogTitle>
            <Button size="sm" variant="outline" onClick={loadReplicationStatus} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* 主库状态 */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Database className="h-5 w-5" />
                主库状态
              </h3>
              {replicationStatus?.master_status.file ? (
                <div className="space-y-2 text-sm">
                  <div className="flex">
                    <span className="w-24 text-muted-foreground">Binlog 文件:</span>
                    <span className="font-mono">{replicationStatus.master_status.file}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-muted-foreground">位置:</span>
                    <span className="font-mono">{replicationStatus.master_status.position}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-muted-foreground">复制的数据库:</span>
                    <span>{replicationStatus.master_status.binlog_do_db || '无'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 text-muted-foreground">忽略的数据库:</span>
                    <span>{replicationStatus.master_status.binlog_ignore_db || '无'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">
                  当前实例未配置为主库
                </div>
              )}
            </div>

            {/* 从库状态 */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Database className="h-5 w-5" />
                从库状态
              </h3>
              {replicationStatus?.slave_status.slave_io_state === "Not configured" ? (
                <div className="text-muted-foreground text-sm">
                  当前实例未配置为从库
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-muted-foreground">IO 线程:</span>
                    <span className={getStatusColor(replicationStatus.slave_status.slave_io_running, replicationStatus.slave_status.last_error)}>
                      {getStatusIcon(replicationStatus.slave_status.slave_io_running, replicationStatus.slave_status.last_error)}
                      {replicationStatus.slave_status.slave_io_running ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-muted-foreground">SQL 线程:</span>
                    <span className={getStatusColor(replicationStatus.slave_status.slave_sql_running, replicationStatus.slave_status.last_error)}>
                      {getStatusIcon(replicationStatus.slave_status.slave_sql_running, replicationStatus.slave_status.last_error)}
                      {replicationStatus.slave_status.slave_sql_running ? '运行中' : '已停止'}
                    </span>
                  </div>
                  {replicationStatus.slave_status.last_error && (
                    <div className="flex">
                      <span className="w-24 text-muted-foreground">错误信息:</span>
                      <span className="text-red-500">{replicationStatus.slave_status.last_error}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-24 text-muted-foreground">延迟时间:</span>
                    <span className={cn(
                      "font-semibold",
                      replicationStatus.slave_status.seconds_behind_master > 0 ? "text-orange-500" : "text-green-500"
                    )}>
                      {replicationStatus.slave_status.seconds_behind_master > 0 
                        ? `${replicationStatus.slave_status.seconds_behind_master} 秒` 
                        : '无延迟'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 数据一致性检查 */}
            {table && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-3">数据一致性检查</h3>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={checkConsistency} 
                    disabled={consistencyLoading}
                    variant="outline"
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", consistencyLoading && "animate-spin")} />
                    检查表 {table} 的一致性
                  </Button>
                </div>
                {consistencyResult && (
                  <div className="mt-3 p-3 bg-background rounded border">
                    <pre className="text-sm whitespace-pre-wrap">{consistencyResult}</pre>
                  </div>
                )}
              </div>
            )}

            {/* 同步说明 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h3 className="font-semibold mb-2">关于主从同步</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• <strong>IO 线程</strong>: 负责从主库读取二进制日志事件</p>
                <p>• <strong>SQL 线程</strong>: 负责执行从主库读取的事件</p>
                <p>• <strong>延迟时间</strong>: 从库落后主库的时间（秒）</p>
                <p>• 正常情况下，两个线程都应该显示"运行中"状态</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
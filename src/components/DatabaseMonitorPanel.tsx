import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { RefreshCw, Activity, Database, Clock, AlertTriangle, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DatabaseType = 'mysql' | 'redis' | 'mongodb';

interface BaseMonitorData {
  timestamp: number;
  qps: number;
  connections: number;
  cpu_usage: number;
  memory_usage: number;
  uptime: number;
}

interface MySQLMonitorData extends BaseMonitorData {
  slow_queries: number;
  innodb_buffer_pool_hit: number;
}

interface RedisMonitorData extends BaseMonitorData {
  total_keys: number;
  expired_keys: number;
  evicted_keys: number;
  total_commands: number;
  total_connections: number;
  memory_peak: number;
  hit_rate: number;
}

interface MongoDBMonitorData extends BaseMonitorData {
  collections: number;
  data_size: number;
  index_size: number;
  documents: number;
}

type MonitorData = MySQLMonitorData | RedisMonitorData | MongoDBMonitorData;

interface DatabaseMonitorPanelProps {
  connectionId: string;
  databaseType: DatabaseType;
}

export default function DatabaseMonitorPanel({ connectionId, databaseType }: DatabaseMonitorPanelProps) {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [historyData, setHistoryData] = useState<MonitorData[]>([]);
  const [loading, setLoading] = useState(false);

  const getCommandName = () => {
    switch (databaseType) {
      case 'mysql':
        return 'get_mysql_monitor_data';
      case 'redis':
        return 'get_redis_monitor_data';
      case 'mongodb':
        return 'get_mongodb_monitor_data';
    }
  };

  const loadMonitorData = async () => {
    if (!connectionId) return;

    setLoading(true);
    try {
      const commandName = getCommandName();
      const result: string = await invoke(commandName, { connId: connectionId });
      const data: MonitorData = JSON.parse(result);
      setMonitorData(data);

      // 添加到历史数据（保留最近60个点）
      setHistoryData(prev => {
        const newHistory = [...prev, data];
        if (newHistory.length > 60) {
          newHistory.shift();
        }
        return newHistory;
      });
    } catch (error) {
      console.error('加载监控数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!connectionId) return;

    // 立即加载一次
    loadMonitorData();

    // 每3秒更新一次
    const interval = setInterval(() => {
      loadMonitorData();
    }, 3000);

    return () => clearInterval(interval);
  }, [connectionId, databaseType]);

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds} 秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`;
    return `${Math.floor(seconds / 86400)} 天`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };

  const formatMemory = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderMetricCards = () => {
    if (!monitorData) return null;

    switch (databaseType) {
      case 'mysql':
        const mysqlData = monitorData as MySQLMonitorData;
        return (
          <>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">QPS</div>
                    <div className="text-xs text-muted-foreground">每秒查询数</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{(mysqlData.qps ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">连接数</div>
                    <div className="text-xs text-muted-foreground">当前连接</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{mysqlData.connections ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">慢查询</div>
                    <div className="text-xs text-muted-foreground">总慢查询数</div>
                  </div>
                </div>
                <div className={`text-2xl font-bold ${(mysqlData.slow_queries ?? 0) > 0 ? 'text-orange-600' : ''}`}>
                  {mysqlData.slow_queries ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">运行时间</div>
                    <div className="text-xs text-muted-foreground">正常运行时间</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{formatUptime(mysqlData.uptime ?? 0)}</div>
              </CardContent>
            </Card>
          </>
        );

      case 'redis':
        const redisData = monitorData as RedisMonitorData;
        return (
          <>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">QPS</div>
                    <div className="text-xs text-muted-foreground">每秒命令数</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{(redisData.qps ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">连接数</div>
                    <div className="text-xs text-muted-foreground">当前连接</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{redisData.connections ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Key 数量</div>
                    <div className="text-xs text-muted-foreground">总 Key 数</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{(redisData.total_keys ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">运行时间</div>
                    <div className="text-xs text-muted-foreground">正常运行时间</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{formatUptime(redisData.uptime ?? 0)}</div>
              </CardContent>
            </Card>
          </>
        );

      case 'mongodb':
        const mongoData = monitorData as MongoDBMonitorData;
        return (
          <>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">QPS</div>
                    <div className="text-xs text-muted-foreground">每秒操作数</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{(mongoData.qps ?? 0).toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">连接数</div>
                    <div className="text-xs text-muted-foreground">当前连接</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{mongoData.connections ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">文档数</div>
                    <div className="text-xs text-muted-foreground">总文档数</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{(mongoData.documents ?? 0).toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">运行时间</div>
                    <div className="text-xs text-muted-foreground">正常运行时间</div>
                  </div>
                </div>
                <div className="text-2xl font-bold">{formatUptime(mongoData.uptime ?? 0)}</div>
              </CardContent>
            </Card>
          </>
        );
    }
  };

  const renderAdditionalMetrics = () => {
    if (!monitorData) return null;

    switch (databaseType) {
      case 'mysql':
        const mysqlData = monitorData as MySQLMonitorData;
        return (
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-muted-foreground">InnoDB 缓冲池命中率</div>
                <div className="text-xs text-muted-foreground">
                  {(mysqlData.innodb_buffer_pool_hit ?? 0) >= 95 ? '✓ 优秀 (≥95%)' : '⚠ 需要优化'}
                </div>
              </div>
              <div className="text-3xl font-bold">{(mysqlData.innodb_buffer_pool_hit ?? 0).toFixed(2)}%</div>
            </CardContent>
          </Card>
        );

      case 'redis':
        const redisData = monitorData as RedisMonitorData;
        return (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">内存使用</div>
                  <div className="text-xs text-muted-foreground">峰值: {formatMemory(redisData.memory_peak ?? 0)}</div>
                </div>
                <div className="text-2xl font-bold">{formatMemory(redisData.memory_usage ?? 0)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">命中率</div>
                  <div className="text-xs text-muted-foreground">缓存命中率</div>
                </div>
                <div className="text-2xl font-bold">{(redisData.hit_rate ?? 0).toFixed(2)}%</div>
              </CardContent>
            </Card>
          </div>
        );

      case 'mongodb':
        const mongoData = monitorData as MongoDBMonitorData;
        return (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">集合数</div>
                  <div className="text-xs text-muted-foreground">总集合数</div>
                </div>
                <div className="text-2xl font-bold">{mongoData.collections ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">数据大小</div>
                  <div className="text-xs text-muted-foreground">占用空间</div>
                </div>
                <div className="text-2xl font-bold">{formatMemory(mongoData.data_size ?? 0)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">索引大小</div>
                  <div className="text-xs text-muted-foreground">占用空间</div>
                </div>
                <div className="text-2xl font-bold">{formatMemory(mongoData.index_size ?? 0)}</div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  const getChartData = () => {
    return historyData.map(item => ({
      time: formatTimestamp(item.timestamp),
      QPS: item.qps ?? 0,
      连接数: item.connections ?? 0,
      ...(databaseType === 'mysql' && {
        慢查询: (item as MySQLMonitorData).slow_queries ?? 0,
        命中率: (item as MySQLMonitorData).innodb_buffer_pool_hit ?? 0,
      }),
      ...(databaseType === 'redis' && {
        Key数: (item as RedisMonitorData).total_keys ?? 0,
        命中率: (item as RedisMonitorData).hit_rate ?? 0,
      }),
      ...(databaseType === 'mongodb' && {
        文档数: (item as MongoDBMonitorData).documents ?? 0,
      }),
    }));
  };

  const chartData = getChartData();

  return (
    <div className="h-full flex flex-col gap-4">
      {!connectionId ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          请先连接数据库
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-2">
            {/* 实时指标卡片 */}
            <div className="grid grid-cols-4 gap-4">
              {renderMetricCards()}
            </div>

            {/* 附加指标 */}
            {renderAdditionalMetrics()}

            {/* 图表 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>实时监控图表</CardTitle>
                  <button
                    onClick={loadMonitorData}
                    className="p-2 hover:bg-muted rounded-md transition-colors"
                    title="刷新"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div style={{ width: '100%', height: '400px' }}>
                    <ResponsiveContainer width="100%" height={400} aspect={undefined}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="QPS" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="连接数" stroke="#10b981" strokeWidth={2} dot={false} />
                        {databaseType === 'mysql' && (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="慢查询" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="命中率" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                          </>
                        )}
                        {databaseType === 'redis' && (
                          <>
                            <Line yAxisId="left" type="monotone" dataKey="Key数" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="命中率" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                          </>
                        )}
                        {databaseType === 'mongodb' && (
                          <Line yAxisId="left" type="monotone" dataKey="文档数" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    正在收集数据...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
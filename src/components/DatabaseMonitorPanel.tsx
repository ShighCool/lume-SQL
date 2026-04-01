import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { RefreshCw, Activity, Database, Clock, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonitorData {
  timestamp: number;
  qps: number;
  connections: number;
  slow_queries: number;
  cpu_usage: number;
  memory_usage: number;
  uptime: number;
  innodb_buffer_pool_hit: number;
}

interface DatabaseMonitorPanelProps {
  connectionId: string;
}

export default function DatabaseMonitorPanel({ connectionId }: DatabaseMonitorPanelProps) {
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [historyData, setHistoryData] = useState<MonitorData[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMonitorData = async () => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      const data: MonitorData = await invoke('get_mysql_monitor_data', { connId: connectionId });
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
  }, [connectionId]);

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

  const chartData = historyData.map(item => ({
    time: formatTimestamp(item.timestamp),
    QPS: item.qps,
    连接数: item.connections,
    慢查询: item.slow_queries,
    命中率: item.innodb_buffer_pool_hit,
  }));

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-lg font-semibold">数据库监控</h3>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button 
            onClick={loadMonitorData}
            className="p-2 hover:bg-muted rounded-md transition-colors"
            title="刷新"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!connectionId ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          请先连接数据库
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-2">
            {/* 实时指标卡片 */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    QPS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monitorData?.qps.toFixed(2) || '0.00'}</div>
                  <div className="text-xs text-muted-foreground mt-1">每秒查询数</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    连接数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monitorData?.connections || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">当前连接</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    慢查询
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${monitorData && monitorData.slow_queries > 0 ? 'text-orange-600' : ''}`}>
                    {monitorData?.slow_queries || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">总慢查询数</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    运行时间
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monitorData ? formatUptime(monitorData.uptime) : '--'}</div>
                  <div className="text-xs text-muted-foreground mt-1">正常运行时间</div>
                </CardContent>
              </Card>
            </div>

            {/* 缓冲池命中率 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">InnoDB 缓冲池命中率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{monitorData?.innodb_buffer_pool_hit.toFixed(2) || '0.00'}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {monitorData && monitorData.innodb_buffer_pool_hit >= 95 ? '✓ 优秀 (≥95%)' : '⚠ 需要优化'}
                </div>
              </CardContent>
            </Card>

            {/* 图表 */}
            <Card>
              <CardHeader>
                <CardTitle>实时监控图表</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="QPS" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="连接数" stroke="#10b981" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="慢查询" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="命中率" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
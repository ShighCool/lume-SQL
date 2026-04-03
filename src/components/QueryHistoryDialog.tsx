import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Search, Trash2, Play, Clock, X } from 'lucide-react';

interface QueryHistoryItem {
  id: string;
  sql: string;
  timestamp: number;
  database: string | null;
  connectionId: string;
  executionTime?: number;
  rowCount?: number;
}

interface QueryHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuery: (sql: string) => void;
  connectionId: string | null;
  database: string | null;
}

const STORAGE_KEY = 'querydb_query_history';

export default function QueryHistoryDialog({
  open,
  onOpenChange,
  onSelectQuery,
  connectionId,
  database,
}: QueryHistoryDialogProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<QueryHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  useEffect(() => {
    filterHistory();
  }, [searchQuery, history]);

  const loadHistory = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items: QueryHistoryItem[] = JSON.parse(stored);
        // 按时间倒序排列
        items.sort((a, b) => b.timestamp - a.timestamp);
        setHistory(items);
      }
    } catch (error) {
      // Error handling without console logging
    } finally {
      setLoading(false);
    }
  };

  const saveHistory = (items: QueryHistoryItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      // Error handling without console logging
    }
  };

  const filterHistory = () => {
    let filtered = [...history];

    // 按连接 ID 过滤
    if (connectionId) {
      filtered = filtered.filter(item => item.connectionId === connectionId);
    }

    // 按数据库过滤
    if (database) {
      filtered = filtered.filter(item => item.database === database);
    }

    // 按搜索关键词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.sql.toLowerCase().includes(query)
      );
    }

    setFilteredHistory(filtered);
  };

  const handleSelectQuery = (item: QueryHistoryItem) => {
    onSelectQuery(item.sql);
    onOpenChange(false);
  };

  const handleDeleteQuery = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要删除这条查询历史吗？')) return;

    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const handleClearAll = () => {
    if (!confirm('确定要清空所有查询历史吗？此操作不可恢复。')) return;

    setHistory([]);
    saveHistory([]);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    // 小于 1 分钟
    if (diff < 60000) {
      return '刚刚';
    }
    // 小于 1 小时
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} 分钟前`;
    }
    // 小于 1 天
    if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)} 小时前`;
    }
    // 小于 7 天
    if (diff < 604800000) {
      return `${Math.floor(diff / 86400000)} 天前`;
    }

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getQueryType = (sql: string) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return '查询';
    if (trimmed.startsWith('INSERT')) return '插入';
    if (trimmed.startsWith('UPDATE')) return '更新';
    if (trimmed.startsWith('DELETE')) return '删除';
    if (trimmed.startsWith('CREATE')) return '创建';
    if (trimmed.startsWith('DROP')) return '删除';
    if (trimmed.startsWith('ALTER')) return '修改';
    if (trimmed.startsWith('SHOW')) return '显示';
    return '其他';
  };

  const getQueryTypeColor = (sql: string) => {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'bg-blue-100 text-blue-800';
    if (trimmed.startsWith('INSERT')) return 'bg-green-100 text-green-800';
    if (trimmed.startsWith('UPDATE')) return 'bg-yellow-100 text-yellow-800';
    if (trimmed.startsWith('DELETE')) return 'bg-red-100 text-red-800';
    if (trimmed.startsWith('CREATE')) return 'bg-purple-100 text-purple-800';
    if (trimmed.startsWith('DROP')) return 'bg-red-100 text-red-800';
    if (trimmed.startsWith('ALTER')) return 'bg-orange-100 text-orange-800';
    if (trimmed.startsWith('SHOW')) return 'bg-cyan-100 text-cyan-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>查询历史</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 space-y-4">
          {/* 搜索栏 */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索 SQL 语句..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadHistory}
            >
              刷新
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={history.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              清空
            </Button>
          </div>

          {/* 统计信息 */}
          <div className="text-sm text-gray-500">
            共 {filteredHistory.length} 条查询历史
          </div>

          {/* 历史列表 */}
          <ScrollArea className="flex-1 border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">加载中...</div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Clock className="h-12 w-12 mb-2 opacity-50" />
                <div>暂无查询历史</div>
              </div>
            ) : (
              <div className="divide-y">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectQuery(item)}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getQueryTypeColor(item.sql)}`}>
                            {getQueryType(item.sql)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(item.timestamp)}
                          </span>
                          {item.database && (
                            <span className="text-xs text-gray-400">
                              @ {item.database}
                            </span>
                          )}
                          {item.executionTime !== undefined && (
                            <span className="text-xs text-gray-400">
                              {item.executionTime}ms
                            </span>
                          )}
                        </div>
                        <pre className="text-sm font-mono bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                          {item.sql}
                        </pre>
                        {item.rowCount !== undefined && (
                          <div className="text-xs text-gray-500 mt-1">
                            影响行数: {item.rowCount}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectQuery(item);
                          }}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleDeleteQuery(item.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* 使用提示 */}
          <div className="text-xs text-gray-500">
            <p>• 点击查询可将其加载到 SQL 编辑器</p>
            <p>• 查询历史保存在本地浏览器存储中</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// 添加查询到历史的辅助函数
export function addQueryToHistory(
  sql: string,
  connectionId: string,
  database: string | null,
  executionTime?: number,
  rowCount?: number
) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let items: QueryHistoryItem[] = stored ? JSON.parse(stored) : [];

    const newItem: QueryHistoryItem = {
      id: Date.now().toString(),
      sql: sql.trim(),
      timestamp: Date.now(),
      database,
      connectionId,
      executionTime,
      rowCount,
    };

    // 添加到开头
    items.unshift(newItem);

    // 限制历史记录数量（最多 1000 条）
    if (items.length > 1000) {
      items = items.slice(0, 1000);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    // Error handling without console logging
  }
}
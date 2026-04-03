import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Plus, Trash2, RefreshCw, Clock, Terminal, Download, Edit2, Activity, X, ChevronDown } from 'lucide-react';

// Redis 常用命令列表，用于命令提示
const REDIS_COMMANDS = [
  // String 操作
  { name: 'SET', description: '设置键值' },
  { name: 'GET', description: '获取键值' },
  { name: 'SETNX', description: '当键不存在时设置值' },
  { name: 'SETEX', description: '设置键值并指定过期时间' },
  { name: 'GETSET', description: '获取旧值并设置新值' },
  { name: 'MGET', description: '批量获取多个键的值' },
  { name: 'MSET', description: '批量设置多个键值对' },
  { name: 'INCR', description: '将键值加一' },
  { name: 'DECR', description: '将键值减一' },
  { name: 'INCRBY', description: '将键值增加指定数值' },
  { name: 'DECRBY', description: '将键值减少指定数值' },
  { name: 'APPEND', description: '追加值到字符串末尾' },
  { name: 'STRLEN', description: '获取字符串长度' },
  
  // Hash 操作
  { name: 'HSET', description: '设置哈希字段' },
  { name: 'HGET', description: '获取哈希字段值' },
  { name: 'HGETALL', description: '获取所有哈希字段和值' },
  { name: 'HDEL', description: '删除哈希字段' },
  { name: 'HEXISTS', description: '检查哈希字段是否存在' },
  { name: 'HKEYS', description: '获取所有哈希字段名' },
  { name: 'HVALS', description: '获取所有哈希值' },
  { name: 'HLEN', description: '获取哈希字段数量' },
  { name: 'HINCRBY', description: '增加哈希字段的数值' },
  { name: 'HMGET', description: '批量获取哈希字段值' },
  { name: 'HMSET', description: '批量设置哈希字段值' },
  
  // List 操作
  { name: 'LPUSH', description: '从列表左侧推入元素' },
  { name: 'RPUSH', description: '从列表右侧推入元素' },
  { name: 'LPOP', description: '从列表左侧弹出元素' },
  { name: 'RPOP', description: '从列表右侧弹出元素' },
  { name: 'LLEN', description: '获取列表长度' },
  { name: 'LINDEX', description: '获取列表指定索引的元素' },
  { name: 'LRANGE', description: '获取列表指定范围的元素' },
  { name: 'LSET', description: '设置列表指定索引的元素' },
  { name: 'LREM', description: '删除列表中指定值的元素' },
  { name: 'LTRIM', description: '修剪列表，只保留指定范围' },
  
  // Set 操作
  { name: 'SADD', description: '向集合添加成员' },
  { name: 'SREM', description: '从集合移除成员' },
  { name: 'SISMEMBER', description: '检查成员是否在集合中' },
  { name: 'SMEMBERS', description: '获取集合所有成员' },
  { name: 'SCARD', description: '获取集合成员数量' },
  { name: 'SPOP', description: '随机弹出集合成员' },
  { name: 'SRANDMEMBER', description: '随机获取集合成员' },
  { name: 'SINTER', description: '获取多个集合的交集' },
  { name: 'SUNION', description: '获取多个集合的并集' },
  { name: 'SDIFF', description: '获取多个集合的差集' },
  
  // ZSet 操作
  { name: 'ZADD', description: '向有序集合添加成员' },
  { name: 'ZREM', description: '从有序集合移除成员' },
  { name: 'ZSCORE', description: '获取有序集合成员的分数' },
  { name: 'ZRANGE', description: '获取有序集合指定范围的成员' },
  { name: 'ZREVRANGE', description: '获取有序集合指定范围的成员（降序）' },
  { name: 'ZRANK', description: '获取成员在有序集合中的排名' },
  { name: 'ZREVRANK', description: '获取成员在有序集合中的排名（降序）' },
  { name: 'ZCARD', description: '获取有序集合成员数量' },
  { name: 'ZCOUNT', description: '获取分数范围内的成员数量' },
  { name: 'ZINCRBY', description: '增加有序集合成员的分数' },
  
  // Key 操作
  { name: 'KEYS', description: '查找匹配模式的键' },
  { name: 'EXISTS', description: '检查键是否存在' },
  { name: 'DEL', description: '删除键' },
  { name: 'EXPIRE', description: '设置键的过期时间' },
  { name: 'TTL', description: '获取键的剩余过期时间' },
  { name: 'RENAME', description: '重命名键' },
  { name: 'TYPE', description: '获取键的类型' },
  { name: 'DUMP', description: '序列化键的值' },
  { name: 'RESTORE', description: '反序列化值并存储到键' },
  { name: 'SCAN', description: '增量迭代键空间' },
  
  // 服务器操作
  { name: 'INFO', description: '获取服务器信息和统计' },
  { name: 'DBSIZE', description: '获取当前数据库的键数量' },
  { name: 'FLUSHDB', description: '清空当前数据库' },
  { name: 'FLUSHALL', description: '清空所有数据库' },
  { name: 'SELECT', description: '切换数据库' },
  { name: 'PING', description: '测试服务器连接' },
  { name: 'ECHO', description: '回显字符串' },
  { name: 'CONFIG', description: '获取或设置配置参数' },
  { name: 'SLOWLOG', description: '管理慢查询日志' },
  { name: 'CLIENT', description: '管理客户端连接' },
  { name: 'MONITOR', description: '实时监控所有命令' },
];
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { cn } from '../lib/utils';
import { useConnectionStore } from '../stores/connectionStore';
import DatabaseMonitorPanel from './DatabaseMonitorPanel';

type RedisKeyType = 'string' | 'hash' | 'list' | 'set' | 'zset';

interface RedisKey {
  key: string;
  type: RedisKeyType;
  ttl: number;
  memory_usage?: number;
}

interface RedisBrowserProps {
  connectionId: string | null;
}

export function RedisBrowser({ connectionId }: RedisBrowserProps) {
  const { connections } = useConnectionStore();
  
  // 获取连接配置中的高级选项
  const connection = connections.find((c) => c.id === connectionId);
  const advancedOptions = connection?.config.redis?.advancedOptions;
  const databaseCount = advancedOptions?.databaseCount || 16;
  const keyPageSize = advancedOptions?.keyPageSize || 1000;

  // 添加调试信息
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showFormattedJSON, setShowFormattedJSON] = useState(false);
  const [hashData, setHashData] = useState<Array<[string, string]>>([]);
  const [listData, setListData] = useState<string[]>([]);
  const [zsetData, setZsetData] = useState<Array<[string, number]>>([]);
  const [dbIndex, setDbIndex] = useState(0);
  const [dbInfo, setDbInfo] = useState<{ key_count: number; used_memory: number; redis_version: string } | null>(null);
  const [showSetTtlDialog, setShowSetTtlDialog] = useState(false);
  const [newTtl, setNewTtl] = useState('');

  // 分页和加载更多
    const [cursor, setCursor] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
  
    // 搜索统计信息
    const [searchStats, setSearchStats] = useState<{
      total: number | null;
      displayed: number;
      scanning: boolean;
    }>({
      total: null,
      displayed: 0,
      scanning: false,
    });
  
    // 新增 UI 功能状态
  const [showCommandInputPanel, setShowCommandInputPanel] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [commandDuration, setCommandDuration] = useState<number | null>(null);
  const [showCommandJsonFormatted, setShowCommandJsonFormatted] = useState(false);
  
  // 命令提示相关状态
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(REDIS_COMMANDS);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameOldKey, setRenameOldKey] = useState('');
  const [renameNewKey, setRenameNewKey] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSlowlogDialog, setShowSlowlogDialog] = useState(false);
  const [slowlogData, setSlowlogData] = useState<any[]>([]);
  const [loadingSlowlog, setLoadingSlowlog] = useState(false);
  const [showClientsDialog, setShowClientsDialog] = useState(false);
  const [clientsData, setClientsData] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  const [monitorData, setMonitorData] = useState<any>(null);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // 编辑器状态
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [editingHashIndex, setEditingHashIndex] = useState<number | null>(null);
  const [editingListIndex, setEditingListIndex] = useState<number | null>(null);
  const [editingZSetIndex, setEditingZSetIndex] = useState<number | null>(null);
  const [showAddElementDialog, setShowAddElementDialog] = useState(false);
  const [newElement, setNewElement] = useState('');
  const [newScore, setNewScore] = useState('');
  const [addPosition, setAddPosition] = useState<'left' | 'right'>('right');

  // Key 详情加载状态
  const [loadingKeyDetail, setLoadingKeyDetail] = useState(false);
  
  // Key 数据缓存
  const keyDataCache = useRef<Map<string, { type: string; data: any }>>(new Map());

  // 防止快速点击的 ref
  const isLoadingRef = useRef(false);

  // 命令过滤函数
  const filterCommands = useCallback((input: string) => {
    if (!input.trim()) {
      setFilteredCommands(REDIS_COMMANDS);
      setShowCommandSuggestions(false);
      return;
    }

    const inputUpper = input.toUpperCase().trim();
    const filtered = REDIS_COMMANDS.filter(cmd => 
      cmd.name.startsWith(inputUpper) || 
      cmd.name.includes(inputUpper) ||
      cmd.description.toUpperCase().includes(inputUpper)
    );
    
    setFilteredCommands(filtered);
    setShowCommandSuggestions(filtered.length > 0);
    setSelectedSuggestionIndex(-1);
  }, []);

  // Hash 和 ZSet 分页状态
  const [hashPagination, setHashPagination] = useState({ offset: 0, limit: 50, hasMore: true, total: 0 });
  const [zsetPagination, setZsetPagination] = useState({ offset: 0, limit: 50, hasMore: true, total: 0 });
  const [hashSearch, setHashSearch] = useState('');
  const [zsetSearch, setZsetSearch] = useState('');
  const hashScrollRef = useRef<HTMLDivElement>(null);
  const zsetScrollRef = useRef<HTMLDivElement>(null);

  // 搜索防抖状态
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 类型筛选状态
  const [selectedType, setSelectedType] = useState<string>('all');
  const [useExactSearch, setUseExactSearch] = useState(false); // 精确搜索模式
  const typeOptions = [
    { value: 'all', label: '全部类型' },
    { value: 'string', label: 'String' },
    { value: 'hash', label: 'Hash' },
    { value: 'list', label: 'List' },
    { value: 'set', label: 'Set' },
    { value: 'zset', label: 'ZSet' },
  ];

  // 加载数据库信息
  const loadDbInfo = useCallback(async () => {
    if (!connectionId) return;
    try {
      const info = await invoke('get_redis_db_info', {
        connId: connectionId,
      });

      // 解析 Redis INFO 命令的输出
      const infoStr = info as string;
      const keyCountMatch = infoStr.match(/db\d+:keys=(\d+)/);
      const memoryMatch = infoStr.match(/used_memory:(\d+)/);
      const versionMatch = infoStr.match(/redis_version:([\d.]+)/);

      if (keyCountMatch) {
        setDbInfo({
          key_count: parseInt(keyCountMatch[1], 10),
          used_memory: memoryMatch ? parseInt(memoryMatch[1], 10) : 0,
          redis_version: versionMatch ? versionMatch[1] : 'unknown',
        });
      }
    } catch (error) {
    }
  }, [connectionId]);

  // 加载 keys 列表（支持分页和类型过滤）
  const loadKeys = useCallback(async (reset: boolean = false) => {
    if (!connectionId) {
      return;
    }

    // 判断是否需要完整扫描（有搜索或类型筛选）
    const needFullScan = debouncedSearchQuery || selectedType !== 'all';

    if (reset) {
      setLoading(true);
      setCursor(0);
      setKeys([]);
      setHasMore(true);
      // 如果是完整扫描，设置扫描状态
      if (needFullScan) {
        setSearchStats({ scanning: true, total: null, displayed: 0 });
      } else {
        // 正常浏览模式，清空统计信息
        setSearchStats({ scanning: false, total: null, displayed: 0 });
      }
    } else {
      setLoadingMore(true);
    }

    try {
      // 将用户输入转换为 glob 模式，例如 "p" → "*p*"
      const pattern = debouncedSearchQuery ? `*${debouncedSearchQuery}*` : '*';
      const currentCursor = reset ? 0 : cursor;
      const typeFilter = selectedType === 'all' ? null : selectedType;

      // 如果使用精确搜索模式，直接使用输入内容作为 pattern（不添加通配符）
      const exactPattern = useExactSearch && debouncedSearchQuery ? debouncedSearchQuery : pattern;

      const response = useExactSearch && debouncedSearchQuery
        ? await invoke('search_redis_keys_exact', {
            connId: connectionId,
            pattern: exactPattern,
            keyType: typeFilter,
          })
        : await invoke('get_redis_keys_by_type', {
            connId: connectionId,
            pattern,
            keyType: typeFilter,
            limit: keyPageSize,
            cursor: needFullScan ? 0 : currentCursor,  // 完整扫描时 cursor 不重要
          });

      // 尝试解析为对象
      let parsedResponse;
      if (typeof response === 'string') {
        try {
          parsedResponse = JSON.parse(response);
        } catch (e) {
          throw new Error(`Failed to parse response: ${e}`);
        }
      } else {
        parsedResponse = response;
      }

      // 防御性检查
      if (!parsedResponse) {
        throw new Error('Response is null or undefined');
      }

      if (!parsedResponse.keys) {
        throw new Error('Response does not have keys field');
      }

      if (!Array.isArray(parsedResponse.keys)) {
        throw new Error('keys is not an array');
      }

      // 简化版本：只使用 keys 名称，不获取详细信息
      const keyDetails: RedisKey[] = parsedResponse.keys.map(key => ({
        key,
        type: selectedType === 'all' ? 'string' as RedisKeyType : selectedType as RedisKeyType,
        ttl: -1,
        memory_usage: 0,
      }));

      if (reset || needFullScan) {
        setKeys(keyDetails);
      } else {
        setKeys(prev => [...prev, ...keyDetails]);
      }

      // 如果是完整扫描，不需要分页
      if (needFullScan) {
        setHasMore(false);
        // 更新统计信息
        setSearchStats({
          total: parsedResponse.total_matched || keyDetails.length,
          displayed: keyDetails.length,
          scanning: false,
        });
      } else {
        // 分页模式
        setCursor(parsedResponse.cursor);
        if (parsedResponse.keys.length === 0 && !reset) {
          setHasMore(false);
        } else {
          setHasMore(parsedResponse.has_more);
        }
        // 分页模式的统计信息在 useEffect 中更新
      }
    } catch (error) {
      alert(`加载 keys 失败: ${error}`);
      setSearchStats(prev => ({ ...prev, scanning: false }));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [connectionId, cursor, debouncedSearchQuery, keyPageSize, selectedType]);

  // 分页模式下更新统计信息
  useEffect(() => {
    const needFullScan = debouncedSearchQuery || selectedType !== 'all';
    if (!needFullScan && !loading && !loadingMore) {
      setSearchStats({
        total: null,
        displayed: keys.length,
        scanning: false,
      });
    }
  }, [keys.length, debouncedSearchQuery, selectedType, loading, loadingMore]);

  // 当焦点消失时执行搜索
  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    setDebouncedSearchQuery(searchQuery);
  };

  // 搜索防抖：用户停止输入 1000ms 后自动触发搜索
  useEffect(() => {
    // 清除之前的定时器
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // 设置新的定时器
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 1000);

    // 清理函数
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery]);

  // 当防抖后的搜索查询或类型筛选改变时，重新加载（重置分页）
  useEffect(() => {
    if (connectionId) {
      loadKeys(true);
    }
  }, [connectionId, debouncedSearchQuery, selectedType]);

  // Hash 和 ZSet 滚动监听
  useEffect(() => {
    const handleScroll = (container: HTMLElement | null, pagination: any, setPagination: any, loadData: () => void) => {
      if (!container) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const target = entries[0];
          if (target.isIntersecting && pagination.hasMore) {
            loadData();
          }
        },
        { root: container, rootMargin: '100px', threshold: 0.1 }
      );

      const sentinel = container.querySelector('.scroll-sentinel');
      if (sentinel) observer.observe(sentinel);

      return () => observer.disconnect();
    };

    if (selectedKey?.type === 'hash' && hashScrollRef.current) {
      return handleScroll(hashScrollRef.current, hashPagination, setHashPagination, () => loadHashData(false));
    }
    if (selectedKey?.type === 'zset' && zsetScrollRef.current) {
      return handleScroll(zsetScrollRef.current, zsetPagination, setZsetPagination, () => loadZSetData(false));
    }
  }, [hashPagination, zsetPagination, selectedKey]);

  const handleLoadMore = () => {
    const needFullScan = debouncedSearchQuery || selectedType !== 'all';
    if (!needFullScan && !loadingMore && hasMore) {
      loadKeys(false);
    }
  };

  // 使用 IntersectionObserver 监听是否滚动到底部
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        const needFullScan = debouncedSearchQuery || selectedType !== 'all';

        if (needFullScan) {
          // 完整扫描模式，不需要加载更多
          setIsAtBottom(true);
        } else {
          // 分页模式
          if (target.isIntersecting && hasMore && !loadingMore) {
            handleLoadMore();
          }
          setIsAtBottom(target.isIntersecting && !hasMore);
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loadingMore, debouncedSearchQuery, selectedType]);

  useEffect(() => {
    loadDbInfo();
  }, [connectionId]);

  const handleSelectKey = async (key: RedisKey) => {
    // 如果已经在加载，直接返回
    if (isLoadingRef.current) {
      return;
    }

    setSelectedKey(key);
    setShowFormattedJSON(false);
    if (!connectionId) return;

    // 对于 hash 和 zset 类型，使用分页加载
    if (key.type === 'hash' || key.type === 'zset') {
      setKeyValue('');
      setListData([]);
      if (key.type === 'hash') {
        setZsetData([]);
        setHashPagination({ offset: 0, limit: 50, hasMore: true, total: 0 });
        setHashSearch('');
        loadHashData(true);
      } else {
        setHashData([]);
        setZsetPagination({ offset: 0, limit: 50, hasMore: true, total: 0 });
        setZsetSearch('');
        loadZSetData(true);
      }
      return;
    }

    // 检查缓存
    const cached = keyDataCache.current.get(key.key);
    if (cached) {
      const { type, data } = cached;
      switch (type) {
        case 'string':
          setKeyValue(data);
          setHashData([]);
          setListData([]);
          setZsetData([]);
          break;
        case 'hash':
          setKeyValue('');
          setHashData(data);
          setListData([]);
          setZsetData([]);
          break;
        case 'list':
        case 'set':
          setKeyValue('');
          setHashData([]);
          setListData(data);
          setZsetData([]);
          break;
        case 'zset':
          setKeyValue('');
          setHashData([]);
          setListData([]);
          setZsetData(data);
          break;
      }
      return;
    }

    // 设置加载状态
    isLoadingRef.current = true;
    setLoadingKeyDetail(true);

    try {
      const response = await invoke<string>('get_redis_value', {
        connId: connectionId,
        key: key.key,
      });

      // get_redis_value 返回的是 JSON 字符串，格式为 {"type": "xxx", "value": ...}
      const data = JSON.parse(response);
      const valueType = data.type;
      const value = data.value;

      // 缓存数据（对于 hash 类型，转换为数组格式）
      const cacheData = valueType === 'hash' 
        ? Object.entries(value).map(([k, v]) => [k, v] as [string, string])
        : value;
      keyDataCache.current.set(key.key, { type: valueType, data: cacheData });

      switch (valueType) {
        case 'string':
          setKeyValue(value);
          setHashData([]);
          setListData([]);
          setZsetData([]);
          break;
        case 'hash':
          setKeyValue('');
          setHashData(cacheData as Array<[string, string]>);
          setListData([]);
          setZsetData([]);
          break;
        case 'list':
        case 'set':
          setKeyValue('');
          setHashData([]);
          setListData(value);
          setZsetData([]);
          break;
        case 'zset':
          setKeyValue('');
          setHashData([]);
          setListData([]);
          setZsetData(value);
          break;
      }
    } catch (error) {
      // 不使用 alert，而是设置错误状态
      setKeyValue('');
      setHashData([]);
      setListData([]);
      setZsetData([]);
    } finally {
      setLoadingKeyDetail(false);
      isLoadingRef.current = false;
    }
  };

  const handleDeleteKey = async (key: string) => {
    if (!connectionId) return;
    if (!confirm(`确定要删除 key "${key}" 吗？`)) return;

    try {
      await invoke('delete_redis_key', {
        connId: connectionId,
        key,
      });
      
      // 清除缓存
      keyDataCache.current.delete(key);
      
      await loadKeys();
      if (selectedKey?.key === key) {
        setSelectedKey(null);
      }
    } catch (error) {
      alert(`删除 key 失败: ${error}`);
    }
  };

  const handleRefresh = () => {
    loadKeys(true);
  };

  const handleAddKey = () => {
    alert('添加 key 功能开发中');
  };

  // 加载 hash 数据（分页）
  const loadHashData = async (reset: boolean = false) => {
    if (!connectionId || !selectedKey) return;
    
    if (reset) {
      setHashPagination({ offset: 0, limit: 50, hasMore: true, total: 0 });
    }
    
    try {
      const response = await invoke('get_hash_fields_paginated', {
        connId: connectionId,
        key: selectedKey.key,
        offset: reset ? 0 : hashPagination.offset,
        limit: hashPagination.limit,
        search: hashSearch || undefined,
      });
      
      const result = JSON.parse(response as string);
      
      if (reset) {
        setHashData(result.data);
        setHashPagination(prev => ({ ...prev, total: result.total, hasMore: result.has_more, offset: result.data.length }));
      } else {
        setHashData(prev => [...prev, ...result.data]);
        setHashPagination(prev => ({ ...prev, total: result.total, hasMore: result.has_more, offset: prev.offset + result.data.length }));
      }
    } catch (error) {
    }
  };

  // 加载 zset 数据（分页）
  const loadZSetData = async (reset: boolean = false) => {
    if (!connectionId || !selectedKey) return;
    
    if (reset) {
      setZsetPagination({ offset: 0, limit: 50, hasMore: true, total: 0 });
    }
    
    try {
      const response = await invoke('get_zset_members_paginated', {
        connId: connectionId,
        key: selectedKey.key,
        offset: reset ? 0 : zsetPagination.offset,
        limit: zsetPagination.limit,
        search: zsetSearch || undefined,
      });
      
      const result = JSON.parse(response as string);
      
      if (reset) {
        setZsetData(result.data);
        setZsetPagination(prev => ({ ...prev, total: result.total, hasMore: result.has_more, offset: result.data.length }));
      } else {
        setZsetData(prev => [...prev, ...result.data]);
        setZsetPagination(prev => ({ ...prev, total: result.total, hasMore: result.has_more, offset: prev.offset + result.data.length }));
      }
    } catch (error) {
    }
  };

  const handleSetTtl = async () => {
    if (!connectionId || !selectedKey) return;
    const ttlValue = parseInt(newTtl);
    
    if (isNaN(ttlValue) || ttlValue < 0) {
      alert('请输入有效的秒数（0 或正整数）');
      return;
    }

    try {
      await invoke('set_redis_key_ttl', {
        connId: connectionId,
        key: selectedKey.key,
        ttl: ttlValue,
      });

      alert('TTL 设置成功');
      setShowSetTtlDialog(false);
      setNewTtl('');
      
      // 重新加载 key 信息
      const [keyType, ttl] = await Promise.all([
        invoke<string>('get_redis_key_type', { connId: connectionId, key: selectedKey.key }),
        invoke<number>('get_redis_key_ttl', { connId: connectionId, key: selectedKey.key }),
      ]);
      
      setSelectedKey({
        key: selectedKey.key,
        type: keyType as RedisKeyType,
        ttl,
      });
    } catch (error) {
      alert(`设置 TTL 失败: ${error}`);
    }
  };

  const handleRenameKey = async () => {
    if (!connectionId || !renameOldKey || !renameNewKey.trim()) {
      alert('请输入新名称');
      return;
    }

    try {
      await invoke('rename_redis_key', {
        connId: connectionId,
        old_key: renameOldKey,
        new_key: renameNewKey.trim(),
      });

      alert('重命名成功');
      setShowRenameDialog(false);
      setRenameOldKey('');
      setRenameNewKey('');
      loadKeys();
      loadDbInfo();
    } catch (error) {
      alert(`重命名失败: ${error}`);
    }
  };

  const handleExecuteCommand = async () => {
    if (!connectionId || !commandInput.trim()) {
      alert('请输入命令');
      return;
    }

    try {
      const response = await invoke('execute_redis_command', {
        connId: connectionId,
        command: commandInput.trim(),
      }) as string;

      // 解析返回的 JSON（包含 result 和 duration_ms）
      const parsed = JSON.parse(response);
      setCommandOutput(parsed.result || 'OK');
      setCommandDuration(parsed.duration_ms || null);
      setShowCommandJsonFormatted(false); // 重置格式化状态
    } catch (error) {
      setCommandOutput(`错误: ${error}`);
      setCommandDuration(null);
    }
  };

  const handleExportData = async () => {
    if (!connectionId) return;

    try {
      const pattern = searchQuery || '*';
      const result = await invoke('export_redis_keys', {
        connId: connectionId,
        pattern,
      }) as string;

      const blob = new Blob([result], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redis_export_${dbIndex}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
      alert('导出成功');
    } catch (error) {
      alert(`导出失败: ${error}`);
    }
  };

  const handleLoadSlowlog = async () => {
    if (!connectionId) return;

    setLoadingSlowlog(true);
    try {
      const result = await invoke('get_redis_slowlog', {
        connId: connectionId,
        limit: 100,
      }) as string;

      // 解析慢查询日志数据
      // Redis SLOWLOG GET 返回的是数组，每个元素包含 [id, timestamp, duration, command]
      const logs = JSON.parse(result);
      setSlowlogData(Array.isArray(logs) ? logs : []);
      setShowSlowlogDialog(true);
    } catch (error) {
      alert(`获取慢查询日志失败: ${error}`);
    } finally {
      setLoadingSlowlog(false);
    }
  };

  const handleLoadClients = async () => {
    if (!connectionId) return;

    setLoadingClients(true);
    try {
      const result = await invoke('get_redis_clients', {
        connId: connectionId,
      }) as string;

      // 解析客户端连接数据
      // Redis CLIENT LIST 返回的是字符串，每个客户端信息一行
      const lines = result.split('\n').filter(line => line.trim());
      const clients = lines.map(line => {
        const clientInfo: any = {};
        line.split(' ').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            clientInfo[key] = value;
          }
        });
        return clientInfo;
      });

      setClientsData(clients);
      setShowClientsDialog(true);
    } catch (error) {
      alert(`获取客户端连接失败: ${error}`);
    } finally {
      setLoadingClients(false);
    }
  };

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const handleSelectDb = async (index: number) => {
    if (!connectionId) return;
    
    try {
      await invoke('select_redis_database', {
        connId: connectionId,
        db_index: index,
      });
      
      // 清除缓存
      keyDataCache.current.clear();
      
      setDbIndex(index);
      setSelectedKey(null);
      setSelectedKeys(new Set());
      loadKeys();
      loadDbInfo();
    } catch (error) {
      alert(`切换数据库失败: ${error}`);
    }
  };

  const handleBatchDelete = async () => {
    if (!connectionId) return;
    if (selectedKeys.size === 0) {
      alert('请先选择要删除的 keys');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedKeys.size} 个 keys 吗？`)) return;

    try {
      const keysArray = Array.from(selectedKeys);
      const count = await invoke('delete_redis_keys_batch', {
        connId: connectionId,
        keys: keysArray,
      });

      alert(`成功删除 ${count} 个 keys`);
      setSelectedKeys(new Set());
      loadKeys();
      loadDbInfo();
    } catch (error) {
      alert(`批量删除失败: ${error}`);
    }
  };

  const handleToggleSelectKey = (key: string) => {
    setSelectedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // ==================== Hash 编辑器处理函数 ====================
  
  const handleAddHashField = async () => {
    if (!connectionId || !selectedKey || !newFieldName.trim() || !newFieldValue.trim()) return;
    
    try {
      await invoke('add_hash_field', {
        connId: connectionId,
        key: selectedKey.key,
        field: newFieldName.trim(),
        value: newFieldValue.trim(),
      });
      
      setHashData([...hashData, [newFieldName.trim(), newFieldValue.trim()]]);
      setNewFieldName('');
      setNewFieldValue('');
      setShowAddFieldDialog(false);
      loadDbInfo();
    } catch (error) {
      alert(`添加字段失败: ${error}`);
    }
  };

  const handleDeleteHashField = async (field: string) => {
    if (!connectionId || !selectedKey) return;
    if (!confirm(`确定要删除字段 "${field}" 吗？`)) return;
    
    try {
      await invoke('delete_hash_field', {
        connId: connectionId,
        key: selectedKey.key,
        field,
      });
      
      setHashData(hashData.filter(([f]) => f !== field));
      loadDbInfo();
    } catch (error) {
      alert(`删除字段失败: ${error}`);
    }
  };

  const handleEditHashField = (index: number, newFieldValue: string) => {
    const newData = [...hashData];
    newData[index][1] = newFieldValue;
    setHashData(newData);
  };

  // ==================== List 编辑器处理函数 ====================
  
  const handlePushListElement = async (value: string) => {
    if (!connectionId || !selectedKey || !value.trim()) return;
    
    try {
      await invoke('push_list_element', {
        connId: connectionId,
        key: selectedKey.key,
        value: value.trim(),
        position: addPosition,
      });
      
      if (addPosition === 'left') {
        setListData([value.trim(), ...listData]);
      } else {
        setListData([...listData, value.trim()]);
      }
      
      setNewElement('');
      setShowAddElementDialog(false);
      loadDbInfo();
    } catch (error) {
      alert(`添加元素失败: ${error}`);
    }
  };

  const handlePopListElement = async (position: 'left' | 'right') => {
    if (!connectionId || !selectedKey) return;
    if (!confirm(`确定要弹出${position === 'left' ? '头部' : '尾部'}元素吗？`)) return;
    
    try {
      await invoke('pop_list_element', {
        connId: connectionId,
        key: selectedKey.key,
        position,
      });
      
      if (position === 'left') {
        setListData(listData.slice(1));
      } else {
        setListData(listData.slice(0, -1));
      }
      
      loadDbInfo();
    } catch (error) {
      alert(`弹出元素失败: ${error}`);
    }
  };

  const handleSetListElement = async (index: number, value: string) => {
    if (!connectionId || !selectedKey) return;
    
    try {
      await invoke('set_list_element', {
        connId: connectionId,
        key: selectedKey.key,
        index,
        value,
      });
      
      const newData = [...listData];
      newData[index] = value;
      setListData(newData);
      loadDbInfo();
    } catch (error) {
      alert(`设置元素失败: ${error}`);
    }
  };

  const handleDeleteListElement = async (index: number) => {
    if (!connectionId || !selectedKey) return;
    if (!confirm(`确定要删除索引 ${index} 的元素吗？`)) return;
    
    try {
      await invoke('delete_list_element', {
        connId: connectionId,
        key: selectedKey.key,
        index,
      });
      
      setListData(listData.filter((_, i) => i !== index));
      loadDbInfo();
    } catch (error) {
      alert(`删除元素失败: ${error}`);
    }
  };

  // ==================== Set 编辑器处理函数 ====================
  
  const handleAddSetMembers = async (members: string[]) => {
    if (!connectionId || !selectedKey || members.length === 0) return;
    
    try {
      const addedCount = await invoke('add_set_members', {
        connId: connectionId,
        key: selectedKey.key,
        members,
      });
      
      setListData([...listData, ...members]);
      setNewElement('');
      setShowAddElementDialog(false);
      loadDbInfo();
      alert(`成功添加 ${addedCount} 个成员`);
    } catch (error) {
      alert(`添加成员失败: ${error}`);
    }
  };

  const handleRemoveSetMembers = async (members: string[]) => {
    if (!connectionId || !selectedKey || members.length === 0) return;
    if (!confirm(`确定要删除选中的 ${members.length} 个成员吗？`)) return;
    
    try {
      const removedCount = await invoke('remove_set_members', {
        connId: connectionId,
        key: selectedKey.key,
        members,
      });
      
      setListData(listData.filter(item => !members.includes(item)));
      loadDbInfo();
      alert(`成功删除 ${removedCount} 个成员`);
    } catch (error) {
      alert(`删除成员失败: ${error}`);
    }
  };

  // ==================== ZSet 编辑器处理函数 ====================
  
  const handleAddZSetMember = async (member: string, score: number) => {
    if (!connectionId || !selectedKey || !member.trim()) return;
    
    try {
      await invoke('add_zset_member', {
        connId: connectionId,
        key: selectedKey.key,
        member: member.trim(),
        score,
      });
      
      setZsetData([...zsetData, [member.trim(), score]]);
      setNewElement('');
      setNewScore('');
      setShowAddElementDialog(false);
      loadDbInfo();
    } catch (error) {
      alert(`添加成员失败: ${error}`);
    }
  };

  const handleRemoveZSetMember = async (member: string) => {
    if (!connectionId || !selectedKey) return;
    if (!confirm(`确定要删除成员 "${member}" 吗？`)) return;
    
    try {
      await invoke('remove_zset_member', {
        connId: connectionId,
        key: selectedKey.key,
        member,
      });
      
      setZsetData(zsetData.filter(([m]) => m !== member));
      loadDbInfo();
    } catch (error) {
      alert(`删除成员失败: ${error}`);
    }
  };

  const handleUpdateZSetScore = async (member: string, newScore: number) => {
    if (!connectionId || !selectedKey) return;
    
    try {
      await invoke('update_zset_score', {
        connId: connectionId,
        key: selectedKey.key,
        member,
        score: newScore,
      });
      
      const newData: [string, number][] = zsetData.map(([m, s]) => m === member ? [m, newScore] : [m, s]);
      setZsetData(newData);
      loadDbInfo();
    } catch (error) {
      alert(`更新分数失败: ${error}`);
    }
  };

  const handleSaveValue = async () => {
    if (!connectionId || !selectedKey) return;

    try {
      let value: string;
      switch (selectedKey.type) {
        case 'string':
          value = keyValue;
          break;
        case 'hash':
          value = JSON.stringify(hashData);
          break;
        case 'list':
        case 'set':
          value = JSON.stringify(listData);
          break;
        case 'zset':
          value = JSON.stringify(zsetData);
          break;
        default:
          return;
      }

      await invoke('set_redis_value', {
        connId: connectionId,
        key: selectedKey.key,
        value,
        keyType: selectedKey.type,
        ttl: selectedKey.ttl === -1 ? null : selectedKey.ttl,
      });

      // 更新缓存
      let cacheData;
      switch (selectedKey.type) {
        case 'string':
          cacheData = value;
          break;
        case 'hash':
          cacheData = hashData;
          break;
        case 'list':
        case 'set':
          cacheData = listData;
          break;
        case 'zset':
          cacheData = zsetData;
          break;
      }
      keyDataCache.current.set(selectedKey.key, { type: selectedKey.type, data: cacheData });

      alert('保存成功');
    } catch (error) {
      alert(`保存值失败: ${error}`);
    }
  };

  const formatTTL = (ttl: number) => {
    if (ttl === -1) return '永不过期';
    if (ttl === -2) return '已过期';
    return `${ttl}秒`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分`;
  };

  // 检测字符串是否是有效的 JSON
  const tryParseJSON = (str: string): any | null => {
    if (!str || typeof str !== 'string') return null;
    str = str.trim();
    if (str.startsWith('{') || str.startsWith('[')) {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    }
    return null;
  };

  // 格式化 JSON 为美化字符串
  const formatJSON = (value: any): string => {
    return JSON.stringify(value, null, 2);
  };

  const renderValueEditor = () => {
    if (!selectedKey) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          选择一个 Key 查看详情
        </div>
      );
    }

    switch (selectedKey.type) {
      case 'string':
        {
          const parsedJSON = tryParseJSON(keyValue);
          const isJSON = parsedJSON !== null;
          const displayValue = showFormattedJSON && isJSON ? formatJSON(parsedJSON) : keyValue;

          return (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  TTL: {formatTTL(selectedKey.ttl)}
                </div>
                <div className="flex gap-2">
                  {isJSON && (
                    <Button
                      variant="outline"
                      onClick={() => setShowFormattedJSON(!showFormattedJSON)}
                    >
                      {showFormattedJSON ? '原始格式' : 'JSON 格式'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                    设置 TTL
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">值</label>
                {showFormattedJSON && isJSON ? (
                  <textarea
                    value={displayValue}
                    readOnly
                    className="w-full min-h-[200px] p-4 text-sm border rounded-md resize-none font-mono bg-muted/30"
                    spellCheck={false}
                  />
                ) : (
                  <Input
                    value={displayValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    className="font-mono"
                  />
                )}
              </div>
              <Button onClick={handleSaveValue}>保存</Button>
            </div>
          );
        }

      case 'hash':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)} | 共 {hashPagination.total} 个字段
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索字段..."
                  value={hashSearch}
                  onChange={(e) => { setHashSearch(e.target.value); loadHashData(true); }}
                  className="w-40"
                />
                <Button variant="outline" onClick={() => setShowSetTtlDialog(true)}>设置 TTL</Button>
                <Button onClick={() => setShowAddFieldDialog(true)}><Plus className="h-4 w-4 mr-1" />添加字段</Button>
              </div>
            </div>
            <ScrollArea ref={hashScrollRef} className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">字段</TableHead>
                    <TableHead className="w-1/3">值</TableHead>
                    <TableHead className="w-1/6">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hashData.map(([field, value], index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">{field}</TableCell>
                      <TableCell>
                        {editingHashIndex === index ? (
                          <Input
                            value={value}
                            onChange={(e) => handleEditHashField(index, e.target.value)}
                            onBlur={() => setEditingHashIndex(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingHashIndex(null)}
                            className="font-mono"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-mono cursor-pointer hover:bg-muted px-2 py-1 rounded"
                            onClick={() => setEditingHashIndex(index)}
                          >
                            {value}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleDeleteHashField(field)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hashPagination.hasMore && <div className="scroll-sentinel h-1" />}
            </ScrollArea>
          </div>
        );

      case 'list':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button onClick={() => {
                  setAddPosition('left');
                  setShowAddElementDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加到头部
                </Button>
                <Button onClick={() => {
                  setAddPosition('right');
                  setShowAddElementDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加到尾部
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {listData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded group">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{index}</span>
                  {editingListIndex === index ? (
                    <Input
                      value={item}
                      onChange={(e) => setListData(listData.map((v, i) => i === index ? e.target.value : v))}
                      onBlur={() => {
                        handleSetListElement(index, listData[index]);
                        setEditingListIndex(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetListElement(index, listData[index])}
                      className="flex-1 font-mono"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 font-mono cursor-pointer hover:bg-muted-foreground/10 px-2 py-1 rounded break-all"
                      onClick={() => setEditingListIndex(index)}
                      title={item}
                    >
                      {item}
                    </span>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleDeleteListElement(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {listData.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handlePopListElement('left')}>
                  弹出头部
                </Button>
                <Button variant="outline" onClick={() => handlePopListElement('right')}>
                  弹出尾部
                </Button>
              </div>
            )}
            <Button onClick={handleSaveValue}>保存</Button>
          </div>
        );

      case 'set':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button onClick={() => setShowAddElementDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加成员
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              {listData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-muted rounded group">
                  <span className="text-xs text-muted-foreground w-8 shrink-0">{index}</span>
                  <span className="flex-1 font-mono break-all" title={item}>
                    {item}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={() => handleRemoveSetMembers([item])}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveValue}>保存</Button>
          </div>
        );

      case 'zset':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)} | 共 {zsetPagination.total} 个成员
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索成员..."
                  value={zsetSearch}
                  onChange={(e) => { setZsetSearch(e.target.value); loadZSetData(true); }}
                  className="w-40"
                />
                <Button variant="outline" onClick={() => setShowSetTtlDialog(true)}>设置 TTL</Button>
                <Button onClick={() => setShowAddElementDialog(true)}><Plus className="h-4 w-4 mr-1" />添加成员</Button>
              </div>
            </div>
            <ScrollArea ref={zsetScrollRef} className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/4">排名</TableHead>
                    <TableHead className="w-1/4">分数</TableHead>
                    <TableHead className="w-1/3">成员</TableHead>
                    <TableHead className="w-1/6">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zsetData
                    .sort((a, b) => b[1] - a[1])
                    .map(([member, score], index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center">{index + 1}</TableCell>
                      <TableCell>
                        {editingZSetIndex === index ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={newScore}
                            onChange={(e) => setNewScore(e.target.value)}
                            onBlur={() => {
                              if (newScore.trim()) {
                                handleUpdateZSetScore(member, parseFloat(newScore));
                              }
                              setEditingZSetIndex(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateZSetScore(member, parseFloat(newScore))}
                            className="w-20"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-mono cursor-pointer hover:bg-muted px-1 rounded"
                            onClick={() => {
                              setEditingZSetIndex(index);
                              setNewScore(score.toString());
                            }}
                          >
                            {score}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{member}</TableCell>
                      <TableCell>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => handleRemoveZSetMember(member)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {zsetPagination.hasMore && <div className="scroll-sentinel h-1" />}
            </ScrollArea>
          </div>
        );

      default:
        return null;
    }
  };

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        请先选择一个连接
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-[300px] border-r flex flex-col sidebar-transition">
        {/* 数据库信息 */}
        <div className="p-4 border-b bg-muted/30 transition-smooth">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold transition-smooth">数据库</span>
            <select
              value={dbIndex}
              onChange={(e) => handleSelectDb(parseInt(e.target.value))}
              className="text-sm bg-background border rounded px-3 py-1.5 transition-all duration-200"
            >
              {Array.from({ length: databaseCount }, (_, i) => (
                <option key={i} value={i}>
                  DB{i}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-muted-foreground space-y-2 transition-all duration-200">
            <div className="flex justify-between">
              <span>Keys:</span>
              <span className="font-mono transition-opacity duration-200">
                {dbInfo ? dbInfo.key_count : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>内存:</span>
              <span className="font-mono transition-opacity duration-200">
                {dbInfo ? `${(dbInfo.used_memory / 1024 / 1024).toFixed(2)} MB` : '-- MB'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>版本:</span>
              <span className="font-mono transition-opacity duration-200">
                {dbInfo ? dbInfo.redis_version : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 搜索和操作工具栏 */}
        <div className="p-4 border-b space-y-4 min-w-0">
          {/* 第一行：搜索和筛选 */}
          <div className="flex gap-3 min-w-0">
            <div className="relative flex-1 min-w-0 transition-all duration-300 ease-in-out" style={{ flex: isSearchFocused ? '3' : '1' }}>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder={useExactSearch ? "精确搜索 (输入完整 key 名称)" : "搜索 keys (支持通配符 *)..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={handleSearchBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    // 清除防抖定时器，立即触发搜索
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = null;
                    }
                    setDebouncedSearchQuery(searchQuery);
                    e.currentTarget.blur(); // 移除焦点
                  }
                }}
                className="pl-10 pr-20 h-10"
              />
              {(loading && searchQuery) && (
                <div className="absolute right-20 top-2.5 h-4 w-4 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                </div>
              )}
              <Button
                size="sm"
                variant={useExactSearch ? "default" : "ghost"}
                onClick={() => {
                  setUseExactSearch(!useExactSearch);
                  // 切换模式后重新搜索
                  if (searchQuery) {
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = null;
                    }
                    setDebouncedSearchQuery(searchQuery);
                  }
                }}
                className="absolute right-8 top-1.5 h-7 px-3 text-xs"
                title={useExactSearch ? "精确搜索模式：匹配完整 key 名称" : "模糊搜索模式：支持通配符 *"}
              >
                精确
              </Button>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    // 清除防抖定时器，立即清除搜索
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current);
                      searchDebounceRef.current = null;
                    }
                    setDebouncedSearchQuery('');
                  }}
                  className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 flex items-center justify-center"
                  title="清除搜索"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-background border rounded px-3 py-2 text-sm h-10 transition-all duration-300 ease-in-out flex-shrink-0"
              style={{ width: isSearchFocused ? '96px' : '128px' }}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 第二行：操作按钮 */}
          <TooltipProvider>
            <div className="flex items-center gap-2 flex-wrap">
              {/* 第一组：添加、删除 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleAddKey}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>添加</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleBatchDelete}
                    disabled={selectedKeys.size === 0}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除选中</TooltipContent>
              </Tooltip>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              {/* 第二组：刷新 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>刷新</TooltipContent>
              </Tooltip>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              {/* 第三组：导出 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => setShowExportDialog(true)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>导出</TooltipContent>
              </Tooltip>

              {/* 分隔线 */}
              <div className="w-px h-4 bg-border mx-1 shrink-0" />

              {/* 第四组：高级功能 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleLoadSlowlog} disabled={loadingSlowlog}>
                    <Clock className={cn("h-4 w-4", loadingSlowlog && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>慢查询日志</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={handleLoadClients} disabled={loadingClients}>
                    <Terminal className={cn("h-4 w-4", loadingClients && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>客户端连接</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => setShowMonitorDialog(true)}>
                    <Activity className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>实时监控</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1 min-h-full">
            {/* 搜索统计信息提示条 */}
            {(searchStats.scanning || searchStats.total !== null || (debouncedSearchQuery || selectedType !== 'all')) && (
              <div className="mb-2 p-2 bg-muted/50 rounded-md text-xs">
                {searchStats.scanning ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    <span>正在扫描所有 keys...</span>
                  </div>
                ) : searchStats.total !== null ? (
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{searchStats.displayed}</span>
                    <span> / </span>
                    <span className="font-medium text-foreground">{searchStats.total}</span>
                    <span> 个 keys</span>
                    {searchStats.total > searchStats.displayed && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (仅显示前 {searchStats.displayed} 个，搜索时最多返回 1000 个)
                      </span>
                    )}
                  </div>
                ) : (debouncedSearchQuery || selectedType !== 'all') ? (
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">{searchStats.displayed}</span>
                    <span> 个 keys</span>
                    {debouncedSearchQuery && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (搜索时最多返回 1000 个)
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {loading && keys.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {keys.length === 0 && !loading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {selectedType !== 'all' ? (
                      <>
                        <div className="mb-2">没有找到 "{selectedType}" 类型的 keys</div>
                        <div className="text-xs">请尝试选择其他类型或清除筛选</div>
                      </>
                    ) : searchQuery ? (
                      <>
                        <div className="mb-2">没有找到匹配 "{searchQuery}" 的 keys</div>
                        <div className="text-xs">请尝试其他搜索词</div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2">没有找到任何 keys</div>
                        <div className="text-xs">当前数据库为空</div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {keys.map((key) => (
                <ContextMenu key={key.key}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`
                        group flex items-center justify-between p-3 rounded-md cursor-pointer transition-all duration-200 ease-in-out mb-1
                        ${selectedKey?.key === key.key ? 'bg-primary/10 text-primary scale-[1.02]' : 'hover:bg-muted hover:scale-[1.01]'}
                      `}
                      onClick={() => handleSelectKey(key)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedKeys.has(key.key)}
                          onCheckedChange={(checked) => {
                            handleToggleSelectKey(key.key);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="transition-all duration-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div 
                            className="font-mono text-sm break-words transition-all duration-200"
                            title={key.key}
                          >
                            {key.key}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground transition-all duration-200 mt-1">
                            <span className="px-1.5 py-0.5 rounded bg-muted/50 shrink-0">{key.type}</span>
                            {key.memory_usage !== undefined && (
                              <span className="text-[10px] shrink-0">({formatMemory(key.memory_usage)})</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 shrink-0 ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKey(key.key);
                        }}
                      >
                        <Trash2 className="h-3 w-3 transition-transform duration-200 group-hover:rotate-12" />
                      </Button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => {
                      setRenameOldKey(key.key);
                      setRenameNewKey(key.key);
                      setShowRenameDialog(true);
                    }}>
                      <Edit2 className="h-3.5 w-3.5 mr-2" />
                      重命名
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleDeleteKey(key.key)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              
                            {/* 加载中提示 */}
                            {loadingMore && (
                              <div className="flex justify-center py-4">
                                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                              </div>
                            )}
              
                            {/* 加载更多触发器（不可见） */}
                            {(debouncedSearchQuery || selectedType !== 'all') ? null : hasMore && <div ref={loadMoreRef} className="h-1" />}
              
                            {/* 到底了提示 */}
                            {!(debouncedSearchQuery || selectedType !== 'all') && !hasMore && keys.length > 0 && (
                              <div ref={loadMoreRef} className={cn(
                                "text-center py-4 text-xs text-muted-foreground transition-all duration-300",
                                isAtBottom && "scale-110 text-primary font-medium"
                              )}>
                                {isAtBottom ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <span>🎉</span>
                                    <span>已经到底了，共 {keys.length} 个 keys</span>
                                    <span>🎉</span>
                                  </div>
                                ) : (
                                  <span>已加载 {keys.length} 个 keys</span>
                                )}
                              </div>
                            )}
                          </>
                          )}
                          </>
                          )}
                        </div>
                      </ScrollArea>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {/* 命令输入面板 */}
        <div className="mb-4">
          <Button
            variant={showCommandInputPanel ? "default" : "outline"}
            onClick={() => setShowCommandInputPanel(!showCommandInputPanel)}
            className="mb-2"
          >
            <Terminal className="h-4 w-4 mr-2" />
            {showCommandInputPanel ? '隐藏命令输入' : '显示命令输入'}
          </Button>
          
          {showCommandInputPanel && (
            <div className="space-y-4 animate-in slide-in-from-left-4 duration-300">
              <div className="relative">
                <label className="text-sm font-medium">Redis 命令</label>
                <div className="relative">
                  <Input
                    ref={commandInputRef}
                    placeholder="输入 Redis 命令，如: GET mykey 或 KEYS user:*"
                    value={commandInput}
                    onChange={(e) => {
                      setCommandInput(e.target.value);
                      filterCommands(e.target.value);
                    }}
                    className="mt-2 font-mono"
                    onFocus={() => {
                      if (commandInput.trim()) {
                        filterCommands(commandInput);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setShowCommandSuggestions(false);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (showCommandSuggestions && selectedSuggestionIndex >= 0) {
                          const selectedCommand = filteredCommands[selectedSuggestionIndex];
                          setCommandInput(selectedCommand.name);
                          setShowCommandSuggestions(false);
                          setSelectedSuggestionIndex(-1);
                          commandInputRef.current?.focus();
                        } else {
                          handleExecuteCommand();
                        }
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setShowCommandSuggestions(true);
                        setSelectedSuggestionIndex(prev => 
                          prev < filteredCommands.length - 1 ? prev + 1 : prev
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setSelectedSuggestionIndex(prev => 
                          prev > 0 ? prev - 1 : -1
                        );
                      } else if (e.key === 'Escape') {
                        setShowCommandSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }
                    }}
                  />
                  {showCommandSuggestions && filteredCommands.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-[250px] overflow-y-auto z-50">
                      {filteredCommands.map((cmd, index) => (
                        <div
                          key={cmd.name}
                          className={`
                            px-4 py-3 cursor-pointer transition-colors
                            ${index === selectedSuggestionIndex 
                              ? 'bg-primary text-primary-foreground' 
                              : 'hover:bg-muted'}
                          `}
                          onClick={() => {
                            setCommandInput(cmd.name);
                            setShowCommandSuggestions(false);
                            setSelectedSuggestionIndex(-1);
                            commandInputRef.current?.focus();
                          }}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                        >
                          <div className="font-mono font-semibold">{cmd.name}</div>
                          <div className="text-xs opacity-70 mt-1">{cmd.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  提示：按 Enter 执行命令，↑↓ 选择命令，ESC 关闭提示
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleExecuteCommand}>
                  <Terminal className="h-4 w-4 mr-2" />
                  执行
                </Button>
                {commandOutput && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCommandInput('');
                      setCommandOutput('');
                      setCommandDuration(null);
                      setShowCommandJsonFormatted(false);
                    }}
                  >
                    清除结果
                  </Button>
                )}
              </div>

              {commandOutput && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium">执行结果</label>
                    <div className="flex items-center gap-3">
                      {commandDuration !== null && (
                        <span className="text-xs text-muted-foreground">
                          耗时: {commandDuration < 1 ? `${(commandDuration * 1000).toFixed(2)}μs` : `${commandDuration}ms`}
                        </span>
                      )}
                      {tryParseJSON(commandOutput) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowCommandJsonFormatted(!showCommandJsonFormatted)}
                          className="text-xs h-7 px-3"
                        >
                          {showCommandJsonFormatted ? '原始格式' : 'JSON 格式'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 bg-muted/50 rounded-lg p-5 max-h-[200px] overflow-auto">
                    {showCommandJsonFormatted && tryParseJSON(commandOutput) ? (
                      <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                        {formatJSON(tryParseJSON(commandOutput))}
                      </pre>
                    ) : (
                      <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                        {commandOutput}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key 详情显示区域 */}
        <div className="flex-1 overflow-auto">
          {selectedKey ? (
            <div>
              <div className="mb-6">
                <h3 className="text-xl font-semibold">{selectedKey.key}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  类型: {selectedKey.type}
                </p>
              </div>
              <div className="border rounded-lg p-6 min-h-[200px]">
                {loadingKeyDetail ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">加载中...</p>
                      <p className="text-xs text-muted-foreground opacity-60">正在从 Redis 获取数据</p>
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {renderValueEditor()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              选择一个 Key 查看详情
            </div>
          )}
        </div>
      </div>

      {/* 添加 Hash 字段对话框 */}
      {showAddFieldDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">添加 Hash 字段</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">字段名</label>
                <Input
                  placeholder="输入字段名"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  className="mt-2 font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium">字段值</label>
                <Input
                  placeholder="输入字段值"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className="mt-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowAddFieldDialog(false);
                  setNewFieldName('');
                  setNewFieldValue('');
                }}>
                  取消
                </Button>
                <Button onClick={handleAddHashField}>
                  添加
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加元素对话框 */}
      {showAddElementDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">
              {selectedKey?.type === 'list' 
                ? `添加到${addPosition === 'left' ? '头部' : '尾部'}` 
                : selectedKey?.type === 'set' 
                  ? '添加 Set 成员'
                  : '添加 ZSet 成员'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  {selectedKey?.type === 'zset' ? '成员' : '元素值'}
                </label>
                <Input
                  placeholder={selectedKey?.type === 'zset' ? '输入成员名' : '输入元素值'}
                  value={newElement}
                  onChange={(e) => setNewElement(e.target.value)}
                  className="mt-2 font-mono"
                />
              </div>
              {selectedKey?.type === 'zset' && (
                <div>
                  <label className="text-sm font-medium">分数</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="输入分数"
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value)}
                    className="mt-2"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowAddElementDialog(false);
                  setNewElement('');
                  setNewScore('');
                }}>
                  取消
                </Button>
                <Button onClick={() => {
                  if (selectedKey?.type === 'list') {
                    handlePushListElement(newElement);
                  } else if (selectedKey?.type === 'set') {
                    handleAddSetMembers([newElement]);
                  } else if (selectedKey?.type === 'zset') {
                    handleAddZSetMember(newElement, parseFloat(newScore) || 0);
                  }
                }}>
                  添加
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 重命名对话框 */}
      {showRenameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">重命名 Key</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">旧名称</label>
                <Input
                  value={renameOldKey}
                  disabled
                  className="mt-2 font-mono"
                />
              </div>
              <div>
                <label className="text-sm font-medium">新名称</label>
                <Input
                  placeholder="输入新名称"
                  value={renameNewKey}
                  onChange={(e) => setRenameNewKey(e.target.value)}
                  className="mt-2 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowRenameDialog(false);
                  setRenameOldKey('');
                  setRenameNewKey('');
                }}>
                  取消
                </Button>
                <Button onClick={handleRenameKey}>
                  确定
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导出对话框 */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">导出数据</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  将导出匹配 "{searchQuery || '*'}" 的所有 Keys 及其数据。
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  预计导出 {keys.length} 个 Keys。
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  导出
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 设置 TTL 对话框 */}
      {showSetTtlDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">设置过期时间</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">过期时间（秒）</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="输入秒数，0 表示永不过期"
                  value={newTtl}
                  onChange={(e) => setNewTtl(e.target.value)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  提示：0 表示永不过期，-1 表示保持当前设置
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowSetTtlDialog(false);
                  setNewTtl('');
                }}>
                  取消
                </Button>
                <Button onClick={handleSetTtl}>
                  确定
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 慢查询日志对话框 */}
      {showSlowlogDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[800px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">慢查询日志</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSlowlogDialog(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingSlowlog ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : slowlogData.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  没有慢查询日志
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/6">ID</TableHead>
                      <TableHead className="w-1/6">时间</TableHead>
                      <TableHead className="w-1/6">耗时 (微秒)</TableHead>
                      <TableHead className="w-1/2">命令</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slowlogData.map((log: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{log.id}</TableCell>
                        <TableCell>
                          {new Date(log.timestamp * 1000).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell className={cn(
                          "font-mono",
                          log.duration > 10000 ? "text-destructive" : log.duration > 1000 ? "text-orange-500" : ""
                        )}>
                          {log.duration} μs
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all">
                          {Array.isArray(log.command) ? log.command.join(' ') : log.command}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              提示：红色表示耗时超过 10,000μs（10ms），橙色表示耗时超过 1,000μs（1ms）
            </div>
          </div>
        </div>
      )}

      {/* 客户端连接管理对话框 */}
      {showClientsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[900px] max-w-[90vw] max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">客户端连接管理 ({clientsData.length} 个连接)</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowClientsDialog(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : clientsData.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  没有客户端连接
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/6">ID</TableHead>
                      <TableHead className="w-1/5">地址</TableHead>
                      <TableHead className="w-1/6">连接时长</TableHead>
                      <TableHead className="w-1/6">空闲时长</TableHead>
                      <TableHead className="w-1/6">数据库</TableHead>
                      <TableHead className="w-1/6">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData.map((client: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{client.id}</TableCell>
                        <TableCell className="font-mono">
                          {client.addr}
                        </TableCell>
                        <TableCell>
                          {formatDuration(parseInt(client.age) || 0)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(parseInt(client.idle) || 0)}
                        </TableCell>
                        <TableCell>
                          DB{client.db}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs",
                            client.name === "master" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                          )}>
                            {client.name || "客户端"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 实时监控对话框 */}
      {showMonitorDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg w-full max-w-[1200px] h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <h3 className="text-lg font-semibold">Redis 实时监控</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowMonitorDialog(false)}>
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <DatabaseMonitorPanel connectionId={connectionId || ''} databaseType="redis" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
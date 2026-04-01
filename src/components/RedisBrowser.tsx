import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Plus, Trash2, RefreshCw, Clock, Terminal, Download, Edit2 } from 'lucide-react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
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
  const [keys, setKeys] = useState<RedisKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<RedisKey | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [hashData, setHashData] = useState<Array<[string, string]>>([]);
  const [listData, setListData] = useState<string[]>([]);
  const [zsetData, setZsetData] = useState<Array<[string, number]>>([]);
  const [dbIndex, setDbIndex] = useState(0);
  const [dbInfo, setDbInfo] = useState<{ key_count: number; used_memory: number } | null>(null);
  const [showSetTtlDialog, setShowSetTtlDialog] = useState(false);
  const [newTtl, setNewTtl] = useState('');
  
  // 新增 UI 功能状态
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [commandOutput, setCommandOutput] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameOldKey, setRenameOldKey] = useState('');
  const [renameNewKey, setRenameNewKey] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  
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

  // 加载数据库信息
  const loadDbInfo = useCallback(async () => {
    if (!connectionId) return;
    try {
      const info = await invoke('get_redis_db_info', {
        connId: connectionId,
      });
      setDbInfo(info as { key_count: number; used_memory: number });
    } catch (error) {
      console.error('加载数据库信息失败:', error);
    }
  }, [connectionId]);

  // 加载 keys 列表
  const loadKeys = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const pattern = searchQuery || '*';
      const keyList: string[] = await invoke('get_redis_keys', {
        connId: connectionId,
        pattern,
      });

      // 为每个 key 获取类型、TTL 和内存占用
      const keyDetails: RedisKey[] = [];
      for (const key of keyList) {
        try {
          const [keyType, ttl, memoryUsage] = await Promise.all([
            invoke<string>('get_redis_key_type', { connId: connectionId, key }),
            invoke<number>('get_redis_key_ttl', { connId: connectionId, key }),
            invoke<number>('get_redis_key_memory_usage', { connId: connectionId, key }).catch(() => 0),
          ]);
          keyDetails.push({
            key,
            type: keyType as RedisKeyType,
            ttl,
            memory_usage: memoryUsage,
          });
        } catch (e) {
          console.error(`获取 key ${key} 详情失败:`, e);
        }
      }

      setKeys(keyDetails);
    } catch (error) {
      console.error('加载 keys 失败:', error);
      alert(`加载 keys 失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, searchQuery]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    loadDbInfo();
  }, [loadDbInfo]);

  const filteredKeys = keys.filter((k) =>
    k.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectKey = async (key: RedisKey) => {
    setSelectedKey(key);
    if (!connectionId) return;

    try {
      const value = await invoke<string>('get_redis_value', {
        connId: connectionId,
        key: key.key,
      });

      switch (key.type) {
        case 'string':
          setKeyValue(value);
          setHashData([]);
          setListData([]);
          setZsetData([]);
          break;
        case 'hash':
          setKeyValue('');
          setHashData(JSON.parse(value));
          setListData([]);
          setZsetData([]);
          break;
        case 'list':
        case 'set':
          setKeyValue('');
          setHashData([]);
          setListData(JSON.parse(value));
          setZsetData([]);
          break;
        case 'zset':
          setKeyValue('');
          setHashData([]);
          setListData([]);
          setZsetData(JSON.parse(value));
          break;
      }
    } catch (error) {
      console.error('加载 key 值失败:', error);
      alert(`加载 key 值失败: ${error}`);
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
      await loadKeys();
      if (selectedKey?.key === key) {
        setSelectedKey(null);
      }
    } catch (error) {
      console.error('删除 key 失败:', error);
      alert(`删除 key 失败: ${error}`);
    }
  };

  const handleRefresh = () => {
    loadKeys();
  };

  const handleAddKey = () => {
    alert('添加 key 功能开发中');
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
      console.error('设置 TTL 失败:', error);
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
      console.error('重命名失败:', error);
      alert(`重命名失败: ${error}`);
    }
  };

  const handleExecuteCommand = async () => {
    if (!connectionId || !commandInput.trim()) {
      alert('请输入命令');
      return;
    }

    try {
      const result = await invoke('execute_redis_command', {
        connId: connectionId,
        command: commandInput.trim(),
      });

      setCommandOutput(result || 'OK');
    } catch (error) {
      console.error('执行命令失败:', error);
      setCommandOutput(`错误: ${error}`);
    }
  };

  const handleExportData = async () => {
    if (!connectionId) return;

    try {
      const pattern = searchQuery || '*';
      const result = await invoke('export_redis_keys', {
        connId: connectionId,
        pattern,
      });

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
      console.error('导出失败:', error);
      alert(`导出失败: ${error}`);
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
      
      setDbIndex(index);
      setSelectedKey(null);
      setSelectedKeys(new Set());
      loadKeys();
      loadDbInfo();
    } catch (error) {
      console.error('切换数据库失败:', error);
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
      console.error('批量删除失败:', error);
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
      console.error('添加字段失败:', error);
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
      console.error('删除字段失败:', error);
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
      console.error('添加元素失败:', error);
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
      console.error('弹出元素失败:', error);
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
      console.error('设置元素失败:', error);
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
      console.error('删除元素失败:', error);
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
      console.error('添加成员失败:', error);
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
      console.error('删除成员失败:', error);
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
      console.error('添加成员失败:', error);
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
      console.error('删除成员失败:', error);
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
      
      const newData = zsetData.map(([m, s]) => m === member ? [m, newScore] : [m, s]);
      setZsetData(newData);
      loadDbInfo();
    } catch (error) {
      console.error('更新分数失败:', error);
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

      alert('保存成功');
    } catch (error) {
      console.error('保存值失败:', error);
      alert(`保存值失败: ${error}`);
    }
  };

  const formatTTL = (ttl: number) => {
    if (ttl === -1) return '永不过期';
    if (ttl === -2) return '已过期';
    return `${ttl}秒`;
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
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                设置 TTL
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">值</label>
              <Input
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button onClick={handleSaveValue}>保存</Button>
          </div>
        );

      case 'hash':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button size="sm" onClick={() => setShowAddFieldDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加字段
                </Button>
              </div>
            </div>
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
                          className="font-mono cursor-pointer hover:bg-muted px-1 rounded"
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
            <Button onClick={handleSaveValue}>保存</Button>
          </div>
        );

      case 'list':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button size="sm" onClick={() => {
                  setAddPosition('left');
                  setShowAddElementDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加到头部
                </Button>
                <Button size="sm" onClick={() => {
                  setAddPosition('right');
                  setShowAddElementDialog(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加到尾部
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {listData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded group">
                  <span className="text-xs text-muted-foreground w-8">{index}</span>
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
                      className="flex-1 font-mono cursor-pointer hover:bg-muted-foreground/10 px-1 rounded truncate"
                      onClick={() => setEditingListIndex(index)}
                      title={item}
                    >
                      {item}
                    </span>
                  )}
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => handleDeleteListElement(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {listData.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handlePopListElement('left')}>
                  弹出头部
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePopListElement('right')}>
                  弹出尾部
                </Button>
              </div>
            )}
            <Button onClick={handleSaveValue}>保存</Button>
          </div>
        );

      case 'set':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button size="sm" onClick={() => setShowAddElementDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加成员
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {listData.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded group">
                  <span className="text-xs text-muted-foreground w-8">{index}</span>
                  <span className="flex-1 font-mono truncate" title={item}>
                    {item}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                TTL: {formatTTL(selectedKey.ttl)}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowSetTtlDialog(true)}>
                  设置 TTL
                </Button>
                <Button size="sm" onClick={() => setShowAddElementDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加成员
                </Button>
              </div>
            </div>
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
            <Button onClick={handleSaveValue}>保存</Button>
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
      <div className="w-[300px] border-r flex flex-col">
        {/* 数据库信息 */}
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold">数据库</span>
            <select
              value={dbIndex}
              onChange={(e) => handleSelectDb(parseInt(e.target.value))}
              className="text-xs bg-background border rounded px-2 py-1"
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i} value={i}>
                  DB{i}
                </option>
              ))}
            </select>
          </div>
          {dbInfo && (
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Keys:</span>
                <span className="font-mono">{dbInfo.key_count}</span>
              </div>
              <div className="flex justify-between">
                <span>内存:</span>
                <span className="font-mono">{(dbInfo.used_memory / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            </div>
          )}
        </div>

        {/* 搜索和操作 */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索 keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleAddKey}>
              <Plus className="h-4 w-4 mr-2" />
              添加
            </Button>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowCommandDialog(true)}>
              <Terminal className="h-4 w-4 mr-2" />
              命令
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowExportDialog(true)}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
          </div>
          {selectedKeys.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除选中 ({selectedKeys.size})
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredKeys.map((key) => (
              <ContextMenu key={key.key}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`
                      group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors
                      ${selectedKey?.key === key.key ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}
                    `}
                    onClick={() => handleSelectKey(key)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedKeys.has(key.key)}
                        onCheckedChange={(checked) => {
                          handleToggleSelectKey(key.key);
                          if (checked as boolean) {
                            handleSelectKey(key);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm truncate">{key.key}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{key.type}</span>
                          {key.memory_usage !== undefined && (
                            <span className="text-[10px]">({formatMemory(key.memory_usage)})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteKey(key.key);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
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
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-4">
        {selectedKey ? (
          <div className="h-full">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{selectedKey.key}</h3>
              <p className="text-sm text-muted-foreground">
                类型: {selectedKey.type}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              {renderValueEditor()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            选择一个 Key 查看详情
          </div>
        )}
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

      {/* 自定义命令执行器对话框 */}
      {showCommandDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[600px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">自定义命令执行器</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Redis 命令</label>
                <Input
                  placeholder="输入 Redis 命令，如: GET mykey 或 KEYS user:*"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  className="mt-2 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleExecuteCommand();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  提示：按 Enter 执行命令
                </p>
              </div>
              {commandOutput && (
                <div>
                  <label className="text-sm font-medium">执行结果</label>
                  <div className="mt-2 bg-muted/50 rounded-lg p-4 max-h-[300px] overflow-auto">
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                      {commandOutput}
                    </pre>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setShowCommandDialog(false);
                  setCommandInput('');
                  setCommandOutput('');
                }}>
                  关闭
                </Button>
                <Button onClick={handleExecuteCommand}>
                  <Terminal className="h-4 w-4 mr-2" />
                  执行
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
                  预计导出 {filteredKeys.length} 个 Keys。
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
    </div>
  );
}
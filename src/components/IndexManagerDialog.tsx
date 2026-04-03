import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Plus, Trash2, X } from 'lucide-react';

interface IndexDetail {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
}

interface IndexManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  table: string;
}

export function IndexManagerDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  table,
}: IndexManagerDialogProps) {
  const [indexes, setIndexes] = useState<IndexDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexColumns, setNewIndexColumns] = useState<string[]>([]);
  const [newIndexIsUnique, setNewIndexIsUnique] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  useEffect(() => {
    if (open && connectionId && database && table) {
      loadIndexes();
      loadAvailableColumns();
    }
  }, [open, connectionId, database, table]);

  const loadIndexes = async () => {
    setLoading(true);
    try {
      const data = await invoke('get_table_indexes', {
        connId: connectionId,
        database,
        table,
      });
      setIndexes(data as IndexDetail[]);
    } catch (error) {
      alert(`加载索引失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableColumns = async () => {
    try {
      const columns: any[] = await invoke('get_mysql_table_schema', {
        connId: connectionId,
        database,
        table,
      });
      setAvailableColumns(columns.map((col: any) => col.name));
    } catch (error) {
      // Error handling without console logging
    }
  };

  const handleDeleteIndex = async (indexName: string) => {
    if (indexName === 'PRIMARY') {
      alert('主键索引不能删除，请通过"设计表"功能修改主键');
      return;
    }

    if (confirm(`确定要删除索引 "${indexName}" 吗？`)) {
      try {
        await invoke('drop_index', {
          connId: connectionId,
          database,
          table,
          indexName,
        });
        alert('索引删除成功');
        loadIndexes();
      } catch (error) {
        alert(`删除索引失败: ${error}`);
      }
    }
  };

  const handleAddIndex = async () => {
    if (!newIndexName.trim()) {
      alert('请输入索引名称');
      return;
    }

    if (newIndexColumns.length === 0) {
      alert('请至少选择一列');
      return;
    }

    try {
      await invoke('add_index', {
        connId: connectionId,
        database,
        table,
        indexName: newIndexName.trim(),
        columns: newIndexColumns,
        isUnique: newIndexIsUnique,
        indexType: 'BTREE',
      });
      alert('索引添加成功');
      setShowAddForm(false);
      setNewIndexName('');
      setNewIndexColumns([]);
      setNewIndexIsUnique(false);
      loadIndexes();
    } catch (error) {
      alert(`添加索引失败: ${error}`);
    }
  };

  const handleColumnToggle = (columnName: string) => {
    if (newIndexColumns.includes(columnName)) {
      setNewIndexColumns(newIndexColumns.filter(c => c !== columnName));
    } else {
      setNewIndexColumns([...newIndexColumns, columnName]);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span>加载中...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto" style={{ width: '1200px', maxWidth: '1200px' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>索引管理 - {table}</DialogTitle>
            <Button size="sm" onClick={loadIndexes}>
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </div>
        </DialogHeader>

        {/* 添加索引表单 */}
        {showAddForm && (
          <div className="mb-4 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold mb-3">添加新索引</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">索引名称</label>
                <Input
                  value={newIndexName}
                  onChange={(e) => setNewIndexName(e.target.value)}
                  placeholder="输入索引名称"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">选择列</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {availableColumns.map((col) => (
                    <div key={col} className="flex items-center gap-2">
                      <Checkbox
                        checked={newIndexColumns.includes(col)}
                        onCheckedChange={() => handleColumnToggle(col)}
                      />
                      <span className="text-sm">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newIndexIsUnique}
                  onCheckedChange={(v) => setNewIndexIsUnique(!!v)}
                />
                <span className="text-sm font-medium">唯一索引 (UNIQUE)</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleAddIndex}>添加</Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {/* 索引列表 */}
        <div className="overflow-auto max-h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-48">索引名</TableHead>
                <TableHead className="w-64">列</TableHead>
                <TableHead className="w-32">唯一约束</TableHead>
                <TableHead className="w-32">类型</TableHead>
                <TableHead className="w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indexes.map((idx, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <span className="font-medium">{idx.name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {idx.columns.map((col, j) => (
                        <span
                          key={j}
                          className="px-2 py-1 bg-muted rounded text-xs"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={idx.is_unique || idx.is_primary} disabled />
                  </TableCell>
                  <TableCell>
                    {idx.is_primary ? (
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                        PRIMARY
                      </span>
                    ) : idx.is_unique ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        UNIQUE
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-muted rounded text-xs">
                        {idx.index_type}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!idx.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteIndex(idx.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant={showAddForm ? "outline" : "default"}
          >
            {showAddForm ? (
              <>
                <X className="h-4 w-4 mr-2" />
                取消添加
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                添加索引
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

interface TableStructure {
  table_name: string;
  comment: string;
  engine: string;
  charset: string;
  update_time: string | null;
  columns: ColumnDetail[];
}

interface ColumnDetail {
  name: string;
  type_info: string;
  length: string | null;
  comment: string | null;
  default: string | null;
  is_nullable: boolean;
  is_primary: boolean;
  is_unique: boolean;
  is_auto_increment: boolean;
  is_unsigned: boolean;
  is_zerofill: boolean;
}

interface IndexDetail {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
}

interface ForeignKeyDetail {
  name: string;
  column: string;
  referenced_table: string;
  referenced_column: string;
  on_delete: string;
  on_update: string;
}

interface TableDesignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  table: string;
  onSaved: () => void;
}

export function TableDesignDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  table,
  onSaved
}: TableDesignDialogProps) {
  const [structure, setStructure] = useState<TableStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('columns');
  const [indexes, setIndexes] = useState<IndexDetail[]>([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [showAddIndexForm, setShowAddIndexForm] = useState(false);
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexColumns, setNewIndexColumns] = useState<string[]>([]);
  const [newIndexIsUnique, setNewIndexIsUnique] = useState(false);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  
  // 外键相关状态
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDetail[]>([]);
  const [foreignKeysLoading, setForeignKeysLoading] = useState(false);
  const [showAddForeignKeyForm, setShowAddForeignKeyForm] = useState(false);
  const [newForeignKeyName, setNewForeignKeyName] = useState('');
  const [newForeignKeyColumn, setNewForeignKeyColumn] = useState('');
  const [newReferencedTable, setNewReferencedTable] = useState('');
  const [newReferencedColumn, setNewReferencedColumn] = useState('');
  const [newOnDelete, setNewOnDelete] = useState('RESTRICT');
  const [newOnUpdate, setNewOnUpdate] = useState('RESTRICT');
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  useEffect(() => {
    if (open && connectionId && database && table) {
      loadStructure();
    }
  }, [open, connectionId, database, table]);

  const loadStructure = async () => {
    setLoading(true);
    try {
      const data = await invoke('get_table_structure', {
        connId: connectionId,
        database,
        table,
      });
      setStructure(data as TableStructure);
      // 加载索引、外键和可用表
      loadIndexes();
      loadForeignKeys();
      loadAvailableColumns();
      loadAvailableTables();
    } catch (error) {
      alert(`加载表结构失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const loadIndexes = async () => {
    setIndexLoading(true);
    try {
      const data = await invoke('get_table_indexes', {
        connId: connectionId,
        database,
        table,
      });
      setIndexes(data as IndexDetail[]);
    } catch (error) {
      // Error handling without console logging
    } finally {
      setIndexLoading(false);
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

  const handleSave = async () => {
    if (!structure) return;
    
    // 验证列名是否唯一
    const columnNames = structure.columns.map(c => c.name);
    const uniqueNames = new Set(columnNames);
    if (columnNames.length !== uniqueNames.size) {
      alert('列名必须唯一，请检查是否有重复的列名！');
      return;
    }
    
    // 验证主键
    const primaryKeys = structure.columns.filter(c => c.is_primary);
    if (primaryKeys.length === 0) {
      alert('表必须有至少一个主键！');
      return;
    }
    
    // 验证自增字段
    const autoIncrementColumns = structure.columns.filter(c => c.is_auto_increment);
    if (autoIncrementColumns.length > 1) {
      alert('一个表只能有一个自增字段！');
      return;
    }
    
    setSaving(true);
    try {
      await invoke('save_table_structure', {
        connId: connectionId,
        database,
        table,
        columns: structure.columns,
      });
      alert('保存成功！');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      alert(`保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const updateColumn = (index: number, field: keyof ColumnDetail, value: any) => {
    if (!structure) return;
    const newColumns = [...structure.columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setStructure({ ...structure, columns: newColumns });
  };

  const addColumn = () => {
    if (!structure) return;
    setStructure({
      ...structure,
      columns: [
        ...structure.columns,
        {
          name: 'new_column',
          type_info: 'varchar',
          length: '255',
          comment: '',
          default: null,
          is_nullable: true,
          is_primary: false,
          is_unique: false,
          is_auto_increment: false,
          is_unsigned: false,
          is_zerofill: false,
        },
      ],
    });
  };

  const deleteColumn = (index: number) => {
    if (!structure) return;
    const col = structure.columns[index];
    if (col.is_primary) {
      alert('不能删除主键列！');
      return;
    }
    const newColumns = structure.columns.filter((_, i) => i !== index);
    setStructure({ ...structure, columns: newColumns });
  };

  const handlePrimaryKeyChange = (index: number, value: boolean) => {
    if (!structure) return;
    const newColumns = [...structure.columns];
    
    // 如果设置为 true，清除其他主键
    if (value) {
      newColumns.forEach((col, i) => {
        if (i !== index) {
          col.is_primary = false;
        }
      });
      newColumns[index].is_primary = true;
      newColumns[index].is_nullable = false; // 主键不能为 NULL
    } else {
      newColumns[index].is_primary = false;
    }
    
    setStructure({ ...structure, columns: newColumns });
  };

  const handleAutoIncrementChange = (index: number, value: boolean) => {
    if (!structure) return;
    const newColumns = [...structure.columns];
    
    // 如果设置为 true，清除其他自增字段
    if (value) {
      newColumns.forEach((col, i) => {
        if (i !== index) {
          col.is_auto_increment = false;
        }
      });
      newColumns[index].is_auto_increment = true;
      newColumns[index].is_primary = true; // 自增字段必须是主键
      newColumns[index].is_nullable = false; // 自增字段不能为 NULL
    } else {
      newColumns[index].is_auto_increment = false;
    }
    
    setStructure({ ...structure, columns: newColumns });
  };

  const handleDeleteIndex = async (indexName: string) => {
    if (indexName === 'PRIMARY') {
      alert('主键索引不能删除，请通过"列"标签页修改主键');
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
      setShowAddIndexForm(false);
      setNewIndexName('');
      setNewIndexColumns([]);
      setNewIndexIsUnique(false);
      loadIndexes();
    } catch (error) {
      alert(`添加索引失败: ${error}`);
    }
  };

  const handleIndexColumnToggle = (columnName: string) => {
    if (newIndexColumns.includes(columnName)) {
      setNewIndexColumns(newIndexColumns.filter(c => c !== columnName));
    } else {
      setNewIndexColumns([...newIndexColumns, columnName]);
    }
  };

  // 外键相关函数
  const loadForeignKeys = async () => {
    setForeignKeysLoading(true);
    try {
      const data = await invoke('get_table_foreign_keys', {
        connId: connectionId,
        database,
        table,
      });
      setForeignKeys(data as ForeignKeyDetail[]);
    } catch (error) {
      // Error handling without console logging
    } finally {
      setForeignKeysLoading(false);
    }
  };

  const loadAvailableTables = async () => {
    try {
      const data = await invoke('get_mysql_tables', {
        connId: connectionId,
        database,
      });
      setAvailableTables(data as string[]);
    } catch (error) {
      console.error('加载可用表失败:', error);
    }
  };

  const handleDeleteForeignKey = async (name: string) => {
    if (!confirm(`确定要删除外键 "${name}" 吗？`)) return;
    
    try {
      await invoke('drop_foreign_key', {
        connId: connectionId,
        database,
        table,
        name,
      });
      alert('外键删除成功');
      loadForeignKeys();
    } catch (error) {
      console.error('删除外键失败:', error);
      alert(`删除外键失败: ${error}`);
    }
  };

  const handleAddForeignKey = async () => {
    if (!newForeignKeyName.trim()) {
      alert('请输入外键名称');
      return;
    }
    if (!newForeignKeyColumn) {
      alert('请选择外键列');
      return;
    }
    if (!newReferencedTable) {
      alert('请选择引用表');
      return;
    }
    if (!newReferencedColumn) {
      alert('请选择引用列');
      return;
    }

    try {
      await invoke('add_foreign_key', {
        connId: connectionId,
        database,
        table,
        name: newForeignKeyName,
        column: newForeignKeyColumn,
        referenced_table: newReferencedTable,
        referenced_column: newReferencedColumn,
        on_delete: newOnDelete,
        on_update: newOnUpdate,
      });
      alert('外键添加成功');
      setShowAddForeignKeyForm(false);
      setNewForeignKeyName('');
      setNewForeignKeyColumn('');
      setNewReferencedTable('');
      setNewReferencedColumn('');
      setNewOnDelete('RESTRICT');
      setNewOnUpdate('RESTRICT');
      loadForeignKeys();
    } catch (error) {
      console.error('添加外键失败:', error);
      alert(`添加外键失败: ${error}`);
    }
  };

  if (loading || !structure) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent style={{ width: '1200px', maxWidth: '1200px' }}>
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
      <DialogContent style={{ width: '1200px', maxWidth: '1200px' }} className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>设计表 - {structure.table_name}</DialogTitle>
        </DialogHeader>

        {/* 表基本信息 */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
          <div>
            <span className="text-muted-foreground">表名</span>
            <span className="ml-2 font-semibold">{structure.table_name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">注释</span>
            <span className="ml-2">{structure.comment || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">引擎</span>
            <span className="ml-2">{structure.engine}</span>
          </div>
          <div>
            <span className="text-muted-foreground">字符集</span>
            <span className="ml-2">{structure.charset}</span>
          </div>
          {structure.update_time && (
            <div className="col-span-4">
              <span className="text-muted-foreground">更新时间</span>
              <span className="ml-2">{structure.update_time}</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="columns">列</TabsTrigger>
            <TabsTrigger value="foreign">外键</TabsTrigger>
            <TabsTrigger value="index">索引</TabsTrigger>
            <TabsTrigger value="trigger">触发器</TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="mt-4">
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-32">名称</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead className="w-20">长度</TableHead>
                    <TableHead className="w-32">注释</TableHead>
                    <TableHead className="w-24">默认值</TableHead>
                    <TableHead className="w-16 text-center">Not Null</TableHead>
                    <TableHead className="w-16 text-center">主键</TableHead>
                    <TableHead className="w-16 text-center">唯一</TableHead>
                    <TableHead className="w-16 text-center">自增</TableHead>
                    <TableHead className="w-20 text-center">UNSIGNED</TableHead>
                    <TableHead className="w-20 text-center">Zerofill</TableHead>
                    <TableHead className="w-20">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structure.columns.map((col, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={col.name}
                          onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={col.type_info}
                          onChange={(e) => updateColumn(idx, 'type_info', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={col.length || ''}
                          onChange={(e) => updateColumn(idx, 'length', e.target.value)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={col.comment || ''}
                          onChange={(e) => updateColumn(idx, 'comment', e.target.value)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={col.default || ''}
                          onChange={(e) => updateColumn(idx, 'default', e.target.value)}
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!col.is_nullable}
                          onCheckedChange={(v) => updateColumn(idx, 'is_nullable', !v)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={col.is_primary}
                          onCheckedChange={(v) => handlePrimaryKeyChange(idx, !!v)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={col.is_unique}
                          onCheckedChange={(v) => updateColumn(idx, 'is_unique', !!v)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={col.is_auto_increment}
                          onCheckedChange={(v) => handleAutoIncrementChange(idx, !!v)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={col.is_unsigned}
                          onCheckedChange={(v) => updateColumn(idx, 'is_unsigned', !!v)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={col.is_zerofill}
                          onCheckedChange={(v) => updateColumn(idx, 'is_zerofill', !!v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteColumn(idx)}
                          disabled={col.is_primary}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4">
              <Button onClick={addColumn}>
                <Plus className="h-4 w-4 mr-2" />
                添加列
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="foreign">
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">外键列表</h3>
                <Button size="sm" onClick={loadForeignKeys}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
              </div>

              {/* 添加外键表单 */}
              {showAddForeignKeyForm && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">添加新外键</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">外键名称</label>
                      <Input
                        value={newForeignKeyName}
                        onChange={(e) => setNewForeignKeyName(e.target.value)}
                        placeholder="fk_name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">本表列</label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={newForeignKeyColumn}
                        onChange={(e) => setNewForeignKeyColumn(e.target.value)}
                      >
                        <option value="">选择列</option>
                        {availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">引用表</label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={newReferencedTable}
                        onChange={(e) => {
                          setNewReferencedTable(e.target.value);
                          setNewReferencedColumn('');
                        }}
                      >
                        <option value="">选择引用表</option>
                        {availableTables.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">引用列</label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={newReferencedColumn}
                        onChange={(e) => setNewReferencedColumn(e.target.value)}
                        disabled={!newReferencedTable}
                      >
                        <option value="">选择引用列</option>
                        {newReferencedTable && availableColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">ON DELETE</label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={newOnDelete}
                        onChange={(e) => setNewOnDelete(e.target.value)}
                      >
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">ON UPDATE</label>
                      <select
                        className="w-full p-2 border rounded-md"
                        value={newOnUpdate}
                        onChange={(e) => setNewOnUpdate(e.target.value)}
                      >
                        <option value="RESTRICT">RESTRICT</option>
                        <option value="CASCADE">CASCADE</option>
                        <option value="SET NULL">SET NULL</option>
                        <option value="NO ACTION">NO ACTION</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={handleAddForeignKey}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setShowAddForeignKeyForm(false);
                      setNewForeignKeyName('');
                      setNewForeignKeyColumn('');
                      setNewReferencedTable('');
                      setNewReferencedColumn('');
                    }}>
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 外键列表 */}
              {foreignKeysLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : foreignKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>暂无外键</p>
                </div>
              ) : (
                <div className="overflow-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr>
                        <th className="px-4 py-2 text-left border-b min-w-[120px]">外键名</th>
                        <th className="px-4 py-2 text-left border-b min-w-[120px]">本表列</th>
                        <th className="px-4 py-2 text-left border-b min-w-[120px]">引用表</th>
                        <th className="px-4 py-2 text-left border-b min-w-[120px]">引用列</th>
                        <th className="px-4 py-2 text-left border-b min-w-[100px]">ON DELETE</th>
                        <th className="px-4 py-2 text-left border-b min-w-[100px]">ON UPDATE</th>
                        <th className="px-4 py-2 text-left border-b min-w-[80px]">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {foreignKeys.map((fk, idx) => (
                        <tr key={idx} className="hover:bg-muted/50">
                          <td className="px-4 py-2 border-b font-semibold">{fk.name}</td>
                          <td className="px-4 py-2 border-b">{fk.column}</td>
                          <td className="px-4 py-2 border-b">{fk.referenced_table}</td>
                          <td className="px-4 py-2 border-b">{fk.referenced_column}</td>
                          <td className="px-4 py-2 border-b">{fk.on_delete}</td>
                          <td className="px-4 py-2 border-b">{fk.on_update}</td>
                          <td className="px-4 py-2 border-b">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleDeleteForeignKey(fk.name)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4">
                <Button size="sm" onClick={() => setShowAddForeignKeyForm(true)} disabled={showAddForeignKeyForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加外键
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="index">
            <div className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">索引列表</h3>
                <Button size="sm" onClick={loadIndexes}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  刷新
                </Button>
              </div>

              {/* 添加索引表单 */}
              {showAddIndexForm && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">添加新索引</h4>
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
                              onCheckedChange={() => handleIndexColumnToggle(col)}
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
                      <Button onClick={handleAddIndex} size="sm">添加</Button>
                      <Button variant="outline" onClick={() => setShowAddIndexForm(false)} size="sm">取消</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 索引列表 */}
              {indexLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span>加载索引中...</span>
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px] border rounded-md">
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
                                size="icon-xs"
                                onClick={() => handleDeleteIndex(idx.name)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="mt-4">
                <Button
                  onClick={() => setShowAddIndexForm(!showAddIndexForm)}
                  variant={showAddIndexForm ? "outline" : "default"}
                  size="sm"
                >
                  {showAddIndexForm ? (
                    <>
                      取消添加
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      添加索引
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="trigger">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              触发器管理（待实现）
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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

interface ColumnDiff {
  column_name: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
}

interface TableStructureDiff {
  table_name: string;
  column_diffs: ColumnDiff[];
  summary: string;
}

interface DataRowDiff {
  primary_key: string;
  column_name: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
}

interface TableDataDiff {
  table_name: string;
  row_diffs: DataRowDiff[];
  summary: string;
}

interface DataComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
  table: string;
}

export default function DataComparisonDialog({
  open,
  onOpenChange,
  connectionId,
  database,
  table,
}: DataComparisonDialogProps) {
  const [targetTable, setTargetTable] = useState('');
  const [structureDiff, setStructureDiff] = useState<TableStructureDiff | null>(null);
  const [dataDiff, setDataDiff] = useState<TableDataDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableTables, setAvailableTables] = useState<string[]>([]);

  useEffect(() => {
    if (open && connectionId && database) {
      loadTables();
    }
  }, [open, connectionId, database]);

  const loadTables = async () => {
    try {
      const tables = await invoke<string[]>('get_mysql_tables', {
        connId: connectionId,
        database,
      });
      setAvailableTables(tables.filter((t) => t !== table));
    } catch (error) {
      // Error handling without console logging
    }
  };

  const compareStructure = async () => {
    if (!targetTable) return;

    setLoading(true);
    try {
      const result = await invoke<TableStructureDiff>('compare_table_structure', {
        connId: connectionId,
        database,
        table1: table,
        table2: targetTable,
      });
      setStructureDiff(result);
    } catch (error) {
      alert('表结构对比失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const compareData = async () => {
    if (!targetTable) return;

    setLoading(true);
    try {
      const result = await invoke<TableDataDiff>('compare_table_data', {
        connId: connectionId,
        database,
        table1: table,
        table2: targetTable,
      });
      setDataDiff(result);
    } catch (error) {
      alert('数据对比失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'added':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            新增
          </span>
        );
      case 'removed':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            删除
          </span>
        );
      case 'modified':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            修改
          </span>
        );
      case 'row_count_diff':
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            行数差异
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            {type}
          </span>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>数据对比</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">当前表</label>
              <div className="p-2 bg-gray-100 rounded-md text-sm">{table}</div>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">目标表</label>
              <select
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">选择目标表</option>
                {availableTables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Tabs defaultValue="structure" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="structure">表结构对比</TabsTrigger>
              <TabsTrigger value="data">数据对比</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={compareStructure} disabled={!targetTable || loading}>
                  {loading ? '对比中...' : '对比表结构'}
                </Button>
              </div>

              {structureDiff && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium">{structureDiff.summary}</p>
                  </div>

                  <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>列名</TableHead>
                          <TableHead>变更类型</TableHead>
                          <TableHead>旧值</TableHead>
                          <TableHead>新值</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {structureDiff.column_diffs.map((diff, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{diff.column_name}</TableCell>
                            <TableCell>{getChangeTypeBadge(diff.change_type)}</TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <div className="truncate">{diff.old_value || '-'}</div>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <div className="truncate">{diff.new_value || '-'}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {structureDiff.column_diffs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-gray-500">
                              没有发现差异
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="data" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={compareData} disabled={!targetTable || loading}>
                  {loading ? '对比中...' : '对比数据'}
                </Button>
              </div>

              {dataDiff && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-md">
                    <p className="text-sm font-medium">{dataDiff.summary}</p>
                  </div>

                  <ScrollArea className="h-[400px] border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>主键</TableHead>
                          <TableHead>列名</TableHead>
                          <TableHead>变更类型</TableHead>
                          <TableHead>旧值</TableHead>
                          <TableHead>新值</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataDiff.row_diffs.map((diff, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{diff.primary_key}</TableCell>
                            <TableCell>{diff.column_name}</TableCell>
                            <TableCell>{getChangeTypeBadge(diff.change_type)}</TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <div className="truncate">{diff.old_value || '-'}</div>
                            </TableCell>
                            <TableCell className="text-sm max-w-xs">
                              <div className="truncate">{diff.new_value || '-'}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {dataDiff.row_diffs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-gray-500">
                              没有发现差异
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
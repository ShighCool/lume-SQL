import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, Trash2, RefreshCw, Search, Database, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import type { MongoDocument } from '../types/database';
import type { ChangeEvent } from 'react';
import { cn } from '../lib/utils';

interface MongoDBBrowserProps {
  connectionId: string | null;
}

export function MongoDBBrowser({ connectionId }: MongoDBBrowserProps) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MongoDocument[]>([]);
  const [filterQuery, setFilterQuery] = useState('{}');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddCollectionDialog, setShowAddCollectionDialog] = useState(false);
  const [showRenameCollectionDialog, setShowRenameCollectionDialog] = useState(false);
  const [newDocument, setNewDocument] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionNameForRename, setNewCollectionNameForRename] = useState('');
  const [documentCount, setDocumentCount] = useState(0);

  // 加载数据库列表
  const loadDatabases = useCallback(async () => {
    if (!connectionId) return;
    try {
      const result: string[] = await invoke('get_mongodb_databases', {
        connId: connectionId,
      });
      setDatabases(result);
    } catch (error) {
      console.error('加载数据库列表失败:', error);
    }
  }, [connectionId]);

  // 加载集合列表
  const loadCollections = useCallback(async () => {
    if (!connectionId || !selectedDatabase) return;
    setLoading(true);
    try {
      const result: string[] = await invoke('get_mongodb_collections', {
        connId: connectionId,
      });
      setCollections(result);
    } catch (error) {
      console.error('加载集合列表失败:', error);
      alert(`加载集合列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, selectedDatabase]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // 加载文档
  const loadDocuments = useCallback(async () => {
    if (!connectionId || !selectedCollection) return;
    setLoading(true);
    try {
      const result: string = await invoke('find_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
        filter: filterQuery,
      });
      const docs = JSON.parse(result);
      setDocuments(docs);
      
      // 加载文档数量
      const count: number = await invoke('count_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
      });
      setDocumentCount(count);
    } catch (error) {
      console.error('加载文档失败:', error);
      alert(`加载文档失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, selectedCollection, filterQuery]);

  const handleSelectDatabase = (database: string) => {
    setSelectedDatabase(database);
    setSelectedCollection(null);
    setDocuments([]);
  };

  const handleSelectCollection = (collection: string) => {
    setSelectedCollection(collection);
  };

  const handleRefresh = () => {
    loadDatabases();
    if (selectedDatabase) {
      loadCollections();
    }
    if (selectedCollection) {
      loadDocuments();
    }
  };

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  const handleAddCollection = async () => {
    if (!connectionId || !selectedDatabase) return;
    if (!newCollectionName.trim()) {
      alert('请输入集合名称');
      return;
    }

    try {
      await invoke('create_mongodb_collection', {
        connId: connectionId,
        collectionName: newCollectionName.trim(),
      });

      alert('集合创建成功');
      setShowAddCollectionDialog(false);
      setNewCollectionName('');
      loadCollections();
    } catch (error) {
      console.error('创建集合失败:', error);
      alert(`创建集合失败: ${error}`);
    }
  };

  const handleDeleteCollection = async (collection: string) => {
    if (!connectionId || !selectedDatabase) return;
    if (!confirm(`确定要删除集合 "${collection}" 吗？此操作不可逆！`)) return;

    try {
      await invoke('drop_mongodb_collection', {
        connId: connectionId,
        collectionName: collection,
      });

      alert('集合删除成功');
      if (selectedCollection === collection) {
        setSelectedCollection(null);
        setDocuments([]);
      }
      loadCollections();
    } catch (error) {
      console.error('删除集合失败:', error);
      alert(`删除集合失败: ${error}`);
    }
  };

  const handleRenameCollection = async () => {
    if (!connectionId || !selectedDatabase || !selectedCollection) return;
    if (!newCollectionNameForRename.trim()) {
      alert('请输入新集合名称');
      return;
    }

    try {
      await invoke('rename_mongodb_collection', {
        connId: connectionId,
        oldName: selectedCollection,
        newName: newCollectionNameForRename.trim(),
      });

      alert('集合重命名成功');
      setShowRenameCollectionDialog(false);
      setNewCollectionNameForRename('');
      setSelectedCollection(newCollectionNameForRename.trim());
      loadCollections();
    } catch (error) {
      console.error('重命名集合失败:', error);
      alert(`重命名集合失败: ${error}`);
    }
  };

  const handleApplyFilter = () => {
    loadDocuments();
  };

  const handleAddDocument = async () => {
    if (!connectionId || !selectedCollection) return;
    if (!newDocument.trim()) {
      alert('请输入文档内容');
      return;
    }

    try {
      // 验证 JSON 格式
      JSON.parse(newDocument);

      await invoke('insert_mongodb_document', {
        connId: connectionId,
        collection: selectedCollection,
        document: newDocument,
      });

      alert('文档添加成功');
      setShowAddDialog(false);
      setNewDocument('');
      loadDocuments();
    } catch (error) {
      console.error('添加文档失败:', error);
      if (error instanceof SyntaxError) {
        alert('无效的 JSON 格式');
      } else {
        alert(`添加文档失败: ${error}`);
      }
    }
  };

  const handleDeleteDocument = async (doc: MongoDocument) => {
    if (!connectionId || !selectedCollection) return;
    if (!confirm(`确定要删除文档 "${String(doc._id)}" 吗？`)) return;

    try {
      await invoke('delete_mongodb_document', {
        connId: connectionId,
        collection: selectedCollection,
        filter: JSON.stringify({ _id: doc._id }),
      });

      alert('文档删除成功');
      loadDocuments();
    } catch (error) {
      console.error('删除文档失败:', error);
      alert(`删除文档失败: ${error}`);
    }
  };

  const handleEditDocument = (doc: MongoDocument) => {
    alert('编辑文档功能开发中');
  };

  // 动态生成表格列
  // 获取所有可能的字段
  const getAllFields = useCallback(() => {
    if (documents.length === 0) return [];
    const allFields = new Set<string>();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => allFields.add(key));
    });
    return Array.from(allFields);
  }, [documents]);

  const renderCellValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    if (typeof value === 'object') {
      return <span className="text-xs font-mono">{JSON.stringify(value)}</span>;
    }
    return <span>{String(value)}</span>;
  };

  if (!connectionId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        请先选择一个连接
      </div>
    );
  }

  const fields = getAllFields();

  return (
    <div className="flex h-full">
      <div className="w-[260px] border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">集合</h3>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleAddCollection}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {collections.map((collection) => (
              <div
                key={collection}
                className={`
                  p-2 rounded-md cursor-pointer transition-colors text-sm
                  ${selectedCollection === collection ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}
                `}
                onClick={() => handleSelectCollection(collection)}
              >
                {collection}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedCollection ? (
          <>
            {/* 工具栏 */}
            <div className="px-4 py-3 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedCollection}</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  添加文档
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder='输入 JSON 过滤条件，如: {"age": 25}'
                    value={filterQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterQuery(e.target.value)}
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={handleApplyFilter} disabled={loading}>
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  查询
                </Button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length > 0 ? (
                <div className="overflow-auto border rounded-md">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">_id</th>
                        {fields.map(field => (
                          <th key={field} className="px-4 py-2 text-left font-medium">{field}</th>
                        ))}
                        <th className="px-4 py-2 text-left font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">
                            <span className="font-mono text-xs" title={String(doc._id)}>
                              {String(doc._id).substring(0, 12)}...
                            </span>
                          </td>
                          {fields.map(field => (
                            <td key={field} className="px-4 py-2">
                              {renderCellValue(doc[field])}
                            </td>
                          ))}
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditDocument(doc)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteDocument(doc)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  {filterQuery === '{}' ? '暂无文档' : '未找到匹配的文档'}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            选择一个集合查看文档
          </div>
        )}
      </div>

      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[600px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">添加新文档</h3>
            <textarea
              placeholder='输入 JSON，如: {"name": "John", "age": 30}'
              className="w-full h-64 p-3 font-mono text-sm border rounded-md resize-none"
              value={newDocument}
              onChange={(e) => setNewDocument(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => {
                setShowAddDialog(false);
                setNewDocument('');
              }}>
                取消
              </Button>
              <Button onClick={handleAddDocument}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
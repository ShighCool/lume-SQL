import { invoke } from '@tauri-apps/api/core';
import { BarChart3, Check, ChevronDown, ChevronRight, Code, Copy, Database, Download, Edit, FileText, FolderTree, Plus, RefreshCw, Search, Settings, Table, Trash2, X, Activity, ZoomIn } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import type { MongoDocument } from '../types/database';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from './ui/context-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import React from 'react';
import DatabaseMonitorPanel from './DatabaseMonitorPanel';

interface MongoDBBrowserProps {
  connectionId: string | null;
}

export function MongoDBBrowser({ connectionId }: MongoDBBrowserProps) {
  console.log('[MongoDBBrowser] Rendering with connectionId:', connectionId);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [collections, setCollections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MongoDocument[]>([]);
  const [filterQuery, setFilterQuery] = useState('{}');
  const [showAddCollectionDialog, setShowAddCollectionDialog] = useState(false);
  const [showRenameCollectionDialog, setShowRenameCollectionDialog] = useState(false);
  const [showCollectionStatsDialog, setShowCollectionStatsDialog] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionNameForRename, setNewCollectionNameForRename] = useState('');
  const [documentCount, setDocumentCount] = useState(0);
  const [collectionStats, setCollectionStats] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'tree' | 'json'>('table');
  const [activeTab, setActiveTab] = useState<'data' | 'monitor'>('data');
  const [editingDoc, setEditingDoc] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [showQueryDialog, setShowQueryDialog] = useState(false);
  const [queryFilter, setQueryFilter] = useState('{}');
  const [queryProjection, setQueryProjection] = useState('{}');
  const [querySort, setQuerySort] = useState('{}');
  const [queryLimit, setQueryLimit] = useState(100);
  const [showFieldControlDialog, setShowFieldControlDialog] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({});
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<any>(null);
  const [viewCellData, setViewCellData] = useState<{ value: string; columnName: string } | null>(null);
  const [viewFormat, setViewFormat] = useState<'text' | 'json'>('text');
  const [expandedDocs, setExpandedDocs] = useState<Set<number>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<MongoDocument | null>(null);
  const [editDocumentData, setEditDocumentData] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  const handleToggleExpand = (index: number) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedDocs(newExpanded);
  };

  // 加载数据库列表
  const loadDatabases = useCallback(async () => {
    if (!connectionId) {
      console.log('loadDatabases: connectionId is null');
      return;
    }
    try {
      console.log('loadDatabases: starting, connId:', connectionId);
      const result: string[] = await invoke('get_mongodb_databases', {
        connId: connectionId,
      });
      console.log('loadDatabases: result:', result);
      setDatabases(result);
    } catch (error) {
      console.error('加载数据库列表失败:', error);
    }
  }, [connectionId]);

  // 加载集合列表
  const loadCollections = useCallback(async () => {
    if (!connectionId || !selectedDatabase) {
      console.log('loadCollections: connectionId or selectedDatabase is null', {
        connectionId,
        selectedDatabase,
      });
      return;
    }
    setLoading(true);
    try {
      console.log('loadCollections: starting, connId:', connectionId, 'database:', selectedDatabase);
      const result: string[] = await invoke('get_mongodb_collections', {
        connId: connectionId,
      });
      console.log('loadCollections: result:', result);
      setCollections(result);
    } catch (error) {
      console.error('加载集合列表失败:', error);
      alert(`加载集合列表失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, selectedDatabase]);

  useEffect(() => {
    console.log('[MongoDBBrowser] useEffect connectionId changed:', connectionId);
    if (connectionId) {
      loadDatabases();
    }
  }, [connectionId]);

  useEffect(() => {
    console.log('[MongoDBBrowser] useEffect selectedDatabase changed:', selectedDatabase);
    if (connectionId && selectedDatabase) {
      loadCollections();
    }
  }, [connectionId, selectedDatabase]);

  // 当选择集合时加载数据
  useEffect(() => {
    console.log('[MongoDBBrowser] useEffect selectedCollection changed:', selectedCollection);
    if (connectionId && selectedCollection) {
      console.log('[MongoDBBrowser]   loading documents for collection:', selectedCollection);
      loadDocuments();
    }
  }, [connectionId, selectedCollection, currentPage, pageSize]);

  // 加载文档
  const loadDocuments = useCallback(async () => {
    if (!connectionId || !selectedCollection) {
      console.log('[MongoDBBrowser] loadDocuments: connectionId or selectedCollection is null', {
        connectionId,
        selectedCollection,
      });
      return;
    }
    setLoading(true);
    try {
      console.log('[MongoDBBrowser] loadDocuments: starting');
      console.log('[MongoDBBrowser]   connId:', connectionId);
      console.log('[MongoDBBrowser]   collection:', selectedCollection);
      console.log('[MongoDBBrowser]   filterQuery:', filterQuery);
      console.log('[MongoDBBrowser]   page:', currentPage - 1);
      console.log('[MongoDBBrowser]   pageSize:', pageSize);

      const result: string = await invoke('find_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
        filter: filterQuery,
        page: currentPage - 1,
        pageSize: pageSize,
      });

      console.log('[MongoDBBrowser]   raw result length:', result.length);
      console.log('[MongoDBBrowser]   raw result:', result);

      const docs = JSON.parse(result);
      console.log('[MongoDBBrowser]   parsed docs length:', docs.length);
      console.log('[MongoDBBrowser]   parsed docs:', docs);
      setDocuments(docs);

      // 自动设置所有字段为可见
      const allFields = new Set<string>();
      docs.forEach((doc: MongoDocument) => {
        Object.keys(doc).forEach(key => allFields.add(key));
      });
      const newVisibility: Record<string, boolean> = {};
      allFields.forEach(field => {
        newVisibility[field] = true;
      });
      setFieldVisibility(newVisibility);

      // 加载文档数量
      const count: number = await invoke('count_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
      });
      console.log('[MongoDBBrowser]   count:', count);
      setDocumentCount(count);
      setTotalPages(Math.ceil(count / pageSize));
      console.log('[MongoDBBrowser]   totalPages:', Math.ceil(count / pageSize));
    } catch (error) {
      console.error('[MongoDBBrowser] 加载文档失败:', error);
      alert(`加载文档失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }, [connectionId, selectedCollection, filterQuery, currentPage, pageSize]);

  const handleSelectDatabase = (database: string) => {
    console.log('handleSelectDatabase:', database);
    setSelectedDatabase(database);
    setSelectedCollection(null);
    setDocuments([]);
  };

  const handleSelectCollection = (collection: string) => {
    console.log('handleSelectCollection:', collection);
    setSelectedCollection(collection);
  };

  const handleRefresh = () => {
    console.log('handleRefresh: refreshing all');
    loadDatabases();
    if (selectedDatabase) {
      loadCollections();
    }
    if (selectedCollection) {
      loadDocuments();
    }
  };

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

  const handleCopyCollectionName = (collection: string) => {
    navigator.clipboard.writeText(collection);
    alert('集合名称已复制到剪贴板');
  };

  const handleGetCollectionStats = async (collection: string) => {
    try {
      const stats = await invoke('get_mongodb_collection_stats', {
        connId: connectionId,
        collection: collection,
      });
      setCollectionStats(stats as string);
      setShowCollectionStatsDialog(true);
    } catch (error) {
      console.error('获取集合统计失败:', error);
      alert(`获取集合统计失败: ${error}`);
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

  const handleAddDocument = () => {
    setEditingDocument(null);
    setEditDocumentData('{}');
    setShowEditDialog(true);
  };

  const handleSaveDocument = async () => {
    if (!selectedCollection || !connectionId) return;

    try {
      // 验证 JSON 格式
      const documentData = JSON.parse(editDocumentData);

      if (editingDocument) {
        // 编辑模式：更新现有文档
        const updateDoc: any = {};
        Object.keys(documentData).forEach(key => {
          if (key !== '_id') {
            updateDoc[key] = documentData[key];
          }
        });

        await invoke('update_mongodb_document', {
          connId: connectionId,
          collection: selectedCollection,
          filter: JSON.stringify({ _id: editingDocument._id }),
          update: JSON.stringify({ $set: updateDoc }),
        });

        alert('文档更新成功');
      } else {
        // 新增模式：插入新文档
        await invoke('insert_mongodb_document', {
          connId: connectionId,
          collection: selectedCollection,
          document: editDocumentData,
        });

        alert('文档添加成功');
      }

      setShowEditDialog(false);
      loadDocuments();
    } catch (error) {
      if (error instanceof SyntaxError) {
        alert('无效的 JSON 格式');
      } else {
        console.error('保存文档失败:', error);
        alert(`保存文档失败: ${error}`);
      }
    }
  };

  const handleDeleteDocument = async (doc: MongoDocument) => {
    if (!connectionId || !selectedCollection) return;
    if (!confirm(`确定要删除文档 "${renderId(doc._id)}" 吗？`)) return;

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
    setEditingDocument(doc);
    setEditDocumentData(JSON.stringify(doc, null, 2));
    setShowEditDialog(true);
  };

  const handleStartInlineEdit = (docId: string, field: string, currentValue: any) => {
    setEditingDoc({ id: docId, field });
    setEditValue(typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue));
  };

  const handleSaveInlineEdit = async () => {
    if (!editingDoc || !selectedCollection || !connectionId) return;

    try {
      const docIndex = documents.findIndex(doc => renderId(doc._id) === editingDoc.id);
      if (docIndex === -1) return;

      const doc = documents[docIndex];
      const updateDoc: any = {};

      // 保留原值，只更新编辑的字段
      Object.keys(doc).forEach(key => {
        if (key === editingDoc.field) {
          try {
            // 尝试解析为 JSON
            updateDoc[key] = JSON.parse(editValue);
          } catch {
            updateDoc[key] = editValue;
          }
        } else {
          updateDoc[key] = doc[key];
        }
      });

      await invoke('update_mongodb_document', {
        connId: connectionId,
        collection: selectedCollection,
        filter: JSON.stringify({ _id: doc._id }),
        update: JSON.stringify({ $set: updateDoc }),
      });

      alert('文档更新成功');
      setEditingDoc(null);
      setEditValue('');
      loadDocuments();
    } catch (error) {
      console.error('更新文档失败:', error);
      alert(`更新文档失败: ${error}`);
    }
  };

  const handleCancelInlineEdit = () => {
    setEditingDoc(null);
    setEditValue('');
  };

  const handleToggleSelectDoc = (docId: string) => {
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
    setSelectAll(false);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(documents.map(doc => renderId(doc._id))));
    }
    setSelectAll(!selectAll);
  };

  const handleBatchDelete = async () => {
    if (!connectionId || !selectedCollection) return;
    if (selectedDocs.size === 0) {
      alert('请先选择要删除的文档');
      return;
    }

    if (!confirm(`确定要删除 ${selectedDocs.size} 个文档吗？此操作不可逆！`)) return;

    try {
      for (const docId of selectedDocs) {
        await invoke('delete_mongodb_document', {
          connId: connectionId,
          collection: selectedCollection,
          filter: JSON.stringify({ _id: docId }),
        });
      }

      alert(`成功删除 ${selectedDocs.size} 个文档`);
      setSelectedDocs(new Set());
      setSelectAll(false);
      loadDocuments();
    } catch (error) {
      console.error('批量删除失败:', error);
      alert(`批量删除失败: ${error}`);
    }
  };

  const handleExport = () => {
    if (documents.length === 0) {
      alert('没有文档可导出');
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    if (exportFormat === 'json') {
      content = JSON.stringify(documents, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      // CSV 导出
      if (documents.length === 0) {
        alert('没有文档可导出');
        return;
      }

      const fields = Object.keys(documents[0]);
      const csvContent = [
        fields.join(','),
        ...documents.map(doc =>
          fields.map(field => {
            const value = doc[field];
            const strValue = value === null || value === undefined ? '' : String(value);
            return `"${strValue.replace(/"/g, '""')}"`;
          }).join(',')
        ),
      ].join('\n');

      content = csvContent;
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCollection || 'export'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('导出成功');
    setShowExportDialog(false);
  };

  const handleExportAll = async () => {
    if (!connectionId || !selectedCollection) return;

    try {
      const allDocs: any[] = [];
      let cursor = await invoke('find_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
        filter: '{}',
        page: 0,
        pageSize: 1000,
      });

      const docs = JSON.parse(cursor as string) as any[];
      allDocs.push(...docs);

      // 如果数据量大，继续获取更多
      const count = await invoke('count_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
      }) as number;

      let page = 1;
      while (allDocs.length < count && page * 1000 <= count) {
        cursor = await invoke('find_mongodb_documents', {
          connId: connectionId,
          collection: selectedCollection,
          filter: '{}',
          page: page,
          pageSize: 1000,
        });

        const docs = JSON.parse(cursor as string) as any[];
        allDocs.push(...docs);
        page++;
      }

      let content: string;
      let mimeType: string;
      let extension: string;

      if (exportFormat === 'json') {
        content = JSON.stringify(allDocs, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else {
        if (allDocs.length === 0) {
          alert('没有文档可导出');
          return;
        }

        const fields = Object.keys(allDocs[0]);
        const csvContent = [
          fields.join(','),
          ...allDocs.map(doc =>
            fields.map(field => {
              const value = doc[field];
              const strValue = value === null || value === undefined ? '' : String(value);
              return `"${strValue.replace(/"/g, '""')}"`;
            }).join(',')
          ),
        ].join('\n');

        content = csvContent;
        mimeType = 'text/csv';
        extension = 'csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCollection}_all.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`导出成功，共 ${allDocs.length} 个文档`);
      setShowExportDialog(false);
    } catch (error) {
      console.error('导出失败:', error);
      alert(`导出失败: ${error}`);
    }
  };

  const handleApplyAdvancedQuery = async () => {
    if (!connectionId || !selectedCollection) return;

    try {
      setLoading(true);
      setCurrentPage(1); // 重置到第一页
      const result: string = await invoke('find_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
        filter: queryFilter,
        page: 0,
        pageSize: queryLimit,
      });
      const docs = JSON.parse(result);
      setDocuments(docs);

      const count: number = await invoke('count_mongodb_documents', {
        connId: connectionId,
        collection: selectedCollection,
      });
      setDocumentCount(count);
      setTotalPages(Math.ceil(count / queryLimit));

      setShowQueryDialog(false);
    } catch (error) {
      console.error('查询失败:', error);
      alert(`查询失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    loadDocuments();
  };

  const handleToggleField = (field: string) => {
    setFieldVisibility(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleResetFieldVisibility = () => {
    const allFields = getAllFields();
    const newVisibility: Record<string, boolean> = {};
    allFields.forEach(field => {
      newVisibility[field] = true;
    });
    setFieldVisibility(newVisibility);
  };

  const handleShowDocDetail = (doc: MongoDocument) => {
    setSelectedDocForDetail(doc);
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

  // 渲染 MongoDB _id 为可读字符串
  const renderId = (id: MongoDocument['_id']): string => {
    if (typeof id === 'string') return id;
    if (typeof id === 'number') return String(id);
    if (id && typeof id === 'object' && '$oid' in id) {
      return String(id.$oid);
    }
    return String(id);
  };

  // 获取可见的字段（排除 _id，因为已经有专门的列显示）
  const visibleFields = getAllFields().filter(field => field !== '_id' && fieldVisibility[field] !== false);

  const formatValue = (value: string, format: string): string => {
    if (!value) return '';
    
    switch (format) {
      case 'json':
        try {
          const parsed = JSON.parse(value);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return value;
        }
      default:
        return value;
    }
  };

  const renderCellValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value);
        return <span className="text-xs font-mono truncate" title={jsonStr}>{jsonStr}</span>;
      } catch {
        return <span className="text-xs font-mono text-muted-foreground">[Object]</span>;
      }
    }
    return <span>{String(value)}</span>;
  };

  // 树形视图渲染
  const renderTree = (doc: MongoDocument, depth = 0) => {
    const indent = depth * 20;

    return (
      <div key={renderId(doc._id)} style={{ marginLeft: `${indent}px` }}>
        <div className="flex items-center py-1 hover:bg-muted/50 rounded px-1 cursor-pointer">
          <span className="font-mono text-xs mr-2 text-primary">_id: {renderId(doc._id).substring(0, 8)}</span>
        </div>
        {Object.entries(doc)
          .filter(([key]) => key !== '_id')
          .map(([key, value]) =>
            value !== null && typeof value === 'object' && !Array.isArray(value) ? (
              <div key={key} className="ml-4">
                <div className="flex items-center py-1 hover:bg-muted/50 rounded px-1">
                  <span className="text-primary font-medium text-xs mr-2">{key}:</span>
                  <span className="text-muted-foreground text-xs">{typeof value}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{JSON.stringify(value).substring(0, 50)}...</span>
                </div>
                {Object.entries(value).map(([subKey, subValue]) => (
                  <div key={subKey} className="ml-4 py-0.5">
                    <span className="text-xs text-muted-foreground">{subKey}: </span>
                    <span className="text-xs">{String(subValue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div key={key} className="flex items-center py-1 hover:bg-muted/50 rounded px-1">
                <span className="text-primary font-medium text-xs mr-2">{key}:</span>
                {renderCellValue(value)}
              </div>
            )
          )}
      </div>
    );
  };

  if (!connectionId) {
    console.log('[MongoDBBrowser] No connectionId provided, showing placeholder');
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        请先选择一个连接
      </div>
    );
  }

  const fields = getAllFields();

  return (
    <div className="flex h-full">
      {/* 数据库列表 */}
      <div className="w-40 border-r flex flex-col h-full sidebar-transition">
        <div className="p-2 border-b flex items-center justify-between shrink-0">
          <h3 className="text-xs font-semibold transition-smooth">数据库</h3>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={loadDatabases}
            disabled={loading}
            className="transition-smooth"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-1 space-y-0.5">
            {loading && databases.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : databases.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                暂无数据库
              </div>
            ) : (
              databases.map((database) => (
                <button
                  key={database}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
                    selectedDatabase === database
                      ? "bg-primary/20 text-primary font-medium"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleSelectDatabase(database)}
                  title={database}
                >
                  <Database className="h-3 w-3 shrink-0 transition-transform duration-200" />
                  <span className="truncate transition-opacity duration-200">{database}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 集合列表 */}
      {selectedDatabase && (
        <div className="w-40 border-r flex flex-col h-full main-content-transition">
          <div className="p-2 border-b flex items-center justify-between shrink-0">
            <h3 className="text-xs font-semibold transition-smooth">集合</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowRenameCollectionDialog(true)}
                disabled={!selectedCollection}
                className="transition-smooth"
                title="重命名集合"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowAddCollectionDialog(true)}
                className="transition-smooth"
                title="创建集合"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="p-1 space-y-0.5">
              {loading && collections.length === 0 ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                </div>
              ) : collections.length === 0 ? (
                <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                  暂无集合
                </div>
              ) : (
                collections.map((collection) => (
                  <ContextMenu key={collection}>
                    <ContextMenuTrigger asChild>
                      <button
                        className={cn(
                          "w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
                          selectedCollection === collection
                            ? "bg-primary/20 text-primary font-medium"
                            : "hover:bg-muted"
                        )}
                        onClick={() => handleSelectCollection(collection)}
                        title={collection}
                      >
                        <FileText className="h-3 w-3 shrink-0 transition-transform duration-200" />
                        <span className="truncate transition-opacity duration-200">{collection}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleSelectCollection(collection)}>
                        <Check className="h-3 w-3 mr-2" />
                        选择
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCopyCollectionName(collection)}>
                        <Copy className="h-3 w-3 mr-2" />
                        复制名称
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleGetCollectionStats(collection)}>
                        <BarChart3 className="h-3 w-3 mr-2" />
                        查看统计
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => {
                        setSelectedCollection(collection);
                        setShowRenameCollectionDialog(true);
                      }}>
                        <Edit className="h-3 w-3 mr-2" />
                        重命名
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => handleDeleteCollection(collection)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        删除
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      {selectedCollection ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* 工具栏 */}
          <div className="px-4 py-3 border-b space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <h3 className="text-lg font-semibold">{selectedCollection}</h3>
                <span className="text-xs text-muted-foreground">({documentCount} docs)</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 overflow-x-auto whitespace-nowrap min-w-max">
                <Button 
                  size="icon" 
                  variant={activeTab === 'data' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('data')} 
                  title="数据视图"
                >
                  <Database className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant={activeTab === 'monitor' ? 'default' : 'ghost'} 
                  onClick={() => setActiveTab('monitor')} 
                  title="性能监控"
                >
                  <Activity className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-1 shrink-0" />
                <Button size="icon" variant="ghost" onClick={() => setShowQueryDialog(true)} title="高级查询">
                  <Search className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleBatchDelete} disabled={selectedDocs.size === 0} title={`批量删除 (${selectedDocs.size})`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowFieldControlDialog(true)} title="字段显示">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleAddDocument} title="添加文档">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowExportDialog(true)} title="导出">
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleRefresh} title="刷新">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder='输入 JSON 过滤条件，如: {"age": 25}'
                  value={filterQuery}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFilterQuery(e.target.value)}
                  className="pl-9 font-mono text-sm"
                />
              </div>
              <Button size="sm" variant="ghost" onClick={handleApplyFilter} disabled={loading}>
                查询
              </Button>
            </div>
          </div>

          {/* 视图切换 - 只在数据视图中显示 */}
          {activeTab === 'data' && (
            <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="table" className="flex items-center gap-1">
                    <Table className="h-3.5 w-3.5" />
                    表格
                  </TabsTrigger>
                  <TabsTrigger value="tree" className="flex items-center gap-1">
                    <FolderTree className="h-3.5 w-3.5" />
                    树形
                  </TabsTrigger>
                  <TabsTrigger value="json" className="flex items-center gap-1">
                    <Code className="h-3.5 w-3.5" />
                    JSON
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* 内容区域 - 根据视图模式显示不同内容 */}
          <div className="flex-1 flex flex-col min-h-0">
            {activeTab === 'monitor' ? (
              <DatabaseMonitorPanel connectionId={connectionId || ''} databaseType="mongodb" />
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewMode === 'table' ? (
              <>
                {/* 表格滚动区域 */}
                <div className="flex-1 overflow-auto p-4">
                  <div className="min-w-max">
                    <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: `${48 + 128 + visibleFields.length * 180 + 80}px` }}>
                      <colgroup>
                        <col style={{ width: '48px' }} />
                        <col style={{ width: '128px' }} />
                        {visibleFields.map(() => (
                          <col key={Math.random()} style={{ width: '180px' }} />
                        ))}
                        <col style={{ width: '80px' }} />
                      </colgroup>
                      <thead className="sticky top-0 bg-background z-20 shadow-sm">
                        <tr>
                          <th className="px-2 py-2 border-b border-r font-semibold text-left bg-background sticky left-0 z-10">
                            <Checkbox
                              checked={selectAll}
                              onCheckedChange={handleSelectAll}
                              id="table-select-all"
                            />
                          </th>
                          <th className="px-4 py-2 border-b border-r font-semibold text-left whitespace-nowrap bg-background">_id</th>
                          {visibleFields.map(field => (
                            <th key={field} className="px-4 py-2 border-b border-r font-semibold text-left whitespace-nowrap bg-background">{field}</th>
                          ))}
                          <th className="px-2 py-2 border-b font-semibold text-center whitespace-nowrap bg-background sticky right-0 z-10">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc, idx) => {
                          const isExpanded = expandedDocs.has(idx);
                          return (
                            <React.Fragment key={idx}>
                              <tr className="border-b hover:bg-muted/50 transition-colors duration-150">
                                <td className="px-2 py-2 border-b border-r sticky left-0 bg-background z-10">
                                  <div className="flex items-center gap-1">
                                    <Checkbox
                                      checked={selectedDocs.has(renderId(doc._id))}
                                                                        onCheckedChange={() => handleToggleSelectDoc(renderId(doc._id))}                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleToggleExpand(idx)}
                                    >
                                      {isExpanded ? <ChevronDown className="h-3 w-3 transition-transform duration-200" /> : <ChevronRight className="h-3 w-3 transition-transform duration-200" />}
                                    </Button>
                                  </div>
                                </td>
                                <td className="px-4 py-2 border-b border-r transition-colors duration-150" title={renderId(doc._id)}>
                                  <span className="font-mono text-xs">
                                    {renderId(doc._id).substring(0, 12)}...
                                  </span>
                                </td>
                                {visibleFields.map(field => (
                                  <td
                                    key={field}
                                    className="px-4 py-2 border-b border-r overflow-hidden group relative transition-colors duration-150"
                                  >
                                    <div className="truncate transition-opacity duration-150" title={typeof doc[field] === 'object' ? JSON.stringify(doc[field]) : String(doc[field] || '')}>
                                      {renderCellValue(doc[field])}
                                    </div>
                                    <button
                                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted cursor-pointer transition-all duration-200"
                                      onClick={() => {
                                        const value = typeof doc[field] === 'object' ? JSON.stringify(doc[field]) : String(doc[field] || '');
                                        setViewCellData({ value, columnName: field });
                                      }}
                                    >
                                      <ZoomIn className="h-3 w-3 transition-transform duration-200" />
                                    </button>
                                  </td>
                                ))}
                                <td className="px-2 py-2 border-b text-center sticky right-0 bg-background z-10">
                                  <div className="flex gap-1 justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleEditDocument(doc)}
                                      title="编辑"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() => handleDeleteDocument(doc)}
                                      title="删除"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-muted/30">
                                  <td className="border-b border-r bg-muted/30 sticky left-0 z-10"></td>
                                  <td colSpan={visibleFields.length + 1} className="border-b">
                                    <div className="p-4 max-w-full">
                                      <pre className="text-xs font-mono bg-background p-3 rounded border overflow-auto max-w-full whitespace-pre-wrap break-all">
                                        {JSON.stringify(doc, null, 2)}
                                      </pre>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 分页和状态栏 */}
                <div className="shrink-0 border-t bg-muted/30">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="text-xs text-muted-foreground shrink-0">
                      第 {currentPage} / {totalPages} 页
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        上一页
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  </div>
                  <div className="px-4 py-1 flex items-center justify-between text-xs text-muted-foreground border-t">
                    <div className="flex items-center gap-4 shrink-0 overflow-hidden">
                      <span className="truncate">数据库名: {selectedDatabase || '-'}</span>
                      <span className="truncate">集合: {selectedCollection || '-'}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 overflow-hidden">
                      <span className="truncate">文档数: {documentCount}</span>
                      <span className="truncate">视图: {viewMode === 'table' ? '表格' : viewMode === 'tree' ? '树形' : 'JSON'}</span>
                      <span className="truncate">选中: {selectedDocs.size}</span>
                    </div>
                  </div>
                </div>

                
              </>
            ) : viewMode === 'tree' ? (
              <div className="flex-1 overflow-auto p-4">
                {documents.map((doc) => renderTree(doc))}
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4">
                <pre className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(documents, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center h-full text-sm text-muted-foreground">
          选择一个集合查看文档
        </div>
      )}

      {/* 创建集合对话框 */}
      {showAddCollectionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">创建新集合</h3>
            <Input
              placeholder="输入集合名称"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddCollectionDialog(false);
                setNewCollectionName('');
              }}>
                取消
              </Button>
              <Button onClick={handleAddCollection}>创建</Button>
            </div>
          </div>
        </div>
      )}

      {/* 重命名集合对话框 */}
      {showRenameCollectionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">重命名集合</h3>
            <Input
              placeholder="输入新集合名称"
              value={newCollectionNameForRename}
              onChange={(e) => setNewCollectionNameForRename(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowRenameCollectionDialog(false);
                setNewCollectionNameForRename('');
              }}>
                取消
              </Button>
              <Button onClick={handleRenameCollection}>重命名</Button>
            </div>
          </div>
        </div>
      )}

      {/* 集合统计对话框 */}
      {showCollectionStatsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">集合统计信息</h3>
            <div className="overflow-auto max-h-[60vh] font-mono text-xs">
              <pre className="whitespace-pre-wrap">{collectionStats}</pre>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => {
                setShowCollectionStatsDialog(false);
                setCollectionStats('');
              }}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 查看单元格数据对话框 */}
      {viewCellData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[600px] max-w-[90vw] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{viewCellData.columnName}</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewCellData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4 flex-1 overflow-auto">
              <Tabs value={viewFormat} onValueChange={(v) => setViewFormat(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="text-sm font-mono whitespace-pre-wrap break-all overflow-auto max-h-[500px]">
                  {viewFormat === 'json' ? formatValue(viewCellData.value, 'json') : viewCellData.value}
                </pre>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(viewCellData.value);
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                复制
              </Button>
              <Button onClick={() => setViewCellData(null)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑文档对话框 */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingDocument ? '编辑文档' : '添加新文档'}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowEditDialog(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <div className="space-y-2">
                <Label className="text-sm">{editingDocument ? '文档内容 (JSON 格式)' : '文档内容 (JSON 格式)'}</Label>
                <textarea
                  value={editDocumentData}
                  onChange={(e) => setEditDocumentData(e.target.value)}
                  className="w-full h-[500px] p-3 text-sm border rounded-md resize-none font-mono bg-background"
                  placeholder='输入 JSON 格式的文档，如: {"name": "张三", "age": 25}'
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
              <Button onClick={handleSaveDocument}>{editingDocument ? '更新' : '添加'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* 导出对话框 */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">导出数据</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">导出格式</Label>
                <div className="flex gap-2">
                  <Button
                    variant={exportFormat === 'json' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportFormat('json')}
                  >
                    JSON
                  </Button>
                  <Button
                    variant={exportFormat === 'csv' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setExportFormat('csv')}
                  >
                    CSV
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>导出内容: {documents.length} 个文档</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => {
                setShowExportDialog(false);
                setExportFormat('json');
              }}>
                取消
              </Button>
              <Button onClick={handleExport} disabled={documents.length === 0}>
                导出当前文档
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 高级查询对话框 */}
      {showQueryDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[600px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">高级查询</h3>
            <div className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Filter（JSON）</Label>
                <textarea
                  placeholder='过滤条件，如: {"age": 25, "status": "active"}'
                  value={queryFilter}
                  onChange={(e) => setQueryFilter(e.target.value)}
                  className="w-full h-32 p-3 font-mono text-sm border rounded-md resize-none"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Projection（选择字段，可选）</Label>
                <textarea
                  placeholder='投影字段，如: {"name": 1, "age": 1} 或 {"name": 0} 表示排除'
                  value={queryProjection}
                  onChange={(e) => setQueryProjection(e.target.value)}
                  className="w-full h-24 p-3 font-mono text-sm border rounded-md resize-none"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Sort（排序，可选）</Label>
                <textarea
                  placeholder='排序条件，如: {"age": -1} 或 {"name": 1}'
                  value={querySort}
                  onChange={(e) => setQuerySort(e.target.value)}
                  className="w-full h-20 p-3 font-mono text-sm border rounded-md resize-none"
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Limit（限制数量）</Label>
                <Input
                  type="number"
                  value={queryLimit}
                  onChange={(e) => setQueryLimit(parseInt(e.target.value) || 100)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => {
                setShowQueryDialog(false);
                setQueryFilter('{}');
                setQueryProjection('{}');
                setQuerySort('{}');
                setQueryLimit(100);
              }}>
                重置
              </Button>
              <Button onClick={handleApplyAdvancedQuery} disabled={loading}>
                执行查询
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 字段控制对话框 */}
      {showFieldControlDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[400px] max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">字段显示控制</h3>
            <div className="space-y-4 max-h-[60vh] overflow-auto">
              <div className="space-y-2">
                <Label className="text-sm">显示的字段</Label>
                <div className="space-y-2 max-h-[40vh] overflow-auto border rounded p-2">
                  {getAllFields().map(field => (
                    <div key={field} className="flex items-center">
                      <Checkbox
                        checked={fieldVisibility[field] !== false}
                        onCheckedChange={() => handleToggleField(field)}
                        id={`field-${field}`}
                      />
                      <label
                        htmlFor={`field-${field}`}
                        className="ml-2 text-sm flex-1 cursor-pointer"
                      >
                        {field}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowFieldControlDialog(false)}>
                关闭
              </Button>
              <Button variant="outline" onClick={handleResetFieldVisibility}>
                重置
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 文档详情面板 */}
      {selectedDocForDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[600px] max-w-[90vw] h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">文档详情</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDocForDetail(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto font-mono text-xs bg-muted/30 rounded p-3">
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedDocForDetail, null, 2)}</pre>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setSelectedDocForDetail(null)}>
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
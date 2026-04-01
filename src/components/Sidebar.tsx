import { useState } from 'react';
import { Database, Plus, Trash2, Plug, PowerOff, Loader2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConnectionStore } from '../stores/connectionStore';
import type { Connection } from '../types/database';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ConnectionForm } from './ConnectionForm';
import { cn } from '../lib/utils';

type ConnectionType = 'mysql' | 'redis' | 'mongodb';

const typeLabels: Record<ConnectionType, string> = {
  mysql: 'MySQL',
  redis: 'Redis',
  mongodb: 'MongoDB',
};

const typeIcons: Record<ConnectionType, any> = {
  mysql: Database,
  redis: Database,
  mongodb: Database,
};

interface ConnectionItemProps {
  connection: Connection;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  collapsed: boolean;
}

function ConnectionItem({ connection, isActive, onSelect, onDelete, onEdit, collapsed }: ConnectionItemProps) {
  const { connectingIds, connectConnection, disconnectConnection } = useConnectionStore();
  
  const isConnected = connection.status === 'connected';
  const isConnecting = connection.status === 'connecting' || connectingIds.has(connection.id);
  const isError = connection.status === 'error';
  const isDisconnected = connection.status === 'disconnected';

  const handleConnectClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await connectConnection(connection.id);
    } catch (error) {
      alert(`连接失败: ${error}`);
    }
  };

  const handleDisconnectClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await disconnectConnection(connection.id);
    } catch (error) {
      alert(`断开连接失败: ${error}`);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(connection.id);
  };

  const TypeIcon = typeIcons[connection.type];

  if (collapsed) {
    return (
      <div
        className={cn(
          "group flex items-center justify-center p-2 rounded-md cursor-pointer transition-colors relative",
          isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
        )}
        onClick={() => onSelect(connection.id)}
        title={connection.name}
      >
        <div className="relative">
          <TypeIcon className="h-4 w-4" />
          <div className={cn(
            "absolute -top-1 -right-1 h-2 w-2 rounded-full",
            isConnected ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.8)] animate-pulse" : 
            isConnecting ? "bg-yellow-500" : 
            isError ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" :
            "bg-gray-400"
          )} />
        </div>
        <div className={cn(
          "absolute left-full ml-1 px-2 py-1 bg-popover border rounded-md shadow-lg text-xs whitespace-nowrap z-50",
          "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
        )}>
          <div className="font-medium">{connection.name}</div>
          <div className={cn(
            "text-[10px]",
            isError ? "text-red-500" : "text-muted-foreground"
          )}>
            {isConnecting ? '连接中...' : isConnected ? '已连接' : isError ? '连接失败' : '未连接'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors",
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
      )}
      onClick={() => onSelect(connection.id)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <TypeIcon className="h-4 w-4 shrink-0" />
        <div className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          isConnected ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse" : 
          isConnecting ? "bg-yellow-500" : 
          isError ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" :
          "bg-gray-400"
        )} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{connection.name}</span>
          <span className={cn(
            "text-xs",
            isError ? "text-red-500" : "text-muted-foreground"
          )}>
            {isConnecting ? '连接中...' : isConnected ? '已连接' : isError ? '连接失败' : '未连接'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {isConnecting ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-100"
            disabled
          >
            <Loader2 className="h-3 w-3 animate-spin" />
          </Button>
        ) : isConnected || isError ? (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDisconnectClick}
            title={isError ? "重试连接" : "断开连接"}
          >
            {isError ? (
              <Plug className="h-3 w-3" />
            ) : (
              <PowerOff className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleConnectClick}
            title="连接"
          >
            <Plug className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleEditClick}
          title="编辑"
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(connection.id);
          }}
          title="删除"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { connections, activeConnectionId, setActiveConnection, removeConnection } =
    useConnectionStore();
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleSelectConnection = (id: string) => {
    setActiveConnection(id);
  };

  const handleDeleteConnection = (id: string) => {
    removeConnection(id);
  };

  const handleEditConnection = (id: string) => {
    setEditingConnectionId(id);
    setShowConnectionForm(true);
  };

  const handleCloseForm = () => {
    setShowConnectionForm(false);
    setEditingConnectionId(null);
  };

  const groupedConnections = {
    mysql: connections.filter((c) => c.type === 'mysql'),
    redis: connections.filter((c) => c.type === 'redis'),
    mongodb: connections.filter((c) => c.type === 'mongodb'),
  };

  return (
    <aside 
      className={cn(
        "h-screen border-r bg-background flex flex-col transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[260px]"
      )}
    >
      <div className="p-4 border-b flex items-center justify-between">
        <div className={cn(
          "flex items-center transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          <h2 className="text-lg font-semibold whitespace-nowrap">连接</h2>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "展开" : "折叠"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {connections.length === 0 ? (
          !collapsed && (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">暂无连接</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setEditingConnectionId(null);
                  setShowConnectionForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加连接
              </Button>
            </div>
          )
        ) : (
          <>
            {!collapsed && (
              <>
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    MySQL ({groupedConnections.mysql.length})
                  </h3>
                  <div className="space-y-1">
                    {groupedConnections.mysql.map((connection) => (
                      <ConnectionItem
                        key={connection.id}
                        connection={connection}
                        isActive={activeConnectionId === connection.id}
                        onSelect={handleSelectConnection}
                        onDelete={handleDeleteConnection}
                        onEdit={handleEditConnection}
                        collapsed={collapsed}
                      />
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    Redis ({groupedConnections.redis.length})
                  </h3>
                  <div className="space-y-1">
                    {groupedConnections.redis.map((connection) => (
                      <ConnectionItem
                        key={connection.id}
                        connection={connection}
                        isActive={activeConnectionId === connection.id}
                        onSelect={handleSelectConnection}
                        onDelete={handleDeleteConnection}
                        onEdit={handleEditConnection}
                        collapsed={collapsed}
                      />
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    MongoDB ({groupedConnections.mongodb.length})
                  </h3>
                  <div className="space-y-1">
                    {groupedConnections.mongodb.map((connection) => (
                      <ConnectionItem
                        key={connection.id}
                        connection={connection}
                        isActive={activeConnectionId === connection.id}
                        onSelect={handleSelectConnection}
                        onDelete={handleDeleteConnection}
                        onEdit={handleEditConnection}
                        collapsed={collapsed}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
            {collapsed && (
              <div className="space-y-1">
                {connections.map((connection) => (
                  <ConnectionItem
                    key={connection.id}
                    connection={connection}
                    isActive={activeConnectionId === connection.id}
                    onSelect={handleSelectConnection}
                    onDelete={handleDeleteConnection}
                    onEdit={handleEditConnection}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </ScrollArea>

      {!collapsed && (
        <div className="p-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setEditingConnectionId(null);
              setShowConnectionForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            添加连接
          </Button>
        </div>
      )}

      <ConnectionForm
        open={showConnectionForm}
        onOpenChange={handleCloseForm}
        editingConnectionId={editingConnectionId}
      />
    </aside>
  );
}
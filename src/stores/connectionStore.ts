import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import type { Connection, ConnectionStatus, ConnectionConfig } from '../types/database';

type ActiveTab = 'sql' | 'redis' | 'mongodb';

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  activeTab: ActiveTab;
  activeDatabase: string | null;
  activeTable: string | null;
  connectingIds: Set<string>;
  showSchemaDialog: boolean;
  showTableDesignDialog: boolean;
  addConnection: (connection: Omit<Connection, 'id' | 'createdAt'>) => string;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  setConnectionStatus: (id: string, status: ConnectionStatus) => void;
  setActiveConnection: (id: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setActiveDatabase: (database: string | null) => void;
  setActiveTable: (table: string | null) => void;
  setShowSchemaDialog: (show: boolean) => void;
  setShowTableDesignDialog: (show: boolean) => void;
  connectConnection: (id: string) => Promise<void>;
  disconnectConnection: (id: string) => Promise<void>;
  testConnection: (type: Connection['type'], config: ConnectionConfig) => Promise<boolean>;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      activeTab: 'sql',
      activeDatabase: null,
      activeTable: null,
      connectingIds: new Set(),
      showSchemaDialog: false,
      showTableDesignDialog: false,

      addConnection: (connection) => {
        const id = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const newConnection: Connection = {
          ...connection,
          id,
          createdAt: Date.now(),
        };
        set((state) => ({
          connections: [...state.connections, newConnection],
        }));
        return id;
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        }));
      },

      setConnectionStatus: (id, status) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, status } : conn
          ),
        }));
      },

      setActiveConnection: (id) => {
        set({ activeConnectionId: id, activeDatabase: null, activeTable: null });
      },

      setActiveTab: (tab) => {
        set({ activeTab: tab });
      },

      setActiveDatabase: (database) => {
        set({ activeDatabase: database, activeTable: null });
        // 在 DatabaseSidebar 中清空 selectedTable
      },

      setActiveTable: (table) => {
        set({ activeTable: table });
      },

      setShowSchemaDialog: (show) => {
        set({ showSchemaDialog: show });
      },

      setShowTableDesignDialog: (show) => {
        set({ showTableDesignDialog: show });
      },

      connectConnection: async (id) => {
        const { connections, setConnectionStatus } = get();
        const connection = connections.find((c) => c.id === id);

        if (!connection) return;

        set((state) => ({
          connectingIds: new Set(state.connectingIds).add(id),
        }));

        try {
          setConnectionStatus(id, 'connecting');

          let result: boolean;
          switch (connection.type) {
            case 'mysql':
              const mysqlConfig = connection.config.mysql!;
              result = await invoke('connect_mysql', {
                connId: id,
                host: mysqlConfig.host,
                port: mysqlConfig.port,
                user: mysqlConfig.username,
                password: mysqlConfig.password,
                database: mysqlConfig.database,
              });
              break;
            case 'redis':
              const redisConfig = connection.config.redis!;
              result = await invoke('connect_redis', {
                connId: id,
                host: redisConfig.host,
                port: redisConfig.port,
                username: redisConfig.username,
                password: redisConfig.password,
                db: redisConfig.database,
              });
              break;
            case 'mongodb':
              const mongoConfig = connection.config.mongodb!;
              result = await invoke('connect_mongodb', {
                connId: id,
                host: mongoConfig.host,
                port: mongoConfig.port,
                username: mongoConfig.username,
                password: mongoConfig.password,
                database: mongoConfig.database,
              });
              break;
          }

          if (result) {
            setConnectionStatus(id, 'connected');
            // 连接成功后清空上次选择的数据库和表
            set({ activeDatabase: null, activeTable: null });
          } else {
            setConnectionStatus(id, 'disconnected');
            throw new Error('连接失败');
          }
        } catch (error) {
          setConnectionStatus(id, 'disconnected');
          throw error;
        } finally {
          set((state) => {
            const newConnectingIds = new Set(state.connectingIds);
            newConnectingIds.delete(id);
            return { connectingIds: newConnectingIds };
          });
        }
      },

      disconnectConnection: async (id) => {
        const { connections, setConnectionStatus } = get();
        const connection = connections.find((c) => c.id === id);

        if (!connection) return;

        try {
          let result: boolean;
          switch (connection.type) {
            case 'mysql':
              result = await invoke('disconnect_mysql', { connId: id });
              break;
            case 'redis':
              result = await invoke('disconnect_redis', { connId: id });
              break;
            case 'mongodb':
              result = await invoke('disconnect_mongodb', { connId: id });
              break;
          }

          if (result) {
            setConnectionStatus(id, 'disconnected');
          }
        } catch (error) {
          throw error;
        }
      },

      testConnection: async (type, config) => {
        try {
          let result: boolean;
          switch (type) {
            case 'mysql':
              const mysqlConfig = config.mysql!;
              result = await invoke('test_mysql_connection', {
                host: mysqlConfig.host,
                port: mysqlConfig.port,
                user: mysqlConfig.username,
                password: mysqlConfig.password,
                database: mysqlConfig.database,
              });
              break;
            case 'redis':
              const redisConfig = config.redis!;
              result = await invoke('test_redis_connection', {
                host: redisConfig.host,
                port: redisConfig.port,
                username: redisConfig.username,
                password: redisConfig.password,
                db: redisConfig.database,
              });
              break;
            case 'mongodb':
              const mongoConfig = config.mongodb!;
              result = await invoke('test_mongodb_connection', {
                host: mongoConfig.host,
                port: mongoConfig.port,
                username: mongoConfig.username,
                password: mongoConfig.password,
                database: mongoConfig.database,
              });
              break;
          }
          return result;
        } catch (error) {
          // 抛出错误，让前端捕获并显示详细错误信息
          throw error;
        }
      },
    }),
    {
      name: 'db-connections',
      partialize: (state) => ({
        connections: state.connections,
        activeConnectionId: state.activeConnectionId,
        activeTab: state.activeTab,
        activeDatabase: state.activeDatabase,
        activeTable: state.activeTable,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // 应用启动时，将所有连接状态重置为 "disconnected"
          state.connections = state.connections.map((conn) => ({
            ...conn,
            status: 'disconnected' as ConnectionStatus,
          }));
          // 清空上次选择的数据库和表
          state.activeDatabase = null;
          state.activeTable = null;
        }
      },
    }
  )
);
// 数据库类型定义

export type DatabaseType = 'mysql' | 'redis' | 'mongodb';

export interface MySQLAdvancedOptions {
  hideSystemDatabases: boolean;
  allowedDatabases?: string;
  defaultQueryLimit: number;
  defaultSortField?: string;
}

export interface ConnectionConfig {
  mysql?: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    advancedOptions?: MySQLAdvancedOptions;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    database?: number;
  };
  mongodb?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    database: string;
  };
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface Connection {
  id: string;
  name: string;
  type: DatabaseType;
  config: ConnectionConfig;
  status: ConnectionStatus;
  createdAt: number;
  lastUsed?: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  affectedRows: number;
  executionTime: number;
}

export interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number;
  size: number;
}

export interface MongoDocument {
  _id: string | number | { $oid: string };
  [key: string]: unknown;
}
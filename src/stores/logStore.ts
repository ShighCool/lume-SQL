import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SQLLog {
  id: string;
  timestamp: number;
  sql: string;
  status: 'success' | 'error';
  result: string;
  affectedRows?: number;
  duration: number;
  connectionId?: string;
  database?: string;
}

interface LogStore {
  logs: SQLLog[];
  maxLogs: number;
  addLog: (log: Omit<SQLLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  exportLogs: () => string;
  getLogsByConnection: (connectionId: string) => SQLLog[];
  getLogsByDatabase: (database: string) => SQLLog[];
}

export const useLogStore = create<LogStore>()(
  persist(
    (set, get) => ({
      logs: [],
      maxLogs: 1000,
      
      addLog: (log) => {
        const newLog: SQLLog = {
          ...log,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
        };
        set((state) => ({
          logs: [newLog, ...state.logs].slice(0, state.maxLogs),
        }));
      },
      
      clearLogs: () => set({ logs: [] }),
      
      exportLogs: () => {
        const { logs } = get();
        return logs.map(log => {
          const time = new Date(log.timestamp).toLocaleString();
          const result = log.status === 'success' 
            ? `Result: ${log.affectedRows || 0} rows affected in ${log.duration}ms`
            : `Execute fail: ${log.result}`;
          return `${time} Executing: ${log.sql}\n${time} ${result}`;
        }).join('\n\n');
      },

      getLogsByConnection: (connectionId) => {
        return get().logs.filter(log => log.connectionId === connectionId);
      },

      getLogsByDatabase: (database) => {
        return get().logs.filter(log => log.database === database);
      },
    }),
    {
      name: 'sql-logs',
    }
  )
);
import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export function SQLEditor() {
  const { theme } = useThemeStore();
  const [sql, setSql] = useState('-- 输入 SQL 查询\nSELECT * FROM users LIMIT 10;');
  const [results, setResults] = useState<Record<string, unknown>[]>([]);

  const handleExecute = () => {
    console.log('Executing SQL:', sql);
    // 暂时使用模拟数据
    setResults([
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ]);
  };

  const columns = results.length > 0 ? Object.keys(results[0]) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="h-[50%] flex flex-col border-b">
        <div className="flex items-center justify-between p-2 border-b bg-muted/50">
          <span className="text-sm font-medium">SQL 编辑器</span>
          <Button size="sm" onClick={handleExecute}>
            <Play className="h-4 w-4 mr-2" />
            执行
          </Button>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={sql}
            onChange={(value) => setSql(value || '')}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8, bottom: 8 },
            }}
          />
        </div>
      </div>

      <div className="h-[50%] flex flex-col">
        <div className="flex items-center justify-between p-2 border-b bg-muted/50">
          <span className="text-sm font-medium">
            查询结果 {results.length > 0 && `(${results.length} 行)`}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              执行查询后显示结果
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map((column) => (
                      <TableCell key={`${index}-${column}`}>
                        {String(row[column] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
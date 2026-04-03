import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Play, Square, Copy, CheckCircle2, XCircle, FileText } from 'lucide-react';

interface ApiManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ApiManagerDialog({
  open,
  onOpenChange,
}: ApiManagerDialogProps) {
  const [apiStatus, setApiStatus] = useState(false);
  const [apiPort, setApiPort] = useState<number | null>(null);
  const [portInput, setPortInput] = useState('8080');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      checkApiStatus();
    }
  }, [open]);

  const checkApiStatus = async () => {
    try {
      const [status, port] = await Promise.all([
        invoke<boolean>('get_api_status'),
        invoke<number>('get_api_port'),
      ]);
      setApiStatus(status);
      setApiPort(port);
    } catch (error) {
      // Error handling without console logging
    }
  };

  const startServer = async () => {
    setLoading(true);
    try {
      const port = parseInt(portInput);
      if (isNaN(port) || port < 1 || port > 65535) {
        alert('请输入有效的端口号 (1-65535)');
        return;
      }

      const result = await invoke<string>('start_api_server', { port });
      alert(result);
      checkApiStatus();
    } catch (error) {
      alert('启动失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const stopServer = async () => {
    setLoading(true);
    try {
      const result = await invoke<string>('stop_api_server');
      alert(result);
      checkApiStatus();
    } catch (error) {
      alert('停止失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlExamples = [
    {
      name: '健康检查',
      method: 'GET',
      url: `http://127.0.0.1:${apiPort || 8080}/api/health`,
      description: '检查 API 服务器是否正常运行',
    },
    {
      name: '获取连接列表',
      method: 'GET',
      url: `http://127.0.0.1:${apiPort || 8080}/api/connections`,
      description: '获取所有可用的数据库连接 ID',
    },
    {
      name: '执行查询',
      method: 'POST',
      url: `http://127.0.0.1:${apiPort || 8080}/api/query`,
      body: JSON.stringify(
        {
          conn_id: 'your_connection_id',
          sql: 'SELECT * FROM users LIMIT 10',
        },
        null,
        2
      ),
      description: '执行 SQL 查询并返回结果',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>API 接口管理</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="status">服务器状态</TabsTrigger>
            <TabsTrigger value="docs">API 文档</TabsTrigger>
            <TabsTrigger value="examples">使用示例</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-6">
            {/* 状态显示 */}
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              {apiStatus ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <div className="font-semibold">
                  API 服务器状态: {apiStatus ? '运行中' : '已停止'}
                </div>
                {apiStatus && apiPort && (
                  <div className="text-sm text-gray-500">
                    监听端口: {apiPort}
                  </div>
                )}
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>端口号</Label>
                  <Input
                    type="number"
                    value={portInput}
                    onChange={(e) => setPortInput(e.target.value)}
                    min="1"
                    max="65535"
                    placeholder="8080"
                  />
                </div>
                <Button
                  onClick={startServer}
                  disabled={apiStatus || loading}
                  className="min-w-[120px]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  启动服务器
                </Button>
                <Button
                  onClick={stopServer}
                  disabled={!apiStatus || loading}
                  variant="destructive"
                  className="min-w-[120px]"
                >
                  <Square className="h-4 w-4 mr-2" />
                  停止服务器
                </Button>
              </div>
            </div>

            {/* 说明 */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">使用说明</h3>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>• API 服务器允许外部程序通过 HTTP 请求访问数据库</li>
                <li>• 服务器仅监听本地地址 (127.0.0.1)，仅本机可访问</li>
                <li>• 启动服务器后，可以使用 REST API 执行 SQL 查询</li>
                <li>• 所有请求都需要提供有效的连接 ID</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-6">
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  API 端点
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                      <code className="text-sm">/api/health</code>
                    </div>
                    <p className="text-sm text-gray-600 ml-16">健康检查端点，返回服务器状态和时间戳</p>
                    <div className="mt-2 ml-16 p-2 bg-gray-50 rounded text-xs">
                      响应: {`{ "status": "ok", "timestamp": "2024-01-01T00:00:00Z" }`}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-mono rounded">GET</span>
                      <code className="text-sm">/api/connections</code>
                    </div>
                    <p className="text-sm text-gray-600 ml-16">获取所有可用的数据库连接 ID 列表</p>
                    <div className="mt-2 ml-16 p-2 bg-gray-50 rounded text-xs">
                      响应: {`["conn1", "conn2", "conn3"]`}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-mono rounded">POST</span>
                      <code className="text-sm">/api/query</code>
                    </div>
                    <p className="text-sm text-gray-600 ml-16">执行 SQL 查询并返回结果</p>
                    <div className="mt-2 ml-16 p-2 bg-gray-50 rounded text-xs">
                      请求: {`{ "conn_id": "connection_id", "sql": "SELECT * FROM users" }`}
                    </div>
                    <div className="mt-2 ml-16 p-2 bg-gray-50 rounded text-xs">
                      响应: {`{ "success": true, "data": [[...], [...]], "error": null }`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">错误处理</h3>
                <p className="text-sm text-gray-600">
                  当请求失败时，API 会返回错误信息：
                </p>
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                  {`{ "success": false, "data": null, "error": "错误描述" }`}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            {curlExamples.map((example, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{example.name}</h3>
                  <span className={`px-2 py-1 text-xs font-mono rounded ${
                    example.method === 'GET' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {example.method}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{example.description}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <code className="text-xs">{example.url}</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(example.url)}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {example.body && (
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <pre className="text-xs">{example.body}</pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(example.body || '')}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold mb-2 text-yellow-800">注意事项</h3>
              <ul className="text-sm space-y-1 text-yellow-700">
                <li>• 使用前请确保 API 服务器已启动</li>
                <li>• 请将 <code className="bg-yellow-100 px-1 rounded">your_connection_id</code> 替换为实际的连接 ID</li>
                <li>• 生产环境中请配置适当的身份验证和访问控制</li>
                <li>• 查询结果可能会很大，建议使用 LIMIT 限制返回行数</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import type { DatabaseType, ConnectionConfig, MySQLAdvancedOptions, RedisAdvancedOptions } from '../types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';

interface ConnectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConnectionId?: string | null;
}

interface MySQLFormData {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

interface RedisFormData {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

interface MongoFormData {
  name: string;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

export function ConnectionForm({ open, onOpenChange, editingConnectionId }: ConnectionFormProps) {
  const { addConnection, testConnection, updateConnection, connections, disconnectConnection } = useConnectionStore();
  const [activeTab, setActiveTab] = useState<DatabaseType>('mysql');
  const [testing, setTesting] = useState(false);

  const [mysqlForm, setMysqlForm] = useState<MySQLFormData>({
    name: '',
    host: 'localhost',
    port: '3306',
    username: '',
    password: '',
    database: '',
  });

  const [redisForm, setRedisForm] = useState<RedisFormData>({
    name: '',
    host: 'localhost',
    port: '6379',
    username: '',
    password: '',
    database: '0',
  });

  const [mongoForm, setMongoForm] = useState<MongoFormData>({
    name: '',
    host: 'localhost',
    port: '27017',
    username: '',
    password: '',
    database: '',
  });

  const [mysqlAdvancedOptions, setMysqlAdvancedOptions] = useState<MySQLAdvancedOptions>({
    hideSystemDatabases: true,
    allowedDatabases: '',
    defaultQueryLimit: 100,
    defaultSortField: '',
  });

  const [redisAdvancedOptions, setRedisAdvancedOptions] = useState<RedisAdvancedOptions>({
    databaseCount: 16,
    keyPageSize: 100,
  });

  // 初始化编辑模式
  useEffect(() => {
    if (editingConnectionId && open) {
      const connection = connections.find((c) => c.id === editingConnectionId);
      if (connection) {
        setActiveTab(connection.type);
        switch (connection.type) {
          case 'mysql':
            const mysqlConfig = connection.config.mysql!;
            setMysqlForm({
              name: connection.name,
              host: mysqlConfig.host,
              port: mysqlConfig.port.toString(),
              username: mysqlConfig.username,
              password: mysqlConfig.password,
              database: mysqlConfig.database,
            });
            setMysqlAdvancedOptions(mysqlConfig.advancedOptions || {
              hideSystemDatabases: true,
              allowedDatabases: '',
              defaultQueryLimit: 100,
              defaultSortField: '',
            });
            break;
          case 'redis':
            const redisConfig = connection.config.redis!;
            setRedisForm({
              name: connection.name,
              host: redisConfig.host,
              port: redisConfig.port.toString(),
              username: redisConfig.username || '',
              password: redisConfig.password || '',
              database: redisConfig.database?.toString() || '0',
            });
            setRedisAdvancedOptions(redisConfig.advancedOptions || {
              databaseCount: 16,
              keyPageSize: 100,
            });
            break;
          case 'mongodb':
            const mongoConfig = connection.config.mongodb!;
            setMongoForm({
              name: connection.name,
              host: mongoConfig.host,
              port: mongoConfig.port.toString(),
              username: mongoConfig.username || '',
              password: mongoConfig.password || '',
              database: mongoConfig.database,
            });
            break;
        }
      }
    }
  }, [editingConnectionId, open, connections]);

  // 重置所有表单
  const resetForms = () => {
    setMysqlForm({
      name: '',
      host: 'localhost',
      port: '3306',
      username: '',
      password: '',
      database: '',
    });
    setRedisForm({
      name: '',
      host: 'localhost',
      port: '6379',
      username: '',
      password: '',
      database: '0',
    });
    setMongoForm({
      name: '',
      host: 'localhost',
      port: '27017',
      username: '',
      password: '',
      database: '',
    });
    setMysqlAdvancedOptions({
      hideSystemDatabases: true,
      allowedDatabases: '',
      defaultQueryLimit: 100,
      defaultSortField: '',
    });
    setActiveTab('mysql');
  };

  // 弹窗打开时，新建模式重置表单，编辑模式在初始化时填充
  useEffect(() => {
    if (open && !editingConnectionId) {
      resetForms();
    }
  }, [open, editingConnectionId]);

  const handleSave = async () => {
    let config: ConnectionConfig;
    let name: string;
    let type: DatabaseType;

    switch (activeTab) {
      case 'mysql':
        name = mysqlForm.name;
        type = 'mysql';
        config = {
          mysql: {
            host: mysqlForm.host,
            port: parseInt(mysqlForm.port),
            username: mysqlForm.username,
            password: mysqlForm.password,
            database: mysqlForm.database,
            advancedOptions: mysqlAdvancedOptions,
          },
        };
        break;
      case 'redis':
        name = redisForm.name;
        type = 'redis';
        config = {
          redis: {
            host: redisForm.host,
            port: parseInt(redisForm.port),
            username: redisForm.username.trim() || undefined,
            password: redisForm.password.trim() || undefined,
            database: parseInt(redisForm.database),
            advancedOptions: redisAdvancedOptions,
          },
        };
        break;
      case 'mongodb':
        name = mongoForm.name;
        type = 'mongodb';
        config = {
          mongodb: {
            host: mongoForm.host,
            port: parseInt(mongoForm.port),
            username: mongoForm.username || undefined,
            password: mongoForm.password || undefined,
            database: mongoForm.database,
          },
        };
        break;
    }

    if (!name) {
      alert('请输入连接名称');
      return;
    }

    if (editingConnectionId) {
      // 编辑模式：更新现有连接
      const connection = connections.find((c) => c.id === editingConnectionId);
      
      // 如果连接当前是连接状态，先断开它
      const wasConnected = connection && connection.status === 'connected';
      
      if (wasConnected) {
        try {
          await disconnectConnection(editingConnectionId);
        } catch (error) {
          console.error('断开连接失败:', error);
        }
      }
      
      updateConnection(editingConnectionId, {
        name,
        type,
        config,
      });
      
      // 只有在之前是连接状态时才提示重新连接
      if (wasConnected) {
        alert('连接配置已更新，请点击连接按钮重新连接。');
      }
    } else {
      // 新建模式：添加新连接
      addConnection({
        name,
        type,
        config,
        status: 'disconnected',
      });
    }

    onOpenChange(false);
  };

  const handleTest = async () => {
    let config: ConnectionConfig;
    let type: DatabaseType = activeTab;

    switch (activeTab) {
      case 'mysql':
        config = {
          mysql: {
            host: mysqlForm.host,
            port: parseInt(mysqlForm.port),
            username: mysqlForm.username,
            password: mysqlForm.password,
            database: mysqlForm.database,
          },
        };
        break;
      case 'redis':
        config = {
          redis: {
            host: redisForm.host,
            port: parseInt(redisForm.port),
            username: redisForm.username.trim() || undefined,
            password: redisForm.password.trim() || undefined,
            database: parseInt(redisForm.database),
            advancedOptions: redisAdvancedOptions,
          },
        };
        break;
      case 'mongodb':
        config = {
          mongodb: {
            host: mongoForm.host,
            port: parseInt(mongoForm.port),
            username: mongoForm.username || undefined,
            password: mongoForm.password || undefined,
            database: mongoForm.database,
          },
        };
        break;
    }

    setTesting(true);
    try {
      const success = await testConnection(type, config);
      if (success) {
        alert('连接测试成功！');
      } else {
        alert('连接测试失败，请检查配置。');
      }
    } catch (error) {
      alert(`连接测试失败: ${error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!sm:max-w-[672px]">
        <DialogHeader>
          <DialogTitle>{editingConnectionId ? '编辑数据库连接' : '添加数据库连接'}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DatabaseType)}>
          <TabsList className="w-full">
            <TabsTrigger value="mysql" className="flex-1">MySQL</TabsTrigger>
            <TabsTrigger value="redis" className="flex-1">Redis</TabsTrigger>
            <TabsTrigger value="mongodb" className="flex-1">MongoDB</TabsTrigger>
          </TabsList>

          <TabsContent value="mysql" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mysql-name">连接名称</Label>
              <Input
                id="mysql-name"
                value={mysqlForm.name}
                onChange={(e) => setMysqlForm({ ...mysqlForm, name: e.target.value })}
                placeholder="输入连接名称"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mysql-host">主机</Label>
                <Input
                  id="mysql-host"
                  value={mysqlForm.host}
                  onChange={(e) => setMysqlForm({ ...mysqlForm, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mysql-port">端口</Label>
                <Input
                  id="mysql-port"
                  type="number"
                  value={mysqlForm.port}
                  onChange={(e) => setMysqlForm({ ...mysqlForm, port: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mysql-username">用户名</Label>
                <Input
                  id="mysql-username"
                  value={mysqlForm.username}
                  onChange={(e) => setMysqlForm({ ...mysqlForm, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mysql-password">密码</Label>
                <PasswordInput
                  id="mysql-password"
                  value={mysqlForm.password}
                  onChange={(e) => setMysqlForm({ ...mysqlForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mysql-database">默认数据库</Label>
              <Input
                id="mysql-database"
                value={mysqlForm.database}
                onChange={(e) => setMysqlForm({ ...mysqlForm, database: e.target.value })}
                placeholder="输入数据库名称"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-3 block">高级选项</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hide-system-dbs"
                    checked={mysqlAdvancedOptions.hideSystemDatabases}
                    onCheckedChange={(checked) => 
                      setMysqlAdvancedOptions({ ...mysqlAdvancedOptions, hideSystemDatabases: checked as boolean })
                    }
                  />
                  <Label htmlFor="hide-system-dbs" className="text-sm cursor-pointer">
                    隐藏系统数据库（information_schema, mysql, performance_schema, sys）
                  </Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="allowed-dbs" className="text-sm">只显示指定数据库</Label>
                  <Input
                    id="allowed-dbs"
                    value={mysqlAdvancedOptions.allowedDatabases || ''}
                    onChange={(e) => setMysqlAdvancedOptions({ ...mysqlAdvancedOptions, allowedDatabases: e.target.value })}
                    placeholder="多个数据库用逗号分隔，如: db1, db2, db3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="query-limit" className="text-sm">默认查询条数</Label>
                    <Input
                      id="query-limit"
                      type="number"
                      value={mysqlAdvancedOptions.defaultQueryLimit}
                      onChange={(e) => setMysqlAdvancedOptions({ ...mysqlAdvancedOptions, defaultQueryLimit: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sort-field" className="text-sm">默认倒序字段</Label>
                    <Input
                      id="sort-field"
                      value={mysqlAdvancedOptions.defaultSortField || ''}
                      onChange={(e) => setMysqlAdvancedOptions({ ...mysqlAdvancedOptions, defaultSortField: e.target.value })}
                      placeholder="如: id, created_at"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="redis" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="redis-name">连接名称</Label>
              <Input
                id="redis-name"
                value={redisForm.name}
                onChange={(e) => setRedisForm({ ...redisForm, name: e.target.value })}
                placeholder="输入连接名称"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="redis-host">主机</Label>
                <Input
                  id="redis-host"
                  value={redisForm.host}
                  onChange={(e) => setRedisForm({ ...redisForm, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redis-port">端口</Label>
                <Input
                  id="redis-port"
                  type="number"
                  value={redisForm.port}
                  onChange={(e) => setRedisForm({ ...redisForm, port: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="redis-username">用户名（可选，与密码一起使用）</Label>
                <Input
                  id="redis-username"
                  value={redisForm.username}
                  onChange={(e) => setRedisForm({ ...redisForm, username: e.target.value })}
                  placeholder="留空则不需要用户名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="redis-password">密码（可选，与用户名一起使用）</Label>
                <PasswordInput
                  id="redis-password"
                  value={redisForm.password}
                  onChange={(e) => setRedisForm({ ...redisForm, password: e.target.value })}
                  placeholder="留空则不需要密码"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="redis-database">数据库索引</Label>
              <Input
                id="redis-database"
                type="number"
                value={redisForm.database}
                onChange={(e) => setRedisForm({ ...redisForm, database: e.target.value })}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-semibold mb-3 block">高级选项</Label>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="redis-db-count" className="text-sm">数据库数量</Label>
                    <Input
                      id="redis-db-count"
                      type="number"
                      value={redisAdvancedOptions.databaseCount}
                      onChange={(e) => setRedisAdvancedOptions({ ...redisAdvancedOptions, databaseCount: parseInt(e.target.value) || 16 })}
                      placeholder="16"
                      min="1"
                      max="256"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="redis-key-page-size" className="text-sm">每页 key 数量</Label>
                    <Input
                      id="redis-key-page-size"
                      type="number"
                      value={redisAdvancedOptions.keyPageSize}
                      onChange={(e) => setRedisAdvancedOptions({ ...redisAdvancedOptions, keyPageSize: parseInt(e.target.value) || 100 })}
                      placeholder="100"
                      min="10"
                      max="10000"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mongodb" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mongo-name">连接名称</Label>
              <Input
                id="mongo-name"
                value={mongoForm.name}
                onChange={(e) => setMongoForm({ ...mongoForm, name: e.target.value })}
                placeholder="输入连接名称"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="mongo-host">主机</Label>
                <Input
                  id="mongo-host"
                  value={mongoForm.host}
                  onChange={(e) => setMongoForm({ ...mongoForm, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mongo-port">端口</Label>
                <Input
                  id="mongo-port"
                  type="number"
                  value={mongoForm.port}
                  onChange={(e) => setMongoForm({ ...mongoForm, port: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mongo-username">用户名（可选）</Label>
                <Input
                  id="mongo-username"
                  value={mongoForm.username}
                  onChange={(e) => setMongoForm({ ...mongoForm, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mongo-password">密码（可选）</Label>
                <PasswordInput
                  id="mongo-password"
                  value={mongoForm.password}
                  onChange={(e) => setMongoForm({ ...mongoForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mongo-database">认证数据库</Label>
              <Input
                id="mongo-database"
                value={mongoForm.database}
                onChange={(e) => setMongoForm({ ...mongoForm, database: e.target.value })}
                placeholder="输入数据库名称"
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="secondary" onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </Button>
          <Button onClick={handleSave}>
            {editingConnectionId ? '更新' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
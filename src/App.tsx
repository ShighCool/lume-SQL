import { useEffect, useState } from 'react';
import { Database, ChevronRight } from 'lucide-react';
import { useConnectionStore } from './stores/connectionStore';
import { useThemeStore } from './stores/themeStore';
import { Sidebar } from './components/Sidebar';
import { DatabaseSidebar } from './components/DatabaseSidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { ConnectionForm } from './components/ConnectionForm';
import { MySQLBrowser } from './components/MySQLBrowser';
import { RedisBrowser } from './components/RedisBrowser';
import { MongoDBBrowser } from './components/MongoDBBrowser';
import { Button } from './components/ui/button';

function App() {
  const { theme } = useThemeStore();
  const { connections, activeConnectionId, activeDatabase, activeTable } = useConnectionStore();
  const [showConnectionForm, setShowConnectionForm] = useState(false);

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const renderContent = () => {
    if (!activeConnection) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">未选择连接</h2>
            <p className="text-muted-foreground mb-4">
              从左侧边栏选择一个连接或创建新连接
            </p>
            <Button onClick={() => setShowConnectionForm(true)}>
              创建新连接
            </Button>
          </div>
        </div>
      );
    }

    if (activeConnection.status !== 'connected') {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Database className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">未连接</h2>
            <p className="text-muted-foreground mb-4">
              点击左侧连接按钮以连接数据库
            </p>
          </div>
        </div>
      );
    }

    switch (activeConnection.type) {
      case 'mysql':
        return (
          <div className="flex h-full">
            <DatabaseSidebar connectionId={activeConnectionId} />
            <MySQLBrowser 
              connectionId={activeConnectionId} 
              database={activeDatabase}
              table={activeTable}
            />
          </div>
        );
      case 'redis':
        return <RedisBrowser connectionId={activeConnectionId} />;
      case 'mongodb':
        return <MongoDBBrowser connectionId={activeConnectionId} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            未知连接类型
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {activeConnection ? (
              <span className="font-medium">{activeConnection.name}</span>
            ) : (
              <span className="text-muted-foreground">未选择连接</span>
            )}
            {activeDatabase && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{activeDatabase}</span>
              </>
            )}
            {activeTable && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{activeTable}</span>
              </>
            )}
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>

      <ConnectionForm
        open={showConnectionForm}
        onOpenChange={setShowConnectionForm}
      />
    </div>
  );
}

export default App;
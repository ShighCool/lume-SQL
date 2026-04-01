import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react';

interface ERColumn {
  name: string;
  type: string;
  is_primary: boolean;
  is_foreign: boolean;
}

interface ERTable {
  name: string;
  columns: ERColumn[];
}

interface ERRelation {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
}

interface ERDiagram {
  database: string;
  tables: ERTable[];
  relations: ERRelation[];
}

interface ERDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  database: string;
}

export function ERDiagramDialog({ open, onOpenChange, connectionId, database }: ERDiagramDialogProps) {
  const [diagram, setDiagram] = useState<ERDiagram | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open && connectionId && database) {
      loadDiagram();
    }
  }, [open, connectionId, database]);

  useEffect(() => {
    if (diagram && canvasRef.current) {
      drawDiagram();
    }
  }, [diagram, zoom, pan]);

  const loadDiagram = async () => {
    setLoading(true);
    try {
      const data = await invoke('get_er_diagram', {
        connId: connectionId,
        database,
      });
      setDiagram(data as ERDiagram);
    } catch (error) {
      console.error('加载ER图失败:', error);
      alert(`加载ER图失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const drawDiagram = () => {
    if (!diagram || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 计算表的位置（简单布局）
    const tablePositions = new Map<string, { x: number; y: number }>();
    const tableWidth = 180;
    const tableHeight = 40;
    const columnHeight = 25;
    const padding = 40;

    diagram.tables.forEach((table, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = padding + col * (tableWidth + padding);
      const y = padding + row * (tableHeight + table.columns.length * columnHeight + padding);
      tablePositions.set(table.name, { x, y });
    });

    // 绘制关系线
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    diagram.relations.forEach((relation) => {
      const fromPos = tablePositions.get(relation.from_table);
      const toPos = tablePositions.get(relation.to_table);

      if (fromPos && toPos) {
        // 绘制连接线
        ctx.beginPath();
        ctx.moveTo(fromPos.x + tableWidth / 2, fromPos.y);
        ctx.lineTo(toPos.x + tableWidth / 2, toPos.y);
        ctx.stroke();

        // 绘制端点
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(fromPos.x + tableWidth / 2, fromPos.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(toPos.x + tableWidth / 2, toPos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 绘制表
    diagram.tables.forEach((table) => {
      const pos = tablePositions.get(table.name);
      if (!pos) return;

      // 绘制表头
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(pos.x, pos.y, tableWidth, tableHeight);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(table.name, pos.x + 8, pos.y + 25);

      // 绘制列
      table.columns.forEach((column, colIndex) => {
        const colY = pos.y + tableHeight + colIndex * columnHeight;
        
        ctx.fillStyle = colIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(pos.x, colY, tableWidth, columnHeight);

        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(pos.x, colY, tableWidth, columnHeight);

        // 主键图标
        if (column.is_primary) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px Arial';
          ctx.fillText('PK', pos.x + 5, colY + 17);
        }

        // 外键图标
        if (column.is_foreign && !column.is_primary) {
          ctx.fillStyle = '#3b82f6';
          ctx.font = 'bold 10px Arial';
          ctx.fillText('FK', pos.x + 5, colY + 17);
        }

        // 列名
        ctx.fillStyle = '#1e293b';
        ctx.font = '11px Arial';
        ctx.fillText(column.name, pos.x + 35, colY + 17);

        // 列类型
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Arial';
        const maxWidth = 80;
        const typeText = column.type.length > 10 ? column.type.substring(0, 10) + '...' : column.type;
        ctx.fillText(typeText, pos.x + tableWidth - 5 - maxWidth, colY + 17);
      });
    });

    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const newZoom = zoom - e.deltaY * 0.001;
    setZoom(Math.max(0.2, Math.min(3, newZoom)));
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.2, prev - 0.2));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `${database}_er_diagram.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  if (loading || !diagram) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>ER 图 - {database}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
            <span>加载中...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-auto" style={{ width: '1400px', maxWidth: '1400px' }}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>ER 图 - {diagram.database}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={loadDiagram}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                下载
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 控制栏 */}
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">缩放: {(zoom * 100).toFixed(0)}%</span>
            <Button size="sm" variant="outline" onClick={handleZoomOut}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleZoomIn}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleResetView}>
              重置视图
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            表: {diagram.tables.length} | 关系: {diagram.relations.length}
          </div>
        </div>

        {/* 画布 */}
        <div className="border rounded-lg bg-gray-50 overflow-hidden" style={{ height: '500px' }}>
          <canvas
            ref={canvasRef}
            width={2000}
            height={2000}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="cursor-move"
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* 图例 */}
        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-semibold mb-3 text-sm">图例</h3>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span>主键 (PK)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span>外键 (FK)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500"></div>
              <span>外键关系</span>
            </div>
            <div className="text-muted-foreground">
              提示: 滚轮缩放，拖拽移动
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
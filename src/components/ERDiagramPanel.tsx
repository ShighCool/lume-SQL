import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, Download, RefreshCw } from 'lucide-react';

interface ERTable {
  name: string;
  columns: {
    name: string;
    type: string;
    primary: boolean;
    nullable: boolean;
  }[];
}

interface ERRelation {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  relation_type: string;
}

interface ERDiagram {
  database: string;
  tables: ERTable[];
  relations: ERRelation[];
}

interface ERDiagramPanelProps {
  connectionId: string | null;
  database: string | null;
}

export default function ERDiagramPanel({ connectionId, database }: ERDiagramPanelProps) {
  const [erDiagram, setErDiagram] = useState<ERDiagram | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (connectionId && database) {
      loadERDiagram();
    }
  }, [connectionId, database]);

  useEffect(() => {
    if (erDiagram && canvasRef.current) {
      drawERDiagram();
    }
  }, [erDiagram, zoom]);

  const loadERDiagram = async () => {
    if (!connectionId || !database) return;

    setLoading(true);
    try {
      const result = await invoke<ERDiagram>('get_er_diagram', {
        connId: connectionId,
        database,
      });
      setErDiagram(result);
    } catch (error) {
      console.error('加载 ER 图失败:', error);
      alert('加载 ER 图失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const drawERDiagram = () => {
    if (!erDiagram || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = zoom / 100;
    const tableWidth = 200;
    const tableHeight = 30;
    const rowHeight = 25;
    const gap = 20;

    // 计算画布大小
    const cols = Math.ceil(Math.sqrt(erDiagram.tables.length));
    const canvasWidth = cols * (tableWidth + gap);
    const rows = Math.ceil(erDiagram.tables.length / cols);
    const canvasHeight = rows * (tableHeight + gap + 50);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.scale(scale, scale);

    // 绘制表
    erDiagram.tables.forEach((table, index) => {
      const x = (index % cols) * (tableWidth + gap);
      const y = Math.floor(index / cols) * (tableHeight + gap + table.columns.length * rowHeight + gap);

      // 绘制表头背景
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x, y, tableWidth, tableHeight);

      // 绘制表头边框
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, tableWidth, tableHeight);

      // 绘制表名
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(table.name, x + tableWidth / 2, y + tableHeight / 2 + 5);

      // 绘制列
      table.columns.forEach((column, colIndex) => {
        const colY = y + tableHeight + colIndex * rowHeight;

        // 绘制列背景
        ctx.fillStyle = column.primary ? '#fef3c7' : '#ffffff';
        ctx.fillRect(x, colY, tableWidth, rowHeight);

        // 绘制列边框
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(x, colY, tableWidth, rowHeight);

        // 绘制列名
        ctx.fillStyle = '#334155';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(column.name, x + 10, colY + rowHeight / 2);

        // 绘制列类型
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(column.type, x + tableWidth - 10, colY + rowHeight / 2);

        // 绘制主键图标
        if (column.primary) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(x + tableWidth - 30, colY + rowHeight / 2, 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // 绘制可空标记
        if (column.nullable) {
          ctx.fillStyle = '#64748b';
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('NULL', x + tableWidth - 50, colY + rowHeight / 2);
        }
      });
    });

    // 绘制关系线
    erDiagram.relations.forEach((relation) => {
      const fromTableIndex = erDiagram.tables.findIndex(t => t.name === relation.from_table);
      const toTableIndex = erDiagram.tables.findIndex(t => t.name === relation.to_table);

      if (fromTableIndex === -1 || toTableIndex === -1) return;

      const fromX = (fromTableIndex % cols) * (tableWidth + gap) + tableWidth / 2;
      const fromY = Math.floor(fromTableIndex / cols) * (tableHeight + gap + 50) + tableHeight + 30;
      const toX = (toTableIndex % cols) * (tableWidth + gap) + tableWidth / 2;
      const toY = Math.floor(toTableIndex / cols) * (tableHeight + gap + 50) + tableHeight + 30;

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // 绘制箭头
      const angle = Math.atan2(toY - fromY, toX - fromX);
      const arrowLength = 10;
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - arrowLength * Math.cos(angle - Math.PI / 6), toY - arrowLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - arrowLength * Math.cos(angle + Math.PI / 6), toY - arrowLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    });
  };

  const handleZoomIn = () => setZoom(z => Math.min(300, z + 20));
  const handleZoomOut = () => setZoom(z => Math.max(20, z - 20));
  const handleReset = () => setZoom(100);

  const handleExport = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `er_diagram_${database}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  if (!connectionId || !database) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        请先连接数据库并选择一个数据库
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ER 图</h2>
        <div className="flex gap-2">
          <Button onClick={loadERDiagram} disabled={loading} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
          <Button onClick={handleZoomOut} disabled={zoom <= 20} variant="outline" size="sm">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button onClick={handleZoomIn} disabled={zoom >= 300} variant="outline" size="sm">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button onClick={handleReset} variant="outline" size="sm">
            {zoom}%
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            导出 PNG
          </Button>
        </div>
      </div>

      <div className="flex-1 border rounded-lg overflow-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : erDiagram ? (
          <canvas
            ref={canvasRef}
            className="block mx-auto my-4"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            暂无 ER 图数据
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">ER 图说明</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• 显示当前数据库中的所有表结构</li>
          <li>• 黄色圆点标记表示主键列</li>
          <li>• 蓝色连线表示表之间的外键关系</li>
          <li>• 使用缩放按钮调整视图大小</li>
          <li>• 可导出为 PNG 图片</li>
        </ul>
      </div>
    </div>
  );
}
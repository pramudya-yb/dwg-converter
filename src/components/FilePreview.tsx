'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface PreviewEntity {
  type: string;
  layer?: string;
  color?: number;
  points?: Point[];
  center?: Point;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  text?: string;
  height?: number;
}

interface PreviewData {
  entities: PreviewEntity[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  layers: string[];
  entityCount: number;
}

// AutoCAD ACI color mapping (simplified)
const ACI_COLORS: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff',
  5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080',
  9: '#c0c0c0',
};

interface FilePreviewProps {
  file: File | null;
}

export default function FilePreview({ file }: FilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const isDXF = file?.name.toLowerCase().endsWith('.dxf');

  // Parse DXF on client side for preview
  const parseDXFLocally = useCallback(async (fileContent: string): Promise<PreviewData> => {
    const lines = fileContent.split(/\r?\n/);
    const entities: PreviewEntity[] = [];
    const layerSet = new Set<string>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    function updateBounds(x: number, y: number) {
      if (isFinite(x) && isFinite(y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    let i = 0;
    let inEntities = false;

    while (i < lines.length - 1) {
      const code = lines[i]?.trim();
      const value = lines[i + 1]?.trim();

      if (code === '2' && value === 'ENTITIES') {
        inEntities = true;
        i += 2;
        continue;
      }

      if (code === '0' && value === 'ENDSEC' && inEntities) break;

      if (!inEntities) {
        i += 2;
        continue;
      }

      if (code === '0') {
        const entityType = value;

        if (entityType === 'LINE') {
          const entity: PreviewEntity = { type: 'LINE', points: [] };
          let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
          i += 2;
          while (i < lines.length - 1) {
            const gc = lines[i]?.trim();
            const gv = lines[i + 1]?.trim();
            if (gc === '0') break;
            switch (gc) {
              case '8': entity.layer = gv; layerSet.add(gv!); break;
              case '62': entity.color = parseInt(gv!); break;
              case '10': x1 = parseFloat(gv!); break;
              case '20': y1 = parseFloat(gv!); break;
              case '11': x2 = parseFloat(gv!); break;
              case '21': y2 = parseFloat(gv!); break;
            }
            i += 2;
          }
          entity.points = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
          updateBounds(x1, y1);
          updateBounds(x2, y2);
          entities.push(entity);
          continue;
        }

        if (entityType === 'CIRCLE') {
          const entity: PreviewEntity = { type: 'CIRCLE' };
          let cx = 0, cy = 0, r = 0;
          i += 2;
          while (i < lines.length - 1) {
            const gc = lines[i]?.trim();
            const gv = lines[i + 1]?.trim();
            if (gc === '0') break;
            switch (gc) {
              case '8': entity.layer = gv; layerSet.add(gv!); break;
              case '62': entity.color = parseInt(gv!); break;
              case '10': cx = parseFloat(gv!); break;
              case '20': cy = parseFloat(gv!); break;
              case '40': r = parseFloat(gv!); break;
            }
            i += 2;
          }
          entity.center = { x: cx, y: cy };
          entity.radius = r;
          updateBounds(cx - r, cy - r);
          updateBounds(cx + r, cy + r);
          entities.push(entity);
          continue;
        }

        if (entityType === 'ARC') {
          const entity: PreviewEntity = { type: 'ARC' };
          let cx = 0, cy = 0, r = 0, sa = 0, ea = 360;
          i += 2;
          while (i < lines.length - 1) {
            const gc = lines[i]?.trim();
            const gv = lines[i + 1]?.trim();
            if (gc === '0') break;
            switch (gc) {
              case '8': entity.layer = gv; layerSet.add(gv!); break;
              case '62': entity.color = parseInt(gv!); break;
              case '10': cx = parseFloat(gv!); break;
              case '20': cy = parseFloat(gv!); break;
              case '40': r = parseFloat(gv!); break;
              case '50': sa = parseFloat(gv!); break;
              case '51': ea = parseFloat(gv!); break;
            }
            i += 2;
          }
          entity.center = { x: cx, y: cy };
          entity.radius = r;
          entity.startAngle = sa;
          entity.endAngle = ea;
          updateBounds(cx - r, cy - r);
          updateBounds(cx + r, cy + r);
          entities.push(entity);
          continue;
        }

        if (entityType === 'LWPOLYLINE' || entityType === 'POLYLINE') {
          const entity: PreviewEntity = { type: 'POLYLINE', points: [] };
          i += 2;
          let currentX: number | null = null;
          while (i < lines.length - 1) {
            const gc = lines[i]?.trim();
            const gv = lines[i + 1]?.trim();
            if (gc === '0') {
              if (gv === 'VERTEX') { i += 2; continue; }
              if (gv === 'SEQEND') {
                i += 2;
                while (i < lines.length - 1 && lines[i]?.trim() !== '0') i += 2;
                break;
              }
              break;
            }
            switch (gc) {
              case '8': entity.layer = gv; layerSet.add(gv!); break;
              case '62': entity.color = parseInt(gv!); break;
              case '10': currentX = parseFloat(gv!); break;
              case '20': {
                const y = parseFloat(gv!);
                if (currentX !== null) {
                  entity.points!.push({ x: currentX, y });
                  updateBounds(currentX, y);
                  currentX = null;
                }
                break;
              }
            }
            i += 2;
          }
          if (entity.points!.length > 0) entities.push(entity);
          continue;
        }

        if (entityType === 'TEXT' || entityType === 'MTEXT') {
          const entity: PreviewEntity = { type: 'TEXT' };
          let x = 0, y = 0;
          i += 2;
          while (i < lines.length - 1) {
            const gc = lines[i]?.trim();
            const gv = lines[i + 1]?.trim();
            if (gc === '0') break;
            switch (gc) {
              case '8': entity.layer = gv; layerSet.add(gv!); break;
              case '62': entity.color = parseInt(gv!); break;
              case '10': x = parseFloat(gv!); break;
              case '20': y = parseFloat(gv!); break;
              case '1': entity.text = gv; break;
              case '40': entity.height = parseFloat(gv!); break;
            }
            i += 2;
          }
          entity.points = [{ x, y }];
          updateBounds(x, y);
          entities.push(entity);
          continue;
        }

        // Skip unknown entities
        i += 2;
        while (i < lines.length - 1 && lines[i]?.trim() !== '0') i += 2;
        continue;
      }
      i += 2;
    }

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

    return {
      entities,
      bounds: { minX, minY, maxX, maxY },
      layers: Array.from(layerSet),
      entityCount: entities.length,
    };
  }, []);

  // Load and parse DXF file
  useEffect(() => {
    if (!file || !isDXF) {
      setPreviewData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const data = await parseDXFLocally(content);
        setPreviewData(data);
      } catch (err) {
        setError('Gagal memparse file DXF');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Gagal membaca file');
      setLoading(false);
    };
    reader.readAsText(file);
  }, [file, isDXF, parseDXFLocally]);

  // Render canvas
  useEffect(() => {
    if (!previewData || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = '#050515';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const offsetX = (pan.x % gridSize);
    const offsetY = (pan.y % gridSize);
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const { bounds, entities } = previewData;
    const bWidth = bounds.maxX - bounds.minX || 1;
    const bHeight = bounds.maxY - bounds.minY || 1;

    // Calculate scale to fit
    const padding = 40;
    const scaleX = (width - padding * 2) / bWidth;
    const scaleY = (height - padding * 2) / bHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoom;

    // Transform: world to screen
    const toScreen = (wx: number, wy: number): [number, number] => {
      const sx = (wx - bounds.minX) * scale + padding + pan.x + (width - bWidth * scale - padding * 2) / 2;
      // Flip Y axis (CAD Y goes up, screen Y goes down)
      const sy = height - ((wy - bounds.minY) * scale + padding + pan.y + (height - bHeight * scale - padding * 2) / 2);
      return [sx, sy];
    };

    const getColor = (entity: PreviewEntity): string => {
      if (entity.color && ACI_COLORS[entity.color]) return ACI_COLORS[entity.color];
      return '#00d4ff';
    };

    // Draw entities
    for (const entity of entities) {
      ctx.strokeStyle = getColor(entity);
      ctx.fillStyle = getColor(entity);
      ctx.lineWidth = 1;

      switch (entity.type) {
        case 'LINE': {
          if (entity.points && entity.points.length >= 2) {
            const [x1, y1] = toScreen(entity.points[0].x, entity.points[0].y);
            const [x2, y2] = toScreen(entity.points[1].x, entity.points[1].y);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
          break;
        }

        case 'CIRCLE': {
          if (entity.center && entity.radius) {
            const [cx, cy] = toScreen(entity.center.x, entity.center.y);
            const r = entity.radius * scale;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }

        case 'ARC': {
          if (entity.center && entity.radius) {
            const [cx, cy] = toScreen(entity.center.x, entity.center.y);
            const r = entity.radius * scale;
            const sa = -(entity.startAngle || 0) * Math.PI / 180;
            const ea = -(entity.endAngle || 360) * Math.PI / 180;
            ctx.beginPath();
            ctx.arc(cx, cy, r, sa, ea, true);
            ctx.stroke();
          }
          break;
        }

        case 'POLYLINE': {
          if (entity.points && entity.points.length > 0) {
            ctx.beginPath();
            const [sx, sy] = toScreen(entity.points[0].x, entity.points[0].y);
            ctx.moveTo(sx, sy);
            for (let i = 1; i < entity.points.length; i++) {
              const [px, py] = toScreen(entity.points[i].x, entity.points[i].y);
              ctx.lineTo(px, py);
            }
            ctx.stroke();
          }
          break;
        }

        case 'TEXT': {
          if (entity.points && entity.points.length > 0 && entity.text) {
            const [tx, ty] = toScreen(entity.points[0].x, entity.points[0].y);
            const fontSize = Math.max(8, Math.min(24, (entity.height || 10) * scale * 0.5));
            ctx.font = `${fontSize}px Inter, monospace`;
            ctx.fillText(entity.text, tx, ty);
          }
          break;
        }
      }
    }

    // Draw info overlay
    ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
    ctx.font = '11px Inter, monospace';
    ctx.fillText(`${entities.length} entities | Zoom: ${(zoom * 100).toFixed(0)}%`, 12, height - 12);

  }, [previewData, zoom, pan]);

  // Mouse handlers for pan/zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.1, Math.min(10, z * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    setPan(p => ({ x: p.x + dx, y: p.y - dy }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!file) return null;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
          {previewData && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
              {previewData.entityCount} entities • {previewData.layers.length} layers
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="preview-control-btn" onClick={() => setZoom(z => Math.min(10, z * 1.2))} title="Zoom In">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button className="preview-control-btn" onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} title="Zoom Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button className="preview-control-btn" onClick={resetView} title="Reset View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="preview-canvas-container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {loading && (
          <div className="preview-empty">
            <div className="spinner-large" />
            <p style={{ marginTop: '16px' }}>Memparse file DXF...</p>
          </div>
        )}
        {error && (
          <div className="preview-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p style={{ marginTop: '12px', color: 'var(--error)' }}>{error}</p>
          </div>
        )}
        {!isDXF && !loading && (
          <div className="preview-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p style={{ marginTop: '12px' }}>Preview hanya tersedia untuk file DXF</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px', color: 'var(--text-muted)' }}>File DWG perlu dikonversi ke DXF terlebih dahulu</p>
          </div>
        )}
        {previewData && !loading && !error && (
          <canvas
            ref={canvasRef}
            className="preview-canvas"
          />
        )}
        {previewData && previewData.entityCount === 0 && !loading && (
          <div className="preview-empty" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <p>Tidak ada entity yang terdeteksi dalam file ini</p>
          </div>
        )}
      </div>
    </div>
  );
}

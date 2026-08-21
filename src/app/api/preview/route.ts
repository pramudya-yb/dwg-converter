import { NextRequest, NextResponse } from 'next/server';

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

function parseDXFContent(content: string): PreviewData {
  const lines = content.split(/\r?\n/);
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

  // Find ENTITIES section
  let i = 0;
  let inEntities = false;

  while (i < lines.length) {
    const code = lines[i]?.trim();
    const value = lines[i + 1]?.trim();

    if (code === '2' && value === 'ENTITIES') {
      inEntities = true;
      i += 2;
      continue;
    }

    if (code === '0' && value === 'ENDSEC' && inEntities) {
      break;
    }

    if (!inEntities) {
      i += 2;
      continue;
    }

    // Parse entities
    if (code === '0') {
      const entityType = value;

      if (entityType === 'LINE') {
        const entity: PreviewEntity = { type: 'LINE', points: [] };
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
        i += 2;

        while (i < lines.length) {
          const gc = lines[i]?.trim();
          const gv = lines[i + 1]?.trim();
          if (gc === '0') break;

          switch (gc) {
            case '8': if (gv) { entity.layer = gv; layerSet.add(gv); } break;
            case '62': entity.color = parseInt(gv || '0'); break;
            case '10': x1 = parseFloat(gv || '0'); break;
            case '20': y1 = parseFloat(gv || '0'); break;
            case '11': x2 = parseFloat(gv || '0'); break;
            case '21': y2 = parseFloat(gv || '0'); break;
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

        while (i < lines.length) {
          const gc = lines[i]?.trim();
          const gv = lines[i + 1]?.trim();
          if (gc === '0') break;

          switch (gc) {
            case '8': if (gv) { entity.layer = gv; layerSet.add(gv); } break;
            case '62': entity.color = parseInt(gv || '0'); break;
            case '10': cx = parseFloat(gv || '0'); break;
            case '20': cy = parseFloat(gv || '0'); break;
            case '40': r = parseFloat(gv || '0'); break;
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

        while (i < lines.length) {
          const gc = lines[i]?.trim();
          const gv = lines[i + 1]?.trim();
          if (gc === '0') break;

          switch (gc) {
            case '8': if (gv) { entity.layer = gv; layerSet.add(gv); } break;
            case '62': entity.color = parseInt(gv || '0'); break;
            case '10': cx = parseFloat(gv || '0'); break;
            case '20': cy = parseFloat(gv || '0'); break;
            case '40': r = parseFloat(gv || '0'); break;
            case '50': sa = parseFloat(gv || '0'); break;
            case '51': ea = parseFloat(gv || '0'); break;
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

        while (i < lines.length) {
          const gc = lines[i]?.trim();
          const gv = lines[i + 1]?.trim();
          if (gc === '0') {
            if (gv === 'VERTEX') {
              i += 2;
              continue;
            }
            if (gv === 'SEQEND') {
              i += 2;
              // skip SEQEND group codes
              while (i < lines.length && lines[i]?.trim() !== '0') i += 2;
              break;
            }
            break;
          }

          switch (gc) {
            case '8': if (gv) { entity.layer = gv; layerSet.add(gv); } break;
            case '62': entity.color = parseInt(gv || '0'); break;
            case '10': {
              const x = parseFloat(gv || '0');
              // Read the corresponding Y
              let y = 0;
              if (i + 2 < lines.length && lines[i + 2]?.trim() === '20') {
                y = parseFloat(lines[i + 3]?.trim() || '0');
              }
              entity.points!.push({ x, y });
              updateBounds(x, y);
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

        while (i < lines.length) {
          const gc = lines[i]?.trim();
          const gv = lines[i + 1]?.trim();
          if (gc === '0') break;

          switch (gc) {
            case '8': if (gv) { entity.layer = gv; layerSet.add(gv); } break;
            case '62': entity.color = parseInt(gv || '0'); break;
            case '10': x = parseFloat(gv || '0'); break;
            case '20': y = parseFloat(gv || '0'); break;
            case '1': entity.text = gv; break;
            case '40': entity.height = parseFloat(gv || '0'); break;
          }
          i += 2;
        }

        entity.points = [{ x, y }];
        updateBounds(x, y);
        entities.push(entity);
        continue;
      }

      // Skip unknown entity
      i += 2;
      while (i < lines.length && lines[i]?.trim() !== '0') {
        i += 2;
      }
      continue;
    }

    i += 2;
  }

  // Handle case where no entities found or bounds are invalid
  if (!isFinite(minX)) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  }

  return {
    entities,
    bounds: { minX, minY, maxX, maxY },
    layers: Array.from(layerSet),
    entityCount: entities.length,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.dxf')) {
      return NextResponse.json(
        { error: 'Preview is only available for DXF files. DWG files require conversion to DXF first.' },
        { status: 400 }
      );
    }

    // Limit preview parsing to 50MB to avoid OOM on giant text-encoded DXFs
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large for preview (max 50MB).' },
        { status: 413 }
      );
    }

    const content = await file.text();
    const previewData = parseDXFContent(content);

    return NextResponse.json(previewData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse DXF file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

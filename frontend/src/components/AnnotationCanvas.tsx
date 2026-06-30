import { useEffect, useRef, useState, useCallback } from 'react';
import { Pen, Highlighter, ArrowRight, Type, Undo2, Trash2, Send, Eye, EyeOff } from 'lucide-react';

type Tool = 'pen' | 'marker' | 'arrow' | 'text';

interface Point { x: number; y: number; }

export interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  text?: string;
}

const COLORS = ['#EF4444', '#FBBF24', '#10B981', '#60A5FA', '#FFFFFF'];
const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';

interface Props {
  isOrganizer: boolean;
  sessionId: string;
  slideNumber: number;
  publicStrokes: Stroke[];
}

export function AnnotationCanvas({ isOrganizer, sessionId, slideNumber, publicStrokes }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#EF4444');
  const [draftStrokes, setDraftStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showDraft, setShowDraft] = useState(true);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [published, setPublished] = useState(false);

  const draftKey = `ann_${sessionId}_${slideNumber}`;

  // Load draft from localStorage on slide change
  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    setDraftStrokes(saved ? JSON.parse(saved) : []);
    setCurrentStroke(null);
    setPublished(false);
  }, [draftKey]);

  const saveDraft = useCallback((strokes: Stroke[]) => {
    localStorage.setItem(draftKey, JSON.stringify(strokes));
  }, [draftKey]);

  // Normalize pointer position to 0-1
  const getPos = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ('touches' in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return null;
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = (e as MouseEvent).clientX; cy = (e as MouseEvent).clientY;
    }
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
  }, []);

  // Draw all strokes onto canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawList = (list: Stroke[]) => {
      list.forEach(s => {
        if (!s.points.length) return;
        ctx.globalAlpha = s.opacity;
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        ctx.lineWidth = s.size * Math.min(W, H);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (s.tool === 'text' && s.text) {
          ctx.globalAlpha = 1;
          ctx.font = `bold ${Math.round(s.size * H)}px Inter,sans-serif`;
          ctx.fillText(s.text, s.points[0].x * W, s.points[0].y * H);
          return;
        }
        if (s.points.length < 2) return;

        if (s.tool === 'arrow') {
          const p1 = s.points[0], p2 = s.points[s.points.length - 1];
          const x1 = p1.x * W, y1 = p1.y * H, x2 = p2.x * W, y2 = p2.y * H;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const hl = ctx.lineWidth * 5;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - hl * Math.cos(angle - Math.PI / 6), y2 - hl * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - hl * Math.cos(angle + Math.PI / 6), y2 - hl * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(s.points[0].x * W, s.points[0].y * H);
          s.points.slice(1).forEach(p => ctx.lineTo(p.x * W, p.y * H));
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
    };

    drawList(publicStrokes);
    if (isOrganizer && showDraft) drawList(draftStrokes);
    if (currentStroke) drawList([currentStroke]);
  }, [publicStrokes, draftStrokes, currentStroke, showDraft, isOrganizer]);

  // Resize canvas to match container
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const sync = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      render();
    };
    const obs = new ResizeObserver(sync);
    obs.observe(wrap);
    sync();
    return () => obs.disconnect();
  }, [render]);

  useEffect(() => { render(); }, [render]);

  // --- Pointer handlers ---
  const onStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isOrganizer) return;
    e.preventDefault();
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;

    if (tool === 'text') {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextPos({ x: pos.x * rect.width, y: pos.y * rect.height });
      setTextValue('');
      return;
    }

    setIsDrawing(true);
    setCurrentStroke({
      id: Date.now().toString(),
      tool,
      color,
      size: tool === 'marker' ? 0.025 : 0.006,
      opacity: tool === 'marker' ? 0.35 : 1,
      points: [pos],
    });
  }, [isOrganizer, tool, color, getPos]);

  const onMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const pos = getPos(e.nativeEvent as MouseEvent | TouchEvent);
    if (!pos) return;
    setCurrentStroke(prev => prev ? {
      ...prev,
      points: tool === 'arrow' ? [prev.points[0], pos] : [...prev.points, pos],
    } : null);
  }, [isDrawing, currentStroke, tool, getPos]);

  const onEnd = useCallback(() => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    if (currentStroke.points.length >= 2) {
      const next = [...draftStrokes, currentStroke];
      setDraftStrokes(next);
      saveDraft(next);
    }
    setCurrentStroke(null);
  }, [isDrawing, currentStroke, draftStrokes, saveDraft]);

  const confirmText = useCallback(() => {
    if (!textPos || !textValue.trim()) { setTextPos(null); return; }
    const canvas = canvasRef.current!;
    const stroke: Stroke = {
      id: Date.now().toString(),
      tool: 'text', color, size: 0.045, opacity: 1,
      points: [{ x: textPos.x / canvas.clientWidth, y: textPos.y / canvas.clientHeight }],
      text: textValue,
    };
    const next = [...draftStrokes, stroke];
    setDraftStrokes(next);
    saveDraft(next);
    setTextPos(null);
  }, [textPos, textValue, color, draftStrokes, saveDraft]);

  const undo = () => {
    const next = draftStrokes.slice(0, -1);
    setDraftStrokes(next); saveDraft(next);
  };

  const clear = () => { setDraftStrokes([]); saveDraft([]); };

  const publish = async () => {
    await fetch(`${BASE_URL}/api/sessions/${sessionId}/annotations/${slideNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strokes: draftStrokes, publish: true }),
    });
    setPublished(true);
    setTimeout(() => setPublished(false), 2000);
  };

  const hasDraft = draftStrokes.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, zIndex: 10,
      pointerEvents: isOrganizer ? 'auto' : 'none' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', touchAction: 'none',
          cursor: isOrganizer ? (tool === 'text' ? 'text' : 'crosshair') : 'default' }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />

      {/* Text input overlay */}
      {textPos && (
        <input
          autoFocus
          style={{
            position: 'absolute', left: textPos.x, top: textPos.y,
            background: 'rgba(0,0,0,0.6)', border: `2px dashed ${color}`,
            borderRadius: 4, color, fontSize: 18, fontWeight: 700,
            padding: '2px 6px', minWidth: 120, zIndex: 20, outline: 'none',
          }}
          value={textValue}
          onChange={e => setTextValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmText(); if (e.key === 'Escape') setTextPos(null); }}
          onBlur={confirmText}
        />
      )}

      {/* Toolbar — only for organizer */}
      {isOrganizer && (
        <div className="ann-toolbar">
          {/* Tool buttons */}
          <div className="ann-group">
            {([
              { t: 'pen' as Tool, Icon: Pen, label: 'Ручка' },
              { t: 'marker' as Tool, Icon: Highlighter, label: 'Маркер' },
              { t: 'arrow' as Tool, Icon: ArrowRight, label: 'Стрелка' },
              { t: 'text' as Tool, Icon: Type, label: 'Текст' },
            ]).map(({ t, Icon, label }) => (
              <button key={t} className={`ann-btn ${tool === t ? 'active' : ''}`}
                onClick={() => setTool(t)} title={label}>
                <Icon size={16} />
                <span className="ann-label">{label}</span>
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="ann-group">
            {COLORS.map(c => (
              <button key={c} className={`ann-color ${color === c ? 'active' : ''}`}
                style={{ background: c }} onClick={() => setColor(c)} title={c} />
            ))}
          </div>

          {/* Actions */}
          <div className="ann-group">
            <button className="ann-btn" onClick={undo} disabled={!hasDraft} title="Отменить">
              <Undo2 size={16} />
            </button>
            <button className="ann-btn" onClick={clear} disabled={!hasDraft} title="Очистить всё">
              <Trash2 size={16} />
            </button>
            <button className="ann-btn" onClick={() => setShowDraft(s => !s)} title={showDraft ? 'Скрыть черновик' : 'Показать черновик'}>
              {showDraft ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button className="ann-btn publish" onClick={publish} disabled={!hasDraft} title="Показать всем">
              <Send size={16} />
              <span className="ann-label">{published ? 'Отправлено!' : 'Показать всем'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

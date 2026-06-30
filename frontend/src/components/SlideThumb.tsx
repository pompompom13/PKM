import { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { Stroke } from './AnnotationCanvas';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface Props {
  pdfUrl: string;
  page: number;
  width?: number;
  strokes?: Stroke[];
}

export function SlideThumb({ pdfUrl, page, width = 140, strokes = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    pdfjsLib.getDocument(pdfUrl).promise.then(async doc => {
      if (cancelled) return;
      const p = await doc.getPage(page);
      const vp = p.getViewport({ scale: 1 });
      const scale = width / vp.width;
      const sv = p.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = sv.width;
      canvas.height = sv.height;
      await p.render({ canvasContext: canvas.getContext('2d')!, viewport: sv }).promise;
      if (strokes.length > 0 && overlayRef.current) {
        const oc = overlayRef.current;
        oc.width = sv.width;
        oc.height = sv.height;
        drawStrokes(oc, strokes);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pdfUrl, page, width, strokes]);

  return (
    <div style={{ position: 'relative', width, flexShrink: 0, borderRadius: 6, overflow: 'hidden', border: '2px solid var(--border)', background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
      {strokes.length > 0 && (
        <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}
    </div>
  );
}

function drawStrokes(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  strokes.forEach(s => {
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
}

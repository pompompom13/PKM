import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface Props {
  pdfUrl: string;
  currentPage: number;
  onTotalPages: (n: number) => void;
  children?: React.ReactNode;
}

export function PresentationViewer({ pdfUrl, currentPage, onTotalPages, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [rendering, setRendering] = useState(false);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    let cancelled = false;
    pdfjsLib.getDocument(pdfUrl).promise.then(doc => {
      if (!cancelled) {
        setPdfDoc(doc);
        onTotalPages(doc.numPages);
      }
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    setRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const containerWidth = canvas.parentElement?.clientWidth || 800;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth / viewport.width, 2);
      const scaledViewport = page.getViewport({ scale });
      const context = canvas.getContext('2d')!;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const task = page.render({ canvasContext: context, viewport: scaledViewport });
      renderTaskRef.current = task;
      await task.promise;
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== 'RenderingCancelledException') console.error(e);
    } finally {
      setRendering(false);
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  return (
    <div className="slide-canvas-wrap" style={{ position: 'relative' }}>
      {rendering && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', zIndex: 1 }}>
          <div className="spinner" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 'auto' }} />
      {children}
    </div>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil,
  Eraser,
  Minus,
  Square,
  Circle,
  MoveUpRight,
  Type,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Lock,
  Unlock,
  AlertCircle
} from 'lucide-react';

const PRESET_COLORS = [
  '#ffffff',
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#94a3b8'
];

const PRESET_SIZES = [2, 4, 8, 16];

const Whiteboard = ({
  meetingId,
  socket,
  currentUser,
  isHost = false,
  onClose
}) => {
  // Tool state
  const [activeTool, setActiveTool] = useState('pencil'); // 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'arrow' | 'text'
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [brushSize, setBrushSize] = useState(4);
  const [zoom, setZoom] = useState(1);
  const [panOffset] = useState({ x: 0, y: 0 });

  // Whiteboard drawing elements
  const [elements, setElements] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockWarning, setLockWarning] = useState('');

  // Live peer cursors & active in-progress peer drawing
  const [peerCursors, setPeerCursors] = useState({}); // userId -> { x, y, userName }
  const peerDrawingsRef = useRef({}); // elementId -> in-progress element

  // Inline text input state
  const [textInput, setTextInput] = useState(null); // { x, y, canvasX, canvasY }
  const [textValue, setTextValue] = useState('');

  // Canvas refs
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentElementRef = useRef(null);
  const lastCursorEmitRef = useRef(0);
  const lastStepEmitRef = useRef(0);

  // 1. Convert client coordinates to virtual canvas coordinates
  const getCanvasCoords = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;
      return {
        x: (rawX - panOffset.x) / zoom,
        y: (rawY - panOffset.y) / zoom
      };
    },
    [panOffset.x, panOffset.y, zoom]
  );

  // 2. Draw element primitive on canvas context
  const renderElement = useCallback((ctx, elem) => {
    if (!elem) return;
    ctx.save();
    ctx.strokeStyle = elem.type === 'eraser' ? '#0f172a' : elem.color || '#3b82f6';
    ctx.fillStyle = elem.color || '#3b82f6';
    ctx.lineWidth = elem.size || 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (elem.type) {
      case 'pencil':
      case 'eraser': {
        const points = elem.points || [];
        if (points.length < 2) {
          if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0].x, points[0].y, elem.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(elem.startX, elem.startY);
        ctx.lineTo(elem.endX, elem.endY);
        ctx.stroke();
        break;
      }
      case 'rectangle': {
        const x = Math.min(elem.startX, elem.endX);
        const y = Math.min(elem.startY, elem.endY);
        const w = Math.abs(elem.endX - elem.startX);
        const h = Math.abs(elem.endY - elem.startY);
        ctx.beginPath();
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'circle': {
        const centerX = (elem.startX + elem.endX) / 2;
        const centerY = (elem.startY + elem.endY) / 2;
        const radiusX = Math.abs(elem.endX - elem.startX) / 2;
        const radiusY = Math.abs(elem.endY - elem.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const { startX, startY, endX, endY } = elem;
        const headLength = Math.max(12, elem.size * 3);
        const angle = Math.atan2(endY - startY, endX - startX);

        // Draw main shaft
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = `${Math.max(14, elem.size * 3.5)}px sans-serif`;
        ctx.fillText(elem.text || '', elem.startX, elem.startY);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }, []);

  // 3. Redraw main canvas
  const redrawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Board background (dark SaaS canvas)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Apply zoom & pan transformations
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Render committed elements in order
    elements.forEach((elem) => renderElement(ctx, elem));
    ctx.restore();
  }, [elements, panOffset.x, panOffset.y, renderElement, zoom]);

  // 4. Redraw preview canvas (active user drawing + peer in-progress strokes)
  const redrawPreviewCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Render local active drawing
    if (currentElementRef.current) {
      renderElement(ctx, currentElementRef.current);
    }

    // Render peer active drawings
    Object.values(peerDrawingsRef.current).forEach((peerElem) => {
      renderElement(ctx, peerElem);
    });

    ctx.restore();
  }, [panOffset.x, panOffset.y, renderElement, zoom]);

  // Handle canvas sizing & DPI scaling
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      const mainCanvas = canvasRef.current;
      const previewCanvas = previewCanvasRef.current;
      if (!container || !mainCanvas || !previewCanvas) return;

      const rect = container.getBoundingClientRect();
      const width = Math.max(800, rect.width);
      const height = Math.max(500, rect.height);

      mainCanvas.width = width;
      mainCanvas.height = height;
      previewCanvas.width = width;
      previewCanvas.height = height;

      redrawMainCanvas();
      redrawPreviewCanvas();
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [redrawMainCanvas, redrawPreviewCanvas]);

  // Trigger main canvas redraw when elements or zoom changes
  useEffect(() => {
    redrawMainCanvas();
  }, [redrawMainCanvas]);

  // 5. Socket.IO Real-time Synchronization
  useEffect(() => {
    if (!socket) return;

    // Request initial state on join
    socket.emit('whiteboard-init');

    const handleWhiteboardState = ({ elements: initialElements, isLocked: lockState }) => {
      if (initialElements) setElements(initialElements);
      if (typeof lockState === 'boolean') setIsLocked(lockState);
    };

    const handleDrawStart = ({ element }) => {
      peerDrawingsRef.current[element.id] = element;
      redrawPreviewCanvas();
    };

    const handleDrawStep = ({ elementId, point }) => {
      if (peerDrawingsRef.current[elementId]) {
        peerDrawingsRef.current[elementId].points.push(point);
        redrawPreviewCanvas();
      }
    };

    const handleDrawEnd = ({ element }) => {
      delete peerDrawingsRef.current[element.id];
      setElements((prev) => {
        if (prev.some((e) => e.id === element.id)) return prev;
        return [...prev, element];
      });
      redrawPreviewCanvas();
    };

    const handleCursor = ({ x, y, userName, userId }) => {
      setPeerCursors((prev) => ({
        ...prev,
        [userId]: { x, y, userName, lastUpdated: Date.now() }
      }));
    };

    const handleSync = ({ elements: syncedElements }) => {
      if (syncedElements) {
        setElements(syncedElements);
      }
    };

    const handleCleared = () => {
      setElements([]);
      peerDrawingsRef.current = {};
      redrawPreviewCanvas();
    };

    const handleLockStatus = ({ isLocked: newLockStatus }) => {
      setIsLocked(newLockStatus);
      if (newLockStatus && !isHost) {
        setLockWarning('The meeting host has locked the whiteboard. Drawing is disabled.');
        setTimeout(() => setLockWarning(''), 5000);
      }
    };

    const handleError = ({ message }) => {
      setLockWarning(message);
      setTimeout(() => setLockWarning(''), 4000);
    };

    socket.on('whiteboard-state', handleWhiteboardState);
    socket.on('whiteboard-draw-start', handleDrawStart);
    socket.on('whiteboard-draw-step', handleDrawStep);
    socket.on('whiteboard-draw-end', handleDrawEnd);
    socket.on('whiteboard-cursor', handleCursor);
    socket.on('whiteboard-sync', handleSync);
    socket.on('whiteboard-cleared', handleCleared);
    socket.on('whiteboard-lock-status', handleLockStatus);
    socket.on('whiteboard-error', handleError);

    // Peer cursor cleanup interval (remove cursors inactive for >3s)
    const cursorCleanupInterval = setInterval(() => {
      const now = Date.now();
      setPeerCursors((prev) => {
        let changed = false;
        const next = {};
        Object.entries(prev).forEach(([uid, cursor]) => {
          if (now - cursor.lastUpdated < 3000) {
            next[uid] = cursor;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      socket.off('whiteboard-state', handleWhiteboardState);
      socket.off('whiteboard-draw-start', handleDrawStart);
      socket.off('whiteboard-draw-step', handleDrawStep);
      socket.off('whiteboard-draw-end', handleDrawEnd);
      socket.off('whiteboard-cursor', handleCursor);
      socket.off('whiteboard-sync', handleSync);
      socket.off('whiteboard-cleared', handleCleared);
      socket.off('whiteboard-lock-status', handleLockStatus);
      socket.off('whiteboard-error', handleError);
      clearInterval(cursorCleanupInterval);
    };
  }, [isHost, redrawPreviewCanvas, socket]);

  // 6. Mouse Interaction Handlers
  const handleMouseDown = (e) => {
    if (isLocked && !isHost) {
      setLockWarning('Drawing is disabled by the host.');
      return;
    }

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Text tool: open inline text box
    if (activeTool === 'text') {
      const rect = containerRef.current.getBoundingClientRect();
      setTextInput({
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        canvasX: x,
        canvasY: y
      });
      setTextValue('');
      return;
    }

    isDrawingRef.current = true;
    const elemId = 'elem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const newElement = {
      id: elemId,
      type: activeTool,
      color: activeTool === 'eraser' ? '#0f172a' : selectedColor,
      size: brushSize,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      points: activeTool === 'pencil' || activeTool === 'eraser' ? [{ x, y }] : []
    };

    currentElementRef.current = newElement;
    redrawPreviewCanvas();

    if (socket) {
      socket.emit('whiteboard-draw-start', { element: newElement });
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    // Emit live cursor coordinates (throttled ~50ms)
    const now = Date.now();
    if (socket && now - lastCursorEmitRef.current > 50) {
      lastCursorEmitRef.current = now;
      socket.emit('whiteboard-cursor', { x, y });
    }

    if (!isDrawingRef.current || !currentElementRef.current) return;

    const elem = currentElementRef.current;
    elem.endX = x;
    elem.endY = y;

    if (elem.type === 'pencil' || elem.type === 'eraser') {
      elem.points.push({ x, y });

      // Emit draw step for live freehand syncing (throttled ~25ms)
      if (socket && now - lastStepEmitRef.current > 25) {
        lastStepEmitRef.current = now;
        socket.emit('whiteboard-draw-step', { elementId: elem.id, point: { x, y } });
      }
    }

    redrawPreviewCanvas();
  };

  const handleMouseUp = () => {
    if (!isDrawingRef.current || !currentElementRef.current) return;
    isDrawingRef.current = false;

    const finishedElem = currentElementRef.current;
    currentElementRef.current = null;

    // Discard empty strokes
    if (
      (finishedElem.type === 'pencil' || finishedElem.type === 'eraser') &&
      finishedElem.points.length <= 1
    ) {
      redrawPreviewCanvas();
      return;
    }

    setElements((prev) => [...prev, finishedElem]);
    redrawPreviewCanvas();

    if (socket) {
      socket.emit('whiteboard-draw-end', { element: finishedElem });
    }
  };

  // Submit inline text element
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!textValue.trim() || !textInput) {
      setTextInput(null);
      return;
    }

    const elemId = 'elem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTextElem = {
      id: elemId,
      type: 'text',
      startX: textInput.canvasX,
      startY: textInput.canvasY,
      text: textValue.trim(),
      color: selectedColor,
      size: brushSize
    };

    setElements((prev) => [...prev, newTextElem]);
    setTextInput(null);
    setTextValue('');

    if (socket) {
      socket.emit('whiteboard-draw-end', { element: newTextElem });
    }
  };

  // 7. Action Handlers: Undo, Redo, Clear, Lock, Export
  const handleUndo = () => {
    if (socket) socket.emit('whiteboard-undo');
  };

  const handleRedo = () => {
    if (socket) socket.emit('whiteboard-redo');
  };

  const handleClear = () => {
    if (window.confirm('Clear all drawings on the shared whiteboard?')) {
      if (socket) socket.emit('whiteboard-clear');
    }
  };

  const handleToggleLock = () => {
    if (!isHost) return;
    const nextLock = !isLocked;
    if (socket) {
      socket.emit('whiteboard-toggle-lock', { isLocked: nextLock });
    }
  };

  const handleExportPNG = () => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    // Create high-res offscreen canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = mainCanvas.width;
    exportCanvas.height = mainCanvas.height;
    const ctx = exportCanvas.getContext('2d');

    // Fill with solid dark background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Render all elements
    elements.forEach((elem) => renderElement(ctx, elem));

    const image = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `NEXORA-Whiteboard-${meetingId}-${Date.now()}.png`;
    link.href = image;
    link.click();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-dark-950 overflow-hidden select-none">
      {/* Top Floating Whiteboard Control Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-1.5 p-2 bg-dark-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-slate-850/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTool('pencil')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'pencil' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Pencil (Freehand)"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'eraser' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'line' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Line"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('rectangle')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'rectangle' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'circle' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Circle"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('arrow')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'arrow' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Arrow"
          >
            <MoveUpRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-lg transition cursor-pointer ${
              activeTool === 'text' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Text Tool (Click canvas to place)"
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Color Palette */}
        <div className="flex items-center gap-1.5 px-1.5 py-1 bg-slate-850/80 rounded-xl">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-5 h-5 rounded-full transition transform cursor-pointer border ${
                selectedColor === c ? 'scale-125 border-white ring-2 ring-brand-500/50' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              title={`Color: ${c}`}
            />
          ))}
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value)}
            className="w-5 h-5 rounded-full cursor-pointer bg-transparent border-0 opacity-80 hover:opacity-100"
            title="Custom Color"
          />
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Brush Size Selector */}
        <div className="flex items-center gap-1 bg-slate-850/80 p-1 rounded-xl">
          {PRESET_SIZES.map((sz) => (
            <button
              key={sz}
              onClick={() => setBrushSize(sz)}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                brushSize === sz ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title={`Brush Size ${sz}px`}
            >
              {sz}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Undo, Redo, Clear */}
        <div className="flex items-center gap-1 bg-slate-850/80 p-1 rounded-xl">
          <button
            onClick={handleUndo}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title="Clear Board"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        {/* Zoom & Export */}
        <div className="flex items-center gap-1 bg-slate-850/80 p-1 rounded-xl">
          <button
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-xs font-mono text-slate-300 hover:bg-slate-800 rounded-lg transition"
            title="Reset Zoom (100%)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleExportPNG}
            className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer"
            title="Export Board as PNG"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Host Controls */}
        {isHost && (
          <>
            <div className="h-5 w-px bg-slate-800" />
            <button
              onClick={handleToggleLock}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isLocked
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
              title={isLocked ? 'Unlock whiteboard for all' : 'Lock whiteboard (Host only)'}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'Locked' : 'Open'}</span>
            </button>
          </>
        )}

        {/* Close Button */}
        {onClose && (
          <>
            <div className="h-5 w-px bg-slate-800" />
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              Exit Whiteboard
            </button>
          </>
        )}
      </div>

      {/* Lock Warning Banner */}
      {lockWarning && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
          <div className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs rounded-xl shadow-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{lockWarning}</span>
          </div>
        </div>
      )}

      {/* Main Canvas Viewport Area */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Layer 1: Base Committed Elements Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Layer 2: Overlay Active In-Progress Canvas */}
        <canvas ref={previewCanvasRef} className="absolute inset-0 pointer-events-none" />

        {/* Layer 3: Remote Peer Cursors Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Object.entries(peerCursors).map(([uid, cursor]) => {
            if (uid === (currentUser?.id || currentUser?._id)) return null;
            const screenX = cursor.x * zoom + panOffset.x;
            const screenY = cursor.y * zoom + panOffset.y;

            return (
              <div
                key={uid}
                className="absolute transition-all duration-75 flex items-center gap-1.5"
                style={{
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  transform: 'translate(0px, 0px)'
                }}
              >
                <div className="w-3 h-3 rounded-full bg-brand-400 border-2 border-white shadow-lg animate-ping" />
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-brand-600/90 text-white shadow-md border border-brand-400/30 whitespace-nowrap">
                  {cursor.userName || 'Peer'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Layer 4: Inline Text Input Prompt */}
        {textInput && (
          <form
            onSubmit={handleTextSubmit}
            className="absolute z-30"
            style={{
              left: `${textInput.screenX}px`,
              top: `${textInput.screenY}px`
            }}
          >
            <input
              type="text"
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={handleTextSubmit}
              placeholder="Type text & press Enter..."
              className="bg-dark-900/95 border border-brand-500 rounded-lg px-2.5 py-1 text-xs text-white shadow-xl focus:outline-none"
              style={{
                color: selectedColor,
                fontSize: `${Math.max(12, brushSize * 3)}px`
              }}
            />
          </form>
        )}
      </div>
    </div>
  );
};

export default Whiteboard;


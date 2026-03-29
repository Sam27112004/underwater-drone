import { MODEL_REGISTRY } from '../models/registry.js';

/**
 * AIPanel
 *
 * Floating control bar shown below the video feed controls.
 * Lets the user pick a YOLO model, see load status, FPS, and toggle detection.
 *
 * Props:
 *   selectedModelId   string         — current model id from registry
 *   onModelChange     (id) => void   — called when dropdown changes
 *   isLoading         boolean        — model is loading
 *   error             string | null  — load error message
 *   fps               number         — inference FPS (0 when off)
 *   active            boolean        — detection running
 *   onToggle          () => void     — enable/disable detection
 *   videoConnected    boolean        — whether video feed is live
 */
export default function AIPanel({
  selectedModelId,
  onModelChange,
  isLoading,
  error,
  fps,
  active,
  onToggle,
  videoConnected,
}) {
  const isDisabled = selectedModelId === 'none';
  const canRun     = !isDisabled && !isLoading && !error && videoConnected;

  let statusText  = '—';
  let statusClass = '';
  if (isDisabled)        { statusText = 'DISABLED';  statusClass = 'ai-status-off'; }
  else if (isLoading)    { statusText = 'LOADING…';  statusClass = 'ai-status-loading'; }
  else if (error)        { statusText = 'ERR';       statusClass = 'ai-status-error'; }
  else if (!videoConnected) { statusText = 'NO FEED'; statusClass = 'ai-status-off'; }
  else if (active)       { statusText = 'LIVE';      statusClass = 'ai-status-live'; }
  else                   { statusText = 'READY';     statusClass = 'ai-status-ready'; }

  return (
    <div className="ai-panel hover-target">
      {/* ── Label ── */}
      <span className="ai-panel-label">AI</span>

      {/* ── Model dropdown ── */}
      <select
        className="mono-select ai-model-select hover-target"
        value={selectedModelId}
        onChange={e => onModelChange(e.target.value)}
      >
        {MODEL_REGISTRY.map(m => (
          <option key={m.id} value={m.id}>{m.label}</option>
        ))}
      </select>

      {/* ── Status badge ── */}
      <span className={`ai-status-badge ${statusClass}`}>{statusText}</span>

      {/* ── FPS counter (only when active) ── */}
      {active && !isDisabled && (
        <span className="ai-fps">{fps}<span className="ai-fps-unit">/s</span></span>
      )}

      {/* ── Error detail ── */}
      {error && (
        <span className="ai-error" title={error}>
          {error.length > 40 ? error.slice(0, 38) + '…' : error}
        </span>
      )}

      {/* ── Toggle button ── */}
      <button
        className={`btn ai-toggle-btn hover-target ${active ? 'ai-toggle-active' : ''}`}
        onClick={onToggle}
        disabled={!canRun && !active}
        title={
          !videoConnected ? 'Connect video feed first'
          : isLoading     ? 'Model loading…'
          : error         ? error
          : isDisabled    ? 'Select a model first'
          : active        ? 'Stop detection'
          :                 'Start detection'
        }
      >
        {active ? '[ STOP ]' : '[ DETECT ]'}
      </button>
    </div>
  );
}

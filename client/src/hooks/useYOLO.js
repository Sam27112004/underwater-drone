import { useState, useEffect, useRef, useCallback } from 'react';
import * as ort from 'onnxruntime-web';

// ── WASM backend config ──────────────────────────────────────────────────────
// Vite automatically bundles onnxruntime-web's WASM files into public/assets/.
// No custom wasmPaths needed. Single-threaded avoids SharedArrayBuffer COEP issues.
ort.env.wasm.numThreads = 1;

// ── NMS helpers ──────────────────────────────────────────────────────────────

function iou(a, b) {
  const xA = Math.max(a[0], b[0]), yA = Math.max(a[1], b[1]);
  const xB = Math.min(a[2], b[2]), yB = Math.min(a[3], b[3]);
  const inter = Math.max(0, xB - xA) * Math.max(0, yB - yA);
  if (inter === 0) return 0;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  return inter / (areaA + areaB - inter);
}

function nms(boxes, scores, iouThreshold) {
  const order = Array.from({ length: scores.length }, (_, i) => i)
    .sort((a, b) => scores[b] - scores[a]);
  const keep = [];
  const suppressed = new Set();
  for (const i of order) {
    if (suppressed.has(i)) continue;
    keep.push(i);
    for (const j of order) {
      if (j <= i || suppressed.has(j)) continue;
      if (iou(boxes[i], boxes[j]) > iouThreshold) suppressed.add(j);
    }
  }
  return keep;
}

// ── Frame → Float32 tensor ────────────────────────────────────────────────────

function sourceToTensor(source, inputSize) {
  const offscreen = document.createElement('canvas');
  offscreen.width = inputSize;
  offscreen.height = inputSize;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, inputSize, inputSize);
  const { data } = ctx.getImageData(0, 0, inputSize, inputSize); // RGBA uint8

  const n = inputSize * inputSize;
  const float32 = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    float32[i]         = data[i * 4]     / 255; // R plane
    float32[n + i]     = data[i * 4 + 1] / 255; // G plane
    float32[2 * n + i] = data[i * 4 + 2] / 255; // B plane
  }
  return new ort.Tensor('float32', float32, [1, 3, inputSize, inputSize]);
}

// ── YOLOv8/v11 output → detections ──────────────────────────────────────────
// Output shape: [1, 4+numClasses, 8400]  (cx cy w h class0 class1 ...)

function parseOutput(output, confThreshold, iouThreshold, classes) {
  const [, numAttrs, numAnchors] = output.dims;
  const numClasses = numAttrs - 4;
  const data = output.data;

  const rawBoxes = [], rawScores = [], rawClassIds = [];

  for (let i = 0; i < numAnchors; i++) {
    let maxScore = 0, maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * numAnchors + i];
      if (s > maxScore) { maxScore = s; maxClass = c; }
    }
    if (maxScore < confThreshold) continue;

    // cx cy w h in model-input pixel space → normalised 0-1
    const inputSize = Math.round(Math.sqrt(numAnchors)); // approximate
    const cx = data[0 * numAnchors + i];
    const cy = data[1 * numAnchors + i];
    const w  = data[2 * numAnchors + i];
    const h  = data[3 * numAnchors + i];

    // We don't know inputSize from output alone, so use raw coords and
    // normalise after by the actual session inputSize stored in the ref.
    rawBoxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]);
    rawScores.push(maxScore);
    rawClassIds.push(maxClass);
  }

  const keepIdx = nms(rawBoxes, rawScores, iouThreshold);

  return keepIdx.map(i => ({
    x1: rawBoxes[i][0],
    y1: rawBoxes[i][1],
    x2: rawBoxes[i][2],
    y2: rawBoxes[i][3],
    score: rawScores[i],
    classId: rawClassIds[i],
    label: classes[rawClassIds[i]] ?? `cls_${rawClassIds[i]}`,
  }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useYOLO(modelConfig)
 *
 * modelConfig: one entry from MODEL_REGISTRY, or null/undefined to disable.
 *
 * Returns:
 *   isLoading   boolean — model is being fetched/compiled
 *   error       string | null
 *   runInference(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement)
 *               → Promise<Detection[]>  (resolves to [] when not ready)
 */
export default function useYOLO(modelConfig) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState(null);
  const sessionRef                = useRef(null);
  const inputSizeRef              = useRef(640);
  const modelIdRef                = useRef(null);

  useEffect(() => {
    const id = modelConfig?.id ?? 'none';

    // Unchanged model or disabled
    if (id === modelIdRef.current) return;
    modelIdRef.current = id;

    // Release old session
    sessionRef.current?.release?.().catch(() => {});
    sessionRef.current = null;
    setError(null);

    if (!modelConfig?.path) return; // 'none' selected

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const session = await ort.InferenceSession.create(modelConfig.path, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all',
        });
        if (cancelled) { session.release?.(); return; }
        sessionRef.current = session;
        inputSizeRef.current = modelConfig.inputSize ?? 640;
        setIsLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message ?? String(e));
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [modelConfig]);

  const runInference = useCallback(async (source) => {
    const session = sessionRef.current;
    if (!session || !modelConfig) return [];

    try {
      const inputSize = inputSizeRef.current;
      const tensor = sourceToTensor(source, inputSize);

      const inputName = session.inputNames[0];
      const feeds = { [inputName]: tensor };
      const results = await session.run(feeds);
      const outputName = session.outputNames[0];
      const output = results[outputName];

      // Normalise box coords from model-pixel-space to 0-1
      const detections = parseOutput(
        output,
        modelConfig.confThreshold,
        modelConfig.iouThreshold,
        modelConfig.classes,
      );

      // output bbox coords are in 0..inputSize space; divide by inputSize
      return detections.map(d => ({
        ...d,
        x1: d.x1 / inputSize,
        y1: d.y1 / inputSize,
        x2: d.x2 / inputSize,
        y2: d.y2 / inputSize,
      }));
    } catch (e) {
      console.error('[useYOLO] inference error', e);
      return [];
    }
  }, [modelConfig]);

  return { isLoading, error, runInference };
}

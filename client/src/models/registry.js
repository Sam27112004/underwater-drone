/**
 * MODEL REGISTRY
 * ──────────────
 * To add a new model:
 *   1. Export it to ONNX:  yolo export model=yourmodel.pt format=onnx imgsz=640 simplify=True
 *   2. Place the .onnx file in  client/public/models/
 *   3. Add an entry below — the dropdown updates automatically.
 *
 * Required fields:
 *   id            unique string key
 *   label         shown in the dropdown
 *   path          URL path to .onnx (served from public/models/)
 *   inputSize     model input dimension (square), typically 640
 *   confThreshold minimum confidence to show a detection (0-1)
 *   iouThreshold  NMS IoU threshold (0-1)
 *   classes       array of class name strings
 *   description   short tooltip / info text
 */

export const COCO_CLASSES = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat',
  'traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat',
  'dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack',
  'umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball',
  'kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket',
  'bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
  'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair',
  'couch','potted plant','bed','dining table','toilet','tv','laptop','mouse',
  'remote','keyboard','cell phone','microwave','oven','toaster','sink',
  'refrigerator','book','clock','vase','scissors','teddy bear','hair drier',
  'toothbrush',
];

export const MODEL_REGISTRY = [
  // ── Disabled ────────────────────────────────────────────────────────────────
  {
    id: 'none',
    label: '[ DISABLED ]',
    path: null,
    inputSize: null,
    confThreshold: null,
    iouThreshold: null,
    classes: [],
    description: 'AI detection off',
  },

  // ── General Purpose ──────────────────────────────────────────────────────────
  {
    id: 'yolo11n-coco',
    label: 'YOLOv11n — COCO (general)',
    path: '/models/yolo11n.onnx',
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: COCO_CLASSES,
    description: 'General-purpose detection, 80 COCO classes. Fast.',
  },
  {
    id: 'yolo11s-coco',
    label: 'YOLOv11s — COCO (general, higher accuracy)',
    path: '/models/yolo11s.onnx',
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: COCO_CLASSES,
    description: 'Higher accuracy COCO detection. Slower than nano.',
  },

  // ── Marine / Underwater Life ─────────────────────────────────────────────────
  {
    id: 'yolo11n-brackish',
    label: 'YOLOv11n — Brackish (marine life)',
    path: '/models/yolo11n-brackish.onnx',
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: ['fish', 'crab', 'shrimp', 'jellyfish', 'starfish'],
    description: 'Brackish Underwater dataset: fish, crab, shrimp, jellyfish, starfish.',
  },
  {
    id: 'yolo11n-urpc',
    label: 'YOLOv11n — URPC (marine fauna)',
    path: '/models/yolo11n-urpc.onnx',
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: ['holothurian', 'echinus', 'scallop', 'starfish'],
    description: 'URPC2019: sea cucumber, sea urchin, scallop, starfish.',
  },

  // ── Infrastructure / Inspection ──────────────────────────────────────────────
  {
    id: 'yolo11n-crack',
    label: 'YOLOv11n — Crack Detection',
    path: '/models/yolo11n-crack.onnx',
    inputSize: 640,
    confThreshold: 0.40,
    iouThreshold: 0.45,
    classes: ['crack', 'corrosion', 'spalling'],
    description: 'Underwater infrastructure defect detection (dams, bridges, pipes).',
  },
  {
    id: 'yolo11n-pipeline',
    label: 'YOLOv11n — Subsea Pipeline',
    path: '/models/yolo11n-pipeline.onnx',
    inputSize: 640,
    confThreshold: 0.40,
    iouThreshold: 0.45,
    classes: ['pipe', 'crack', 'corrosion', 'joint', 'anode'],
    description: 'Subsea pipeline inspection: corrosion, cracks, joints.',
  },
];

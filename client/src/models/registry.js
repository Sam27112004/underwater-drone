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
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
];

export const MODEL_REGISTRY = [
  // ── Disabled ────────────────────────────────────────────────────────────────
  {
    id: "none",
    label: "[ DISABLED ]",
    path: null,
    inputSize: null,
    confThreshold: null,
    iouThreshold: null,
    classes: [],
    description: "AI detection off",
  },

  // ── General Purpose ──────────────────────────────────────────────────────────
  {
    id: "yolo11n-coco",
    label: "YOLOv11n — COCO (general)",
    path: "/models/yolo11n.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: COCO_CLASSES,
    description: "General-purpose detection, 80 COCO classes. Fast.",
  },

  // ── Marine / Underwater Life ─────────────────────────────────────────────────
  {
    id: "yolov8s-marine",
    label: "YOLOv8s — Marine Ecosystem (custom trained)",
    path: "/models/yolov8s-marine.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: [
      "fish",
      "shark",
      "jellyfish",
      "starfish",
      "stingray",
      "coral",
      "crab",
      "penguin",
      "puffin",
    ],
    description: "Custom-trained YOLOv8s — 9 marine classes. mAP@0.5 ~78%.",
  },
  {
    id: "fathomnet-trash",
    label: "FathomNet — Marine Debris + Sea Life (YOLOv8x)",
    path: "/models/fathomnet-trash.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: [
      "trash",
      "eel",
      "rov",
      "starfish",
      "fish",
      "crab",
      "plant",
      "animal_misc",
      "shells",
      "bird",
      "shark",
      "jellyfish",
      "ray",
    ],
    description:
      "FathomNet pretrained YOLOv8x — 13 classes: marine debris + sea life. Trained on 8 combined MBARI/ocean datasets.",
  },

  // ── Trash / Debris ────────────────────────────────────────────────────────────
  {
    id: "yolov8s-trash",
    label: "YOLOv8s — Underwater Trash (custom trained)",
    path: "/models/yolov8s-trash.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: ["trash", "bio", "rov"],
    description: "Custom-trained YOLOv8s — trash, bio, rov. mAP@0.5 96.6%.",
  },

  // ── Infrastructure / Inspection ──────────────────────────────────────────────
  {
    id: "crack_detector_model",
    label: "Custom — Crack Detector Model",
    path: "/models/crack_detector_model.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: ["crack"],
    description: "Custom crack detector model.",
  },
  {
    id: "yolo11n-crack",
    label: "YOLOv11n — Crack Detection",
    path: "/models/yolo11n-crack.onnx",
    inputSize: 640,
    confThreshold: 0.35,
    iouThreshold: 0.45,
    classes: ["crack"],
    description: "YOLOv11 nano — lightweight and fast crack detection model.",
  },
  {
    id: "yolov8x-crack-seg",
    label: "YOLOv8x — Crack Segmentation",
    path: "/models/yolov8x-crack-seg.onnx",
    inputSize: 640,
    confThreshold: 0.4,
    iouThreshold: 0.45,
    classes: ["crack"],
    description:
      "YOLOv8x segmentation — detects and outlines cracks on underwater structures.",
  },
];

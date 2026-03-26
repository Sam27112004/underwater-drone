# Model Files

Place `.onnx` model files here. They are served as static assets at `/models/<filename>`.

## How to export a YOLOv8/v11 model to ONNX

```bash
pip install ultralytics
yolo export model=yolo11n.pt format=onnx imgsz=640 simplify=True
```

## Recommended starter models

| File | Download | Description |
|---|---|---|
| `yolo11n.onnx` | `yolo export model=yolo11n.pt format=onnx` | General COCO 80-class detection |
| `yolo11n-brackish.onnx` | Fine-tune on Brackish Underwater dataset | Fish, crab, shrimp, jellyfish |
| `yolo11n-crack.onnx` | Fine-tune on Underwater Crack Detection | Crack, corrosion, spalling |

## Adding a new model

1. Export/place the `.onnx` file here
2. Add an entry to `client/src/models/registry.js`
3. That's it — the dropdown updates automatically

## Files in this directory are gitignored (large binaries)

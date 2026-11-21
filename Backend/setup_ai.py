"""Install and verify the pinned RDD2022 YOLOv8s model for RoadWatch."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
ENVIRONMENT = BACKEND / ".venv-ai"
PYTHON = ENVIRONMENT / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
MODEL = BACKEND / "models" / "road_damage_yolov8s.pt"
REPOSITORY = "SreekarAditya/yolo-rdd2022-benchmark"
REVISION = "885af172a1a1fa4e980627b63bb0b23c43439168"
REMOTE_FILE = "yolo-rdd2022-benchmark/yolov8s_seed0_best.pt"
MODEL_URL = f"https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{REMOTE_FILE}"
EXPECTED_SHA256 = "565aae6915e34e4f7f4c44dac0bdcf9fff21b83c4adc74cc97ca09cc31882ce8"
MAX_DOWNLOAD = 64 * 1024 * 1024


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def check_model(path: Path) -> None:
    if not path.is_file():
        raise RuntimeError(f"Trained model is missing: {path}. Run SETUP_AI_AND_START.cmd.")
    if digest(path) != EXPECTED_SHA256:
        raise RuntimeError(
            f"Model checksum does not match the pinned pretrained weights: {path}. "
            "Move that file aside, then rerun SETUP_AI_AND_START.cmd."
        )


def download_model() -> None:
    if MODEL.exists():
        check_model(MODEL)
        print("Verified existing model; download skipped.", flush=True)
        return
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(MODEL_URL, headers={"User-Agent": "RoadWatch-AI-Setup/1.0"})
    temporary = None
    print("Downloading pretrained RDD2022 YOLOv8s weights (about 22.5 MB)...", flush=True)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError(f"Model download returned HTTP {response.status}.")
            size = int(response.headers.get("Content-Length", "0"))
            if size > MAX_DOWNLOAD:
                raise RuntimeError("Unexpected model download size.")
            with tempfile.NamedTemporaryFile(dir=MODEL.parent, suffix=".part", delete=False) as stream:
                temporary = Path(stream.name)
                received = 0
                for chunk in iter(lambda: response.read(1024 * 1024), b""):
                    received += len(chunk)
                    if received > MAX_DOWNLOAD:
                        raise RuntimeError("Model download exceeded the expected size limit.")
                    stream.write(chunk)
                    print(f"\rDownloaded {received / (1024 * 1024):.1f} MB", end="", flush=True)
        print(flush=True)
        check_model(temporary)
        os.replace(temporary, MODEL)
        temporary = None
        print("Download complete; SHA-256 verified.", flush=True)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(
            "Could not download the pretrained model. Check your internet connection. "
            f"Model source: {MODEL_URL}\nDetails: {exc}"
        ) from exc
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def compatible_python() -> list[str]:
    candidates = [["py", "-3.12"], ["py", "-3.13"], ["py", "-3.11"], [sys.executable], ["py", "-3.14"]]
    local = os.environ.get("LOCALAPPDATA")
    if local:
        for version in ("312", "313", "311", "314"):
            candidates.append([str(Path(local) / "Programs" / "Python" / f"Python{version}" / "python.exe")])
    probe = "import sys,struct;sys.exit(0 if (3,11)<=sys.version_info[:2]<=(3,14) and struct.calcsize('P')==8 else 1)"
    for command in candidates:
        try:
            result = subprocess.run(command + ["-c", probe], capture_output=True, timeout=20)
            if result.returncode == 0:
                return command
        except (OSError, subprocess.TimeoutExpired):
            continue
    raise RuntimeError(
        "64-bit Python 3.11 through 3.14 is required for this AI setup. "
        "Install 64-bit Python 3.12 from https://www.python.org/downloads/ and retry."
    )


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def verify_model() -> dict:
    check_model(MODEL)
    os.environ["ROAD_MODEL_PATH"] = str(MODEL)
    os.environ.setdefault("YOLO_CONFIG_DIR", str(BACKEND / ".yolo"))
    os.environ.setdefault("YOLO_OFFLINE", "true")
    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))
    import main
    from fastapi import UploadFile
    from io import BytesIO
    from PIL import Image

    detector = main.load_detector(str(MODEL))
    names = list(detector.names.values()) if isinstance(detector.names, dict) else list(detector.names)
    mapped = [main.model_damage(str(name)) for name in names]
    required = {"Longitudinal crack", "Transverse crack", "Alligator crack", "Pothole"}
    if set(mapped) != required or len(names) != 4:
        raise RuntimeError(f"Unexpected model classes: {names}. This model is not compatible with the app.")
    print("Model classes:", ", ".join(str(name) for name in names), flush=True)
    # A neutral synthetic image checks execution only; it does not measure accuracy.
    image = Image.new("RGB", (640, 640), (128, 128, 128))
    stream = BytesIO()
    image.save(stream, format="JPEG")
    response = main.detect(UploadFile(BytesIO(stream.getvalue()), filename="runtime-check.jpg"))
    if not isinstance(response.get("detections"), list):
        raise RuntimeError("The app detection adapter returned an unexpected response.")
    result = {
        "repository": REPOSITORY,
        "revision": REVISION,
        "remote_file": REMOTE_FILE,
        "sha256": digest(MODEL),
        "classes": names,
        "versions": {
            name: importlib.metadata.version(name)
            for name in ("torch", "torchvision", "ultralytics", "fastapi", "Pillow")
        },
        "verification": "Model loaded and the actual backend detection adapter ran on a synthetic gray image. This is not an accuracy evaluation.",
    }
    (MODEL.parent / "ai_ready.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("PASS: pinned weights, all four class mappings, and actual backend inference.", flush=True)
    return result


def setup() -> None:
    if not (BACKEND / "main.py").is_file() or not (ROOT / "RoadWatch" / "dist" / "index.html").is_file():
        raise RuntimeError("Extract this complete app first. Backend/main.py and RoadWatch/dist/index.html must be present.")
    # Download before installing the larger runtime, so a network failure is reported promptly.
    download_model()
    if not PYTHON.is_file():
        interpreter = compatible_python()
        print("Creating a separate AI Python environment...", flush=True)
        run(interpreter + ["-m", "venv", str(ENVIRONMENT)])
    ready = MODEL.parent / "ai_ready.json"
    if ready.is_file():
        result = subprocess.run([str(PYTHON), str(Path(__file__).resolve()), "--verify"], cwd=ROOT)
        if result.returncode == 0:
            print("Existing AI environment is ready.", flush=True)
            return
    print("Installing CPU PyTorch. This may download several hundred MB...", flush=True)
    run([str(PYTHON), "-m", "pip", "install", "--upgrade", "pip"])
    run([str(PYTHON), "-m", "pip", "install", "--only-binary=:all:",
         "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cpu"])
    run([str(PYTHON), "-m", "pip", "install", "-r", str(BACKEND / "requirements-ai.txt"), "--extra-index-url", "https://download.pytorch.org/whl/cpu"])
    run([str(PYTHON), str(Path(__file__).resolve()), "--verify"])
    print("AI setup completed. Use START_AI.cmd for future launches.", flush=True)


def main_cli() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Verify downloaded weights and run actual backend inference.")
    parser.add_argument("--download-only", action="store_true", help="Download and checksum the trained weights without installing packages.")
    args = parser.parse_args()
    try:
        if args.verify:
            verify_model()
        elif args.download_only:
            download_model()
        else:
            setup()
    except (RuntimeError, OSError, subprocess.SubprocessError, ImportError) as exc:
        print(f"\nRoadWatch AI setup failed: {exc}", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main_cli())


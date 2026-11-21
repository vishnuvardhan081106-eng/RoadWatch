import logging
import os
import re
import sqlite3
import warnings
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from functools import lru_cache
from threading import Lock
from typing import Annotated, Literal
from uuid import UUID

from fastapi import FastAPI, Form, HTTPException, Query, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps
from pydantic import AwareDatetime, BaseModel, Field, ValidationError, model_validator

Database = Path(os.getenv("ROAD_REPORT_DB", Path(__file__).parent / "reports.sqlite3"))
PhotoLimit = 8 * 1024 * 1024
ModelLock = Lock()
DamageType = Literal['Pothole', 'Longitudinal crack', 'Transverse crack', 'Alligator crack', 'Surface damage', 'Crack']

_env_file = Path(__file__).parent / ".env"
def get_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if key:
        return key
    if _env_file.is_file():
        try:
            for _l in _env_file.read_text(encoding="utf-8").splitlines():
                _l = _l.strip()
                if _l and not _l.startswith("#") and "=" in _l:
                    _k, _, _v = _l.partition("=")
                    _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
                    if _k == "GEMINI_API_KEY" and _v:
                        os.environ["GEMINI_API_KEY"] = _v
                        return _v
        except Exception:
            pass
    return ""

if _env_file.is_file():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            _k, _v = _k.strip(), _v.strip().strip('"').strip("'")
            if _k and _v and _k not in os.environ:
                os.environ[_k] = _v


class Detection(BaseModel):
    label: Literal["pothole", "crack", "surface_damage"]
    confidence: float = Field(ge=0, le=1)
    left: float = Field(ge=0, le=1)
    top: float = Field(ge=0, le=1)
    right: float = Field(ge=0, le=1)
    bottom: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def check_box(self):
        if self.left >= self.right or self.top >= self.bottom:
            raise ValueError("Bounding box must have positive width and height")
        return self


class Submission(BaseModel):
    id: UUID
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_source: Literal["gps", "manual"]
    captured_at: AwareDatetime
    note: str = Field(default="", max_length=1000)
    detections: list[Detection] = Field(default_factory=list, max_length=100)
    address: str = Field(default="", max_length=200)
    damage_type: DamageType | None = None
    severity: Literal['Low', 'Medium', 'High'] = 'Medium'
    source: Literal['model', 'manual', 'demo'] = 'model'
    confidence: float | None = Field(default=None, ge=0, le=1)

    @model_validator(mode='after')
    def classification_required(self):
        if not self.detections and not self.damage_type:
            raise ValueError('Provide detections or a reviewed damage_type')
        if self.source == 'manual':
            self.confidence = None
            if self.detections:
                raise ValueError('Manual reports must not contain model bounding boxes')
        return self


class Report(Submission):
    saved_at: AwareDatetime
    photo_url: str
    status: Literal['Submitted', 'In review', 'Resolved'] = 'Submitted'


class StatusUpdate(BaseModel):
    status: Literal['Submitted', 'In review', 'Resolved']


@asynccontextmanager
async def lifespan(app: FastAPI):
    Database.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(Database)) as db, db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                metadata TEXT NOT NULL,
                photo BLOB NOT NULL,
                mime_type TEXT NOT NULL,
                saved_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS report_order ON reports(saved_at DESC, id DESC)")
        columns = {row[1] for row in db.execute('PRAGMA table_info(reports)')}
        if 'status' not in columns:
            db.execute("ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'Submitted'")
    model_path = os.getenv('ROAD_MODEL_PATH', '')
    if model_path and Path(model_path).is_file():
        try:
            load_detector(model_path)
        except Exception:
            pass
    yield


app = FastAPI(title="Road Damage Reporting API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=False,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['Location'],
)


def serialize(metadata: str, saved_at: str, status: str = 'Submitted') -> Report:
    submission = Submission.model_validate_json(metadata)
    return Report(
        **submission.model_dump(),
        saved_at=saved_at,
        photo_url=f"/api/v1/reports/{submission.id}/photo",
        status=status,
    )


def validate_photo(photo: UploadFile) -> tuple[bytes, str]:
    try:
        content = photo.file.read(PhotoLimit + 1)
    finally:
        photo.file.close()
    if len(content) > PhotoLimit:
        raise HTTPException(413, "Photo exceeds 8 MiB")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                mime_type = {"JPEG": "image/jpeg", "PNG": "image/png"}.get(image.format)
                if mime_type is None:
                    raise HTTPException(415, "Use a JPEG or PNG photo")
                if image.width * image.height > 24_000_000:
                    raise HTTPException(413, "Photo exceeds 24 megapixels")
                image.load()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(413, "Photo exceeds the supported dimensions") from exc
    except (OSError, ValueError, SyntaxError) as exc:
        raise HTTPException(415, "Photo must be a valid JPEG or PNG") from exc

    return content, mime_type


@app.get("/health")
def health():
    model_path = os.getenv('ROAD_MODEL_PATH', '')
    gemini_key = get_gemini_key()
    configured = bool(gemini_key or (model_path and Path(model_path).is_file()))
    provider = "gemini" if gemini_key else "yolo" if (model_path and Path(model_path).is_file()) else None
    try:
        with closing(sqlite3.connect(Database)) as db:
            db.execute('SELECT 1 FROM reports LIMIT 1')
    except sqlite3.Error as exc:
        raise HTTPException(503, 'The report database is unavailable') from exc
    return {"status": "ok", 'api_version': 2, 'reporting': True, 'detector_configured': configured, 'ai_provider': provider}


def detect_with_gemini(content: bytes, api_key: str) -> dict:
    import base64
    import json
    import httpx

    b64_image = base64.b64encode(content).decode("utf-8")
    prompt = (
        "Analyze this road image for pavement damage (potholes, longitudinal cracks, transverse cracks, "
        "alligator/fatigue cracks, surface raveling/damage).\n"
        "Return ONLY valid JSON matching this schema:\n"
        "{\n"
        '  "damage_type": "Pothole" | "Longitudinal crack" | "Transverse crack" | "Alligator crack" | "Surface damage" | null,\n'
        '  "confidence": float between 0.0 and 1.0,\n'
        '  "severity": "Low" | "Medium" | "High",\n'
        '  "severity_source": "gemini_vision",\n'
        '  "detections": [\n'
        '    {"label": "pothole"|"crack"|"surface_damage", "confidence": float, "left": float, "top": float, "right": float, "bottom": float}\n'
        '  ],\n'
        '  "message": "Brief description of condition"\n'
        "}\n"
        "Bounding boxes must be normalized 0.0 to 1.0 with left < right and top < bottom. "
        "If no road damage is present, set damage_type to null and detections to []."
    )
    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64_image}}
            ]
        }],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0.1}
    }
    candidate_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]
    last_err = ""
    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            resp = httpx.post(url, json=payload, timeout=25.0)
            if resp.status_code == 200:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                result = json.loads(text)
                boxes = []
                for d in result.get("detections", []):
                    try:
                        left = max(0.0, min(1.0, float(d.get("left", 0))))
                        top = max(0.0, min(1.0, float(d.get("top", 0))))
                        right = max(0.0, min(1.0, float(d.get("right", 1))))
                        bottom = max(0.0, min(1.0, float(d.get("bottom", 1))))
                        if left < right and top < bottom:
                            boxes.append({
                                "label": "pothole" if d.get("label") == "pothole" else "surface_damage" if d.get("label") == "surface_damage" else "crack",
                                "confidence": max(0.0, min(1.0, float(d.get("confidence", 0.9)))),
                                "left": left, "top": top, "right": right, "bottom": bottom
                            })
                    except Exception:
                        continue
                result["detections"] = boxes
                return result
            else:
                last_err = f"{model_name} HTTP {resp.status_code}: {resp.text}"
        except Exception as exc:
            last_err = str(exc)
    raise RuntimeError(f"Gemini API request failed: {last_err}")


@lru_cache(maxsize=1)
def load_detector(model_path: str):
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise HTTPException(503, 'Install Backend/requirements-ai.txt to enable the configured detector. Manual reporting is available.') from exc
    return YOLO(model_path)


def model_damage(label: str):
    key = ' '.join(label.lower().replace('_', ' ').replace('-', ' ').split())
    code = re.match(r'^d(00|10|20|40)(?=$|[^0-9])', key)
    if code:
        key = 'd' + code.group(1)
    classes = {'d00': 'Longitudinal crack', 'd10': 'Transverse crack', 'd20': 'Alligator crack', 'd40': 'Pothole', 'pothole': 'Pothole', 'crack': 'Crack', 'surface damage': 'Surface damage', 'longitudinal crack': 'Longitudinal crack', 'transverse crack': 'Transverse crack', 'alligator crack': 'Alligator crack'}
    return classes.get(key)


@app.post('/api/v1/detect')
def detect(photo: UploadFile):
    content, _ = validate_photo(photo)
    gemini_key = get_gemini_key()
    if gemini_key:
        try:
            return detect_with_gemini(content, gemini_key)
        except Exception as exc:
            logging.warning("Gemini Vision detection failed, falling back to local YOLO: %s", exc)

    model_path = os.getenv('ROAD_MODEL_PATH', '')
    if not model_path or not Path(model_path).is_file():
        raise HTTPException(503, 'No trained road damage model is configured. Choose Classify manually, or configure ROAD_MODEL_PATH on the backend.')
    detections, classes = [], []
    try:
        detector = load_detector(model_path)
        with Image.open(BytesIO(content)) as image:
            source = ImageOps.exif_transpose(image).convert('RGB')
        with ModelLock:
            result = detector.predict(source=source, conf=0.25, max_det=100, verbose=False)[0]
        if result.boxes is not None:
            for box in result.boxes:
                damage = model_damage(str(result.names[int(box.cls.item())]))
                if not damage:
                    continue
                left, top, right, bottom = [max(0.0, min(1.0, float(n))) for n in box.xyxyn[0].tolist()]
                if left >= right or top >= bottom:
                    continue
                detections.append({'label': 'pothole' if damage == 'Pothole' else 'surface_damage' if damage == 'Surface damage' else 'crack', 'confidence': float(box.conf.item()), 'left': left, 'top': top, 'right': right, 'bottom': bottom})
                classes.append(damage)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, 'The configured model could not run. Check its weights and runtime; manual reporting remains available.') from exc
    if not detections:
        return {'damage_type': None, 'confidence': None, 'detections': [], 'message': 'No supported road damage was detected. Retake the photo or review it manually.'}
    best = max(range(len(detections)), key=lambda i: detections[i]['confidence'])
    return {'damage_type': classes[best], 'confidence': detections[best]['confidence'], 'severity': 'Medium', 'severity_source': 'review_required', 'detections': detections}


@app.post("/api/v1/reports", status_code=201, response_model=Report)
def create_report(metadata: Annotated[str, Form(max_length=65536)], photo: UploadFile, response: Response):
    try:
        submission = Submission.model_validate_json(metadata)
    except ValidationError as exc:
        raise RequestValidationError(exc.errors(include_context=False, include_input=False)) from exc

    content, mime_type = validate_photo(photo)
    report_id = str(submission.id)
    encoded = submission.model_dump_json()
    saved_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")

    with closing(sqlite3.connect(Database)) as db, db:
        inserted = db.execute(
            "INSERT INTO reports (id, metadata, photo, mime_type, saved_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
            (report_id, encoded, content, mime_type, saved_at),
        )
        if inserted.rowcount == 0:
            previous, previous_photo, saved_at, status = db.execute(
                "SELECT metadata, photo, saved_at, status FROM reports WHERE id = ?", (report_id,)
            ).fetchone()
            if Submission.model_validate_json(previous) != submission or previous_photo != content:
                raise HTTPException(409, "This report ID is already used for a different submission")
            response.status_code = 200
        else:
            status = 'Submitted'

    response.headers["Location"] = f"/api/v1/reports/{report_id}"
    return serialize(encoded, saved_at, status)


@app.get("/api/v1/reports", response_model=list[Report])
def list_reports(
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    with closing(sqlite3.connect(Database)) as db:
        rows = db.execute(
            "SELECT metadata, saved_at, status FROM reports ORDER BY saved_at DESC, id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return [serialize(*row) for row in rows]


@app.get("/api/v1/reports/{report_id}", response_model=Report)
def get_report(report_id: UUID):
    with closing(sqlite3.connect(Database)) as db:
        row = db.execute(
            "SELECT metadata, saved_at, status FROM reports WHERE id = ?", (str(report_id),)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Report not found")
    return serialize(*row)


@app.get("/api/v1/reports/{report_id}/photo")
def get_photo(report_id: UUID):
    with closing(sqlite3.connect(Database)) as db:
        row = db.execute(
            "SELECT photo, mime_type FROM reports WHERE id = ?", (str(report_id),)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Report not found")
    return Response(row[0], media_type=row[1], headers={"X-Content-Type-Options": "nosniff"})


@app.patch('/api/v1/reports/{report_id}/status', response_model=Report)
def update_status(report_id: UUID, change: StatusUpdate):
    with closing(sqlite3.connect(Database)) as db, db:
        result = db.execute('UPDATE reports SET status = ? WHERE id = ?', (change.status, str(report_id)))
        if result.rowcount == 0:
            raise HTTPException(404, 'Report not found')
        row = db.execute('SELECT metadata, saved_at, status FROM reports WHERE id = ?', (str(report_id),)).fetchone()
    return serialize(*row)


# Serve the exported frontend after API routes, so one local server can run both.
WebBuild = Path(os.getenv('ROAD_WEB_DIR', Path(__file__).parent.parent / 'RoadWatch' / 'dist'))
if (WebBuild / 'index.html').is_file():
    from fastapi.responses import HTMLResponse

    @app.get('/', response_class=HTMLResponse)
    def index():
        return HTMLResponse(
            content=(WebBuild / 'index.html').read_text(encoding='utf-8'),
            headers={'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache', 'Expires': '0'}
        )

    app.mount('/', StaticFiles(directory=WebBuild, html=True), name='frontend')


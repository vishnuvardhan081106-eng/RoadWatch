import json
import sqlite3
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import main


def photo_bytes(format='JPEG'):
    output = BytesIO()
    Image.new('RGB', (24, 24), 'gray').save(output, format=format)
    return output.getvalue()


def metadata(**changes):
    value = {'id': str(uuid4()), 'latitude': 14.4426, 'longitude': 79.9865, 'location_source': 'manual', 'captured_at': '2026-11-18T10:00:00Z', 'note': 'A sample field note', 'address': 'Test road', 'damage_type': 'Pothole', 'severity': 'High', 'source': 'manual', 'detections': []}
    return {**value, **changes}


def submit(client, value, photo=None):
    return client.post('/api/v1/reports', data={'metadata': json.dumps(value)}, files={'photo': ('test.jpg', photo if photo is not None else photo_bytes(), 'image/jpeg')})


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, 'Database', tmp_path / 'reports.sqlite3')
    monkeypatch.delenv('ROAD_MODEL_PATH', raising=False)
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.setattr(main, 'get_gemini_key', lambda: '')
    with TestClient(main.app) as client:
        yield client


def test_health_and_cors(client):
    assert client.get('/health').json()['detector_configured'] is False
    response = client.options('/api/v1/reports', headers={'Origin': 'http://localhost:8081', 'Access-Control-Request-Method': 'POST'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] in ['http://localhost:8081', '*']


def test_manual_report_photo_roundtrip_and_idempotency(client):
    value, photo = metadata(), photo_bytes()
    response = submit(client, value, photo)
    assert response.status_code == 201
    report = response.json()
    assert report['source'] == 'manual' and report['confidence'] is None
    assert report['address'] == value['address'] and report['note'] == value['note']
    assert client.get(report['photo_url']).content == photo
    assert submit(client, value, photo).status_code == 200
    assert len(client.get('/api/v1/reports').json()) == 1
    assert submit(client, {**value, 'note': 'changed'}, photo).status_code == 409
    assert client.get(f"/api/v1/reports/{value['id']}").json()['note'] == value['note']


@pytest.mark.parametrize('change', [{'latitude': 91}, {'longitude': -181}, {'id': 'RW-old'}, {'captured_at': '2026-11-18T10:00:00'}, {'damage_type': None}, {'source': 'invented'}, {'confidence': 1.2}, {'note': 'x' * 1001}])
def test_rejects_invalid_metadata(client, change):
    assert submit(client, metadata(**change)).status_code == 422


def test_rejects_invalid_images(client):
    assert submit(client, metadata(), b'not an image').status_code == 415
    assert submit(client, metadata(), b'x' * (main.PhotoLimit + 1)).status_code == 413
    assert submit(client, metadata(), photo_bytes('GIF')).status_code == 415


def test_status_refresh_and_retry_preserve_status(client):
    value = metadata()
    submit(client, value)
    url = f"/api/v1/reports/{value['id']}/status"
    assert client.patch(url, json={'status': 'In review'}).json()['status'] == 'In review'
    assert client.patch(url, json={'status': 'Resolved'}).json()['status'] == 'Resolved'
    assert submit(client, value).json()['status'] == 'Resolved'
    assert client.patch(url, json={'status': 'unknown'}).status_code == 422
    assert client.patch(f'/api/v1/reports/{uuid4()}/status', json={'status': 'Resolved'}).status_code == 404


def test_pagination_and_missing_records(client):
    for _ in range(3):
        assert submit(client, metadata()).status_code == 201
    page1 = client.get('/api/v1/reports?limit=2&offset=0').json()
    page2 = client.get('/api/v1/reports?limit=2&offset=2').json()
    assert len(page1) == 2 and len(page2) == 1
    assert not set(r['id'] for r in page1) & set(r['id'] for r in page2)
    assert client.get(f'/api/v1/reports/{uuid4()}').status_code == 404
    assert client.get(f'/api/v1/reports/{uuid4()}/photo').status_code == 404


def test_original_database_is_migrated_without_losing_records(tmp_path, monkeypatch):
    database = tmp_path / 'old.sqlite3'
    value = {'id': str(uuid4()), 'latitude': 0, 'longitude': 0, 'location_source': 'gps', 'captured_at': '2026-11-18T10:00:00Z', 'note': 'Legacy report', 'detections': [{'label': 'crack', 'confidence': .8, 'left': .1, 'top': .2, 'right': .8, 'bottom': .9}]}
    with sqlite3.connect(database) as db:
        db.execute('CREATE TABLE reports (id TEXT PRIMARY KEY, metadata TEXT NOT NULL, photo BLOB NOT NULL, mime_type TEXT NOT NULL, saved_at TEXT NOT NULL)')
        db.execute('INSERT INTO reports VALUES (?, ?, ?, ?, ?)', (value['id'], json.dumps(value), photo_bytes(), 'image/jpeg', value['captured_at']))
    monkeypatch.setattr(main, 'Database', database)
    with TestClient(main.app) as client:
        report = client.get('/api/v1/reports').json()[0]
        assert report['id'] == value['id'] and report['status'] == 'Submitted'
        assert report['detections'] == value['detections']
        assert client.get(report['photo_url']).status_code == 200
        assert submit(client, value).status_code == 200


def test_detector_missing_model_is_explicit(client):
    response = client.post('/api/v1/detect', files={'photo': ('road.jpg', photo_bytes(), 'image/jpeg')})
    assert response.status_code == 503
    assert 'No trained road damage model' in response.json()['detail']


def test_detector_adapter_uses_normalized_real_model_output(client, tmp_path, monkeypatch):
    # A deterministic test double checks the adapter, not real model accuracy.
    class Tensor:
        def __init__(self, value): self.value = value
        def item(self): return self.value
        def tolist(self): return self.value
    class Box:
        cls = Tensor(0)
        conf = Tensor(.91)
        xyxyn = [Tensor([.1, .2, .7, .9])]
    class Result:
        names = {0: 'D40'}
        boxes = [Box()]
    class Detector:
        def predict(self, **kwargs): return [Result()]
    weights = tmp_path / 'test-only.pt'
    weights.write_bytes(b'test adapter placeholder')
    monkeypatch.setenv('ROAD_MODEL_PATH', str(weights))
    monkeypatch.setattr(main, 'load_detector', lambda _: Detector())
    response = client.post('/api/v1/detect', files={'photo': ('road.jpg', photo_bytes(), 'image/jpeg')})
    result = response.json()
    assert response.status_code == 200 and result['damage_type'] == 'Pothole'
    assert result['detections'][0]['left'] == .1 and result['confidence'] == .91
    assert result['severity_source'] == 'review_required'

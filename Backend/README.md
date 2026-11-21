# RoadWatch backend

See the parent README.md and API_CONTRACT.md. This service extends the original backend while preserving its UUID, multipart metadata/photo, image validation, and idempotent retry behavior. Existing databases migrate automatically.

Run: python -m uvicorn main:app --host 0.0.0.0 --port 8000

Test: python -m pytest test_backend.py -q

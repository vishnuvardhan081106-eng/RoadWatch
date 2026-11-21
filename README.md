# RoadWatch — Integrated Mobile App

React Native / Expo frontend + FastAPI / SQLite backend for **AI-Based Road Damage Detection and GPS-Enabled Reporting**.

## Quick Start (3 Simple Scripts)

### 1. First-Time Setup
Double-click **`INSTALL_REQUIREMENTS.cmd`** once.
- Installs Python 3.12 AI backend runtime (PyTorch CPU, Ultralytics YOLO).
- Downloads verified pretrained RDD2022 road damage model weights.
- Installs frontend packages and builds the web app.

### 2. Run in Web Browser (PC & Phone Browser)
Double-click **`START_WEB.cmd`**.
- Automatically launches the AI backend and opens `http://localhost:8000` in your browser.
- Displays your Wi-Fi network address so any phone connected to the same Wi-Fi can open it too!

### 3. Run Native Mobile App (Expo Go Demonstration)
Double-click **`START_MOBILE.cmd`**.
- Automatically ensures the AI backend is active on port 8000.
- Starts the Expo development server and shows a QR code.
- Open **Expo Go** on your iPhone or Android and scan the QR code to run the native app with full camera and GPS access.

4. Scan the QR code with Expo Go. Keep the computer and phone on the same Wi-Fi.
5. The app derives the backend address from the Expo development host. Open **Profile → Test backend connection** to verify it. If needed, enter `http://YOUR-PC-IP:8000` and tap **Save preferences**.

For the Android emulator, use `http://10.0.2.2:8000`. `localhost` on a physical phone points to that phone, not your computer.

## Use the integrated workflow

1. Open Profile and test the connection. Reporting should be ready.
2. Create a report, choose a photo, and tap **Classify manually** if you have not configured trained model weights.
3. Select the damage and severity, then add GPS coordinates or enter them manually.
4. Enter a road name and submit. The report is saved locally before upload.
5. View it in Reports and Explore. Refresh retrieves backend status changes and photos.
6. Restart the app: local reports remain available, and backend records load automatically in backend mode.

The interface uses ivory, asphalt, olive, and lime with no gradient backgrounds. Its two modules are **Road Damage Detection** and **GPS Reporting & Tracking**.

## AI model status

**No trained model weights were supplied with the original backend.** Manual capture, reporting, map locations, storage, syncing, and tracking work without weights. The AI route is implemented but returns an explicit service message until a trained road damage model is configured. Demo analysis remains clearly illustrative and does not analyze image pixels.

To use your trained Ultralytics YOLO road damage weights:

```powershell
Backend\.venv\Scripts\python.exe -m pip install -r Backend\requirements-ai.txt
$env:ROAD_MODEL_PATH = 'C:\path\to\your\trained-road-damage.pt'
Backend\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --host 0.0.0.0 --port 8000
```

Supported model names: `D00`, `D10`, `D20`, `D40`, or the corresponding crack/pothole labels. The backend uses genuine model confidence and normalized boxes. Severity defaults to Medium for human review; it is not a measured pothole depth. A general-purpose object detector is not a substitute for trained road damage weights.

## Status tracking

Open **http://127.0.0.1:8000/docs**. For a local classroom demonstration, use:

```text
PATCH /api/v1/reports/{UUID}/status
{"status": "In review"}
```

The allowed statuses are Submitted, In review, and Resolved. Refresh Reports to see the change. The citizen frontend has no button for marking its own report repaired.

This is the original shared local demo service, with no account authentication. Keep it on a trusted private network and use sample data. It does not send reports to a government authority. Authentication and restricted status updates must be added before public deployment.

## Files and data

- `RoadWatch/`: mobile frontend source, tests, lockfile, and exported browser build.
- `Backend/`: integrated backend and regression tests.
- `Backend/reports.sqlite3`: created on first use; stores photos and report metadata.
- `API_CONTRACT.md`: exact integrated request and response formats.
- `VALIDATION.md`: executed checks and remaining device/model limitations.

The original backend database is migrated automatically by adding a status column. Existing records, photos, UUIDs, and timestamps are preserved. Set `ROAD_REPORT_DB` to use another database file. Back up a real database before moving it between installations.

## Development and checks

```powershell
cd RoadWatch
npm ci
npm run typecheck
npm test
npm run build:web
```

```powershell
python -m pip install -r Backend\requirements-dev.txt
python -m pytest Backend\test_backend.py -q
```

With a backend running on `http://127.0.0.1:8765`, run the real HTTP contract test:

```powershell
cd RoadWatch
npm run test:integration
```

Use a separate test database for integration testing. The test creates one clearly named test report and checks updates, retries, photos, and model-unavailable behavior.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend not connected | Start the server; check the URL in Profile. On a phone, use the PC's LAN IP. |
| Windows blocks npm.ps1 | Use `npm.cmd` in place of `npm`, or use the supplied CMD launchers. |
| Port 8000 is busy | Stop the other development server or launch Uvicorn on another port and update Profile. |
| No trained model is configured | Choose manual classification or configure `ROAD_MODEL_PATH`. No fake model result is generated in backend mode. |
| Upload returns 409 | The UUID already belongs to a different payload. The app preserves a stable payload when retrying; do not edit submitted JSON externally and reuse its ID. |
| Maps need internet | Map tiles are online. Local reporting remains available without map tiles. |
| Standalone Android build has a blank map | Configure your own Google Maps key before building an APK. Expo Go has its own development map configuration. |
| Phone GPS/camera is blocked in the browser | Use Expo Go, HTTPS, or manually enter coordinates. |

Camera permission behavior, native maps, and physical-device GPS should be verified on your phone. No APK or trained model is included.

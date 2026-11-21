# Enable trained road damage detection

This copy adds a setup launcher for a real pretrained RDD2022 YOLOv8s detector.
The weight file is NOT bundled. First setup downloads and checks the exact weights,
installs the runtime, and runs the app's detection adapter before starting the server.

## Run on Windows

1. Extract this complete ZIP to a normal folder. Stop any old RoadWatch server.
2. Double-click **INSTALL_REQUIREMENTS.cmd**. Keep internet connected and let it finish.
3. To run in web browser: double-click **START_WEB.cmd** (opens http://127.0.0.1:8000).
4. To run on mobile phone: double-click **START_MOBILE.cmd** and scan the QR code with Expo Go.
5. In Profile, test the backend connection.
6. Create a report, select a clear road-damage photo, and tap Analyze road damage.
7. Review classification and severity, add location, and submit.

Initial setup downloads about 22.5 MB of model weights and potentially several
hundred MB of CPU runtime packages. No GPU, account, API key, or paid service is required.
The launcher uses a compatible installed 64-bit Python (3.11 through 3.14).
AI uses a separate Backend/.venv-ai environment. Python 3.14 is supported by
current CPU PyTorch wheels; the final package installation is verified during setup.

## What the model recognizes

- D00: longitudinal crack
- D10: transverse crack
- D20: alligator/fatigue crack
- D40: pothole

This is pretrained work by SreekarAditya, not a model newly trained for this project.
See MODEL_SOURCE.md for the exact source, immutable revision, checksum, and license.

## Verification and limits

Setup verifies the SHA-256 of the downloaded weights, checks all four class mappings,
and executes the existing backend detection adapter on a synthetic gray image.
It writes Backend/models/ai_ready.json ONLY after these checks pass.
The synthetic-image check confirms execution; it does not measure detection accuracy.
Test real road images in the app afterward. Results can miss damage or be wrong.
Severity remains Medium for user review; the model does not measure pothole depth.
No prediction is fabricated when no supported damage is detected.

The creator reports benchmark results; no independent accuracy evaluation has been
performed for this project. A full dataset is not downloaded by this setup.

## Troubleshooting

- Model download or package install fails: read the visible error, fix the connection, rerun SETUP_AI_AND_START.cmd.
- Python version unavailable: install 64-bit Python 3.12 from python.org and rerun setup.
- Port 8000 is in use: stop the old app terminal with Ctrl+C, then run START_AI.cmd.
- Still seeing missing weights: you are probably running the original server. Stop it and use this copy's START_AI.cmd.
- Model checksum mismatch: move Backend/models/road_damage_yolov8s.pt aside and rerun setup.
- No supported damage found: use a sharp, close, well-lit road image. Manual classification remains available.
- Offline after setup: the model runs locally. Online map tiles still require internet.

If you want your existing reports in this copy, stop both apps, back up your original
Backend/reports.sqlite3, then copy it into this copy's Backend folder before starting.
No original database or report images are included in this ZIP.

## What was checked while preparing this package

Python source syntax, checksum/download handling, and backend class normalization
were checked without downloading the model. The preparation environment blocked
outbound downloads, so the weights and PyTorch could not be installed here.
The first-run launcher performs the real model-load/inference checks on your PC.


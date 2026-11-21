# Executed validation — 18 November 2026

## Passed

| Check | Result |
|---|---|
| Backend regression tests | 16 passed |
| Frontend validation and real HTTP contract tests | 7 passed |
| TypeScript compilation | Passed after aligning TypeScript and React types with Expo SDK 58 |
| Expo dependency compatibility | Dependencies are up to date |
| Production browser export | Passed; final JS bundle approximately 614 KB before transfer compression |
| Android / Hermes production bundle | Passed; 724 modules, approximately 1.8 MB |
| Actual browser runtime | No captured console warnings or errors during the tested workflow |
| Phone-size layout | Checked at 390 × 844 |

## Browser workflow verified

1. Connected to the actual FastAPI backend from Profile.
2. Selected a JPEG through the gallery control and processed it in the frontend.
3. Tried detection without weights and received an explicit missing-model message.
4. Used manual classification and selected High severity.
5. Attempted an incomplete submission and received the required-coordinate error.
6. Added clearly labeled sample coordinates, road name, and notes.
7. Submitted successfully; the detail screen displayed Storage: Synced.
8. Reloaded the application and confirmed the report remained present.
9. Viewed the report location on an actual OpenStreetMap tile map.
10. Updated status on the backend and refreshed the frontend; In review appeared.
11. Verified Submitted excluded that report while In review included it.

The browser test used an isolated test database and a synthetic gray JPEG. It was not an actual road damage observation.

## Backend coverage

Tests cover multipart metadata/photo matching, UUID validation, idempotent retry, duplicate-payload conflicts, exact photo retrieval, status updates, pagination, missing records, CORS, metadata and image validation, and migration from the original five-column database schema. Detector adapter tests use a deterministic test double solely to check the adapter format; they do not measure model accuracy.

## Remaining verification limits

- No trained road damage model weights were supplied. Real AI inference accuracy cannot be validated until appropriate weights are configured. The reporting system works with manual classification; backend mode never substitutes a fake model result.
- Physical Android/iOS camera permissions, GPS reception and accuracy, and native map rendering still require a phone or emulator. Successful native bundling is not a claim of device testing.
- No APK was built. Standalone Android maps require your own Google Maps configuration.
- This shared local backend retains the original demo's lack of account authentication. It is suitable for private classroom testing, not public authority deployment.
- The Python test run emitted one upstream Starlette TestClient deprecation warning about its HTTP client. It did not affect the 16 passing backend tests or real HTTP integration checks.

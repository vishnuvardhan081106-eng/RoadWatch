# RoadWatch integrated API

The frontend and backend use the same versioned contract. API docs are at `/docs`, health at `/health`, and the browser app at `/` when its export exists.

## POST /api/v1/reports

Multipart form fields:

| Field | Content |
|---|---|
| `metadata` | JSON string with the report object below |
| `photo` | Valid JPEG or PNG, up to 8 MiB and 24 megapixels |

```json
{
  "id": "641de441-da7c-490b-a3d2-d03e6c28dbe1",
  "latitude": 14.4426,
  "longitude": 79.9865,
  "location_source": "manual",
  "captured_at": "2026-11-18T10:00:00Z",
  "note": "Near the bus stand",
  "address": "Example road",
  "damage_type": "Pothole",
  "severity": "High",
  "source": "manual",
  "confidence": null,
  "detections": []
}
```

`id` is a stable UUID, reused with the identical photo and payload on retry. A new report returns 201; an identical retry returns 200; a changed payload using an existing UUID returns 409. Both success responses contain the complete report, `saved_at`, `photo_url`, and `status`.

Manual reports need no invented bounding box or confidence. Model reports may include normalized detections:

```json
{"label":"pothole","confidence":0.91,"left":0.1,"top":0.2,"right":0.7,"bottom":0.9}
```

Detection labels: `pothole`, `crack`, `surface_damage`. Coordinates for each box are normalized between 0 and 1, with left < right and top < bottom. At most 100 detections are accepted. The original detector-only metadata format is still accepted for old clients and database records.

Optional additional fields: address up to 200 characters, note up to 1000, reviewed damage_type, severity Low/Medium/High, source manual/model/demo, confidence 0–1. At least detections or a reviewed damage_type is required. Manual source clears top-level confidence and rejects model boxes.

## History, photos, and status

| Method | Route | Behavior |
|---|---|---|
| GET | `/health` | Reporting readiness and whether a model file is configured |
| GET | `/api/v1/reports?limit=100&offset=0` | Newest reports; limit is 1–100 |
| GET | `/api/v1/reports/{uuid}` | One complete report |
| GET | `/api/v1/reports/{uuid}/photo` | Original validated image bytes and correct MIME type |
| PATCH | `/api/v1/reports/{uuid}/status` | Local demo status update: `{"status":"In review"}` |

Statuses: Submitted, In review, Resolved. Re-uploading an identical report does not reset its current status. The frontend follows pagination, loads server photo URLs, and merges remote records by UUID without duplicating local reports.

The local demo backend has no authentication, including on the status endpoint. Do not publish it as an authority workflow without adding access control.

## POST /api/v1/detect

Multipart `photo`. Requires a genuine trained road damage model at the server's `ROAD_MODEL_PATH` and the optional AI dependencies.

Returns reviewed-class suggestions, genuine model confidence, and normalized detections. Supported model classes include D00, D10, D20, and D40. Severity defaults to Medium with `severity_source: "review_required"`.

If no model is configured or its runtime cannot load, returns 503 with an actionable message. If inference finds no supported damage, returns an empty detections array and no damage type; the frontend prompts for another photo or manual review. The endpoint never substitutes random or canned detections.

## Local connection behavior

The browser export uses its current origin. Expo Go derives the PC host from its Metro connection and uses port 8000. The URL, detection path, report path, and image field can be changed in Profile. `EXPO_PUBLIC_API_URL` can override the default at build time.

Browser development on port 8081 is supported by local CORS configuration. Add explicit extra origins with comma-separated `ROAD_CORS_ORIGINS` when using another development host. The bundled browser export is served by the same backend, so it needs no cross-origin access.

Pending reports and photos remain saved locally if requests fail. Submission success is shown only after local persistence. Request timeouts are 25 seconds. Sync is explicit; startup history retrieval only reads data and does not upload pending reports.

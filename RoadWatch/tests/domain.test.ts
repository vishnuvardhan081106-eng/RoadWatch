import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCoordinates, distanceKm, normalizePrediction, validateDraft, filterReports, INITIAL_STATE } from '../src/domain.ts';
test('coordinates reject blank, non-numeric, infinite and out-of-range values', () => {
  for (const [lat, lon] of [['', '0'], [' ', '5'], ['x', '8'], ['Infinity', '9'], ['91', '0'], ['0', '-181']]) assert.equal(validCoordinates(lat, lon), undefined);
  assert.deepEqual(validCoordinates('0', '0'), { latitude: 0, longitude: 0 });
  assert.deepEqual(validCoordinates('-90', '180'), { latitude: -90, longitude: 180 });
});
test('distance uses the spherical distance and returns zero at the same location', () => {
  assert.equal(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(Math.abs(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 111.195) < 0.01);
});
test('model responses normalize supported classes and confidence scales', () => {
  assert.deepEqual(normalizePrediction({ damage_type: 'D40', confidence: 94, severity: 'high' }), { damage: 'Pothole', confidence: 0.94, severity: 'High', source: 'model' });
  assert.equal(normalizePrediction({ prediction: { label: 'alligator_crack', score: 0.8 } }).damage, 'Alligator crack');
  assert.equal(normalizePrediction({ label: 'D00' }).confidence, undefined);
  assert.throws(() => normalizePrediction({ label: 'no damage' }), /No supported damage/);
  assert.throws(() => normalizePrediction(null), /invalid response/);
});
test('submission requires a photo, classification, valid coordinates and road name', () => {
  const draft = { photo: 'file:///test.jpg', prediction: { damage: 'Pothole' as const, severity: 'High' as const, source: 'manual' as const }, address: 'GT Road', notes: '', coordinates: { latitude: 0, longitude: 0 } };
  assert.equal(validateDraft(draft), '');
  assert.match(validateDraft({ ...draft, photo: undefined }), /photo/);
  assert.match(validateDraft({ ...draft, prediction: undefined }), /Analyze/);
  assert.match(validateDraft({ ...draft, coordinates: { latitude: 95, longitude: 0 } }), /coordinates/);
  assert.match(validateDraft({ ...draft, address: '  ' }), /road name/);
});
test('journal searches are case-insensitive and combine with status filters', () => {
  assert.equal(filterReports(INITIAL_STATE.reports, 'GRAND TRUNK', 'All').length, 1);
  assert.equal(filterReports(INITIAL_STATE.reports, 'pothole', 'Resolved').length, 0);
  assert.equal(filterReports(INITIAL_STATE.reports, '', 'Resolved').length, 1);
});

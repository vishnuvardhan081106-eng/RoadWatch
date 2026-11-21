import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkConnection, fetchReports, uploadReport, detectPhoto, endpoint } from '../src/apiCore.ts';
import { INITIAL_STATE, newId } from '../src/domain.ts';
import type { RoadReport } from '../src/types.ts';

const settings = { ...INITIAL_STATE.settings, apiUrl: process.env.TEST_API_URL ?? 'http://127.0.0.1:8765' };
test('frontend contract reaches the real backend and preserves reports, photos, retries and status', async () => {
  assert.equal((await checkConnection(settings)).status, 'ok');
  const bytes = await readFile(new URL('./fixture.jpg', import.meta.url));
  const photo = `data:image/jpeg;base64,${bytes.toString('base64')}`;
  const report: RoadReport = { id: newId(), title: 'Pothole', address: 'Integration test road', notes: 'Frontend multipart contract test', coordinates: { latitude: 14.4426, longitude: 79.9865 }, prediction: { damage: 'Pothole', severity: 'High', source: 'manual' }, status: 'Submitted', sync: 'Pending', createdAt: new Date().toISOString(), photo, locationSource: 'manual' };
  assert.equal(await uploadReport(settings, report), report.id);
  assert.equal(await uploadReport(settings, report), report.id);
  let rows = await fetchReports(settings);
  assert.equal(rows.filter(r => r.id === report.id).length, 1);
  const saved = rows.find(r => r.id === report.id)!;
  assert.equal(saved.address, report.address);
  assert.equal(saved.notes, report.notes);
  assert.equal(saved.prediction.source, 'manual');
  assert.equal(saved.prediction.confidence, undefined);
  assert.deepEqual(Buffer.from(await (await fetch(saved.photo!)).arrayBuffer()), bytes);
  const update = await fetch(endpoint(settings, `/api/v1/reports/${report.id}/status`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Resolved' }) });
  assert.equal(update.status, 200);
  rows = await fetchReports(settings);
  assert.equal(rows.find(r => r.id === report.id)!.status, 'Resolved');
  await assert.rejects(uploadReport(settings, { ...report, notes: 'different payload' }), /already used/);
  await assert.rejects(detectPhoto(settings, photo), /No trained road damage model/);
});
test('API endpoint settings reject invalid protocols and paths', () => {
  assert.throws(() => endpoint({ ...settings, apiUrl: 'file:///tmp' }, '/health'), /http/);
  assert.throws(() => endpoint(settings, '//other-server/path'), /single/);
});

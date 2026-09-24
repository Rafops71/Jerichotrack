/*
 * INDEPENDENT VERIFIER
 *
 * This file deliberately shares NO code with companion.html. It does not load
 * the Firebase SDK, does not reuse any of the app's helpers, and does not know
 * how the app stores anything. It speaks to the sandbox database over plain
 * HTTP and decodes the raw wire format itself.
 *
 * The point: when a test says "the lead was saved", that claim comes from the
 * database itself, not from the app reporting on its own behaviour.
 */
const PROJECT = 'jericho-test';
const BASE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = `http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;

// The emulator accepts the literal token "owner" for full access.
const HEADERS = { Authorization: 'Bearer owner' };

/* Firestore's REST wire format wraps every value in a type tag. Decode it. */
function decodeValue(v) {
  if (v === null || v === undefined) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}

/** Every document in a collection, as plain objects. */
async function readCollection(name) {
  const resp = await fetch(`${BASE}/${name}?pageSize=300`, { headers: HEADERS });
  if (resp.status === 404) return [];
  if (!resp.ok) throw new Error(`Sandbox read of ${name} failed: HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.documents || []).map(d => ({
    _id: d.name.split('/').pop(),
    ...decodeFields(d.fields || {})
  }));
}

/** Wipe the sandbox between tests so each one starts from nothing. */
async function wipe() {
  const resp = await fetch(ADMIN, { method: 'DELETE', headers: HEADERS });
  if (!resp.ok) throw new Error(`Sandbox wipe failed: HTTP ${resp.status}`);
}

/** Poll until a collection contains a matching document, or time out. */
async function waitFor(collection, predicate, { timeoutMs = 10000, label = '' } = {}) {
  const started = Date.now();
  let last = [];
  while (Date.now() - started < timeoutMs) {
    last = await readCollection(collection);
    const hit = last.find(predicate);
    if (hit) return hit;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(
    `Nothing matching ${label || 'the expected record'} appeared in "${collection}" ` +
    `within ${timeoutMs}ms. The sandbox currently holds ${last.length} document(s) there: ` +
    JSON.stringify(last.map(d => d.name || d.title || d._id)).slice(0, 300)
  );
}

/** Assert a collection stays empty for a while - used to prove nothing was saved. */
async function stayedEmpty(collection, forMs = 2500) {
  const started = Date.now();
  while (Date.now() - started < forMs) {
    const docs = await readCollection(collection);
    if (docs.length) {
      throw new Error(
        `"${collection}" should have stayed empty but holds ${docs.length} document(s): ` +
        JSON.stringify(docs).slice(0, 300)
      );
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return true;
}

/* Encode a plain object into Firestore's wire format, for seeding. */
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v) } };
  return { nullValue: null };
}
function encodeFields(obj) {
  const out = {};
  for (const k of Object.keys(obj)) out[k] = encodeValue(obj[k]);
  return out;
}

/*
 * Put a document straight into the sandbox, without going through the app.
 * Used to set up data that Companion can only receive (e.g. pipeline deals,
 * which are created in JerichoTrack on the desktop, not here).
 */
async function seed(collection, id, obj) {
  const resp = await fetch(`${BASE}/${collection}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(obj) })
  });
  if (!resp.ok) throw new Error(`Seeding ${collection}/${id} failed: HTTP ${resp.status} ${await resp.text()}`);
  return true;
}

module.exports = { readCollection, wipe, waitFor, stayedEmpty, seed, PROJECT };

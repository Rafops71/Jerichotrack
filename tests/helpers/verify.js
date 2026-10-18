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

/*
 * Wipe the sandbox between tests so each one starts from nothing.
 *
 * The emulator answers 409 when it is still busy with the previous test's
 * writes, and the volume tests leave two thousand documents behind. That 409
 * came out as a test failure naming the app -- three checklist items read as
 * broken when nothing was wrong with them. So a conflict is waited out rather
 * than reported.
 */
async function wipe({ attempts = 12 } = {}) {
  let last = '';
  for (let i = 0; i < attempts; i++) {
    let resp;
    try {
      resp = await fetch(ADMIN, { method: 'DELETE', headers: HEADERS });
    } catch (e) {
      last = e.message;                       // emulator still starting up
      await new Promise(r => setTimeout(r, 500 + i * 250));
      continue;
    }
    if (resp.ok) return;
    last = 'HTTP ' + resp.status;
    // 409 means busy, not broken. Anything else is worth failing on at once.
    if (resp.status !== 409) break;
    await new Promise(r => setTimeout(r, 500 + i * 250));
  }
  throw new Error(`Sandbox wipe failed after ${attempts} attempts: ${last}`);
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

/*
 * Seed many documents at once, for volume testing.
 *
 * Seeding one at a time is too slow for thousands, and seeding into
 * localStorage instead does not work: the app syncs from this database a moment
 * later and replaces whatever was in local storage. A stress run that skips this
 * measures an empty list - the first attempt reported "0 pairs in 148ms" and
 * looked like a pass.
 */
async function seedMany(collection, items, { chunk = 400 } = {}) {
  /*
   * One commit per batch, not one request per document.
   *
   * Forty parallel single-document POSTs still meant two thousand round trips,
   * which took so long that the two volume tests hit the seven minute ceiling
   * and were reported as the APP being slow. It was the setup. Firestore's
   * :commit endpoint takes many writes in one request, and it caps at 500, so
   * the batches stay under that.
   */
  const DOCS = `projects/${PROJECT}/databases/(default)/documents`;
  for (let i = 0; i < items.length; i += chunk) {
    const writes = items.slice(i, i + chunk).map(item => ({
      update: {
        name: `${DOCS}/${collection}/${String(item.id)}`,
        fields: encodeFields(item)
      }
    }));
    const resp = await fetch(
      `${BASE}:commit`,
      {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes })
      }
    );
    if (!resp.ok) {
      throw new Error(`Seeding ${items.length} into ${collection} failed: ` +
        `HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    }
  }
  return items.length;
}

module.exports = { readCollection, wipe, waitFor, stayedEmpty, seed, seedMany, PROJECT };

/*
 * Runs the REAL Intake worker locally so the robot can drive the real app
 * through it. The only thing standing in is the AI provider itself, which is
 * replaced by a local stub returning a canned, deliberately gift-wrapped
 * answer - so the worker's unwrapping is exercised for real.
 *
 * This tests the worker's actual code. It does not test the real AI.
 */
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const WORKER_PORT = 5056;
const AI_PORT = 5057;

/* ---- stub AI provider, OpenAI-compatible ---- */
const AI_REPLY = {
  leads: [{ name: 'Johan Vermeulen', company: 'Antwerp Metals', email: '', phone: '',
            country: 'Belgium', commodity: 'Copper cathode', notes: 'met at conference',
            sourceSnippet: 'met Johan from Antwerp Metals', confidence: 0.92 }],
  tasks: [{ title: 'Send copper quote', category: 'Follow-up', due: '',
            notes: '', sourceSnippet: 'send him a quote', confidence: 0.88 }],
  notes: [],
  commslog: [],
  broker_quotes: [],
  pipeline: [{ commodity: 'Copper cathode', broker: '', buyer: 'Antwerp Metals', seller: '',
               quantity: '500', unit: 'MT', price: '', origin: 'Chile',
               stage: 'Totally Invented Stage',      // must be coerced to "New"
               notes: '', sourceSnippet: '500 mt from Chile', confidence: 0.6 }]
};

http.createServer((req, res) => {
  const mode = new URL(req.url, 'http://x').searchParams.get('mode') || 'ok';
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const send = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (mode === 'ratelimit') return send(429, { error: { message: 'rate limited' } });
    if (mode === 'badmodel')  return send(404, { error: { message: 'model `old-model` has been decommissioned' } });
    if (mode === 'cutoff') {
      return send(200, { choices: [{ finish_reason: 'length',
        message: { content: '```json\n{"leads":[{"name":"Half' } }] });
    }
    if (mode === 'garbage') {
      return send(200, { choices: [{ finish_reason: 'stop',
        message: { content: 'I am afraid I cannot help with that.' } }] });
    }
    // The normal case, deliberately wrapped the way Mistral wraps it:
    // a bare "JSON" label AND a code fence. The worker must survive both.
    return send(200, { choices: [{ finish_reason: 'stop',
      message: { content: 'JSON\n```json\n' + JSON.stringify(AI_REPLY) + '\n```' } }] });
  });
}).listen(AI_PORT, '127.0.0.1', () => console.log('stub AI on ' + AI_PORT));

/* ---- the real worker ---- */
(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'worker', 'intake-worker-v1.js')).href);
  const worker = mod.default;


  http.createServer(async (req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const request = new Request('http://worker.local' + req.url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks)
      });
      // Let the test choose how the AI behaves, via ?ai=<mode> on the worker URL.
      const aiMode = new URL(req.url, 'http://x').searchParams.get('ai') || 'ok';
      const env = {
        AI_BASE_URL: 'http://127.0.0.1:' + AI_PORT + '/?mode=' + aiMode,
        AI_MODEL: 'stub-model',
        AI_API_KEY: 'stub-provider-key',
        INGEST_AUTH_KEY: 'robot-test-key'
      };
      try {
        const out = await worker.fetch(request, env);
        const text = await out.text();
        res.writeHead(out.status, Object.fromEntries(out.headers));
        res.end(text);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'worker_threw', message: String(e && e.message) }));
      }
    });
  }).listen(WORKER_PORT, '127.0.0.1', () => console.log('real worker on ' + WORKER_PORT));
})();

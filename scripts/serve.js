/* Minimal static server so the robot loads the app over http, like a real browser. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = 5055;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/*
 * STAND-IN WORKER for the Intake tests.
 *
 * Your real Intake worker does not exist yet, so there is nothing to test
 * against. This stands in for it and returns whatever the test asks for, so we
 * can prove YOUR APP'S half of the conversation behaves correctly - the review
 * cards, the Confirm gate, the error messages.
 *
 * It tests the app, NOT your worker. When the real worker exists it must be
 * tested separately.
 */
function stubWorker(req, res) {
  const mode = new URL(req.url, 'http://x').searchParams.get('mode') || 'ok';
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const send = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (mode === 'unauthorized') return send(401, { error: 'unauthorized' });
    if (mode === 'servererror')  return send(500, { error: 'boom' });
    if (mode === 'truncated')    return send(200, { error: 'truncated', partialText: '{"leads":[' });
    if (mode === 'parsefailed')  return send(200, { error: 'parse_failed', rawText: 'JSON ```{...' });
    if (mode === 'badshape')     return send(200, { something: 'unexpected' });
    return send(200, {
      ok: true,
      data: {
        leads: [{ name: 'Johan Vermeulen', company: 'Antwerp Metals', email: '', phone: '',
                  country: 'Belgium', commodity: 'Copper cathode', notes: 'met at conference',
                  sourceSnippet: 'met Johan from Antwerp Metals' }],
        tasks: [{ title: 'Send copper quote', category: 'Follow-up', notes: '', due: '' }],
        notes: [], meetings: [], pipeline: [], commslog: [], brokerQuotes: []
      }
    });
  });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/__stub-worker')) return stubWorker(req, res);
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('robot server on http://127.0.0.1:' + PORT));

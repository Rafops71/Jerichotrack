/* Exercises the real v2 worker code, with Groq itself stood in for. */
const mod = await import('../intake-worker-v3-groq.js');
const worker = mod.default;

const env = { GROQ_API_KEY:'gsk_test', AI_MODEL:'openai/gpt-oss-120b', INGEST_AUTH_KEY:'pw123' };
const realFetch = globalThis.fetch;
let lastRequest = null;

function stubGroq(mode, payload){
  globalThis.fetch = async (url, opts) => {
    lastRequest = { url, body: JSON.parse(opts.body), auth: opts.headers.Authorization };
    if (mode==='429') return new Response('{}',{status:429});
    if (mode==='404') return new Response(JSON.stringify({error:{message:'model `x` has been decommissioned'}}),{status:404});
    if (mode==='401') return new Response('{}',{status:401});
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:payload}}]}),{status:200});
  };
}

const call = (headers, body) => worker.fetch(new Request('https://w.local/',{
  method:'POST', headers, body: JSON.stringify(body)
}), env);

const NOTES = 'met Johan Vermeulen from Antwerp Metals about copper cathode, his email is johan@antwerpmetals.be';
const GOOD = 'JSON\n```json\n'+JSON.stringify({
  leads:[{name:'Johan Vermeulen',company:'Antwerp Metals',email:'johan@antwerpmetals.be',phone:null,
          country:null,commodity:'copper cathode',notes:null,confidence:0.9,
          sourceSnippet:'met Johan Vermeulen from Antwerp Metals'}],
  tasks:[],commslog:[],broker_quotes:[],
  pipeline:[{commodity:'copper cathode',stage:'Totally Made Up',confidence:0.5,sourceSnippet:'copper cathode'}],
  notes:[]
})+'\n```';

const INVENTED = 'JSON\n```json\n'+JSON.stringify({
  leads:[{name:'Johan Vermeulen',company:'Antwerp Metals',email:'fake@invented.com',phone:null,
          country:null,commodity:null,notes:null,confidence:0.9,
          sourceSnippet:'a quote the AI made up that is not in the text'}],
  tasks:[],commslog:[],broker_quotes:[],pipeline:[],notes:[]
})+'\n```';

let pass=0, fail=0;
const check=(name,cond,detail='')=>{ if(cond){pass++;console.log('  PASS',name);} else {fail++;console.log('  FAIL',name,detail);} };

console.log('\nWORKER v2 (Groq) - real code, Groq stood in\n');

stubGroq('ok', GOOD);
let r = await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:NOTES});
let j = await r.json();
check('calls Groq, not Mistral', lastRequest.url.startsWith('https://api.groq.com/openai/v1/chat/completions'), lastRequest.url);
check('sends the model from the setting', lastRequest.body.model==='openai/gpt-oss-120b', lastRequest.body.model);
check('uses the Groq key', lastRequest.auth==='Bearer gsk_test');
check('returns ok:true', j.ok===true);
check('unwraps the JSON+fence packaging', j.data.leads.length===1);
check('keeps the real email', j.data.leads[0].email==='johan@antwerpmetals.be');
check('rejects an invented stage', j.data.pipeline[0].stage===null, String(j.data.pipeline[0].stage));
check('reports the model back', j.meta.model==='openai/gpt-oss-120b');

stubGroq('ok', INVENTED);
j = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:NOTES})).json();
check('deletes an invented email', j.data.leads[0].email===null, String(j.data.leads[0].email));
check('deletes an unverifiable quote', j.data.leads[0].sourceSnippet===null);

stubGroq('ok', GOOD);
j = await (await call({'Content-Type':'application/json','X-API-Key':'WRONG'},{text:NOTES})).json();
check('rejects a wrong password', j.error==='Unauthorized');

const envNoKey = {...env}; delete envNoKey.INGEST_AUTH_KEY;
r = await worker.fetch(new Request('https://w.local/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"text":"x"}'}), envNoKey);
j = await r.json();
check('refuses to run with NO password set (was an open door)', j.error==='setup', JSON.stringify(j).slice(0,80));

stubGroq('429');
j = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:NOTES})).json();
check('explains a rate limit in words', j.error==='rate_limited' && /wait a minute/.test(j.message));

stubGroq('404');
j = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:NOTES})).json();
check('explains a retired model', j.error==='provider_error' && /AI_MODEL/.test(j.message));

stubGroq('401');
j = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:NOTES})).json();
check('explains a bad Groq key, and says which key', j.error==='provider_auth' && /not the password you type/.test(j.message));

console.log(`\n  ${pass} passed, ${fail} failed`);

/* ---- regression: a destination must never end up in the origin field ----
   On the first live run the model put "Rotterdam" in origin, from the phrase
   "CIF Rotterdam". CIF names where the goods are GOING. */
const CIF_TEXT = 'Baltic Agro offer 12,500 MT yellow corn at USD 238/MT CIF Rotterdam, October shipment';
const CIF_REPLY = 'JSON\n```json\n'+JSON.stringify({
  leads:[],tasks:[],commslog:[],
  broker_quotes:[{commodity:'yellow corn',price:'USD 238/MT',origin:'Rotterdam',
                  terms:'CIF Rotterdam, October shipment',qty:'12,500 MT',
                  direction:'Offer',source:'Baltic Agro',confidence:0.98,
                  sourceSnippet:'Baltic Agro offer 12,500 MT yellow corn'}],
  pipeline:[{commodity:'yellow corn',origin:'Rotterdam',stage:'New',confidence:0.7,
             sourceSnippet:'12,500 MT yellow corn'}],
  notes:[]
})+'\n```';

const REAL_ORIGIN = 'FOB Santos, Brazilian soybeans from Mato Grosso';
const REAL_ORIGIN_REPLY = 'JSON\n```json\n'+JSON.stringify({
  leads:[],tasks:[],commslog:[],
  broker_quotes:[{commodity:'soybeans',price:null,origin:'Santos',terms:'FOB Santos',
                  qty:null,direction:'Reference',source:null,confidence:0.8,
                  sourceSnippet:'FOB Santos, Brazilian soybeans'}],
  pipeline:[],notes:[]
})+'\n```';

let p2=0, f2=0;
const chk=(n,c,d='')=>{ if(c){p2++;console.log('  PASS',n);} else {f2++;console.log('  FAIL',n,d);} };

console.log('\nREGRESSION - origin vs destination\n');

stubGroq('ok', CIF_REPLY);
let jj = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:CIF_TEXT})).json();
chk('clears a CIF destination from a quote origin', jj.data.broker_quotes[0].origin===null, String(jj.data.broker_quotes[0].origin));
chk('clears it on the deal too', jj.data.pipeline[0].origin===null, String(jj.data.pipeline[0].origin));
chk('says why it was cleared', /where they come from/.test(jj.data.broker_quotes[0].originNote||''));

stubGroq('ok', REAL_ORIGIN_REPLY);
jj = await (await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:REAL_ORIGIN})).json();
chk('KEEPS a genuine FOB origin', jj.data.broker_quotes[0].origin==='Santos', String(jj.data.broker_quotes[0].origin));

console.log(`  ${p2} passed, ${f2} failed`);

/* ---- the prompt must tell the model what day it is ----
   Live runs kept returning a blank due date for "by 30 September". The model
   was not being stubborn - it was never told the year, so it could not produce
   a YYYY-MM-DD without inventing one, and rule 1 forbids inventing. */
console.log('\nDATE HANDLING\n');
let sentBody = null;
globalThis.fetch = async (u, o) => {
  sentBody = JSON.parse(o.body);
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content:
    JSON.stringify({leads:[],tasks:[],commslog:[],broker_quotes:[],pipeline:[],notes:[]}) } }] }), { status: 200 });
};
await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:'send Maria the SPA draft by 30 September'});
const prompt = sentBody.messages[0].content;
const todayISO = new Date().toISOString().slice(0, 10);

let p3 = 0, f3 = 0;
const chk3 = (n, c, d='') => { if (c) { p3++; console.log('  PASS', n); } else { f3++; console.log('  FAIL', n, d); } };
chk3("the prompt carries today's date", prompt.includes(todayISO), 'expected ' + todayISO);
chk3('and the weekday, so "next Tuesday" can be resolved',
     /TODAY IS (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/.test(prompt));
chk3('says a worked-out date is not an invention', /NOT an invention/.test(prompt));
chk3('still forbids dates with no anchor', /stay null/.test(prompt));
chk3('forbids dates in the past', /Never return a date in the past/.test(prompt));
console.log(`  ${p3} passed, ${f3} failed`);

/* ---- the code net behind the date prompt rule ----
   The prompt gets it right about nine times in ten. The tenth came back blank
   on a live run, so there is now a check behind it, the same way the Incoterms
   rule has one. It is deliberately narrow. */
console.log('\nDUE-DATE NET\n');
const todayNet = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const plusDays = n => { const d=new Date(Date.parse(todayNet)); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const envTz = { ...env, APP_TIMEZONE:'Europe/Brussels' };
const taskReply = tasks => 'JSON\n```json\n'+JSON.stringify({leads:[],tasks,commslog:[],broker_quotes:[],pipeline:[],notes:[]})+'\n```';
const runNet = async (text, tasks) => {
  globalThis.fetch = async () => new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:taskReply(tasks)}}]}),{status:200});
  const r = await worker.fetch(new Request('https://w/',{method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':'pw123'}, body:JSON.stringify({text})}), envTz);
  return r.json();
};
const t = (title, due=null, snip=title) => [{title, category:'Follow-up', notes:null, due, confidence:0.9, sourceSnippet:snip}];
const sep30 = (todayNet <= todayNet.slice(0,4)+'-09-30') ? todayNet.slice(0,4)+'-09-30' : (+todayNet.slice(0,4)+1)+'-09-30';

let p4=0, f4=0;
const chk4=(n,c,d='')=>{ if(c){p4++;console.log('  PASS',n);} else {f4++;console.log('  FAIL',n,'->',d);} };

let n1 = await runNet('Remind me to send Maria the SPA draft by 30 September.', t('Send Maria the SPA draft',null,'send Maria the SPA draft'));
chk4('fills a date the model left blank', n1.data.tasks[0].due===sep30, n1.data.tasks[0].due);
chk4('marks it derived rather than model-supplied', n1.data.tasks[0].dueDerived===true);

let n2 = await runNet('Call Diego on 30 September. Separately, chase the Delta sugar financials.',
                      t('Chase Delta sugar financials',null,'chase the Delta sugar financials'));
chk4('does NOT borrow a date from another sentence', n2.data.tasks[0].due===null, String(n2.data.tasks[0].due));

let n3 = await runNet('Send the draft by 30 September.', t('Send the draft','2026-12-01','Send the draft'));
chk4('never overrides a date the model found', n3.data.tasks[0].due==='2026-12-01', n3.data.tasks[0].due);

let n4 = await runNet('Call Diego tomorrow about the corn.', t('Call Diego'));
chk4('handles "tomorrow"', n4.data.tasks[0].due===plusDays(1), n4.data.tasks[0].due);

let n5 = await runNet('Chase the Vermeer financials next Tuesday.', t('Chase Vermeer financials',null,'Chase the Vermeer financials'));
chk4('leaves judgement calls to the model', n5.data.tasks[0].due===null, String(n5.data.tasks[0].due));

const past = new Date(Date.parse(todayNet) - 20*86400000);
const pastPhrase = past.getUTCDate()+' '+past.toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
let n6 = await runNet(`I was supposed to send that on ${pastPhrase}.`, t('Send that',null,'send that'));
chk4('does not roll a past date forward a year', n6.data.tasks[0].due===null, String(n6.data.tasks[0].due));

let n7 = await runNet('Chase Diego soon, whenever he gets back.', t('Chase Diego'));
chk4('stays blank when there is no date at all', n7.data.tasks[0].due===null, String(n7.data.tasks[0].due));
console.log(`  ${p4} passed, ${f4} failed`);

/* ---- the trade vocabulary must actually reach the model ----
   Whether the model READS a mangled word correctly is its own behaviour and is
   checked by live runs, not here. What is checked here is that the vocabulary,
   the worked examples and the false-positive guard are all in the prompt the
   worker sends - so a careless edit cannot silently drop them. */
console.log('\nTRADE VOCABULARY IN THE PROMPT\n');
let promptSent = null;
globalThis.fetch = async (u, o) => {
  promptSent = JSON.parse(o.body).messages[0].content;
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content:
    JSON.stringify({leads:[],tasks:[],commslog:[],broker_quotes:[],pipeline:[],notes:[]}) } }] }), { status: 200 });
};
await call({'Content-Type':'application/json','X-API-Key':'pw123'},{text:'anything'});

let p5 = 0, f5 = 0;
const chk5 = (n, c, d='') => { if (c) { p5++; console.log('  PASS', n); } else { f5++; console.log('  FAIL', n, d); } };
const inPrompt = t => promptSent.toLowerCase().includes(t.toLowerCase());

for (const term of ['manganese','antimony','cathode','billet','quotational period','off-taker','bill of lading'])
  chk5(`vocabulary carries "${term}"`, inPrompt(term));
for (const code of ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FOB','CFR','CIF'])
  chk5(`Incoterm ${code} listed`, promptSent.includes(code));
chk5('names the hard case: an ordinary word in the wrong place', inPrompt('ORDINARY ENGLISH WORD'));
chk5('gives the copper kettles example', inPrompt('copper kettles'));
chk5('gives the anti money ingots example', inPrompt('anti money ingots'));
chk5('guards anti-money laundering from being "fixed"', inPrompt('anti-money laundering'));
chk5('still demands a verbatim quote', inPrompt('verbatim'));
chk5('still forbids adding a fact', inPrompt('adding a fact is not'));
console.log(`  ${p5} passed, ${f5} failed`);

globalThis.fetch = realFetch;
console.log(`\n  TOTAL: ${pass+p2+p3+p4+p5} passed, ${fail+f2+f3+f4+f5} failed\n`);
process.exit((fail+f2+f3+f4+f5)?1:0);

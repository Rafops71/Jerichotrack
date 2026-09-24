/* Exercises the real v2 worker code, with Groq itself stood in for. */
const mod = await import('../intake-worker-v2-groq.js');
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

globalThis.fetch = realFetch;
console.log(`  ${p2} passed, ${f2} failed`);
console.log(`\n  TOTAL: ${pass+p2} passed, ${fail+f2} failed\n`);
process.exit((fail+f2)?1:0);

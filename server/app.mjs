import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const endpoints=new Set(['sessions','meetings','drivers','laps','position','intervals','stints','pit','race_control','weather','car_data','location','team_radio','championship_drivers','championship_teams']);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};
export function createApp({upstreamFetch=fetch,allowedOrigins=process.env.ALLOWED_ORIGINS||''}={}){
 const cache=new Map(),requests=new Map(),origins=new Set(allowedOrigins.split(',').map(x=>x.trim()).filter(Boolean));let nextStart=0,pending=0,cacheBytes=0;
 const json=(res,status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(body))};
 return http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  try{const url=new URL(req.url,'http://localhost');if(url.pathname==='/health'){json(res,200,{status:'ok',service:'apex-data-api',provider:'OpenF1'});return}
   if(url.pathname.startsWith('/api/openf1/')){
    const origin=req.headers.origin;if(origin){if(!origins.has(origin)){json(res,403,{error:'Origin not allowed'});return}res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization');res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');}
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}if(req.method!=='GET'){json(res,405,{error:'GET required'});return}
    const ep=url.pathname.slice('/api/openf1/'.length);if(!endpoints.has(ep)||url.search.length>2048){json(res,400,{error:'Unsupported data request'});return}
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim(),now=Date.now();for(const [k,v] of requests){if(v.until<now)requests.delete(k)}const rate=requests.get(ip)||{count:0,until:now+60000};if(++rate.count>90){json(res,429,{error:'Rate limit exceeded'},{'Retry-After':'60'});return}requests.set(ip,rate);
    const authorization=req.headers.authorization;if(authorization&&(!authorization.startsWith('Bearer ')||authorization.length>4096)){json(res,400,{error:'Invalid authorization format'});return}
    const key=ep+url.search,cached=!authorization&&cache.get(key);if(cached&&cached.until>now){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Data-Source':'OpenF1','X-Cache':'HIT'});res.end(cached.body);return}
    if(pending>=16){json(res,503,{error:'Data queue busy'},{'Retry-After':'5'});return}pending++;const start=Math.max(Date.now(),nextStart);nextStart=start+400;await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));
    try{const upstream=await upstreamFetch('https://api.openf1.org/v1/'+key,{headers:authorization?{Authorization:authorization}:{},signal:AbortSignal.timeout(25000)});if(!upstream.ok){json(res,upstream.status,{error:upstream.status===401||upstream.status===403?'OpenF1 authorization required':upstream.status===429?'OpenF1 rate limit exceeded':'OpenF1 upstream unavailable'},{'Retry-After':upstream.headers.get('Retry-After')||'15'});return}const body=await upstream.text();if(Buffer.byteLength(body)>12*1024*1024){json(res,502,{error:'Response too large; narrow your time range'});return}JSON.parse(body);
     if(!authorization){const bytes=Buffer.byteLength(body);if(cache.has(key)){cacheBytes-=cache.get(key).bytes;cache.delete(key)}while(cache.size>=15||cacheBytes+bytes>24*1024*1024){const first=cache.keys().next().value;if(first===undefined)break;cacheBytes-=cache.get(first).bytes;cache.delete(first)}cache.set(key,{body,bytes,until:Date.now()+15000});cacheBytes+=bytes;}
     res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Data-Source':'OpenF1','X-Cache':'MISS'});res.end(body);
    }finally{pending--}return;
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Method not allowed'});return}
   let name;try{name=decodeURIComponent(url.pathname)}catch{json(res,400,{error:'Invalid path'});return}const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!target.startsWith(root+path.sep)){json(res,403,{error:'Forbidden'});return}let info;try{info=await stat(target)}catch{json(res,404,{error:'Not found'});return}if(!info.isFile()){json(res,404,{error:'Not found'});return}
   res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':name.endsWith('.json')?'public, max-age=300':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch(e){if(!res.headersSent)json(res,e.name==='TimeoutError'?504:502,{error:'Request could not be completed'});else res.end();}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4173);const server=createApp();server.listen(port,'0.0.0.0',()=>console.log('APEX listening on port '+port));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));}

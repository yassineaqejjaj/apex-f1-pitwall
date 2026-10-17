/* Deterministic scenario model. No fitted predictions or proprietary tyre data. */
(function(root){
 function simulateStrategy(input){
  const defaults={remaining:12,age:20,base:100,loss:22,oldDeg:.08,newDeg:.08,advantage:1.4,warmup:1.2,gap:2,rivalDelta:0};
  const x={...defaults,...input};for(const k of Object.keys(defaults)){x[k]=Number(x[k]);if(!Number.isFinite(x[k]))throw Error('Paramètre invalide : '+k)}
  if(!Number.isInteger(x.remaining)||x.remaining<1||x.remaining>100||x.age<0||x.base<=0||x.loss<0||x.oldDeg<0||x.newDeg<0||x.warmup<0||x.gap<0)throw Error('Hypothèses hors limites');
  const old=i=>x.base+x.oldDeg*i;
  const stay=Array.from({length:x.remaining},(_,i)=>old(i));
  const stayTotal=stay.reduce((a,b)=>a+b,0);
  const scenarios=Array.from({length:x.remaining},(_,stop)=>{
   const times=stay.map((v,i)=>i<stop?v:x.base-x.advantage+x.newDeg*(i-stop)+(i===stop?x.warmup+x.loss:0));
   const total=times.reduce((a,b)=>a+b,0);return {stop,total,gain:stayTotal-total,times};
  });
  const best=scenarios.reduce((a,b)=>b.total<a.total?b:a);
  const window=scenarios.filter(s=>s.total<=best.total+1).map(s=>s.stop);
  const undercutGain=(x.base+x.rivalDelta)-(x.base-x.advantage+x.warmup);
  return {input:x,stayTotal,stay,scenarios,best,window,undercutGain,undercutMargin:undercutGain-x.gap};
 }
 root.PitwallStrategy={simulateStrategy};
})(globalThis);

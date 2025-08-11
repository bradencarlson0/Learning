import React from 'react';
export type Weights={aadt:number;frontage:number;demo:number};
export default function WeightsPanel({w,setW}:{w:Weights;setW:(v:Weights)=>void;}){
 const upd=(k:keyof Weights)=>(e:any)=>setW({...w,[k]:Number(e.target.value)});
 return(<div className='bg-slate-900/90 text-white p-3 rounded-xl grid gap-2 w-[280px]'>
  <div className='font-bold text-sm'>Weights</div>
  <label>Demographics <input type='range' min={0} max={100} value={w.demo} onChange={upd('demo')}/> {w.demo}</label>
  <label>Traffic (AADT) <input type='range' min={0} max={100} value={w.aadt} onChange={upd('aadt')}/> {w.aadt}</label>
  <label>Frontage <input type='range' min={0} max={100} value={w.frontage} onChange={upd('frontage')}/> {w.frontage}</label>
  <div className='opacity-80 text-xs'>These influence the composite score used for ranking candidates.</div>
 </div>);
}

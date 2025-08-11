import React from 'react';
export default function ResultsDrawer({items,onExport}:{items:any[];onExport:(it:any)=>void;}){
 return(<div className='absolute right-3 top-3 bottom-3 w-[360px] overflow-auto bg-white/95 border border-slate-200 rounded-xl p-3'>
  <div className='font-extrabold text-base'>Top Candidates</div>
  <div className='text-xs text-slate-600 mb-2'>{items.length} screened</div>
  {items.map((it:any)=>(
    <div key={it.id} className='border border-slate-100 rounded-lg p-2 mb-2'>
     <div className='flex justify-between'><div className='font-semibold'>{it.id}</div><div className='font-extrabold text-emerald-700'>{Math.round(it.score)}</div></div>
     <div className='text-xs text-slate-600'>{it.decision}</div>
     <div className='grid grid-cols-2 gap-1 mt-1 text-xs'>
      <div><b>AADT</b> {it.aadt?.toLocaleString?.()||it.aadt}</div>
      <div><b>Frontage</b> {Math.round(it.frontage)}</div>
      <div><b>Pop 3mi</b> {it.pop3?.toLocaleString?.()||it.pop3}</div>
      <div><b>U6 3mi</b> {it.u6_3?.toLocaleString?.()||it.u6_3}</div>
      <div><b>HHI</b> ${it.hhi?.toLocaleString?.()||it.hhi}</div>
     </div>
     <button onClick={()=>onExport(it)} className='mt-2 w-full bg-slate-900 text-white py-1 rounded'>Export PDF</button>
    </div>
  ))}
 </div>);
}

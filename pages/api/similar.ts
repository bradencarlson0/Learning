import type {NextApiRequest,NextApiResponse} from 'next';
import bboxPolygon from '@turf/bbox-polygon';
const SUBJECTS:any={TEHAMA:{id:'TEHAMA',centroid:[-97.330,32.897]},CAMPWISDOM:{id:'CAMPWISDOM',centroid:[-96.994,32.664]}};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{const {subject_id='TEHAMA',k='30'}=req.query as any;const subj=SUBJECTS[subject_id]??SUBJECTS.TEHAMA;
  const neighbors=Array.from({length:Number(k)}).map((_,i)=>{const dx=(Math.random()-0.5)*0.3,dy=(Math.random()-0.5)*0.25;const lon=subj.centroid[0]+dx,lat=subj.centroid[1]+dy;const g=bboxPolygon([lon-0.001,lat-0.001,lon+0.001,lat+0.001]).geometry;return {id:`P${i+1}`,centroid:[lon,lat] as [number,number],polygon:g,score:Math.random()*0.9+0.1}});
  const gs=bboxPolygon([subj.centroid[0]-0.002,subj.centroid[1]-0.002,subj.centroid[0]+0.002,subj.centroid[1]+0.002]).geometry;
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=3600');res.status(200).json({subject:{id:subj.id,centroid:subj.centroid,polygon:gs,score:1},neighbors});
 }catch(e:any){console.error('similar:',e?.message||e);res.status(500).json({error:'similar failed'})}
}

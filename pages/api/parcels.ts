import type {NextApiRequest,NextApiResponse} from 'next';
const SUBJECTS:Record<string,[number,number]>={
 TEHAMA:[-97.33,32.897],
 CAMPWISDOM:[-96.994,32.664]
};
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{
  const subj=String(req.query.subject||'TEHAMA');
  const [lon,lat]=SUBJECTS[subj]||SUBJECTS.TEHAMA;
  const d=0.1;const bbox=[lon-d,lat-d,lon+d,lat+d];
  const base='https://services2.arcgis.com/uXyoacYrZTPTKD3R/ArcGIS/rest/services/CCAD_Parcel_Feature_Set/FeatureServer/4/query';
  const p=new URLSearchParams({where:'1=1',outFields:'*',f:'geojson',outSR:'4326',geometry:bbox.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',resultRecordCount:'2000',resultOffset:'0'});
  const features:any[]=[];let offset=0;while(true){p.set('resultOffset',String(offset));const r=await fetch(`${base}?${p.toString()}`);if(!r.ok) throw new Error(`parcels ${r.status}`);const gj=await r.json();const batch=gj?.features??[];features.push(...batch);if(batch.length<2000) break;offset+=2000}
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=86400');res.status(200).json({type:'FeatureCollection',features});
 }catch(e:any){console.error('parcels:',e?.message||e);res.status(502).json({error:'Failed to fetch parcels'})}
}

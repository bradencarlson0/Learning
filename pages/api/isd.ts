import type {NextApiRequest,NextApiResponse} from 'next';
export default async function handler(_:NextApiRequest,res:NextApiResponse){
 try{const base='https://services2.arcgis.com/5MVN2jsqIrNZD4tP/arcgis/rest/services/Map/FeatureServer/0/query';
  const params=new URLSearchParams({where:'1=1',outFields:'*',f:'geojson',outSR:'4326',resultRecordCount:'2000',resultOffset:'0'});
  const features:any[]=[];let offset=0;while(true){params.set('resultOffset',String(offset));const r=await fetch(`${base}?${params.toString()}`);if(!r.ok) throw new Error(`ISD ${r.status}`);const gj=await r.json();const batch=gj?.features??[];features.push(...batch);if(batch.length<2000) break;offset+=2000}
  res.setHeader('Cache-Control','s-maxage=604800, stale-while-revalidate=604800');res.status(200).json({type:'FeatureCollection',features});
 }catch(e:any){console.error('isd:',e?.message||e);res.status(502).json({error:'Failed to fetch ISD'})}
}

import type {NextApiRequest,NextApiResponse} from 'next';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{const year=String(req.query.year??2023);
  const base='https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_AADT_Annuals_(Public_View)/FeatureServer/0/query';
  const p=new URLSearchParams({where:`YEAR=${year}`,outFields:'*',f:'geojson',outSR:'4326',resultRecordCount:'1000',resultOffset:'0'});
  const features:any[]=[];let offset=0;while(true){p.set('resultOffset',String(offset));const r=await fetch(`${base}?${p.toString()}`);if(!r.ok) throw new Error(`TxDOT AADT ${r.status}`);const gj=await r.json();const batch=gj?.features??[];features.push(...batch);if(batch.length<1000) break;offset+=1000}
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=86400');res.status(200).json({type:'FeatureCollection',features});
 }catch(e:any){console.error('aadt:',e?.message||e);res.status(502).json({error:'Failed to fetch AADT'})}
}

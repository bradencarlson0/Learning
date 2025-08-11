import type {NextApiRequest,NextApiResponse} from 'next';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 try{const {bbox='-96.94,33.05,-96.78,33.16'}=req.query as any;
  const base='https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Functional_Classification/FeatureServer/0/query';
  const params=new URLSearchParams({where:'1=1',geometry:bbox,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',outFields:'*',f:'geojson',resultRecordCount:'1000',resultOffset:'0'});
  const features:any[]=[];let offset=0;while(true){params.set('resultOffset',String(offset));const r=await fetch(`${base}?${params.toString()}`);if(!r.ok) throw new Error(`TxDOT FC ${r.status}`);const gj=await r.json();const batch=gj?.features??[];features.push(...batch);if(batch.length<1000) break;offset+=1000}
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=86400');res.status(200).json({type:'FeatureCollection',features});
 }catch(e:any){console.error(e);res.status(502).json({error:'Failed to fetch TxDOT Functional Classification'})}
}

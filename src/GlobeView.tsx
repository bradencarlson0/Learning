import {useEffect,useMemo,useRef} from 'react';
import Globe from 'three-globe';
export default function GlobeView({data}:{data:any}){
 const ref=useRef<any>(null);
 const arcs=useMemo(()=>!data?[]:data.neighbors.map((d:any)=>(
  {startLat:data.subject.centroid[1],startLng:data.subject.centroid[0],endLat:d.centroid[1],endLng:d.centroid[0],color:[['#ffffff','#2ad1c9']],arcAltitude:0.12*(d.score??0),stroke:1+2*(d.score??0)}
 )),[data]);
 useEffect(()=>{if(ref.current&&data){ref.current.pointOfView({lat:data.subject.centroid[1],lng:data.subject.centroid[0],altitude:1.4},1200)}},[data]);
 // @ts-ignore
 return <Globe ref={ref} backgroundColor='#040b17' globeImageUrl='//unpkg.com/three-globe/example/img/earth-blue-marble.jpg' arcsData={arcs} arcColor={'color'} arcAltitude={'arcAltitude'} arcStroke={'stroke'} arcDashLength={0.5} arcDashGap={0.2} arcDashAnimateTime={1400}/>;
}

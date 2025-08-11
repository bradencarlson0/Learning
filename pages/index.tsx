// pages/index.tsx
import { useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, PolygonLayer, ArcLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { AmbientLight, DirectionalLight, LightingEffect, MapView, WebMercatorViewport } from '@deck.gl/core';
import useSWR from 'swr';
import * as turf from '@turf/turf';

import WeightsPanel, { Weights } from '../components/WeightsPanel';
import ResultsDrawer from '../components/ResultsDrawer';
import LayerToggles from '../components/LayerToggles';
import type { LayerState } from '../components/LayerToggles';
import CameraBar from '../components/CameraBar';

type FC = { type: 'FeatureCollection'; features: any[] };
const fetcher = (u: string) => fetch(u).then((r) => r.json());

// Seed sites (centroids)
const SUBJECTS: Record<string, { id: string; centroid: [number, number] }> = {
  TEHAMA: { id: 'TEHAMA', centroid: [-97.33, 32.897] },
  CAMPWISDOM: { id: 'CAMPWISDOM', centroid: [-96.994, 32.664] }
};

// Basemap sources (token-free)
const SATELLITE =
  'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const DARK =
  'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
// Hybrid labels overlay (reference)
const HYBRID_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

export default function IndexPage() {
  const [subjectId, setSubjectId] = useState<'TEHAMA' | 'CAMPWISDOM'>('TEHAMA');
  const [weights, setWeights] = useState<Weights>({ demo: 50, aadt: 25, frontage: 25 });
  const [batch, setBatch] = useState<any[]>([]);
  const [viewState, setViewState] = useState<any>({
    longitude: SUBJECTS.TEHAMA.centroid[0],
    latitude: SUBJECTS.TEHAMA.centroid[1],
    zoom: 12,
    pitch: 0,
    bearing: 0
  });
  const [layersOn, setLayersOn] = useState<LayerState & { labels: boolean }>({
    basemap: 'satellite',
    neighbors: true,
    arcs: false,
    aadt: true,
    isd: true,
    wetlands: true,
    parcels: true,
    centers: true,
    labels: true // NEW: hybrid labels toggle
  });

  const subject = SUBJECTS[subjectId];

  // Data fetch
  const { data: sim } = useSWR(`/api/similar?subject_id=${subjectId}&k=30`, fetcher);
  const { data: aadt } = useSWR(`/api/aadt?year=2023`, fetcher);
  const { data: isd } = useSWR(`/api/isd`, fetcher);
  const { data: wet } = useSWR(`/api/wetlands?subject=${subjectId}`, fetcher);
  const { data: parcels } = useSWR(`/api/parcels?subject=${subjectId}`, fetcher);
  const { data: centers } = useSWR(`/api/centers`, fetcher); // after `npm run geocode`

  // Background
  useEffect(() => {
    document.body.style.background = '#0a0f1c';
    return () => {
      document.body.style.background = '';
    };
  }, []);

  // Subtle depth
  const lighting = useMemo(
    () =>
      new LightingEffect({
        ambientLight: new AmbientLight({ intensity: 1 }),
        dirLight: new DirectionalLight({ intensity: 1, direction: [-1, -3, -1] })
      }),
    []
  );

  // Fly to subject when changed
  useEffect(() => {
    setViewState((vs: any) => ({
      ...vs,
      longitude: sim?.subject?.centroid?.[0] ?? subject.centroid[0],
      latitude: sim?.subject?.centroid?.[1] ?? subject.centroid[1],
      zoom: 12,
      pitch: 0,
      bearing: 0
    }));
  }, [sim, subject]);

  // Base imagery
  const baseTiles = useMemo(
    () =>
      new TileLayer<any>({
        id: 'basemap',
        data: layersOn.basemap === 'satellite' ? SATELLITE : DARK,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: (props: any) =>
          new BitmapLayer(props, {
            image: props.data,
            bounds: props.tile.bbox,
            opacity: layersOn.basemap === 'satellite' ? 0.95 : 0.85
          })
      }),
    [layersOn.basemap]
  );

  // Hybrid labels overlay
  const labelTiles = useMemo(
    () =>
      new TileLayer<any>({
        id: 'labels',
        data: HYBRID_LABELS,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        visible: layersOn.labels,
        renderSubLayers: (props: any) =>
          new BitmapLayer(props, {
            image: props.data,
            bounds: props.tile.bbox,
            opacity: 0.85
          })
      }),
    [layersOn.labels]
  );

  const layers = useMemo(() => {
    const L: any[] = [baseTiles, labelTiles];
    if (!sim) return L;

    // Subject polygon
    L.push(
      new PolygonLayer<any>({
        id: 'subject',
        data: [sim.subject],
        extruded: false,
        getPolygon: (d: any) => d.polygon,
        getFillColor: [255, 255, 255, 30],
        getLineColor: [255, 255, 255, 220],
        lineWidthMinPixels: 2
      })
    );

    // Similar neighbors
    if (layersOn.neighbors) {
      L.push(
        new PolygonLayer<any>({
          id: 'neighbors',
          data: sim.neighbors,
          pickable: true,
          extruded: true,
          elevationScale: 1,
          getPolygon: (d: any) => d.polygon,
          getElevation: (d: any) => 220 * (d.score ?? 0),
          getFillColor: (d: any) => {
            const c = Math.max(0, Math.min(1, d.score ?? 0));
            return [50 + 20 * c, 210, 195 + 40 * c, 170];
          },
          getLineColor: [30, 140, 130, 150],
          lineWidthMinPixels: 1
        })
      );
    }

    // Connector arcs (OFF by default)
    if (layersOn.arcs) {
      L.push(
        new ArcLayer<any>({
          id: 'arcs',
          data: sim.neighbors,
          getSourcePosition: () => sim.subject.centroid,
          getTargetPosition: (d: any) => d.centroid,
          getHeight: (d: any) => 15000 * (d.score ?? 0),
          getSourceColor: [255, 255, 255, 60],
          getTargetColor: [60, 220, 200, 180],
          getWidth: 1
        })
      );
    }

    // AADT points (clamped radii)
    if (layersOn.aadt && aadt) {
      L.push(
        new GeoJsonLayer<any>({
          id: 'aadt',
          data: aadt as FC,
          pointType: 'circle',
          pickable: true,
          pointRadiusUnits: 'pixels',
          getPointRadius: (f: any) => {
            const v = Math.max(0, Math.min(1, (f.properties?.AADT ?? 0) / 100000));
            return 3 + v * 12; // 3–15px
          },
          getFillColor: (f: any) => {
            const v = Math.max(0, Math.min(1, (f.properties?.AADT ?? 0) / 100000));
            return [250 * (1 - v), 150 + 70 * v, 120 + 120 * v, 210];
          },
          getLineColor: [20, 20, 20, 180],
          lineWidthMinPixels: 1
        })
      );
    }

    // ISD boundaries (thin magenta)
    if (layersOn.isd && isd) {
      L.push(
        new GeoJsonLayer<any>({
          id: 'isd',
          data: isd as FC,
          visible: viewState.zoom >= 8.5,
          stroked: true,
          filled: false,
          getLineColor: [255, 0, 197, 160],
          lineWidthMinPixels: 1
        })
      );
    }

    // Wetlands (close zooms)
    if (layersOn.wetlands && wet) {
      L.push(
        new GeoJsonLayer<any>({
          id: 'wet',
          data: wet as FC,
          visible: viewState.zoom >= 10,
          stroked: false,
          filled: true,
          getFillColor: [40, 140, 255, 70]
        })
      );
    }

    // Parcel boundaries
    if (layersOn.parcels && parcels) {
      L.push(
        new GeoJsonLayer<any>({
          id: 'parcels',
          data: parcels as FC,
          visible: viewState.zoom >= 15,
          stroked: true,
          filled: false,
          getLineColor: [115, 76, 0, 200],
          lineWidthMinPixels: 1
        })
      );
    }

    // TLE centers
    if (layersOn.centers && centers) {
      L.push(
        new GeoJsonLayer<any>({
          id: 'centers',
          data: centers as FC,
          pickable: true,
          pointType: 'circle',
          pointRadiusUnits: 'pixels',
          getPointRadius: 5,
          getFillColor: [60, 220, 200, 220],
          getLineColor: [0, 0, 0, 200],
          lineWidthMinPixels: 1
        })
      );
    }

    return L;
  }, [sim, aadt, isd, wet, parcels, centers, baseTiles, labelTiles, layersOn, viewState.zoom]);

  // ----- Actions -----
  async function runBatch() {
    const pts =
      (centers?.features || [])
        .slice(0, 24)
        .map((f: any, i: number) => ({
          id: f.properties?.id || `TLE-${i + 1}`,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1]
        })) || [];

    if (!pts.length) {
      for (let i = 0; i < 12; i++) {
        pts.push({
          id: `CAND-${i + 1}`,
          lon: subject.centroid[0] + (Math.random() - 0.5) * 0.25,
          lat: subject.centroid[1] + (Math.random() - 0.5) * 0.2
        });
      }
    }

    const r = await fetch(`/api/screen-batch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ items: pts })
    });
    const j = await r.json();

    const w = weights;
    const wsum = Math.max(1, w.demo + w.aadt + w.frontage);
    const items = j.items
      .map((x: any) => ({
        ...x,
        score:
          ((w.demo * ((x.pop3 / 30000 + x.u6_3 / 2000 + x.hhi / 85000) / 3)) +
            w.aadt * Math.min(1.5, x.aadt / 40000) +
            w.frontage * Math.min(1, x.frontage / 200)) /
          wsum *
          100
      }))
      .sort((a: any, b: any) => b.score - a.score);

    setBatch(items);
  }

  function exportPdf(it: any) {
    const url = `/api/report?lat=${it.lat}&lon=${it.lon}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `deal-${it.id}.pdf`;
    a.click();
  }

  function snapTopDownNorth() {
    setViewState((vs: any) => ({ ...vs, pitch: 0, bearing: 0 }));
  }
  function snapIsometric() {
    setViewState((vs: any) => ({ ...vs, pitch: 55, bearing: -18 }));
  }
  function resetToSubject() {
    setViewState((vs: any) => ({
      ...vs,
      longitude: sim?.subject?.centroid?.[0] ?? subject.centroid[0],
      latitude: sim?.subject?.centroid?.[1] ?? subject.centroid[1],
      zoom: 12
    }));
  }
  function fitNeighbors() {
    if (!sim?.neighbors?.length) return;
    const union = turf.featureCollection(sim.neighbors.map((n: any) => turf.centroid(n)));
    const bb = turf.bbox(union) as [number, number, number, number];
    const vp = new WebMercatorViewport({
      width: window.innerWidth,
      height: window.innerHeight
    }).fitBounds(
      [
        [bb[0], bb[1]],
        [bb[2], bb[3]]
      ],
      { padding: 100, maxZoom: 15 }
    );
    setViewState((vs: any) => ({ ...vs, ...vp, pitch: 0, bearing: 0 }));
  }

  const getTooltip = (info: any) => {
    const { object, layer } = info;
    if (!object) return null;
    if (layer.id === 'neighbors') {
      const id = object.properties?.id ?? object.id ?? 'Neighbor';
      const score = object.score ?? object.properties?.score;
      const scoreLine = typeof score === 'number' ? `\nScore: ${score.toFixed(2)}` : '';
      return { text: `${id}${scoreLine}` };
    }
    if (layer.id === 'aadt') {
      return { text: `AADT: ${object.properties?.AADT ?? 'n/a'}` };
    }
    if (layer.id === 'centers') {
      const id = object.properties?.id ?? object.id ?? 'Center';
      return { text: `${id}` };
    }
    return null;
  };

  return (
    <div style={{ height: '100vh' }}>
      <DeckGL
        views={new MapView({ repeat: true })}
        controller
        effects={[lighting] as any}
        viewState={viewState as any}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        layers={layers as any}
        getTooltip={getTooltip}
      />

      {/* Top bar */}
      <div className="absolute top-3 left-3 flex gap-2">
        <select
          className="border rounded px-2 py-1 bg-white/90"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value as any)}
        >
          <option value="TEHAMA">9056 Tehama Ridge</option>
          <option value="CAMPWISDOM">2804 W Camp Wisdom</option>
        </select>
        <button className="bg-emerald-600 text-white px-3 rounded" onClick={runBatch}>
          Screen batch
        </button>
        <a className="bg-indigo-600 text-white px-3 rounded" href="/api/finance" target="_blank" rel="noreferrer">
          TLE Finance Preset
        </a>
      </div>

      {/* Left tools */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-3">
        <WeightsPanel w={weights} setW={setWeights} />
        <LayerToggles
          state={layersOn as LayerState & { labels: boolean }}
          setState={setLayersOn as any}
          zoom={viewState.zoom}
        />
        <CameraBar onTopDown={snapTopDownNorth} onIso={snapIsometric} onReset={resetToSubject} onFit={fitNeighbors} />
      </div>

      {/* Right drawer */}
      <ResultsDrawer items={batch} onExport={exportPdf} />
    </div>
  );
}

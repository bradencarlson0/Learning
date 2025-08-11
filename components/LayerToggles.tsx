import React from 'react';

export type LayerState = {
  basemap: 'satellite' | 'dark';
  neighbors: boolean;
  arcs: boolean;
  aadt: boolean;
  isd: boolean;
  wetlands: boolean;
  parcels: boolean;
  centers: boolean;
  labels: boolean
};

export default function LayerToggles({
  state,
  setState,
  zoom
}: {
  state: LayerState;
  setState: (s: LayerState) => void;
  zoom: number;
}) {
  const flip = (k: keyof LayerState) => setState({ ...state, [k]: !state[k] } as LayerState);
  const setBase = (b: 'satellite' | 'dark') => setState({ ...state, basemap: b });
  const wetlandsReady = zoom >= 10;
  const parcelsReady = zoom >= 15;

  return (
    <div className="bg-slate-900/90 text-white p-3 rounded-xl grid gap-2 w-[280px]">
      <div className="font-bold text-sm">Layers</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={state.basemap === 'satellite'} onChange={() => setBase('satellite')} />
          Satellite
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={state.basemap === 'dark'} onChange={() => setBase('dark')} />
          Dark
        </label>

        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={state.neighbors} onChange={() => flip('neighbors')} />
          Similarity polygons
        </label>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={state.arcs} onChange={() => flip('arcs')} />
          Connectors (arcs)
        </label>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={state.aadt} onChange={() => flip('aadt')} />
          Traffic (AADT)
        </label>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={state.isd} onChange={() => flip('isd')} />
          School districts
        </label>
        <label className="flex items-center gap-2 col-span-2" title="Visible at zoom ≥ 10">
          <input
            type="checkbox"
            checked={state.wetlands}
            onChange={() => flip('wetlands')}
            disabled={!wetlandsReady}
          />
          Wetlands {!wetlandsReady && '(zoom ≥ 10)'}
        </label>
        <label className="flex items-center gap-2 col-span-2" title="Visible at zoom ≥ 15">
          <input
            type="checkbox"
            checked={state.parcels}
            onChange={() => flip('parcels')}
            disabled={!parcelsReady}
          />
          Parcels {!parcelsReady && '(zoom ≥ 15)'}
        </label>
        <label className="flex items-center gap-2 col-span-2">
          <input type="checkbox" checked={state.centers} onChange={() => flip('centers')} />
          TLE centers
        </label>
      </div>
    </div>
  );
}

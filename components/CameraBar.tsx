import React from 'react';

export default function CameraBar({
  onTopDown,
  onIso,
  onReset,
  onFit
}: {
  onTopDown: () => void;
  onIso: () => void;
  onReset: () => void;
  onFit: () => void;
}) {
  return (
    <div className="bg-slate-900/90 text-white p-3 rounded-xl grid gap-2 w-[280px]">
      <div className="font-bold text-sm">Camera</div>
      <div className="grid grid-cols-2 gap-2">
        <button className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1" onClick={onTopDown}>
          Top-down (North)
        </button>
        <button className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1" onClick={onIso}>
          Isometric
        </button>
        <button className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1" onClick={onReset}>
          Reset to site
        </button>
        <button className="bg-slate-700 hover:bg-slate-600 rounded px-2 py-1" onClick={onFit}>
          Fit candidates
        </button>
      </div>
    </div>
  );
}

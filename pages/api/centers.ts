import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const p = path.join(process.cwd(), 'public', 'centers.geojson');
    const gj = await fs.readFile(p, 'utf-8');  // written by `npm run geocode`
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=604800');
    res.status(200).send(gj);
  } catch (e: any) {
    res.status(404).json({ error: 'centers.geojson not found. Run `npm run geocode` first.' });
  }
}

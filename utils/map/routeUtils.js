import haversine from 'haversine-distance';
import { GOOGLE_MAPS_APIKEY } from '../../config/config';

// Deduplicate points by small distance threshold (default 20m)
export function deduplicatePoints(data = [], minDistance = 20) {
  if (!data || !data.length) return [];
  const out = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const prev = out[out.length - 1];
    const curr = data[i];
    const dist = haversine({ latitude: prev.latitude, longitude: prev.longitude }, { latitude: curr.latitude, longitude: curr.longitude });
    if (dist > minDistance) out.push(curr);
  }
  return out;
}

function chunkArray(arr = [], size = 100) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function snapToRoads(points = []) {
  if (!GOOGLE_MAPS_APIKEY || !points.length) return [];
  const path = points.map(p => `${p.latitude},${p.longitude}`).join('|');
  const url = `https://roads.googleapis.com/v1/snapToRoads?path=${path}&interpolate=true&key=${GOOGLE_MAPS_APIKEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return (json.snappedPoints || []).map(p => ({ latitude: p.location.latitude, longitude: p.location.longitude }));
  } catch (err) {
    return [];
  }
}

async function fetchDirections(points = []) {
  if (!GOOGLE_MAPS_APIKEY || points.length < 2) return [];
  const origin = `${points[0].latitude},${points[0].longitude}`;
  const destination = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
  const waypoints = points.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join('|');
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_APIKEY}&mode=driving${waypoints ? `&waypoints=${waypoints}` : ''}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const steps = json.routes?.[0]?.legs?.flatMap(leg => leg.steps) || [];
    return steps.map(step => ({ latitude: step.end_location.lat, longitude: step.end_location.lng }));
  } catch (err) {
    return [];
  }
}

export async function buildOptimizedRoute(points = []) {
  if (!points || !points.length) return [];
  try {
    const clean = deduplicatePoints(points, 20);
    const chunks = chunkArray(clean, 100);
    let snapped = [];
    for (const c of chunks) {
      // try snapToRoads but fallback to original chunk
      const s = await snapToRoads(c);
      snapped.push(...(s.length ? s : c));
    }
    const final = await fetchDirections(snapped.length ? snapped : clean);
    return final.length ? final : (snapped.length ? snapped : clean);
  } catch (err) {
    return points;
  }
}

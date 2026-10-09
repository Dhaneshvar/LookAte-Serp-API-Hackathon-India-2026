export type LatLng = [number, number];

export interface Place {
  id: string;
  title: string;
  category?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  latitude: number;
  longitude: number;
  open_state?: string;
  thumbnail?: string;
}

export interface Route {
  points: LatLng[];
  cumKm: number[];
  distanceKm: number;
  durationMin: number;
  legs: { distanceKm: number; durationMin: number }[];
  stopIndex: number[];
  roadRouted: boolean;
}

export const haversineKm = (a: LatLng, b: LatLng) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export function orderNearestFirst(start: LatLng, places: Place[]): Place[] {
  const remaining = [...places];
  const ordered: Place[] = [];
  let cur = start;
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineKm(cur, [remaining[i].latitude, remaining[i].longitude]) <
          haversineKm(cur, [remaining[best].latitude, remaining[best].longitude])) best = i;
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    cur = [next.latitude, next.longitude];
  }
  return ordered;
}

function cumulative(points: LatLng[]) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversineKm(points[i - 1], points[i]));
  return cum;
}

function locateStops(points: LatLng[], stops: Place[]) {
  const idx: number[] = [];
  let from = 0;
  for (const s of stops) {
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < points.length; i++) {
      const d = haversineKm(points[i], [s.latitude, s.longitude]);
      if (d < bestD) { bestD = d; best = i; }
    }
    idx.push(best);
    from = best;
  }
  return idx;
}

export async function buildRoute(start: LatLng, stops: Place[]): Promise<Route> {
  const waypoints: LatLng[] = [start, ...stops.map(s => [s.latitude, s.longitude] as LatLng)];

  try {
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) throw new Error('no route');
    const points: LatLng[] = r.geometry.coordinates.map(([lng, lat]: number[]) => [lat, lng]);
    return {
      points,
      cumKm: cumulative(points),
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      legs: r.legs.map((l: any) => ({ distanceKm: l.distance / 1000, durationMin: l.duration / 60 })),
      stopIndex: locateStops(points, stops),
      roadRouted: true,
    };
  } catch {
    const legs = waypoints.slice(1).map((w, i) => {
      const km = haversineKm(waypoints[i], w);
      return { distanceKm: km, durationMin: (km / 30) * 60 };
    });
    const cumKm = cumulative(waypoints);
    return {
      points: waypoints,
      cumKm,
      distanceKm: cumKm[cumKm.length - 1],
      durationMin: legs.reduce((a, l) => a + l.durationMin, 0),
      legs,
      stopIndex: waypoints.slice(1).map((_, i) => i + 1),
      roadRouted: false,
    };
  }
}

export function positionAt(route: Route, progress: number): { pos: LatLng; index: number } {
  const total = route.cumKm[route.cumKm.length - 1] || 1;
  const d = Math.min(Math.max(progress, 0), 1) * total;
  let lo = 0;
  let hi = route.cumKm.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route.cumKm[mid] < d) lo = mid + 1; else hi = mid;
  }
  const i = Math.max(lo, 1);
  const a = route.points[i - 1];
  const b = route.points[i] ?? a;
  const seg = route.cumKm[i] - route.cumKm[i - 1] || 1;
  const t = Math.min(Math.max((d - route.cumKm[i - 1]) / seg, 0), 1);
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], index: i - 1 };
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Circle, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Mic, Send, Square, Play, Pause, Navigation, Star, ExternalLink, Minus, Maximize2, X, Search,
  VolumeX, Route as RouteIcon, Camera, ImagePlus, LocateFixed,
} from 'lucide-react';
import FluidOrb from '@/components/ui/fluid-orb';
import {
  LatLng, Place, Route, buildRoute, orderNearestFirst, positionAt,
} from '@/lib/route';
import { shrinkImage } from '@/lib/image';
import { kindOf, kindSvg } from '@/lib/placeKind';

interface ToolStep {
  tool: string;
  label: string;
  source?: string | null;
  args?: { query?: string; destination?: string };
}

interface ImageItem {
  title?: string | null;
  thumbnail: string;
  source?: string | null;
  link?: string | null;
}

interface CardItem {
  title: string;
  subtitle?: string;
  rating?: number | null;
  reviews?: number | null;
  link?: string | null;
  thumbnail?: string | null;
  provider?: string;
}

interface SourceItem {
  title: string;
  link: string;
  source?: string | null;
}

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  places?: Place[];
  tools?: ToolStep[];
  image?: string;
  hint?: string;
  images?: ImageItem[];
  cards?: CardItem[];
  sources?: SourceItem[];
}

type VoiceState = 'idle' | 'listening' | 'thinking';
type PanelState = 'open' | 'min' | 'closed';
type Journey = { status: 'idle' | 'running' | 'paused' | 'done'; p: number };

const DEFAULT_START: LatLng = [11.9416, 79.8083];
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PHOTO_PROMPT = 'What is this? If it is food, find places near me that serve it. If it is a place, tell me about it and show it on the map.';
const QUICK = ['Best cafes nearby', 'Optimize my itinerary', 'Sunset spots', 'Street food'];

const readItinerary = () => {
  try {
    const raw = JSON.parse(localStorage.getItem('lookate_todos') || '[]');
    return Array.isArray(raw)
      ? raw.map((t: any) => ({ title: t.title, completed: !!t.completed, hashtags: t.hashtags || [] }))
      : [];
  } catch {
    return [];
  }
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const plain = (t: string) =>
  t.replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ');

const userIcon = L.divIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 8px rgba(37,99,235,.25)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const vehicleIcon = L.divIcon({
  className: '',
  html: '<div style="width:26px;height:26px;border-radius:50%;background:#06b6d4;border:3px solid #fff;box-shadow:0 0 0 10px rgba(6,182,212,.3)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});
const stopIcon = (n: number, visited: boolean, place: Place, hint: string) => {
  const kind = kindOf(place, hint);
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:38px;height:38px">
      <div style="width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${visited ? '#0891b2' : kind.color};border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.4)">${kindSvg(kind, 18)}</div>
      <div style="position:absolute;top:-7px;right:-7px;min-width:19px;height:19px;padding:0 4px;box-sizing:border-box;border-radius:10px;background:${visited ? '#0e7490' : '#0f172a'};color:#fff;font:700 11px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid #fff">${visited ? '✓' : n}</div>
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
};

function FitTo({ points, token }: { points: LatLng[]; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [desktop ? 430 : 30, 40],
      paddingBottomRight: [30, desktop ? 40 : Math.round(window.innerHeight * 0.45)],
      maxZoom: 16,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return null;
}

function Follow({ pos, on }: { pos: LatLng | null; on: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (on && pos) map.setView(pos, Math.max(map.getZoom(), 15), { animate: false });
  }, [pos, on, map]);
  return null;
}

function Recenter({ pos, token, panelOpen }: { pos: LatLng; token: number; panelOpen: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!token) return;
    map.setView(pos, 16, { animate: false });
    if (panelOpen) {
      // Aim at the part of the map the chat panel does not cover
      const desktop = window.matchMedia('(min-width: 768px)').matches;
      map.panBy(desktop ? [-203, 0] : [0, Math.round(map.getSize().y * 0.22)], { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return null;
}

type LocStatus = 'locating' | 'ok' | 'denied' | 'unavailable';

interface Props {
  itineraryToken?: number;
}

export default function JourneyView({ itineraryToken = 0 }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, sender: 'ai', time: now(), text: 'Tap the mic or type. Ask for places, food or a route and I will plot it on the map.' },
  ]);
  const [input, setInput] = useState('');
  const [voice, setVoice] = useState<VoiceState>('idle');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState<LatLng>(DEFAULT_START);
  const [stops, setStops] = useState<Place[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [journey, setJourney] = useState<Journey>({ status: 'idle', p: 0 });
  const [panel, setPanel] = useState<PanelState>('open');
  const [kindHint, setKindHint] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const [locStatus, setLocStatus] = useState<LocStatus>('locating');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [centerToken, setCenterToken] = useState(0);
  const watchRef = useRef<number | null>(null);
  const latest = useRef({ messages, stops, start, photo, located: locStatus === 'ok' });
  latest.current = { messages, stops, start, photo, located: locStatus === 'ok' };

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocStatus('unavailable');
      return;
    }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    setLocStatus('locating');
    let first = true;
    const stop = () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
    watchRef.current = navigator.geolocation.watchPosition(
      p => {
        setStart([p.coords.latitude, p.coords.longitude]);
        setAccuracy(p.coords.accuracy);
        setLocStatus('ok');
        if (first) {
          first = false;
          setCenterToken(t => t + 1);
        }
        if (p.coords.accuracy <= 50) stop();
      },
      err => {
        stop();
        setLocStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
    window.setTimeout(stop, 25000);
  }, []);

  useEffect(() => {
    locate();
    return () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
      recRef.current?.abort?.();
      window.speechSynthesis?.cancel();
    };
  }, [locate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, panel]);

  const plot = useCallback(async (places: Place[], ordered = false) => {
    const from = latest.current.start;
    const list = ordered ? places : orderNearestFirst(from, places);
    setStops(list);
    setJourney({ status: 'idle', p: 0 });
    const r = await buildRoute(from, list);
    setRoute(r);
    setFitToken(t => t + 1);
  }, []);

  // Load the optimized itinerary when arriving from the Itinerary tab
  useEffect(() => {
    if (!itineraryToken) return;
    (async () => {
      try {
        const res = await fetch('/locations');
        const data = await res.json();
        const places: Place[] = (data.locations || [])
          .filter((l: any) => l.latitude && l.longitude)
          .map((l: any, i: number) => ({ ...l, id: String(l.id ?? i), title: l.title }));
        if (!places.length) return;
        setPanel('open');
        await plot(places, true);
        setMessages(m => [...m, { id: Date.now(), sender: 'ai', time: now(), text: `Here is your optimized itinerary: ${places.length} stops, ordered for the shortest trip.`, places }]);
      } catch {
        setError('Could not load your itinerary from the server.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryToken]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await shrinkImage(file));
      setError('');
      setPanel('open');
    } catch {
      setError("Couldn't read that image. Try a JPEG or PNG photo under 20 MB.");
    }
  };

  const openPicker = (mode: 'camera' | 'file') => {
    setPhotoMenu(false);
    (mode === 'camera' ? camRef : fileRef).current?.click();
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(plain(text));
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  };

  const send = async (text: string, viaVoice = false) => {
    const attached = latest.current.photo;
    const message = text.trim() || (attached ? PHOTO_PROMPT : '');
    if (!message || busyRef.current) return;
    busyRef.current = true;
    setPhoto(null);
    setPhotoMenu(false);
    stopSpeaking();
    setError('');
    setInput('');
    setBusy(true);
    setVoice('thinking');
    setPanel('open');
    const { messages: history, stops: onMap, start: from, located } = latest.current;
    setMessages(m => [...m, { id: Date.now(), sender: 'user', text: message, time: now(), image: attached || undefined }]);

    let reply = '';
    let places: Place[] = [];
    let tools: ToolStep[] = [];
    let ordered = false;
    let images: ImageItem[] = [];
    let cards: CardItem[] = [];
    let sources: SourceItem[] = [];
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          lat: from[0],
          lng: from[1],
          located,
          map_places: onMap.map(s => s.title),
          itinerary: readItinerary(),
          ...(attached ? { image: attached } : {}),
          context: history.slice(-8).map(m => ({ role: m.sender === 'ai' ? 'assistant' : 'user', content: m.text })),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.response) throw new Error(data.error || 'Invalid response');
      reply = data.response;
      places = data.places || [];
      tools = data.tools || [];
      ordered = !!data.ordered;
      images = data.images || [];
      cards = data.cards || [];
      sources = data.sources || [];
    } catch (e: any) {
      reply = e?.message?.includes('not configured')
        ? e.message
        : "I couldn't reach the AI service. Check that the backend is running and try again.";
    }

    const hint = tools.map(t => t.args?.query || t.args?.destination || '').join(' ');
    setMessages(m => [...m, {
      id: Date.now() + 1, sender: 'ai', time: now(), text: reply,
      places: places.length ? places : undefined, tools: tools.length ? tools : undefined,
      images: images.length ? images : undefined, cards: cards.length ? cards : undefined,
      sources: sources.length ? sources : undefined, hint,
    }]);
    if (places.length) setKindHint(hint);
    setVoiceOpen(false);
    if (places.length) await plot(places, ordered);
    if (viaVoice) speak(reply);
    busyRef.current = false;
    setBusy(false);
    setVoice('idle');
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge, or type your question.');
      return;
    }
    stopSpeaking();
    recRef.current?.abort?.();
    const rec = new SR();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let text = '';
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      setTranscript(text);
      if (final) send(text, true);
    };
    rec.onerror = (e: any) => {
      setVoice('idle');
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'Microphone access is blocked. Allow it in the browser to use voice.'
          : e.error === 'no-speech' ? 'I did not hear anything. Tap the orb to try again.' : 'Voice input failed. Tap the orb to retry or type instead.',
      );
    };
    rec.onend = () => setVoice(v => (v === 'listening' ? 'idle' : v));
    recRef.current = rec;
    setError('');
    setTranscript('');
    setVoice('listening');
    rec.start();
  };

  const openVoice = () => {
    setVoiceOpen(true);
    startListening();
  };

  const closeVoice = () => {
    recRef.current?.abort?.();
    setVoiceOpen(false);
    if (!busyRef.current) setVoice('idle');
  };

  // Journey animation along the route
  useEffect(() => {
    if (journey.status !== 'running' || !route) return;
    const durationMs = Math.min(Math.max(route.distanceKm * 4, 12), 40) * 1000;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setJourney(j => {
        if (j.status !== 'running') return j;
        const p = Math.min(1, j.p + dt / durationMs);
        return { status: p >= 1 ? 'done' : 'running', p };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [journey.status, route]);

  const live = useMemo(() => (route && journey.status !== 'idle' ? positionAt(route, journey.p) : null), [route, journey]);
  const visited = route
    ? route.stopIndex.map(si => journey.status === 'done' || (journey.status !== 'idle' && !!live && si <= live.index))
    : [];
  const nextIdx = visited.findIndex(v => !v);
  const nextStop = nextIdx >= 0 ? stops[nextIdx] : null;
  const toNextKm = route && live && nextIdx >= 0 ? Math.max(route.cumKm[route.stopIndex[nextIdx]] - route.cumKm[live.index], 0) : 0;
  const traveled = route && live ? [...route.points.slice(0, live.index + 1), live.pos] : [];
  const fitPoints = useMemo<LatLng[]>(() => [start, ...stops.map(s => [s.latitude, s.longitude] as LatLng)], [start, stops]);
  const orbScale = voice === 'listening' ? 'scale-110' : voice === 'thinking' ? 'scale-100 animate-pulse' : 'scale-90 opacity-80';
  const status =
    voice === 'listening' ? ['Listening...', 'Ask about places, food or routes']
    : voice === 'thinking' ? ['Thinking...', 'Asking the AI and searching Google Maps']
    : speaking ? ['Speaking...', 'Tap the speaker to stop']
    : journey.status === 'running' ? ['On your way', nextStop ? `Next: ${nextStop.title}` : 'Almost there']
    : ['Ready', 'Tap the mic and ask about places, food or routes'];

  return (
    <div className="absolute inset-0">
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={start} zoom={14} zoomControl={false} className="h-full w-full" style={{ background: '#e8eef5' }}>
          <TileLayer url={TILES} attribution={TILE_ATTR} maxZoom={19} />
          <ZoomControl position="topright" />
          <FitTo points={fitPoints} token={fitToken} />
          <Follow pos={journey.status === 'running' && live ? live.pos : null} on={journey.status === 'running'} />
          <Recenter pos={start} token={centerToken} panelOpen={panel === 'open'} />
          {locStatus === 'ok' && accuracy !== null && accuracy < 3000 && (
            <Circle center={start} radius={accuracy} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.1 }} />
          )}
          <Marker position={start} icon={userIcon}>
            <Popup>{locStatus === 'ok' ? `You are here${accuracy !== null ? ` (within ${Math.round(accuracy)} m)` : ''}` : 'Default location. Your real location is not available yet.'}</Popup>
          </Marker>
          {route && (
            <>
              <Polyline positions={route.points} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.9 }} />
              <Polyline positions={route.points} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.95, dashArray: route.roadRouted ? undefined : '8 10' }} />
              {traveled.length > 1 && <Polyline positions={traveled} pathOptions={{ color: '#06b6d4', weight: 6 }} />}
            </>
          )}
          {stops.map((s, i) => {
            const kind = kindOf(s, kindHint);
            return (
              <Marker key={s.id + i} position={[s.latitude, s.longitude]} icon={stopIcon(i + 1, !!visited[i], s, kindHint)}>
                <Tooltip direction="top" offset={[0, -20]} opacity={1} className="lookate-tip">
                  <p className="text-sm font-semibold text-white leading-tight">{i + 1}. {s.title}</p>
                  <p className="text-xs text-blue-200/70">{s.category && s.category !== kind.label ? `${kind.label} · ${s.category}` : kind.label}</p>
                  {(s.rating || s.open_state) ? (
                    <p className="text-xs mt-0.5">
                      {s.rating ? <span className="text-amber-300">★ {s.rating}{s.reviews ? ` (${s.reviews})` : ''}</span> : null}
                      {s.rating && s.open_state ? <span className="text-blue-200/50"> · </span> : null}
                      {s.open_state ? <span className="text-emerald-300">{s.open_state}</span> : null}
                    </p>
                  ) : null}
                </Tooltip>
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <p className="font-semibold text-sm text-white">{i + 1}. {s.title}</p>
                    <p className="text-xs text-blue-200/70">{kind.label}</p>
                    {s.rating ? <p className="text-xs text-amber-300">★ {s.rating}{s.reviews ? ` (${s.reviews})` : ''}</p> : null}
                    {s.address && <p className="text-xs text-blue-100/80">{s.address}</p>}
                    <a className="lookate-link text-xs" target="_blank" rel="noreferrer"
                       href={`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`}>Open in Google Maps</a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          {live && journey.status !== 'done' && <Marker position={live.pos} icon={vehicleIcon} />}
        </MapContainer>
      </div>

      {/* Locate-me button and location status */}
      <button
        onClick={locate}
        aria-label="Show my location"
        title="Show my location"
        className="absolute z-10 right-[10px] top-[86px] w-[34px] h-[34px] rounded-[4px] bg-white text-slate-700 shadow border border-black/20 flex items-center justify-center hover:bg-slate-100"
      >
        <LocateFixed className={`w-5 h-5 ${locStatus === 'locating' ? 'animate-pulse text-blue-600' : locStatus === 'ok' ? 'text-blue-600' : ''}`} />
      </button>
      {locStatus !== 'ok' && (
        <div className="absolute z-10 top-3 left-3 right-14 md:left-[422px] md:right-auto md:max-w-sm rounded-xl bg-slate-950/85 backdrop-blur-xl border border-white/15 px-3 py-2 text-xs text-blue-100 shadow-lg">
          {locStatus === 'locating' && 'Finding your location...'}
          {locStatus === 'denied' && 'Location is blocked, so the map shows a default area. Allow location for this site in your browser, then tap the locate button.'}
          {locStatus === 'unavailable' && "Couldn't get your location, so the map shows a default area. Tap the locate button to retry. Phones need https to share location."}
        </div>
      )}

      {/* Reopen button when the chat is closed */}
      {panel === 'closed' && (
        <button
          onClick={() => setPanel('open')}
          className="absolute z-10 left-4 bottom-4 flex items-center gap-3 rounded-full bg-slate-950/85 backdrop-blur-xl border border-white/15 pl-2 pr-5 py-2 shadow-xl text-white hover:bg-slate-900/90 transition-colors"
        >
          <FluidOrb size={36} color="#1A73F2" />
          <span className="text-sm font-semibold">Ask LookAte</span>
        </button>
      )}

      {/* Assistant panel */}
      {panel !== 'closed' && (
        <aside
          className={`absolute z-10 left-3 right-3 bottom-3 md:left-4 md:right-auto md:w-[390px] flex flex-col rounded-3xl bg-slate-950/80 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/40 overflow-hidden ${
            panel === 'open' ? 'max-h-[72%] md:max-h-none md:top-4 md:bottom-4' : 'md:top-4 md:bottom-auto'
          }`}
        >
          {/* Orb + status + window controls */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10">
            <div className={`transition-transform duration-700 ${orbScale}`}>
              <FluidOrb size={52} color="#1A73F2" className="shadow-[0_0_30px_rgba(6,182,212,0.5)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white leading-tight">{status[0]}</p>
              <p className="text-xs text-blue-200/70 truncate">{status[1]}</p>
            </div>
            {speaking && (
              <button onClick={stopSpeaking} aria-label="Stop speaking" className="w-8 h-8 rounded-full flex items-center justify-center text-cyan-200 hover:bg-white/10">
                <VolumeX className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setPanel(p => (p === 'open' ? 'min' : 'open'))}
              aria-label={panel === 'open' ? 'Minimize chat' : 'Expand chat'} title={panel === 'open' ? 'Minimize' : 'Expand'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200/80 hover:bg-white/10 hover:text-white">
              {panel === 'open' ? <Minus className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setPanel('closed')} aria-label="Close chat" title="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200/80 hover:bg-white/10 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {panel === 'open' && (
            <>
              {/* Conversation + stops */}
              <div className="flex-1 min-h-[56px] overflow-y-auto px-4 py-3 space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex flex-col animate-fadeIn ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[92%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-br-md'
                        : 'bg-white/10 border border-white/15 text-white rounded-bl-md'}`}>
                      {m.image && <img src={m.image} alt="Your photo" className="mb-2 w-full max-h-44 rounded-xl object-cover" />}
                      {plain(m.text)}
                    </div>
                    {m.tools && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.tools.map((t, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
                            t.source === 'demo' || t.source === 'estimate'
                              ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                              : 'bg-cyan-500/15 border-cyan-400/30 text-cyan-200'}`}>
                            <Search className="w-3 h-3" />{t.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.images && (
                      <div className="mt-2 w-full flex gap-2 overflow-x-auto scrollbar-hide">
                        {m.images.map((im, i) => (
                          <a key={i} href={im.link || im.thumbnail} target="_blank" rel="noreferrer"
                             title={[im.title, im.source].filter(Boolean).join(' · ')}
                             className="shrink-0 w-28 h-20 rounded-xl overflow-hidden border border-white/15 bg-white/5 hover:border-cyan-300/60 transition-colors">
                            <img src={im.thumbnail} alt={im.title || 'Photo'} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.cards && (
                      <div className="mt-2 w-full space-y-1.5">
                        {m.cards.map((c, i) => (
                          <a key={i} href={c.link || undefined} target="_blank" rel="noreferrer"
                             className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 hover:border-cyan-300/40 transition-colors">
                            {c.thumbnail && <img src={c.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{c.title}</p>
                              <p className="text-xs text-blue-200/60 truncate">{c.subtitle}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              {c.rating ? <p className="flex items-center justify-end gap-1 text-xs text-amber-300"><Star className="w-3 h-3 fill-amber-300" />{c.rating}{c.reviews ? <span className="text-blue-200/50">({c.reviews})</span> : null}</p> : null}
                              {c.provider && <p className="text-[10px] text-emerald-300">{c.provider}</p>}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {m.sources && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources.map((s, i) => (
                          <a key={i} href={s.link} target="_blank" rel="noreferrer" title={s.title}
                             className="inline-flex items-center gap-1 max-w-[180px] text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-blue-100 hover:bg-white/15">
                            <ExternalLink className="w-3 h-3 shrink-0" /><span className="truncate">{s.source || s.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {m.places && (
                      <div className="mt-2 w-full space-y-1.5">
                        {m.places.map((p, i) => {
                          const kind = kindOf(p, m.hint);
                          return (
                          <div key={p.id + i} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                            <span className="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center" style={{ background: kind.color }} title={kind.label}>
                              <kind.Icon className="w-4 h-4 text-white" strokeWidth={2.4} />
                              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-slate-900 border border-white/70 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{p.title}</p>
                              <p className="text-xs text-blue-200/60 truncate">{p.category}{p.address ? ` · ${p.address}` : ''}</p>
                            </div>
                            {p.rating ? <span className="flex items-center gap-1 text-xs text-amber-300 shrink-0"><Star className="w-3 h-3 fill-amber-300" />{p.rating}</span> : null}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-1.5 px-3.5 py-3 w-fit rounded-2xl rounded-bl-md bg-white/10 border border-white/15">
                    {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Route summary + journey controls */}
              {route && stops.length > 0 && (
                <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <RouteIcon className="w-4 h-4 text-cyan-300" />
                    <span className="font-semibold text-white">{route.distanceKm.toFixed(1)} km</span>
                    <span className="text-blue-200/60">·</span>
                    <span className="font-semibold text-white">{Math.max(1, Math.round(route.durationMin))} min</span>
                    <span className="text-blue-200/60">· {stops.length} stops{route.roadRouted ? '' : ' (straight-line estimate)'}</span>
                  </div>
                  {journey.status !== 'idle' && (
                    <div className="space-y-1">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${journey.p * 100}%` }} />
                      </div>
                      <p className="text-xs text-blue-100/80">
                        {journey.status === 'done'
                          ? 'You have arrived. Journey complete.'
                          : nextStop ? `Heading to ${nextIdx + 1}. ${nextStop.title} · ${toNextKm.toFixed(1)} km to go` : 'Arriving at your last stop'}
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {journey.status === 'idle' || journey.status === 'done' ? (
                      <button onClick={() => setJourney({ status: 'running', p: 0 })}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-sm font-semibold text-white hover:shadow-lg hover:shadow-blue-500/30 transition-shadow">
                        <Navigation className="w-4 h-4" /> {journey.status === 'done' ? 'Replay journey' : 'Start journey'}
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setJourney(j => ({ ...j, status: j.status === 'running' ? 'paused' : 'running' }))}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15">
                          {journey.status === 'running' ? <><Pause className="w-4 h-4" /> Pause</> : <><Play className="w-4 h-4" /> Resume</>}
                        </button>
                        <button onClick={() => { setJourney({ status: 'idle', p: 0 }); setFitToken(t => t + 1); }}
                          className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white hover:bg-white/15">
                          End
                        </button>
                      </>
                    )}
                    <a target="_blank" rel="noreferrer" aria-label="Open route in Google Maps"
                      href={`https://www.google.com/maps/dir/${[start, ...stops.map(s => [s.latitude, s.longitude])].map(c => c.join(',')).join('/')}`}
                      className="px-3 flex items-center rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Composer */}
              <div className="relative shrink-0 px-4 pt-2 pb-4 border-t border-white/10 space-y-2">
                {error && !voiceOpen && <p className="text-xs text-rose-300">{error}</p>}
                {photo && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 p-2">
                    <img src={photo} alt="Attached photo" className="w-11 h-11 rounded-lg object-cover" />
                    <p className="flex-1 min-w-0 text-xs text-blue-100/80">Photo attached. Add a note, or just send and the AI will work out what it is.</p>
                    <button onClick={() => setPhoto(null)} aria-label="Remove photo" className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200/80 hover:bg-white/10">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {photoMenu && (
                  <div className="absolute right-14 bottom-16 z-20 w-44 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl p-1.5">
                    <button onClick={() => openPicker('camera')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10">
                      <Camera className="w-4 h-4 text-cyan-300" /> Take photo
                    </button>
                    <button onClick={() => openPicker('file')} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white hover:bg-white/10">
                      <ImagePlus className="w-4 h-4 text-cyan-300" /> Upload photo
                    </button>
                  </div>
                )}
                {!stops.length && !photo && (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    <button onClick={() => setPhotoMenu(v => !v)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-xs text-cyan-100 hover:bg-cyan-500/25 transition-colors">
                      <Camera className="w-3.5 h-3.5" /> Snap a photo
                    </button>
                    {QUICK.map(q => (
                      <button key={q} onClick={() => send(q)} className="shrink-0 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-blue-100 hover:bg-blue-500/25 transition-colors">{q}</button>
                    ))}
                  </div>
                )}
                <form onSubmit={e => { e.preventDefault(); send(input); }}
                  className="flex items-center gap-1 rounded-full bg-white/10 border border-white/20 pl-4 pr-1.5 py-1.5 focus-within:border-cyan-300/60 transition-colors">
                  <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about places, food, routes..."
                    className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-blue-200/60 outline-none"
                    style={{ outline: 'none', boxShadow: 'none' }} />
                  <button type="button" onClick={() => setPhotoMenu(v => !v)} aria-label="Add a photo"
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${photo ? 'bg-cyan-500/25 text-cyan-200' : 'text-cyan-200 hover:bg-white/15'}`}>
                    <Camera className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={openVoice} aria-label="Voice mode"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-cyan-200 hover:bg-white/15 transition-colors">
                    <Mic className="w-5 h-5" />
                  </button>
                  <button type="submit" disabled={(!input.trim() && !photo) || busy} aria-label="Send"
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500 text-white disabled:opacity-40">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>
      )}

      {/* Full-screen voice mode (opens from the mic button) */}
      {voiceOpen && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-2xl px-6 text-center">
          <button
            onClick={voice === 'idle' ? startListening : undefined}
            aria-label={voice === 'idle' ? 'Tap to talk' : 'Voice orb'}
            className={`transition-transform duration-700 ${orbScale} ${voice === 'idle' ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <FluidOrb size={220} color="#1A73F2" className="shadow-[0_0_80px_rgba(6,182,212,0.45)]" />
          </button>
          <p className="mt-8 text-xl font-medium text-white">
            {voice === 'listening' ? 'Listening...' : voice === 'thinking' ? 'Thinking...' : 'Tap the orb to talk'}
          </p>
          <p className="mt-1 text-sm text-blue-200/70 max-w-sm min-h-[20px]">
            {transcript
              ? `“${transcript}”`
              : voice === 'listening' ? 'Ask about places, food or routes'
              : voice === 'thinking' ? 'Asking the AI and searching Google Maps' : ''}
          </p>
          {error && <p className="mt-3 text-sm text-rose-300 max-w-sm">{error}</p>}
          {photo ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 p-2 pr-3">
              <img src={photo} alt="Attached photo" className="w-16 h-16 rounded-xl object-cover" />
              <div className="text-left">
                <p className="text-xs text-blue-100/80 max-w-[180px]">Say what you want, or</p>
                <button onClick={() => send('', true)} disabled={busy} className="mt-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-xs font-semibold text-white disabled:opacity-50">Analyze photo</button>
              </div>
              <button onClick={() => setPhoto(null)} aria-label="Remove photo" className="w-8 h-8 rounded-full flex items-center justify-center text-blue-200/80 hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="mt-6 flex gap-2">
              <button onClick={() => openPicker('camera')} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15"><Camera className="w-4 h-4 text-cyan-300" /> Snap a photo</button>
              <button onClick={() => openPicker('file')} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm text-white hover:bg-white/15"><ImagePlus className="w-4 h-4 text-cyan-300" /> Upload</button>
            </div>
          )}
          <button onClick={closeVoice} aria-label="Close voice mode"
            className="mt-8 w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

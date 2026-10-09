import React from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, MapPinned, Route, ListChecks, Sparkles, ArrowRight, Search, Brain, Navigation } from 'lucide-react';
import FluidOrb from '@/components/ui/fluid-orb';
import LogoMark, { Wordmark } from '@/components/LogoMark';

interface Props {
  onLaunch: () => void;
  onItinerary: () => void;
}

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-first AI concierge',
    text: 'Just talk. Ask for cafes, sunset spots or a heritage walk and get a natural answer, spoken back to you. Powered by Azure OpenAI.',
  },
  {
    icon: Search,
    title: 'Live, real places',
    text: 'Answers are grounded in live SerpAPI data: Google Maps places, Google Images photos, Tripadvisor ratings and Google AI Mode web answers, chosen by the AI for each question.',
  },
  {
    icon: Camera,
    title: 'Show it a photo',
    text: 'Photograph a dish, a landmark or a menu. The AI works out what it is, then finds nearby places, photos, reviews and facts, and plots them on the map.',
  },
  {
    icon: MapPinned,
    title: 'Answers appear on the map',
    text: 'The places the AI suggests are plotted instantly on a full map, numbered in the order worth visiting.',
  },
  {
    icon: Route,
    title: 'A journey you can start',
    text: 'See the road route, distance and time, then start the journey and follow it stop by stop, or open it in Google Maps.',
  },
  {
    icon: ListChecks,
    title: 'Smart itinerary optimizer',
    text: 'Keep a to-do list of places and the AI reads it. Say "optimize my itinerary" and it reorders the stops to cut travel time, then draws the route on the map.',
  },
];

const STEPS = [
  { icon: Mic, title: 'Ask', text: 'Speak or type what you are looking for.' },
  { icon: Brain, title: 'Discover', text: 'AI plus live SerpAPI results find the best real places.' },
  { icon: Navigation, title: 'Go', text: 'Places are plotted, the route is drawn, and your journey starts.' },
];

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

export default function HomePage({ onLaunch, onItinerary }: Props) {
  return (
    <div className="h-full overflow-y-auto scroll-smooth">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-16 md:pt-20 grid md:grid-cols-2 gap-10 items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="flex items-center gap-3 mb-5">
            <LogoMark size={60} className="drop-shadow-[0_8px_24px_rgba(37,99,235,0.55)]" />
            <Wordmark className="text-3xl" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-medium text-cyan-200">
            <Sparkles className="w-3.5 h-3.5" /> Built for the SerpAPI India Hackathon 2026
          </span>
          <h1 className="mt-4 text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
            Talk to your trip.
            <span className="block bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Watch it appear on the map.
            </span>
          </h1>
          <p className="mt-5 text-base md:text-lg text-blue-100/80 max-w-xl">
            LookAte is a voice-first AI travel companion. Ask about places, food or routes. It finds real
            places live, plots them on a map, draws the route and starts your journey.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onLaunch}
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 font-semibold text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.03] transition-all"
            >
              Launch LookAte
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#how" className="inline-flex items-center px-6 py-3.5 rounded-full bg-white/10 border border-white/20 font-semibold text-white hover:bg-white/15 transition-colors">
              How it works
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative flex items-center justify-center py-12 mt-6 md:mt-0 md:py-6"
        >
          <div className="absolute w-72 h-72 rounded-full bg-cyan-500/30 blur-3xl" />
          <FluidOrb size={260} color="#1A73F2" className="relative shadow-[0_0_90px_rgba(6,182,212,0.5)]" />
          {['“Best cafes near me”', '“Plan a heritage walk”', '“Where is good street food?”'].map((t, i) => (
            <motion.span
              key={t}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute text-xs md:text-sm px-3 py-1.5 rounded-full bg-slate-950/70 backdrop-blur border border-white/15 text-blue-100 ${
                ['top-2 left-0', 'top-1/2 -right-2 md:-right-6', 'bottom-2 left-4'][i]
              }`}
            >
              {t}
            </motion.span>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 pb-16">
        <motion.h2 {...fade} className="text-2xl md:text-3xl font-bold text-center">Everything you need to explore a city</motion.h2>
        <p className="text-center text-blue-200/70 mt-2 mb-8">One assistant. Real data. A map that moves with the conversation.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              {...fade}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg p-5 hover:bg-white/10 hover:border-cyan-300/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="mt-4 font-semibold text-white">{title}</h3>
              <p className="mt-1.5 text-sm text-blue-100/70 leading-relaxed">{text}</p>
            </motion.div>
          ))}
          <motion.button
            {...fade}
            onClick={onItinerary}
            className="rounded-2xl border border-dashed border-cyan-300/40 p-5 text-left text-cyan-200 hover:bg-cyan-500/10 transition-colors flex flex-col justify-center"
          >
            <span className="font-semibold">Try the itinerary optimizer</span>
            <span className="text-sm text-blue-100/70 mt-1 flex items-center gap-1">Open it now <ArrowRight className="w-4 h-4" /></span>
          </motion.button>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-5 pb-16 scroll-mt-4">
        <motion.h2 {...fade} className="text-2xl md:text-3xl font-bold text-center mb-8">How it works</motion.h2>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <motion.div key={title} {...fade} transition={{ duration: 0.5, delay: i * 0.1 }} className="relative rounded-2xl bg-white/5 border border-white/10 p-6 text-center">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-600 text-sm font-bold flex items-center justify-center border-2 border-slate-950">{i + 1}</span>
              <Icon className="w-8 h-8 text-cyan-300 mx-auto" />
              <h3 className="mt-3 font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm text-blue-100/70">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech + CTA */}
      <section className="max-w-4xl mx-auto px-5 pb-20 text-center">
        <p className="text-xs uppercase tracking-widest text-blue-200/50">Powered by</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {['SerpAPI: Maps, Images, Tripadvisor, AI Mode', 'Azure OpenAI (GPT-4o vision)', 'OpenStreetMap + OSRM', 'React + Leaflet'].map(t => (
            <span key={t} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-blue-100">{t}</span>
          ))}
        </div>
        <button
          onClick={onLaunch}
          className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 font-semibold text-white shadow-lg shadow-blue-500/30 hover:scale-[1.03] transition-transform"
        >
          Launch LookAte <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}

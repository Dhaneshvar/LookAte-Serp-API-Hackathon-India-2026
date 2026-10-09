import React, { useState } from 'react';
import { Home, Navigation, CheckSquare } from 'lucide-react';
import HomePage from '@/components/HomePage';
import LogoMark, { Wordmark } from '@/components/LogoMark';
import JourneyView from '@/components/JourneyView';
import TodoSection from '@/components/TodoSection';
import '../App.css';

type TabType = 'home' | 'journey' | 'todo';

const TABS = [
  { id: 'home' as const, icon: Home, label: 'Home' },
  { id: 'journey' as const, icon: Navigation, label: 'LookAte' },
  { id: 'todo' as const, icon: CheckSquare, label: 'Itinerary' },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [itineraryToken, setItineraryToken] = useState(0);

  const openItineraryOnMap = () => {
    setItineraryToken(t => t + 1);
    setActiveTab('journey');
  };

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-25 animate-blob" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-25 animate-blob animation-delay-4000" />
      </div>

      <header className="relative z-20 shrink-0 backdrop-blur-xl bg-white/5 border-b border-white/10 px-4 py-3">
        <button onClick={() => setActiveTab('home')} className="max-w-6xl mx-auto flex items-center gap-3 text-left">
          <LogoMark size={38} className="drop-shadow-[0_4px_10px_rgba(37,99,235,0.45)]" />
          <div>
            <h1 className="text-base leading-tight"><Wordmark /></h1>
            <p className="text-xs text-blue-200/70 leading-tight">AI Travel Guide · Powered by SerpAPI</p>
          </div>
        </button>
      </header>

      <main className="relative z-10 flex-1 min-h-0">
        {activeTab === 'home' && (
          <HomePage onLaunch={() => setActiveTab('journey')} onItinerary={() => setActiveTab('todo')} />
        )}
        {activeTab === 'todo' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto px-4 py-4">
              <TodoSection onNavigateToMap={openItineraryOnMap} />
            </div>
          </div>
        )}
        <div className={`absolute inset-0 ${activeTab === 'journey' ? '' : 'invisible pointer-events-none'}`}>
          <JourneyView itineraryToken={itineraryToken} />
        </div>
      </main>

      <nav className="relative z-20 shrink-0 backdrop-blur-xl bg-slate-950/70 border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-xl mx-auto grid grid-cols-3 gap-1 px-2 py-2">
          {TABS.map(({ id, icon: Icon, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex flex-col items-center py-2 rounded-xl transition-colors ${
                  active ? 'bg-blue-500/20 text-cyan-300' : 'text-blue-200/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

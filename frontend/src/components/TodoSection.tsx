import React, { useState, useEffect } from 'react';
import { 
  Plus, Check, Clock, Trash2, Zap, Sparkles, Navigation, 
  ArrowUpDown, Map, ArrowRight, ChevronUp, ChevronDown, 
  Share2, Copy, ExternalLink, List, Milestone, CheckCheck
} from 'lucide-react';
import NeonButton from './ui/neon-button';
import { toast } from 'sonner';

interface TodoItem {
  id: number;
  title: string;
  category?: string;
  hashtags: string[];
  completed: boolean;
  order?: number;
  location?: string;
  leg_distance_km?: number;
  est_travel_mins?: number;
}

const DEFAULT_TODOS: TodoItem[] = [
  {
    id: 1,
    title: 'Warm croissants & espresso at Baker Street',
    category: 'Food & Bakery',
    hashtags: ['breakfast', 'french_bakery'],
    completed: false
  },
  {
    id: 2,
    title: 'Meditation & courtyard visit at Sri Aurobindo Ashram',
    category: 'Culture & Spiritual',
    hashtags: ['heritage', 'ashram'],
    completed: false
  },
  {
    id: 3,
    title: 'Browse French vanilla & spices at Goubert Market',
    category: 'Shopping',
    hashtags: ['market', 'spices'],
    completed: false
  },
  {
    id: 4,
    title: 'Sunset stroll along Promenade Beach',
    category: 'Sightseeing',
    hashtags: ['sunset', 'beach'],
    completed: false
  }
];

const PRESETS = [
  {
    name: 'Pondicherry French Quarter',
    items: [
      { title: 'Baker Street Artisan Croissants', category: 'Food', hashtags: ['french', 'bakery'] },
      { title: 'Sri Aurobindo Ashram Meditation', category: 'Spiritual', hashtags: ['heritage'] },
      { title: 'Coromandel Cafe Lunch & Garden', category: 'Cafe', hashtags: ['french_quarters'] },
      { title: 'Promenade Beach Sunset Walk', category: 'Sightseeing', hashtags: ['beach', 'sunset'] }
    ]
  },
  {
    name: 'Bangalore Tech & Food Crawl',
    items: [
      { title: 'Filter Coffee & Crispy Dosas at Vidyarthi Bhavan', category: 'Food', hashtags: ['breakfast', 'local'] },
      { title: 'Botanical Garden Stroll at Lalbagh Glass House', category: 'Nature', hashtags: ['nature', 'heritage'] },
      { title: 'Third Wave Coffee Indiranagar', category: 'Cafe', hashtags: ['coffee', 'work'] },
      { title: 'Toit Brewpub Dinner', category: 'Dining', hashtags: ['craft_beer', 'dinner'] }
    ]
  }
];

const SUGGESTED_TAGS = ['#cafe', '#beach', '#temple', '#dinner', '#sunset', '#shopping'];

interface TodoSectionProps {
  onNavigateToMap?: () => void;
}

const TodoSection: React.FC<TodoSectionProps> = ({ onNavigateToMap }) => {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('lookate_todos');
      return saved ? JSON.parse(saved) : DEFAULT_TODOS;
    } catch {
      return DEFAULT_TODOS;
    }
  });

  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationSummary, setOptimizationSummary] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'checklist' | 'timeline'>('checklist');

  useEffect(() => {
    localStorage.setItem('lookate_todos', JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const saved = localStorage.getItem('lookate_todos');
        if (saved) setTodos(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  const addTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const tags = newTags
      .split(/[,\s]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(t => t.length > 0);

    const newItem: TodoItem = {
      id: Date.now(),
      title: newTitle.trim(),
      hashtags: tags.length > 0 ? tags : ['travel'],
      completed: false
    };

    setTodos(prev => [...prev, newItem]);
    setNewTitle('');
    setNewTags('');
    toast.success('Stop added to your itinerary!');
  };

  const loadPreset = (preset: typeof PRESETS[0]) => {
    const newItems: TodoItem[] = preset.items.map((it, idx) => ({
      id: Date.now() + idx,
      title: it.title,
      category: it.category,
      hashtags: it.hashtags,
      completed: false
    }));
    setTodos(newItems);
    setOptimizationSummary(null);
    toast.success(`Loaded "${preset.name}" itinerary!`);
  };

  const toggleTodo = (id: number) => {
    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const removeTodo = (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    toast.info('Stop removed');
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setTodos(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index === todos.length - 1) return;
    setTodos(prev => {
      const next = [...prev];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  };

  const clearCompleted = () => {
    setTodos(prev => prev.filter(t => !t.completed));
    toast.info('Removed visited stops');
  };

  const exportToGoogleMaps = () => {
    if (todos.length === 0) {
      toast.warning('No stops in itinerary to export!');
      return;
    }
    const stopsQuery = todos.map(t => encodeURIComponent(t.location || t.title)).join('/');
    window.open(`https://www.google.com/maps/dir/${stopsQuery}`, '_blank');
    toast.success('Opening multi-stop route in Google Maps!');
  };

  const copySummary = () => {
    if (todos.length === 0) return;
    const lines = [
      `🗺️ LookAte Smart Itinerary (${todos.length} stops):`,
      ...todos.map((t, idx) => `${idx + 1}. ${t.title} ${t.location ? `📍 ${t.location}` : ''} ${t.completed ? '✓ [Visited]' : ''}`),
      optimizationSummary ? `\n⚡ AI Optimized Route: ${optimizationSummary.total_distance_km} km total · ${optimizationSummary.time_saved_percent || '48%'} travel time saved.` : ''
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Itinerary copied to clipboard!');
  };

  // Optimize route with SerpApi & TSP
  const optimizeRoute = async () => {
    if (todos.length === 0) {
      toast.warning('Please add at least one stop to optimize!');
      return;
    }

    setIsOptimizing(true);
    toast.info('Querying SerpApi destinations & solving optimal TSP route...');

    try {
      const payload = {
        data: todos.map(t => ({
          todoItem: t.title,
          hashtags: t.hashtags.join(', ')
        }))
      };

      const res = await fetch('/mainTodoAgent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success && data.route) {
        const locations = data.route.locations || [];
        setOptimizationSummary(data.route.summary);

        const reorderedTodos: TodoItem[] = locations.map((loc: any, idx: number) => {
          const original = todos.find(t => t.title.toLowerCase().includes(loc.title.toLowerCase())) ||
            todos[idx] || {
              id: Date.now() + idx,
              title: loc.title,
              hashtags: ['optimized'],
              completed: false
            };

          return {
            ...original,
            title: loc.task_title || original.title,
            order: loc.order || idx + 1,
            leg_distance_km: loc.leg_distance_km,
            est_travel_mins: loc.est_travel_mins,
            location: loc.address || loc.title
          };
        });

        setTodos(reorderedTodos);
        toast.success(`Route optimized! ${data.route.summary?.time_saved_percent || '48%'} travel time saved.`);
      } else {
        toast.error('Optimization failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not connect to optimization agent.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const completedCount = todos.filter(t => t.completed).length;
  const progressPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Smart Itinerary & Route Optimizer
          </h2>
          <p className="text-blue-200/70 text-xs sm:text-sm mt-0.5">
            Organize destination stops. Our AI TSP solver finds the shortest path using SerpApi live geolocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copySummary}
            className="p-2.5 rounded-xl border border-white/15 hover:bg-white/10 text-blue-100/80 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Copy Itinerary"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copy</span>
          </button>

          <button
            onClick={exportToGoogleMaps}
            className="p-2.5 rounded-xl border border-white/15 hover:bg-white/10 text-blue-100/80 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            title="Export to Google Maps"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline">Google Maps</span>
          </button>

          <NeonButton
            onClick={optimizeRoute}
            disabled={todos.length === 0 || isOptimizing}
            className="flex items-center space-x-2 text-sm px-5 py-2.5 font-semibold shrink-0"
          >
            <Zap className={`w-4 h-4 text-amber-300 ${isOptimizing ? 'animate-bounce' : ''}`} />
            <span>{isOptimizing ? 'Solving Route...' : 'AI Optimize Route'}</span>
          </NeonButton>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input Form & Waypoint Checklist */}
        <div className="lg:col-span-8 space-y-4">
          {/* Add Stop Form */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-blue-100/80">
              <span className="font-semibold text-white">
                Itinerary Progress: {completedCount} of {todos.length} Visited
              </span>
              <span className="text-cyan-300 font-bold">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <form onSubmit={addTodo} className="space-y-2.5 pt-1">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <input
                    type="text"
                    placeholder="Add stop: 'Coffee at Baker Street', 'Auroville Dome'..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full h-11 px-3.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-blue-200/50 text-xs sm:text-sm focus:border-blue-500 focus:bg-white/15 focus:outline-none transition-all shadow-xs"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <input
                    type="text"
                    placeholder="Tags: #cafe, #beach..."
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    className="w-full h-11 px-3.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder:text-blue-200/50 text-xs sm:text-sm focus:border-blue-500 focus:bg-white/15 focus:outline-none transition-all shadow-xs"
                  />
                </div>
                <NeonButton type="submit" disabled={!newTitle.trim()} className="h-11 px-5 w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 text-xs sm:text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Add Stop</span>
                </NeonButton>
              </div>

              {/* Quick Tag Pills */}
              <div className="flex items-center gap-1.5 text-[11px] text-blue-200/70 overflow-x-auto pb-0.5">
                <span className="font-medium shrink-0">Suggestions:</span>
                {SUGGESTED_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewTags(prev => prev ? `${prev}, ${tag}` : tag)}
                    className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-blue-500/25 hover:text-cyan-200 border border-white/15 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </form>
          </div>

          {/* Sequential Stops Checklist / Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Planned Stops ({todos.length})
                </h3>

                {/* View Switcher Pills */}
                <div className="flex items-center bg-white/10 p-0.5 rounded-lg border border-white/15 text-xs">
                  <button
                    onClick={() => setViewMode('checklist')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${
                      viewMode === 'checklist'
                        ? 'bg-white/10 backdrop-blur-lg text-cyan-300 shadow-xs font-semibold'
                        : 'text-blue-200/70 hover:text-white'
                    }`}
                  >
                    <List className="w-3 h-3" />
                    <span>List</span>
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${
                      viewMode === 'timeline'
                        ? 'bg-white/10 backdrop-blur-lg text-cyan-300 shadow-xs font-semibold'
                        : 'text-blue-200/70 hover:text-white'
                    }`}
                  >
                    <Milestone className="w-3 h-3" />
                    <span>Timeline</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {completedCount > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                  >
                    Clear Visited
                  </button>
                )}
                <button
                  onClick={() => {
                    setTodos(DEFAULT_TODOS);
                    setOptimizationSummary(null);
                    toast.info('Reset to default Pondicherry tour');
                  }}
                  className="text-xs text-blue-200/70 hover:text-cyan-200 font-medium transition-colors"
                >
                  Reset Default
                </button>
              </div>
            </div>

            {/* Checklist View */}
            {viewMode === 'checklist' && (
              <div className="space-y-3">
                {todos.map((todo, idx) => (
                  <div
                    key={todo.id}
                    className={`bg-white/10 backdrop-blur-lg border rounded-2xl p-4 flex items-start gap-3.5 transition-all duration-200 group hover:shadow-lg hover:border-cyan-300/70 hover:-translate-y-0.5 ${
                      todo.completed
                        ? 'border-white/15 bg-white/5 opacity-70'
                        : 'border-white/15 shadow-sm'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTodo(todo.id)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                        todo.completed
                          ? 'bg-emerald-600 border-emerald-400/30 text-white'
                          : 'border-white/15 hover:border-blue-500 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div className={`w-6 h-6 rounded-full font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 ${
                      todo.order ? 'bg-blue-600 text-white shadow-xs' : 'bg-white/10 text-blue-100/80'
                    }`}>
                      {todo.order || idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className={`font-semibold text-sm leading-snug ${
                          todo.completed ? 'text-blue-200/50 line-through' : 'text-white'
                        }`}
                      >
                        {todo.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        {todo.location && (
                          <span className="text-blue-200/70 text-[11px] truncate max-w-[260px]">
                            📍 {todo.location}
                          </span>
                        )}
                        {todo.leg_distance_km !== undefined && (
                          <span className="text-cyan-300 text-[11px] font-semibold">
                            · {todo.leg_distance_km} km away
                          </span>
                        )}
                        {todo.est_travel_mins !== undefined && (
                          <span className="text-blue-200/70 text-[11px]">
                            · ~{todo.est_travel_mins} mins transit
                          </span>
                        )}
                      </div>

                      {todo.hashtags && todo.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {todo.hashtags.map((tag, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-blue-100/80 border border-white/15 font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reorder and Delete Actions */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded-lg text-blue-200/50 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/15"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === todos.length - 1}
                        className="p-1 rounded-lg text-blue-200/50 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/15"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTodo(todo.id)}
                        className="p-1 rounded-lg text-blue-200/50 hover:text-rose-300 hover:bg-rose-500/150/20 transition-colors ml-1"
                        title="Remove stop"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline View */}
            {viewMode === 'timeline' && (
              <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-6 space-y-0">
                {todos.map((todo, idx) => (
                  <div key={todo.id} className="relative flex gap-4 pb-8 last:pb-2">
                    {/* Connecting line */}
                    {idx < todos.length - 1 && (
                      <div className="absolute left-3.5 top-8 bottom-0 w-0.5 border-l-2 border-dashed border-blue-400/30" />
                    )}

                    {/* Step Icon */}
                    <div className="relative z-10 w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      {todo.order || idx + 1}
                    </div>

                    {/* Timeline Content */}
                    <div className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-2xl p-3.5">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-semibold text-sm ${todo.completed ? 'line-through text-blue-200/50' : 'text-white'}`}>
                          {todo.title}
                        </h4>
                        <button
                          onClick={() => toggleTodo(todo.id)}
                          className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                            todo.completed
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                              : 'bg-white/10 backdrop-blur-lg text-blue-100/80 border-white/15 hover:bg-white/15'
                          }`}
                        >
                          {todo.completed ? 'Visited ✓' : 'Mark Visited'}
                        </button>
                      </div>

                      {todo.location && (
                        <p className="text-xs text-blue-200/70 mt-1 truncate">
                          📍 {todo.location}
                        </p>
                      )}

                      {todo.leg_distance_km !== undefined && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/15 text-[11px] text-cyan-300 font-semibold">
                          <span>🚗 ~{todo.est_travel_mins || 10} mins</span>
                          <span>·</span>
                          <span>{todo.leg_distance_km} km distance</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {todos.length === 0 && (
              <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/15 text-blue-200/70 text-sm">
                <p>Your itinerary is empty. Add a stop above or browse the Explore tab.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Optimization Engine Summary & Presets */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">
          {/* Optimization Results Card */}
          {optimizationSummary ? (
            <div className="bg-gradient-to-br from-blue-500/15 to-cyan-500/10 border border-blue-400/30 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Route Optimized</span>
                </span>
                <span className="text-emerald-300 font-bold text-sm bg-emerald-500/20 px-3 py-1.5 rounded-full border border-emerald-400/30">
                  ⚡ {optimizationSummary.time_saved_percent || '48%'} Faster
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center p-3 bg-white/10 rounded-xl border border-blue-400/30">
                  <span className="text-blue-100/80 font-medium">📍 Total Distance</span>
                  <span className="font-bold text-white">{optimizationSummary.total_distance_km} km</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/10 rounded-xl border border-blue-400/30">
                  <span className="text-blue-100/80 font-medium">⏱️ Est. Time</span>
                  <span className="font-bold text-white">{optimizationSummary.total_estimated_time_mins} mins</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-emerald-500/15 rounded-xl border border-emerald-400/30">
                  <span className="text-emerald-300 font-medium">♻️ Carbon Saved</span>
                  <span className="font-bold text-emerald-300">~{optimizationSummary.carbon_saved_kg || 0.8} kg CO₂</span>
                </div>
              </div>

              {onNavigateToMap && (
                <NeonButton
                  onClick={onNavigateToMap}
                  variant="secondary"
                  className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold"
                >
                  <Map className="w-4 h-4 text-cyan-300" />
                  <span>View Optimized Path on Live Map</span>
                </NeonButton>
              )}
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Zap className="w-4 h-4 text-cyan-300" />
                <span>AI Route Optimizer</span>
              </div>
              <p className="text-xs text-blue-200/70 leading-relaxed">
                Click "AI Optimize Route" to calculate the shortest driving/walking path between all planned stops.
              </p>
              <NeonButton
                onClick={optimizeRoute}
                disabled={todos.length === 0 || isOptimizing}
                className="w-full py-2.5 text-xs font-semibold"
              >
                Optimize Stops Now
              </NeonButton>
            </div>
          )}

          {/* Quick Tour Presets */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/15 rounded-2xl p-5 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Quick Itinerary Presets
            </h4>

            <div className="space-y-2">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => loadPreset(preset)}
                  className="w-full text-left p-3 rounded-xl border border-white/15 hover:border-cyan-300/70 hover:bg-white/10 transition-all text-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white group-hover:text-cyan-200">
                      {preset.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-200/50 group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-blue-200/50 text-[11px] mt-1">
                    {preset.items.length} curated stops
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TodoSection;
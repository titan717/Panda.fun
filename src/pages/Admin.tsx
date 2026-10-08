import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import {
  Activity, BarChart3, Clock3, Eye, Film, Gauge, LogOut, RefreshCw,
  Search, Users, PlayCircle, CalendarDays, ShieldAlert
} from 'lucide-react';

type EventRow = {
  id: string;
  type: string;
  uid?: string;
  userEmail?: string | null;
  path?: string;
  animeId?: string;
  animeTitle?: string;
  episodeNumber?: string;
  durationSeconds?: number;
  clientTimestamp?: number;
  createdAt?: { seconds?: number };
};

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export function Admin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [users, setUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        setAuthorized(false);
        return;
      }
      setAuthorized(true);

      const since = Date.now() - range * 86400000;
      const eventSnap = await getDocs(query(collection(db, 'analytics_events'), orderBy('clientTimestamp', 'desc'), limit(5000)));
      const rows = eventSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as EventRow))
        .filter(e => (e.clientTimestamp || 0) >= since);
      setEvents(rows);

      const userSnap = await getDocs(query(collection(db, 'users'), limit(5000)));
      setUsers(userSnap.size);
    } catch (error) {
      console.error('Admin dashboard load failed:', error);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user, range]);

  const metrics = useMemo(() => {
    const watch = events.filter(e => e.type === 'watch_progress' || e.type === 'watch_start');
    const watchSeconds = events
      .filter(e => e.type === 'watch_progress')
      .reduce((sum, e) => sum + Number(e.durationSeconds || 0), 0);
    const pageViews = events.filter(e => e.type === 'page_view').length;
    const searches = events.filter(e => e.type === 'search').length;
    const starts = events.filter(e => e.type === 'watch_start' || e.type === 'episode_start').length;
    const completes = events.filter(e => e.type === 'watch_complete').length;
    const uniqueUsers = new Set(events.map(e => e.uid).filter(Boolean)).size;
    const uniqueSessions = new Set(events.map(e => (e as any).sessionId).filter(Boolean)).size;
    const avgSessionWatch = watch.length ? watchSeconds / Math.max(uniqueSessions, 1) : 0;
    return { watchSeconds, pageViews, searches, starts, completes, uniqueUsers, avgSessionWatch };
  }, [events]);

  const topAnime = useMemo(() => {
    const map = new Map<string, { title: string; views: number; watch: number }>();
    events.forEach(e => {
      const key = e.animeId || e.animeTitle;
      if (!key) return;
      const row = map.get(key) || { title: e.animeTitle || key, views: 0, watch: 0 };
      if (e.type === 'anime_open' || e.type === 'episode_start' || e.type === 'watch_start') row.views++;
      if (e.type === 'watch_progress') row.watch += Number(e.durationSeconds || 0);
      map.set(key, row);
    });
    return [...map.values()].sort((a,b) => (b.views + b.watch/600) - (a.views + a.watch/600)).slice(0, 8);
  }, [events]);

  if (authLoading || loading) {
    return <div className="min-h-screen bg-[#f4f6f8] text-[#0b0d17] flex items-center justify-center"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-6"><div className="bg-white rounded-3xl p-8 shadow-xl text-center"><ShieldAlert className="mx-auto mb-3"/><h1 className="text-2xl font-bold">Admin sign-in required</h1><button onClick={() => setLocation('/')} className="mt-5 px-5 py-3 rounded-xl bg-[#0A24E9] text-white">Return to Kinoma</button></div></div>;
  }

  if (!authorized) {
    return <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-6"><div className="bg-white rounded-3xl p-8 shadow-xl text-center"><ShieldAlert className="mx-auto mb-3 text-red-500"/><h1 className="text-2xl font-bold">Access denied</h1><p className="text-gray-500 mt-2">This account does not have the Firebase <b>admin</b> custom claim.</p><button onClick={() => setLocation('/')} className="mt-5 px-5 py-3 rounded-xl bg-[#0b0d17] text-white">Back to Kinoma</button></div></div>;
  }

  const cards = [
    { label: 'Page views', value: metrics.pageViews.toLocaleString(), icon: Eye },
    { label: 'Watch time', value: formatDuration(metrics.watchSeconds), icon: Clock3 },
    { label: 'Unique users', value: metrics.uniqueUsers.toLocaleString(), icon: Users },
    { label: 'Watch starts', value: metrics.starts.toLocaleString(), icon: PlayCircle },
    { label: 'Searches', value: metrics.searches.toLocaleString(), icon: Search },
    { label: 'Completions', value: metrics.completes.toLocaleString(), icon: Gauge }
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#0b0d17] font-sans">
      <aside className="fixed inset-y-0 left-0 hidden w-[250px] lg:flex flex-col bg-[#0b0d17] text-white p-5">
        <div className="px-3 py-4 text-2xl font-black tracking-tight">KINOMA<span className="text-[#0A24E9]">.</span></div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-3 mb-4">Admin workspace</div>
        {[
          ['Overview', BarChart3], ['Audience', Users], ['Content', Film], ['Activity', Activity]
        ].map(([label, Icon]: any) => <div key={label as string} className="px-3 py-3 rounded-xl bg-white/5 flex items-center gap-3 text-sm"><Icon className="w-4 h-4"/>{label}</div>)}
        <div className="mt-auto">
          <button onClick={() => signOut()} className="w-full px-3 py-3 rounded-xl bg-white/5 flex items-center gap-3 text-sm text-white/70 hover:text-white"><LogOut className="w-4 h-4"/>Sign out</button>
        </div>
      </aside>

      <main className="lg:ml-[250px] p-5 sm:p-8 max-w-[1800px]">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#0A24E9] font-bold">Kinoma intelligence</div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.04em] mt-1">Overview</h1>
            <p className="text-gray-500 mt-2">Real usage, playback and discovery analytics.</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={range} onChange={e => setRange(Number(e.target.value) as 7 | 30)} className="bg-white border border-[#dfe3e8] rounded-xl px-4 py-3 text-sm font-semibold"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select>
            <button onClick={() => void load()} className="p-3 bg-white rounded-xl border border-[#dfe3e8] hover:bg-gray-50"><RefreshCw className="w-4 h-4"/></button>
          </div>
        </header>

        <section className="grid grid-cols-2 xl:grid-cols-6 gap-3 mb-6">
          {cards.map(({label,value,icon:Icon},i) => <div key={label} className="bg-white rounded-2xl p-5 border border-[#e0e4e8] shadow-[0_8px_30px_rgba(11,13,23,0.04)]"><div className="flex justify-between items-start"><span className="text-xs font-bold text-gray-500">{label}</span><Icon className={`w-4 h-4 ${i % 3 === 0 ? 'text-[#0A24E9]' : 'text-[#5C9764]'}`}/></div><div className="text-2xl sm:text-3xl font-black mt-4 tracking-tight">{value}</div></div>)}
        </section>

        <section className="grid xl:grid-cols-[1.7fr_1fr] gap-6">
          <div className="bg-white rounded-3xl border border-[#e0e4e8] p-6">
            <div className="flex items-center justify-between mb-6"><div><h2 className="text-lg font-black">Top content</h2><p className="text-xs text-gray-500">Engagement by anime</p></div><Film className="text-[#0A24E9]"/></div>
            <div className="space-y-3">{topAnime.length ? topAnime.map((a,i) => <div key={a.title} className="grid grid-cols-[28px_1fr_auto] gap-3 items-center p-3 rounded-xl hover:bg-[#f4f6f8]"><span className="text-xs font-bold text-gray-400">{String(i+1).padStart(2,'0')}</span><div><div className="font-bold truncate">{a.title}</div><div className="h-1.5 mt-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#0A24E9] rounded-full" style={{width:`${Math.min(100, 18 + a.views * 12)}%`}}/></div></div><div className="text-xs font-bold text-gray-500">{formatDuration(a.watch)}</div></div>) : <div className="py-16 text-center text-gray-400">No analytics yet. Start watching to populate this dashboard.</div>}</div>
          </div>

          <div className="bg-[#0b0d17] text-white rounded-3xl p-6">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Live activity</h2><p className="text-xs text-white/40">Latest events</p></div><Activity className="text-[#8ea4ff]"/></div>
            <div className="mt-5 space-y-3 max-h-[520px] overflow-auto">{events.slice(0,12).map(e => <div key={e.id} className="border-b border-white/10 pb-3"><div className="text-sm font-semibold">{e.animeTitle || e.path || e.type}</div><div className="text-[11px] text-white/40 mt-1">{e.type.replaceAll('_',' ')} · {e.userEmail || 'Anonymous'}</div></div>)}</div>
          </div>
        </section>

        <section className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-[#e0e4e8] p-6"><CalendarDays className="text-[#0A24E9]"/><div className="text-3xl font-black mt-4">{users.toLocaleString()}</div><div className="text-sm font-bold">Registered users</div></div>
          <div className="bg-white rounded-3xl border border-[#e0e4e8] p-6"><Clock3 className="text-[#5C9764]"/><div className="text-3xl font-black mt-4">{formatDuration(metrics.avgSessionWatch)}</div><div className="text-sm font-bold">Avg. watch time / session</div></div>
          <div className="bg-white rounded-3xl border border-[#e0e4e8] p-6"><Activity className="text-[#0A24E9]"/><div className="text-3xl font-black mt-4">{metrics.starts ? Math.round((metrics.completes / metrics.starts) * 100) : 0}%</div><div className="text-sm font-bold">Completion rate</div></div>
        </section>
      </main>
    </div>
  );
}

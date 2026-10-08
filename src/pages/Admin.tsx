import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, BarChart3, BookOpen, CheckCircle2, ChevronRight, Clock3, Copy, Database,
  Download, ExternalLink, Film, Gauge, HeartPulse, LayoutDashboard, LogOut, MonitorPlay,
  RefreshCw, Search, Settings2, Shield, ShieldAlert, Users, X, Zap
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useLocation } from 'wouter';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { api, type MovieApiMedia } from '../lib/api';
import { buildDetailsHref } from '../lib/mediaRoute';
import { updateSEO } from '../lib/seo';
import { formatAdminDuration, getAdminMetrics, getRecentDays, getTopContent, type AdminEvent } from '../lib/adminMetrics';
import '../styles/admin.css';

type AdminTab = 'overview' | 'audience' | 'content' | 'activity' | 'health' | 'reports' | 'settings';
type Range = 7 | 30 | 90;
type UserRow = { uid: string; email?: string; displayName?: string; photoURL?: string; createdAt?: string };
type HealthState = { status: 'idle' | 'loading' | 'ok' | 'error'; checkedAt?: number; data?: unknown; message?: string };

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'audience', label: 'Audience', icon: Users },
  { id: 'content', label: 'Content', icon: Film }, { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'health', label: 'System health', icon: HeartPulse }, { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];
const RANGE_OPTIONS: Range[] = [7, 30, 90];

function isTruthyString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function safeTimestamp(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value) return Number((value as { seconds?: number }).seconds || 0) * 1000;
  return 0;
}
function formatDate(value: unknown): string {
  const timestamp = typeof value === 'number' ? value : safeTimestamp(value);
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
function healthLabel(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Healthy';
  const value = data as Record<string, unknown>;
  const status = value.status ?? value.state ?? value.health;
  return isTruthyString(status) ? status : 'Healthy';
}
function prettyJson(data: unknown): string { try { return JSON.stringify(data, null, 2); } catch { return String(data); } }
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}
function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function exportEvents(events: AdminEvent[]): void {
  const headers = ['timestamp', 'type', 'userEmail', 'uid', 'path', 'animeTitle', 'animeId', 'episodeNumber', 'durationSeconds', 'sessionId'];
  const rows = events.map((event) => [
    event.clientTimestamp ? new Date(event.clientTimestamp).toISOString() : '', event.type, event.userEmail || 'Anonymous',
    event.uid || '', event.path || '', event.animeTitle || '', event.animeId || '', event.episodeNumber || '',
    event.durationSeconds || '', event.sessionId || '',
  ]);
  downloadText('panda-admin-events.csv', [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }) {
  return <article className="panda-admin-stat"><div className="panda-admin-stat__icon"><Icon size={17} strokeWidth={1.8} /></div><span className="panda-admin-stat__label">{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; title: string; description: string }) {
  return <div className="panda-admin-empty"><span><Icon size={22} /></span><strong>{title}</strong><p>{description}</p></div>;
}

function AdminShell({ activeTab, setActiveTab, user, onSignOut, children }: {
  activeTab: AdminTab; setActiveTab: (tab: AdminTab) => void;
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onSignOut: () => Promise<void>; children: React.ReactNode;
}) {
  return <div className="panda-admin">
    <aside className="panda-admin-sidebar">
      <div className="panda-admin-brand"><div className="panda-admin-brand__mark">🐼</div><div><strong>PANDA.FUN</strong><span>Admin console</span></div></div>
      <div className="panda-admin-sidebar__section-label">Workspace</div>
      <nav className="panda-admin-nav" aria-label="Admin navigation">
        {TAB_ITEMS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{activeTab === id && <ChevronRight size={14} />}</button>)}
      </nav>
      <div className="panda-admin-sidebar__bottom">
        <div className="panda-admin-session">{user?.photoURL ? <img src={user.photoURL} alt="" /> : <span>{(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}</span>}<div><strong>{user?.displayName || 'Panda admin'}</strong><small>{user?.email || 'Authenticated administrator'}</small></div></div>
        <button type="button" className="panda-admin-signout" onClick={() => void onSignOut()}><LogOut size={16} />Sign out</button>
      </div>
    </aside>
    <header className="panda-admin-mobile-header"><div className="panda-admin-brand"><div className="panda-admin-brand__mark">🐼</div><div><strong>PANDA.FUN</strong><span>Admin</span></div></div><div className="panda-admin-mobile-actions"><button type="button" onClick={() => setActiveTab('overview')} aria-label="Admin overview"><LayoutDashboard size={18} /></button><button type="button" onClick={() => void onSignOut()} aria-label="Sign out"><LogOut size={18} /></button></div></header>
    <main className="panda-admin-main">{children}</main>
  </div>;
}

function TitleBar({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="panda-admin-titlebar"><div><span className="panda-admin-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ events, usersCount, range, onRangeChange }: { events: AdminEvent[]; usersCount: number; range: Range; onRangeChange: (range: Range) => void }) {
  const metrics = useMemo(() => getAdminMetrics(events), [events]);
  const daily = useMemo(() => getRecentDays(events, Math.min(range, 30)), [events, range]);
  const topContent = useMemo(() => getTopContent(events, 8), [events]);
  const peak = Math.max(1, ...daily.map((row) => Math.max(row.views, row.starts)));

  return <div className="panda-admin-view">
    <TitleBar kicker="PANDA INTELLIGENCE" title="Good control starts with a clear picture." description="Real usage, playback, discovery and system signals — from one place."
      action={<div className="panda-admin-range">{RANGE_OPTIONS.map((value) => <button key={value} type="button" className={range === value ? 'is-active' : ''} onClick={() => onRangeChange(value)}>{value}d</button>)}</div>} />
    <section className="panda-admin-stat-grid">
      <StatCard label="Page views" value={metrics.pageViews.toLocaleString()} detail={range + '-day window'} icon={BarChart3} />
      <StatCard label="Watch time" value={formatAdminDuration(metrics.watchSeconds)} detail="Tracked playback progress" icon={Clock3} />
      <StatCard label="Unique users" value={metrics.uniqueUsers.toLocaleString()} detail="Signed-in activity" icon={Users} />
      <StatCard label="Watch starts" value={metrics.starts.toLocaleString()} detail="Movies + episodes" icon={MonitorPlay} />
      <StatCard label="Searches" value={metrics.searches.toLocaleString()} detail="Discovery intent" icon={Search} />
      <StatCard label="Completion" value={Math.round(metrics.completionRate) + '%'} detail="Completed / starts" icon={Gauge} />
    </section>
    <section className="panda-admin-grid panda-admin-grid--wide">
      <article className="panda-admin-panel panda-admin-panel--chart"><div className="panda-admin-panel__head"><div><span>TRAFFIC + PLAYBACK</span><h2>Daily movement</h2></div><Zap size={17} /></div>
        <div className="panda-admin-bars" aria-label="Daily page views and watch starts">{daily.map((day) => <div className="panda-admin-bars__day" key={day.label}><div className="panda-admin-bars__stack"><span style={{ height: Math.max(6, (day.views / peak) * 100) + '%' }} /><span style={{ height: Math.max(4, (day.starts / peak) * 70) + '%' }} /></div><small>{day.label}</small></div>)}</div>
        <div className="panda-admin-legend"><span><i />Page views</span><span><i />Watch starts</span></div>
      </article>
      <article className="panda-admin-panel panda-admin-panel--dark"><div className="panda-admin-panel__head"><div><span>ENGAGEMENT</span><h2>Top content</h2></div><Film size={17} /></div>
        <div className="panda-admin-ranking">{topContent.length ? topContent.map((row, index) => <div className="panda-admin-ranking__row" key={row.key}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{row.title}</strong><small>{row.opens} starts · {formatAdminDuration(row.watchSeconds)} watched</small></div></div>) : <div className="panda-admin-ranking__empty">Analytics will appear here once Panda gets more watch activity.</div>}</div>
      </article>
    </section>
    <section className="panda-admin-grid panda-admin-grid--three">
      <article className="panda-admin-panel"><div className="panda-admin-mini-icon"><Users size={16} /></div><span className="panda-admin-panel__eyebrow">AUDIENCE</span><strong className="panda-admin-panel__big">{usersCount.toLocaleString()}</strong><p>Registered accounts currently stored in Firestore.</p></article>
      <article className="panda-admin-panel"><div className="panda-admin-mini-icon"><Clock3 size={16} /></div><span className="panda-admin-panel__eyebrow">SESSION QUALITY</span><strong className="panda-admin-panel__big">{formatAdminDuration(metrics.avgWatchSecondsPerSession)}</strong><p>Average tracked watch time per analytics session.</p></article>
      <article className="panda-admin-panel panda-admin-panel--accent"><div className="panda-admin-mini-icon"><Shield size={16} /></div><span className="panda-admin-panel__eyebrow">SECURITY</span><strong className="panda-admin-panel__big">ADMIN</strong><p>The current account is operating with the Firebase admin claim.</p></article>
    </section>
  </div>;
}

function Audience({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState(''); const [selected, setSelected] = useState<UserRow | null>(null);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? users.filter((user) => [user.displayName, user.email, user.uid].some((value) => String(value || '').toLowerCase().includes(q))) : users;
    return [...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [search, users]);

  return <div className="panda-admin-view">
    <TitleBar kicker="AUDIENCE" title="Know who is using Panda." description="Search registered accounts and inspect profile metadata without exposing it publicly." action={<div className="panda-admin-count-chip"><Users size={15} />{users.length.toLocaleString()} users</div>} />
    <div className="panda-admin-toolbar"><label className="panda-admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email or UID" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</label></div>
    <section className="panda-admin-panel panda-admin-table-panel">{filtered.length ? <div className="panda-admin-table-wrap"><table className="panda-admin-table"><thead><tr><th>User</th><th>Email</th><th>Created</th><th>Role</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.uid}><td><div className="panda-admin-user">{row.photoURL ? <img src={row.photoURL} alt="" /> : <span>{(row.displayName || row.email || 'U').slice(0, 1).toUpperCase()}</span>}<div><strong>{row.displayName || 'Unnamed user'}</strong><small>{row.uid}</small></div></div></td><td>{row.email || '—'}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td><td><span className="panda-admin-badge panda-admin-badge--neutral">Member</span></td><td><button type="button" className="panda-admin-icon-button" onClick={() => setSelected(row)} aria-label={'Inspect ' + (row.email || row.uid)}><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No matching users" description="Try a different email, name or UID." />}</section>
    {selected && <div className="panda-admin-drawer-backdrop" role="presentation" onClick={() => setSelected(null)}><aside className="panda-admin-drawer" onClick={(event) => event.stopPropagation()}><div className="panda-admin-drawer__head"><div><span>USER PROFILE</span><h2>{selected.displayName || 'Unnamed user'}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close user profile"><X size={18} /></button></div><div className="panda-admin-detail-list"><div><span>Email</span><strong>{selected.email || '—'}</strong></div><div><span>UID</span><strong>{selected.uid}</strong></div><div><span>Created</span><strong>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</strong></div><div><span>Role</span><strong>Member</strong></div></div><button type="button" className="panda-admin-secondary-button" onClick={() => void navigator.clipboard?.writeText(selected.uid)}><Copy size={15} />Copy UID</button><p className="panda-admin-note">Firebase Auth role changes remain a privileged server-side operation, so this browser console does not attempt to mutate admin claims.</p></aside></div>}
  </div>;
}

function Content() {
  const [queryText, setQueryText] = useState(''); const [results, setResults] = useState<MovieApiMedia[]>([]); const [loading, setLoading] = useState(false); const [probeId, setProbeId] = useState<string | null>(null); const [message, setMessage] = useState('');
  const searchContent = async (event: React.FormEvent) => {
    event.preventDefault(); const q = queryText.trim(); if (!q) return; setLoading(true); setMessage('');
    try { const data = await api.search(q); setResults(data.results.map((item) => item as unknown as MovieApiMedia).slice(0, 12)); }
    catch (error) { setResults([]); setMessage(error instanceof Error ? error.message : 'Content search failed.'); }
    finally { setLoading(false); }
  };
  const probePlayback = async (item: MovieApiMedia) => {
    setProbeId(item.id); setMessage('');
    try { const source = await api.getWatchLink(item.id, 1, 1); setMessage(item.title + ': ' + (source.source.provider || 'Vidy') + ' playback source reachable.'); }
    catch (error) { setMessage(item.title + ': ' + (error instanceof Error ? error.message : 'Playback probe failed.')); }
    finally { setProbeId(null); }
  };
  return <div className="panda-admin-view">
    <TitleBar kicker="CONTENT" title="Inspect what Panda can actually serve." description="Search MovieAPI content, open its public details page, and run a real Vidy playback probe." />
    <form className="panda-admin-content-search" onSubmit={(event) => void searchContent(event)}><label className="panda-admin-search panda-admin-search--large"><Search size={18} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search movies, series or anime" /></label><button type="submit" className="panda-admin-primary-button" disabled={loading || !queryText.trim()}>{loading ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}Search catalogue</button></form>
    {message && <div className="panda-admin-alert"><CheckCircle2 size={16} />{message}</div>}
    <section className="panda-admin-content-grid">{results.length ? results.map((item) => <article className="panda-admin-content-card" key={item.id}><div className="panda-admin-content-card__art">{item.poster || item.backdrop ? <img src={item.poster || item.backdrop || ''} alt="" loading="lazy" /> : <Film size={22} />}<span>{item.type === 'movie' ? 'MOVIE' : 'SERIES'}</span></div><div className="panda-admin-content-card__body"><strong>{item.title}</strong><small>{item.year || 'Year unknown'} · {item.rating ? Number(item.rating).toFixed(1) : 'No rating'}</small><p>{item.overview || 'No overview returned by MovieAPI.'}</p><div className="panda-admin-content-card__actions"><button type="button" className="panda-admin-secondary-button" onClick={() => void probePlayback(item)} disabled={probeId === item.id}>{probeId === item.id ? <RefreshCw size={14} className="animate-spin" /> : <MonitorPlay size={14} />}Probe Vidy</button><a className="panda-admin-icon-link" href={buildDetailsHref(item.title, item.type === 'movie' ? 'movie' : 'series', item.id)} target="_blank" rel="noreferrer" aria-label={'Open ' + item.title + ' in Panda.fun'}><ExternalLink size={15} /></a></div></div></article>) : <EmptyState icon={Film} title="Search the catalogue" description="Use the search box above to inspect live MovieAPI content." />}</section>
  </div>;
}

function ActivityView({ events }: { events: AdminEvent[] }) {
  const [search, setSearch] = useState(''); const [type, setType] = useState('all');
  const types = useMemo(() => ['all', ...Array.from(new Set(events.map((event) => event.type))).sort()], [events]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return events.filter((event) => { const matchesType = type === 'all' || event.type === type; const haystack = [event.type, event.userEmail, event.uid, event.path, event.animeTitle, event.animeId].map((value) => String(value || '')).join(' ').toLowerCase(); return matchesType && (!q || haystack.includes(q)); }); }, [events, search, type]);
  return <div className="panda-admin-view">
    <TitleBar kicker="ACTIVITY LOG" title="See what the product is doing." description="Filter client analytics by event type, title, path, UID or email." action={<button type="button" className="panda-admin-secondary-button" onClick={() => exportEvents(filtered)}><Download size={15} />Export CSV</button>} />
    <div className="panda-admin-toolbar"><label className="panda-admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter events" /></label><select className="panda-admin-select" value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option value={value} key={value}>{value === 'all' ? 'All event types' : value.replaceAll('_', ' ')}</option>)}</select></div>
    <section className="panda-admin-panel panda-admin-table-panel">{filtered.length ? <div className="panda-admin-table-wrap"><table className="panda-admin-table panda-admin-table--activity"><thead><tr><th>Event</th><th>Content</th><th>User</th><th>Path</th><th>When</th></tr></thead><tbody>{filtered.slice(0, 500).map((event) => <tr key={event.id}><td><span className="panda-admin-badge">{event.type.replaceAll('_', ' ')}</span></td><td><strong>{event.animeTitle || '—'}</strong>{event.episodeNumber && <small>E{event.episodeNumber}</small>}</td><td>{event.userEmail || 'Anonymous'}{event.uid && <small>{event.uid.slice(0, 10)}…</small>}</td><td className="panda-admin-mono">{event.path || '—'}</td><td>{formatDate(event.clientTimestamp)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Activity} title="No events match" description="Try another filter or widen the dashboard date range." />}</section>
  </div>;
}

function Health({ health, onCheck }: { health: HealthState; onCheck: () => Promise<void> }) {
  const ok = health.status === 'ok';
  return <div className="panda-admin-view">
    <TitleBar kicker="SYSTEM HEALTH" title="Know when the stack needs attention." description="Live checks for Firebase access, MovieAPI and the active Vidy playback path." action={<button type="button" className="panda-admin-primary-button" onClick={() => void onCheck()} disabled={health.status === 'loading'}>{health.status === 'loading' ? <RefreshCw size={15} className="animate-spin" /> : <HeartPulse size={15} />}Run health check</button>} />
    <section className="panda-admin-health-grid">
      <article className="panda-admin-health-card"><div className="panda-admin-health-card__status is-ok"><span /></div><div><span>FIREBASE</span><strong>Connected</strong><small>Admin-authenticated Firestore reads are available.</small></div><CheckCircle2 size={18} /></article>
      <article className="panda-admin-health-card"><div className={'panda-admin-health-card__status ' + (ok ? 'is-ok' : health.status === 'error' ? 'is-error' : '')}><span /></div><div><span>MOVIEAPI</span><strong>{health.status === 'loading' ? 'Checking…' : health.status === 'error' ? 'Unavailable' : healthLabel(health.data)}</strong><small>Canonical metadata and playback routing service.</small></div>{ok ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}</article>
      <article className="panda-admin-health-card"><div className="panda-admin-health-card__status is-ok"><span /></div><div><span>PLAYBACK PROVIDER</span><strong>Vidy</strong><small>Frontend routes playback through MovieAPI to Vidy.</small></div><MonitorPlay size={18} /></article>
    </section>
    <section className="panda-admin-panel"><div className="panda-admin-panel__head"><div><span>RAW HEALTH RESPONSE</span><h2>MovieAPI diagnostics</h2></div><Database size={17} /></div><pre className="panda-admin-pre">{health.status === 'idle' ? 'Run the health check to inspect the current MovieAPI response.' : health.status === 'error' ? health.message : prettyJson(health.data)}</pre><small className="panda-admin-last-check">Last checked: {health.checkedAt ? formatDate(health.checkedAt) : 'Not checked yet'}</small></section>
  </div>;
}

function Reports({ events, usersCount, range }: { events: AdminEvent[]; usersCount: number; range: Range }) {
  const metrics = useMemo(() => getAdminMetrics(events), [events]); const topContent = useMemo(() => getTopContent(events, 20), [events]);
  const exportSummary = () => {
    const rows = [['Metric', 'Value'], ['Range (days)', range], ['Page views', metrics.pageViews], ['Watch time seconds', Math.round(metrics.watchSeconds)], ['Unique users', metrics.uniqueUsers], ['Unique sessions', metrics.uniqueSessions], ['Watch starts', metrics.starts], ['Completions', metrics.completions], ['Completion rate %', metrics.completionRate.toFixed(2)], ['Searches', metrics.searches], ['Registered users', usersCount]];
    downloadText('panda-admin-summary.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };
  const exportContent = () => {
    const rows = [['Rank', 'Title', 'Starts', 'Watch seconds'], ...topContent.map((row, index) => [index + 1, row.title, row.opens, row.watchSeconds])];
    downloadText('panda-admin-content.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };
  return <div className="panda-admin-view"><TitleBar kicker="REPORTS" title="Turn the dashboard into something you can share." description="Download clean CSV snapshots for the current analytics window." />
    <section className="panda-admin-report-grid">
      <article className="panda-admin-report-card"><div><BarChart3 size={18} /><span>SUMMARY</span></div><strong>Performance snapshot</strong><p>Core traffic, playback, audience and completion figures for the selected range.</p><button type="button" className="panda-admin-primary-button" onClick={exportSummary}><Download size={15} />Download CSV</button></article>
      <article className="panda-admin-report-card"><div><Film size={18} /><span>CONTENT</span></div><strong>Top content</strong><p>Titles ranked by starts and tracked watch time, ready for spreadsheet analysis.</p><button type="button" className="panda-admin-primary-button" onClick={exportContent}><Download size={15} />Download CSV</button></article>
      <article className="panda-admin-report-card panda-admin-report-card--dark"><div><Activity size={18} /><span>EVENTS</span></div><strong>Raw activity log</strong><p>Export the current analytics event set for debugging or deeper analysis.</p><button type="button" className="panda-admin-secondary-button" onClick={() => exportEvents(events)}><Download size={15} />Download CSV</button></article>
    </section>
  </div>;
}

function SettingsView({ autoRefresh, setAutoRefresh }: { autoRefresh: boolean; setAutoRefresh: (value: boolean) => void }) {
  const rows = [['Active provider', 'Vidy', 'Playback is routed via MovieAPI.'], ['Analytics store', 'Firestore', 'Client events are stored in analytics_events.'], ['Admin authorization', 'Firebase custom claim', 'The dashboard requires admin === true.'], ['Production frontend', 'Render', 'Panda.fun production is hosted on Render.']];
  return <div className="panda-admin-view"><TitleBar kicker="ADMIN SETTINGS" title="Quiet controls for the people running Panda." description="These preferences change the admin console only; they do not alter public playback or account policy." />
    <section className="panda-admin-settings-grid"><article className="panda-admin-panel"><div className="panda-admin-panel__head"><div><span>CONSOLE BEHAVIOUR</span><h2>Refresh policy</h2></div><RefreshCw size={17} /></div><label className="panda-admin-toggle-row"><span><strong>Auto-refresh data</strong><small>Refresh Firestore analytics every 60 seconds while this console is open.</small></span><button type="button" className={'panda-admin-toggle ' + (autoRefresh ? 'is-on' : '')} onClick={() => setAutoRefresh(!autoRefresh)} role="switch" aria-checked={autoRefresh}><span /></button></label></article>
      <article className="panda-admin-panel"><div className="panda-admin-panel__head"><div><span>STACK CONFIGURATION</span><h2>Current wiring</h2></div><BookOpen size={17} /></div><div className="panda-admin-config-list">{rows.map(([label, value, detail]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div></article>
    </section>
    <div className="panda-admin-note panda-admin-note--large"><Shield size={16} /><div><strong>Privileged changes stay off the client.</strong><p>Creating or revoking admin custom claims still belongs in the credentialed Firebase Admin environment. This dashboard intentionally avoids pretending it can perform those operations safely from a public browser.</p></div></div>
  </div>;
}

export function Admin() {
  const [, setLocation] = useLocation(); const { user, loading: authLoading, signOut } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null); const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [range, setRange] = useState<Range>(30); const [events, setEvents] = useState<AdminEvent[]>([]); const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingData, setLoadingData] = useState(true); const [error, setError] = useState(''); const [health, setHealth] = useState<HealthState>({ status: 'idle' });
  const [autoRefresh, setAutoRefreshState] = useState(() => { try { return localStorage.getItem('panda-admin-auto-refresh') === 'true'; } catch { return false; } });
  const setAutoRefresh = (value: boolean) => { setAutoRefreshState(value); try { localStorage.setItem('panda-admin-auto-refresh', String(value)); } catch {} };

  const loadData = async () => {
    if (!user) return; setLoadingData(true); setError('');
    try {
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) { setAuthorized(false); return; }
      setAuthorized(true);
      const since = Date.now() - range * 86400000;
      const [eventSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, 'analytics_events'), orderBy('clientTimestamp', 'desc'), limit(5000))),
        getDocs(query(collection(db, 'users'), limit(5000))),
      ]);
      const loadedEvents = eventSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return { id: docSnap.id, ...data, type: String(data.type || 'unknown'), clientTimestamp: typeof data.clientTimestamp === 'number' ? data.clientTimestamp : safeTimestamp(data.createdAt) } as AdminEvent;
      }).filter((event) => !event.clientTimestamp || event.clientTimestamp >= since);
      const loadedUsers = userSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return { uid: String(data.uid || docSnap.id), email: isTruthyString(data.email) ? data.email : undefined, displayName: isTruthyString(data.displayName) ? data.displayName : undefined, photoURL: isTruthyString(data.photoURL) ? data.photoURL : undefined, createdAt: isTruthyString(data.createdAt) ? data.createdAt : undefined } as UserRow;
      });
      setEvents(loadedEvents); setUsers(loadedUsers);
    } catch (loadError) {
      console.error('[Panda.fun] Admin dashboard load failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.'); setAuthorized(false);
    } finally { setLoadingData(false); }
  };

  const runHealthCheck = async () => {
    setHealth({ status: 'loading', checkedAt: Date.now() });
    try { const data = await api.health(); setHealth({ status: 'ok', checkedAt: Date.now(), data }); }
    catch (healthError) { setHealth({ status: 'error', checkedAt: Date.now(), message: healthError instanceof Error ? healthError.message : 'MovieAPI health check failed.' }); }
  };

  useEffect(() => { updateSEO({ title: 'Admin Console', description: 'Panda.fun administrator console.', type: 'website' }); }, []);
  useEffect(() => { if (!user || authLoading) return; void loadData(); }, [user, authLoading, range]);
  useEffect(() => { if (!autoRefresh || !user || authorized !== true) return; const timer = window.setInterval(() => { void loadData(); }, 60000); return () => window.clearInterval(timer); }, [autoRefresh, user, authorized, range]);

  if (authLoading || loadingData || authorized === null) return <div className="panda-admin-gate"><RefreshCw size={22} className="animate-spin" /><span>Checking Panda admin access…</span></div>;
  if (!user) return <div className="panda-admin-gate"><div className="panda-admin-gate__card"><div className="panda-admin-gate__mark">🐼</div><ShieldAlert size={21} /><h1>Admin sign-in required</h1><p>Sign in with the Firebase account that has the Panda.fun <code>admin</code> custom claim.</p><button type="button" className="panda-admin-primary-button" onClick={() => setLocation('/')}>Return to Panda.fun</button></div></div>;
  if (!authorized) return <div className="panda-admin-gate"><div className="panda-admin-gate__card"><div className="panda-admin-gate__mark">🐼</div><ShieldAlert size={21} /><h1>Access denied</h1><p>{error || 'This Firebase account does not have the required admin custom claim.'}</p><div className="panda-admin-gate__actions"><button type="button" className="panda-admin-primary-button" onClick={() => setLocation('/home')}>Back to Panda</button><button type="button" className="panda-admin-secondary-button" onClick={() => void signOut()}>Sign out</button></div></div></div>;

  let activeView: React.ReactNode;
  switch (activeTab) {
    case 'overview': activeView = <Overview events={events} usersCount={users.length} range={range} onRangeChange={setRange} />; break;
    case 'audience': activeView = <Audience users={users} />; break; case 'content': activeView = <Content />; break;
    case 'activity': activeView = <ActivityView events={events} />; break; case 'health': activeView = <Health health={health} onCheck={runHealthCheck} />; break;
    case 'reports': activeView = <Reports events={events} usersCount={users.length} range={range} />; break;
    case 'settings': activeView = <SettingsView autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} />; break; default: activeView = null;
  }
  return <AdminShell activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={signOut}>{activeView}</AdminShell>;
}

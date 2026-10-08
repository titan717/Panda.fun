import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BarChart3, BookOpen, CheckCircle2, ChevronRight, Clock3, Copy,
  Download, ExternalLink, Film, HeartPulse, LayoutDashboard, LogOut, MonitorPlay,
  RefreshCw, Search, Settings2, Shield, ShieldAlert, Users, X, Zap
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useLocation } from 'wouter';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { api, type MovieApiMedia } from '../lib/api';
import { buildDetailsHref } from '../lib/mediaRoute';
import { updateSEO } from '../lib/seo';
import {
  ADMIN_METRICS, formatAdminDuration, getAdminMetrics, getMetricLabel, getMetricValue,
  getRecentDays, getTopContent, type AdminEvent, type AdminMetricKey, type DailyMetricRow
} from '../lib/adminMetrics';
import { hasAdminClaim, hasAdminMarker } from '../lib/adminAccess';
import '../styles/admin.css';

type AdminTab = 'overview' | 'audience' | 'content' | 'activity' | 'health' | 'reports' | 'settings';
type Range = 7 | 30 | 90;
type UserRow = { uid: string; email?: string; displayName?: string; photoURL?: string; createdAt?: string };
type HealthState = { status: 'idle' | 'loading' | 'ok' | 'error'; checkedAt?: number; data?: unknown; message?: string };

const TAB_ITEMS: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'audience', label: 'Audience', icon: Users },
  { id: 'content', label: 'Content', icon: Film },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'health', label: 'System', icon: HeartPulse },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];
const RANGE_OPTIONS: Range[] = [7, 30, 90];

function isTruthyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
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
function prettyJson(data: unknown): string {
  try { return JSON.stringify(data, null, 2); } catch { return String(data); }
}
function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}
function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function exportEvents(events: AdminEvent[]): void {
  const headers = ['timestamp', 'type', 'userEmail', 'uid', 'path', 'animeTitle', 'animeId', 'episodeNumber', 'durationSeconds', 'sessionId'];
  const rows = events.map((event) => [
    event.clientTimestamp ? new Date(event.clientTimestamp).toISOString() : '',
    event.type, event.userEmail || 'Anonymous', event.uid || '', event.path || '',
    event.animeTitle || '', event.animeId || '', event.episodeNumber || '',
    event.durationSeconds || '', event.sessionId || '',
  ]);
  downloadText('panda-admin-events.csv', [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

function Brand() {
  return (
    <div className="panda-admin-brand">
      <div className="panda-admin-brand__mark">🐼</div>
      <div><strong>PANDA.FUN</strong><span>Control room</span></div>
    </div>
  );
}

function TitleBar({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="panda-admin-titlebar">
      <div>
        <span className="panda-admin-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function AdminShell({ activeTab, setActiveTab, user, onSignOut, children }: {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  user: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <div className="panda-admin">
      <aside className="panda-admin-sidebar">
        <Brand />
        <div className="panda-admin-sidebar__label">Workspace</div>
        <nav className="panda-admin-nav" aria-label="Admin navigation">
          {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={activeTab === id ? 'is-active' : ''} onClick={() => setActiveTab(id)}>
              <Icon size={16} strokeWidth={1.9} /><span>{label}</span>{activeTab === id && <ChevronRight size={13} />}
            </button>
          ))}
        </nav>
        <div className="panda-admin-sidebar__bottom">
          <div className="panda-admin-session">
            {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span>{(user?.displayName || user?.email || 'A').slice(0, 1).toUpperCase()}</span>}
            <div><strong>{user?.displayName || 'Panda admin'}</strong><small>{user?.email || 'Authenticated'}</small></div>
          </div>
          <button type="button" className="panda-admin-signout" onClick={() => void onSignOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      <header className="panda-admin-mobile-header">
        <Brand />
        <div className="panda-admin-mobile-actions">
          <button type="button" onClick={() => setActiveTab('overview')} aria-label="Overview"><LayoutDashboard size={17} /></button>
          <button type="button" onClick={() => void onSignOut()} aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </header>
      <main className="panda-admin-main">{children}</main>
    </div>
  );
}

function MetricChart({ rows, metric, onMetricChange }: {
  rows: DailyMetricRow[];
  metric: AdminMetricKey;
  onMetricChange: (metric: AdminMetricKey) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 1000;
  const height = 320;
  const left = 48;
  const right = 18;
  const top = 22;
  const bottom = 44;
  const innerW = width - left - right;
  const innerH = height - top - bottom;
  const values = rows.map((row) => getMetricValue(row, metric));
  const max = Math.max(1, ...values);
  const hasData = values.some((value) => value > 0);
  const formatChartValue = (value: number) => metric === 'watchSeconds' ? formatAdminDuration(value) : value.toLocaleString();
  const path = values.map((value, index) => {
    const x = left + (rows.length <= 1 ? innerW / 2 : index * (innerW / (rows.length - 1)));
    const y = top + innerH - (value / max) * innerH;
    return (index === 0 ? 'M ' : 'L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }).join(' ');
  const area = rows.length ? path + ' L ' + (left + innerW).toFixed(2) + ' ' + (top + innerH).toFixed(2) + ' L ' + left + ' ' + (top + innerH).toFixed(2) + ' Z' : '';

  return (
    <div className="panda-admin-chart">
      <div className="panda-admin-chart__toolbar">
        <div className="panda-admin-chart__metrics" role="tablist" aria-label="Chart metric">
          {ADMIN_METRICS.map((item) => (
            <button key={item.key} type="button" role="tab" aria-selected={metric === item.key} className={metric === item.key ? 'is-active' : ''} onClick={() => setMetric(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <span className="panda-admin-chart__hint">{getMetricLabel(metric)} · daily</span>
      </div>
      <div className="panda-admin-chart__plot">
        <svg viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label={getMetricLabel(metric) + ' over time'} preserveAspectRatio="none">
          {[0, .25, .5, .75, 1].map((ratio) => {
            const y = top + innerH - ratio * innerH;
            const value = ratio * max;
            return <React.Fragment key={ratio}><line x1={left} x2={width - right} y1={y} y2={y} className="panda-admin-chart__gridline" /><text x={left - 8} y={y + 3} textAnchor="end" className="panda-admin-chart__y-label">{formatChartValue(value)}</text></React.Fragment>;
          })}
          {hovered != null && rows[hovered] && <line x1={left + (rows.length <= 1 ? innerW / 2 : hovered * (innerW / (rows.length - 1)))} x2={left + (rows.length <= 1 ? innerW / 2 : hovered * (innerW / (rows.length - 1)))} y1={top} y2={top + innerH} className="panda-admin-chart__guide" />}
          <path d={area} className="panda-admin-chart__area" />
          <path d={path} className="panda-admin-chart__line" />
          {values.map((value, index) => {
            const x = left + (rows.length <= 1 ? innerW / 2 : index * (innerW / (rows.length - 1)));
            const y = top + innerH - (value / max) * innerH;
            return (
              <circle
                key={rows[index]?.key || index}
                cx={x}
                cy={y}
                r={hovered === index ? 5 : 3}
                className="panda-admin-chart__point"
                tabIndex={0}
                aria-label={(rows[index]?.label || '') + ': ' + value}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
              />
            );
          })}
          {[0, Math.floor(rows.length / 2), Math.max(0, rows.length - 1)].map((index) => rows[index] ? (
            <text key={rows[index].key} x={left + (rows.length <= 1 ? innerW / 2 : index * (innerW / (rows.length - 1)))} y={height - 12} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'} className="panda-admin-chart__label">{rows[index].label}</text>
          ) : null)}
        </svg>
        {!hasData && <div className="panda-admin-chart__empty">No stored {getMetricLabel(metric).toLowerCase()} in this range.</div>}
        {hovered != null && rows[hovered] && (
          <div
            className="panda-admin-chart__tooltip"
            style={{ left: (rows.length <= 1 ? 50 : (hovered / (rows.length - 1)) * 100) + '%' }}
            role="status"
          >
            <strong>{rows[hovered].label}</strong>
            <span>{getMetricLabel(metric)}</span>
            <b>{metric === 'watchSeconds' ? formatAdminDuration(getMetricValue(rows[hovered], metric)) : getMetricValue(rows[hovered], metric).toLocaleString()}</b>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="panda-admin-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Overview({ events, usersCount, range, onRangeChange, autoRefresh, onRefresh, refreshing }: {
  events: AdminEvent[];
  usersCount: number;
  range: Range;
  onRangeChange: (range: Range) => void;
  autoRefresh: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const metrics = useMemo(() => getAdminMetrics(events), [events]);
  const daily = useMemo(() => getRecentDays(events, range), [events, range]);
  const topContent = useMemo(() => getTopContent(events, 8), [events]);
  const [metric, setMetric] = useState<AdminMetricKey>('pageViews');

  return (
    <div className="panda-admin-view">
      <TitleBar
        kicker="ANALYTICS"
        title="Panda, without the noise."
        description="GA4 events are collected by Google and mirrored into Firestore for the operational dashboard."
        action={
          <div className="panda-admin-title-actions">
            <div className="panda-admin-range">
              {RANGE_OPTIONS.map((value) => <button key={value} type="button" className={range === value ? 'is-active' : ''} onClick={() => onRangeChange(value)}>{value}d</button>)}
            </div>
            <button type="button" className="panda-admin-icon-action" onClick={onRefresh} disabled={refreshing} aria-label="Refresh analytics">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      <section className="panda-admin-kpi-grid" aria-label="Key metrics">
        <Kpi label="Page views" value={metrics.pageViews.toLocaleString()} detail={range + ' days'} />
        <Kpi label="Unique users" value={metrics.uniqueUsers.toLocaleString()} detail="Signed-in analytics" />
        <Kpi label="Watch starts" value={metrics.starts.toLocaleString()} detail="Movies + episodes" />
        <Kpi label="Watch time" value={formatAdminDuration(metrics.watchSeconds)} detail="Stored playback seconds" />
      </section>

      <section className="panda-admin-chart-panel">
        <MetricChart rows={daily} metric={metric} onMetricChange={setMetric} />
      </section>

      <section className="panda-admin-overview-grid">
        <article className="panda-admin-simple-panel">
          <div className="panda-admin-panel-heading"><div><span>CONTENT</span><h2>Most watched</h2></div><Film size={16} /></div>
          <div className="panda-admin-ranking">
            {topContent.length ? topContent.map((row, index) => (
              <div className="panda-admin-ranking__row" key={row.key}>
                <b>{String(index + 1).padStart(2, '0')}</b>
                <div><strong>{row.title}</strong><small>{row.opens.toLocaleString()} starts · {formatAdminDuration(row.watchSeconds)}</small></div>
              </div>
            )) : <div className="panda-admin-muted-block">No stored watch activity yet.</div>}
          </div>
        </article>
        <article className="panda-admin-simple-panel">
          <div className="panda-admin-panel-heading"><div><span>FUNNEL</span><h2>Discovery to watch</h2></div><Zap size={16} /></div>
          <div className="panda-admin-funnel">
            <div><span>Searches</span><b>{metrics.searches.toLocaleString()}</b></div>
            <div><span>Content selects</span><b>{metrics.contentSelections.toLocaleString()}</b></div>
            <div><span>Watch starts</span><b>{metrics.starts.toLocaleString()}</b></div>
            <div><span>Completions</span><b>{metrics.completions.toLocaleString()}</b></div>
          </div>
        </article>
      </section>

      <div className="panda-admin-source-strip">
        <div><span className="panda-admin-live-dot" />GA4 collection active</div>
        <code>G-9CEEHSHNHJ</code>
        <span>Firestore event mirror</span>
        {autoRefresh && <span>Auto-refresh on</span>}
      </div>
    </div>
  );
}

function Audience({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(q ? users.filter((user) => [user.displayName, user.email, user.uid].some((value) => String(value || '').toLowerCase().includes(q))) : users)]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }, [search, users]);

  return (
    <div className="panda-admin-view">
      <TitleBar kicker="AUDIENCE" title="People, not rows." description="Signed-in accounts mirrored from Firebase Authentication into Firestore profiles." action={<span className="panda-admin-count">{users.length.toLocaleString()} loaded</span>} />
      <div className="panda-admin-toolbar"><label className="panda-admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or UID" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear"><X size={14} /></button>}</label></div>
      <section className="panda-admin-table-shell">
        {filtered.length ? (
          <div className="panda-admin-table-wrap"><table className="panda-admin-table"><thead><tr><th>User</th><th>Email</th><th>Created</th><th>Role</th><th /></tr></thead>
            <tbody>{filtered.map((row) => <tr key={row.uid}>
              <td><div className="panda-admin-user">{row.photoURL ? <img src={row.photoURL} alt="" /> : <span>{(row.displayName || row.email || 'U').slice(0, 1).toUpperCase()}</span>}<div><strong>{row.displayName || 'Unnamed user'}</strong><small>{row.uid}</small></div></div></td>
              <td>{row.email || '—'}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}</td>
              <td><span className="panda-admin-role">Member</span></td>
              <td><button type="button" className="panda-admin-row-action" onClick={() => setSelected(row)} aria-label={'Inspect ' + (row.email || row.uid)}><ChevronRight size={15} /></button></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="panda-admin-empty"><Users size={22} /><strong>No matching users</strong><p>Try another email, name or UID.</p></div>}
      </section>
      {selected && <div className="panda-admin-drawer-backdrop" role="presentation" onClick={() => setSelected(null)}>
        <aside className="panda-admin-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="panda-admin-drawer__head"><div><span>USER</span><h2>{selected.displayName || 'Unnamed user'}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close"><X size={17} /></button></div>
          <div className="panda-admin-detail-list"><div><span>Email</span><strong>{selected.email || '—'}</strong></div><div><span>UID</span><strong>{selected.uid}</strong></div><div><span>Created</span><strong>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</strong></div><div><span>Role</span><strong>Member</strong></div></div>
          <button type="button" className="panda-admin-secondary-button" onClick={() => void navigator.clipboard?.writeText(selected.uid)}><Copy size={14} />Copy UID</button>
        </aside>
      </div>}
    </div>
  );
}

function Content() {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<MovieApiMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [probeId, setProbeId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const searchContent = async (event: React.FormEvent) => {
    event.preventDefault();
    const q = queryText.trim();
    if (!q) return;
    setLoading(true); setMessage('');
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
  return (
    <div className="panda-admin-view">
      <TitleBar kicker="CONTENT" title="Inspect the catalogue." description="Search live MovieAPI records and test the active Vidy playback path." />
      <form className="panda-admin-content-search" onSubmit={(event) => void searchContent(event)}>
        <label className="panda-admin-search panda-admin-search--large"><Search size={17} /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search movies, series or anime" /></label>
        <button type="submit" className="panda-admin-primary-button" disabled={loading || !queryText.trim()}>{loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}Search</button>
      </form>
      {message && <div className="panda-admin-alert"><CheckCircle2 size={15} />{message}</div>}
      <section className="panda-admin-content-grid">{results.length ? results.map((item) => (
        <article className="panda-admin-content-row" key={item.id}>
          <div className="panda-admin-content-art">{item.poster || item.backdrop ? <img src={item.poster || item.backdrop || ''} alt="" loading="lazy" /> : <Film size={20} />}<span>{item.type === 'movie' ? 'MOVIE' : 'SERIES'}</span></div>
          <div className="panda-admin-content-copy"><strong>{item.title}</strong><small>{item.year || 'Unknown'} · {item.rating ? Number(item.rating).toFixed(1) : 'No rating'}</small><p>{item.overview || 'No overview returned.'}</p></div>
          <div className="panda-admin-content-actions"><button type="button" className="panda-admin-secondary-button" onClick={() => void probePlayback(item)} disabled={probeId === item.id}>{probeId === item.id ? <RefreshCw size={13} className="animate-spin" /> : <MonitorPlay size={13} />}Probe Vidy</button><a className="panda-admin-row-action panda-admin-row-action--link" href={buildDetailsHref(item.title, item.type === 'movie' ? 'movie' : 'series', item.id)} target="_blank" rel="noreferrer"><ArrowUpRight size={14} /></a></div>
        </article>
      )) : <div className="panda-admin-empty"><Film size={22} /><strong>Search the catalogue</strong><p>Use MovieAPI search above to inspect live titles.</p></div>}</section>
    </div>
  );
}

function ActivityView({ events }: { events: AdminEvent[] }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const types = useMemo(() => ['all', ...Array.from(new Set(events.map((event) => event.type))).sort()], [events]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesType = type === 'all' || event.type === type;
      const haystack = [event.type, event.userEmail, event.uid, event.path, event.animeTitle, event.animeId].map((value) => String(value || '')).join(' ').toLowerCase();
      return matchesType && (!q || haystack.includes(q));
    });
  }, [events, search, type]);
  return (
    <div className="panda-admin-view">
      <TitleBar kicker="ACTIVITY" title="Raw events, cleanly." description="The Firestore mirror of the GA4 event stream." action={<button type="button" className="panda-admin-secondary-button" onClick={() => exportEvents(filtered)}><Download size={14} />Export</button>} />
      <div className="panda-admin-toolbar"><label className="panda-admin-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter events" /></label><select className="panda-admin-select" value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option key={value} value={value}>{value === 'all' ? 'All events' : value.replaceAll('_', ' ')}</option>)}</select></div>
      <section className="panda-admin-table-shell"><div className="panda-admin-table-wrap"><table className="panda-admin-table panda-admin-table--activity"><thead><tr><th>Event</th><th>Content</th><th>User</th><th>Path</th><th>When</th></tr></thead><tbody>{filtered.slice(0, 500).map((event) => <tr key={event.id}><td><span className="panda-admin-event-badge">{event.type}</span></td><td><strong>{event.animeTitle || '—'}</strong>{event.episodeNumber && <small>E{event.episodeNumber}</small>}</td><td>{event.userEmail || 'Anonymous'}{event.uid && <small>{event.uid.slice(0, 9)}…</small>}</td><td className="panda-admin-mono">{event.path || '—'}</td><td>{formatDate(event.clientTimestamp)}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}

function Health({ health, onCheck }: { health: HealthState; onCheck: () => Promise<void> }) {
  const ok = health.status === 'ok';
  return (
    <div className="panda-admin-view">
      <TitleBar kicker="SYSTEM" title="Know what is alive." description="Live checks for MovieAPI and the active Vidy routing path." action={<button type="button" className="panda-admin-primary-button" onClick={() => void onCheck()} disabled={health.status === 'loading'}>{health.status === 'loading' ? <RefreshCw size={14} className="animate-spin" /> : <HeartPulse size={14} />}Run check</button>} />
      <section className="panda-admin-health-list">
        <div><span className="is-ok" /><strong>Firebase</strong><small>Authenticated Firestore access</small><b>Connected</b></div>
        <div><span className={ok ? 'is-ok' : health.status === 'error' ? 'is-error' : ''} /><strong>MovieAPI</strong><small>Metadata + playback routing</small><b>{health.status === 'loading' ? 'Checking…' : health.status === 'error' ? 'Unavailable' : healthLabel(health.data)}</b></div>
        <div><span className="is-ok" /><strong>Vidy</strong><small>Current playback provider</small><b>Active</b></div>
      </section>
      <pre className="panda-admin-health-pre">{health.status === 'idle' ? 'Run the check to inspect the latest MovieAPI response.' : health.status === 'error' ? health.message : prettyJson(health.data)}</pre>
      <small className="panda-admin-last-check">Last checked: {health.checkedAt ? formatDate(health.checkedAt) : 'Not checked yet'}</small>
    </div>
  );
}

function Reports({ events, usersCount, range }: { events: AdminEvent[]; usersCount: number; range: Range }) {
  const metrics = useMemo(() => getAdminMetrics(events), [events]);
  const topContent = useMemo(() => getTopContent(events, 20), [events]);
  const exportSummary = () => {
    const rows = [
      ['Metric', 'Value'], ['Range (days)', range], ['Page views', metrics.pageViews], ['Watch time seconds', Math.round(metrics.watchSeconds)],
      ['Unique users', metrics.uniqueUsers], ['Unique sessions', metrics.uniqueSessions], ['Watch starts', metrics.starts],
      ['Completions', metrics.completions], ['Completion rate %', metrics.completionRate.toFixed(2)], ['Searches', metrics.searches],
      ['Content selections', metrics.contentSelections], ['Registered users', usersCount],
    ];
    downloadText('panda-admin-summary.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };
  const exportContent = () => {
    const rows = [['Rank', 'Title', 'Starts', 'Watch seconds'], ...topContent.map((row, index) => [index + 1, row.title, row.opens, row.watchSeconds])];
    downloadText('panda-admin-content.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  };
  return (
    <div className="panda-admin-view">
      <TitleBar kicker="REPORTS" title="Useful exports." description="CSV snapshots for the selected analytics window." />
      <section className="panda-admin-report-list">
        <button type="button" className="panda-admin-report-row" onClick={exportSummary}><span><BarChart3 size={16} /></span><div><strong>Performance snapshot</strong><small>Traffic, playback, audience and completion metrics.</small></div><Download size={15} /></button>
        <button type="button" className="panda-admin-report-row" onClick={exportContent}><span><Film size={16} /></span><div><strong>Top content</strong><small>Ranked by opens and stored watch time.</small></div><Download size={15} /></button>
        <button type="button" className="panda-admin-report-row" onClick={() => exportEvents(events)}><span><Activity size={16} /></span><div><strong>Event log</strong><small>Raw Firestore analytics events for debugging.</small></div><Download size={15} /></button>
      </section>
    </div>
  );
}

function SettingsView({ autoRefresh, setAutoRefresh }: { autoRefresh: boolean; setAutoRefresh: (value: boolean) => void }) {
  return (
    <div className="panda-admin-view">
      <TitleBar kicker="SETTINGS" title="Keep the control room quiet." description="Console-only preferences and analytics wiring." />
      <section className="panda-admin-settings-list">
        <label><div><strong>Auto-refresh</strong><small>Refresh analytics every 60 seconds while the console is open.</small></div><button type="button" className={'panda-admin-toggle ' + (autoRefresh ? 'is-on' : '')} onClick={() => setAutoRefresh(!autoRefresh)} role="switch" aria-checked={autoRefresh}><span /></button></label>
        <div><div><strong>Google Analytics 4</strong><small>Measurement ID used by Panda.fun.</small></div><code>G-9CEEHSHNHJ</code></div>
        <div><div><strong>Operational mirror</strong><small>Firestore collection used by this dashboard.</small></div><code>analytics_events</code></div>
        <div><div><strong>Admin access</strong><small>Firestore marker at admins/{uid} or a Firebase admin claim.</small></div><code>admin</code></div>
      </section>
      <div className="panda-admin-note"><Shield size={15} /><span>Google owns the canonical GA4 reporting interface. This dashboard uses the same GA4 event vocabulary and a Firestore mirror for fast product operations.</span></div>
    </div>
  );
}

export function Admin() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, signOut } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [range, setRange] = useState<Range>(30);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthState>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefreshState] = useState(() => {
    try { return localStorage.getItem('panda-admin-auto-refresh') === 'true'; } catch { return false; }
  });
  const setAutoRefresh = (value: boolean) => {
    setAutoRefreshState(value);
    try { localStorage.setItem('panda-admin-auto-refresh', String(value)); } catch {}
  };

  const loadData = async (background = false) => {
    if (!user) return;
    if (background) setRefreshing(true); else setLoadingData(true);
    setError('');
    try {
      const token = await user.getIdTokenResult(true);
      let hasAccess = hasAdminClaim(token.claims as Record<string, unknown>);
      if (!hasAccess) {
        const adminMarker = await getDoc(doc(db, 'admins', user.uid));
        hasAccess = adminMarker.exists() && hasAdminMarker(adminMarker.data() as Record<string, unknown>);
      }
      if (!hasAccess) { setAuthorized(false); return; }
      setAuthorized(true);
      const [eventSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, 'analytics_events'), orderBy('clientTimestamp', 'desc'), limit(10000))),
        getDocs(query(collection(db, 'users'), limit(5000))),
      ]);
      const loadedEvents = eventSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return { id: docSnap.id, ...data, type: String(data.type || 'unknown'), clientTimestamp: typeof data.clientTimestamp === 'number' ? data.clientTimestamp : safeTimestamp(data.createdAt) } as AdminEvent;
      }).filter((event) => !event.clientTimestamp || event.clientTimestamp >= Date.now() - range * 86400000);
      const loadedUsers = userSnap.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return { uid: String(data.uid || docSnap.id), email: isTruthyString(data.email) ? data.email : undefined, displayName: isTruthyString(data.displayName) ? data.displayName : undefined, photoURL: isTruthyString(data.photoURL) ? data.photoURL : undefined, createdAt: isTruthyString(data.createdAt) ? data.createdAt : undefined } as UserRow;
      });
      setEvents(loadedEvents);
      setUsers(loadedUsers);
    } catch (loadError) {
      console.error('[Panda.fun] Admin dashboard load failed:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.');
      setAuthorized(false);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  };

  const runHealthCheck = async () => {
    setHealth({ status: 'loading', checkedAt: Date.now() });
    try { const data = await api.health(); setHealth({ status: 'ok', checkedAt: Date.now(), data }); }
    catch (healthError) { setHealth({ status: 'error', checkedAt: Date.now(), message: healthError instanceof Error ? healthError.message : 'MovieAPI health check failed.' }); }
  };

  useEffect(() => { updateSEO({ title: 'Admin Console', description: 'Panda.fun analytics and operations console.', type: 'website' }); }, []);
  useEffect(() => { if (!user || authLoading) return; void loadData(); }, [user, authLoading, range]);
  useEffect(() => {
    if (!autoRefresh || !user || authorized !== true) return;
    const timer = window.setInterval(() => { void loadData(true); }, 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, user, authorized, range]);

  if (authLoading || loadingData || authorized === null) return <div className="panda-admin-gate"><RefreshCw size={20} className="animate-spin" /><span>Checking admin access…</span></div>;
  if (!user) return <div className="panda-admin-gate"><div className="panda-admin-gate__content"><div className="panda-admin-gate__mark">🐼</div><ShieldAlert size={20} /><h1>Admin sign-in required</h1><p>Sign in with the Firebase account assigned to Panda.fun administration.</p><button type="button" className="panda-admin-primary-button" onClick={() => setLocation('/')}>Return to Panda.fun</button></div></div>;
  if (!authorized) return <div className="panda-admin-gate"><div className="panda-admin-gate__content"><div className="panda-admin-gate__mark">🐼</div><ShieldAlert size={20} /><h1>Access denied</h1><p>{error || 'This Firebase account is not an administrator.'}</p><div className="panda-admin-gate__actions"><button type="button" className="panda-admin-primary-button" onClick={() => setLocation('/home')}>Back to Panda</button><button type="button" className="panda-admin-secondary-button" onClick={() => void signOut()}>Sign out</button></div></div></div>;

  let activeView: React.ReactNode;
  switch (activeTab) {
    case 'overview': activeView = <Overview events={events} usersCount={users.length} range={range} onRangeChange={setRange} autoRefresh={autoRefresh} onRefresh={() => void loadData(true)} refreshing={refreshing} />; break;
    case 'audience': activeView = <Audience users={users} />; break;
    case 'content': activeView = <Content />; break;
    case 'activity': activeView = <ActivityView events={events} />; break;
    case 'health': activeView = <Health health={health} onCheck={runHealthCheck} />; break;
    case 'reports': activeView = <Reports events={events} usersCount={users.length} range={range} />; break;
    case 'settings': activeView = <SettingsView autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} />; break;
    default: activeView = null;
  }

  return <AdminShell activeTab={activeTab} setActiveTab={setActiveTab} user={user} onSignOut={signOut}>{activeView}</AdminShell>;
}

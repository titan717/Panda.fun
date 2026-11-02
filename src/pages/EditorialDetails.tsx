import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft, Check, Copy, Pause, Play, Plus, Volume2, VolumeX, X } from 'lucide-react';
import { getEditorialTitle, editorialTitles } from '../data/fixtures';
import { libraryManager } from '../lib/library';

const PREVIEW_IDS = ['4308', '52427', '35540', '41576', '39912'];

export function EditorialDetails() {
  const [, params] = useRoute<{ id: string }>('/details/:id');
  const [, setLocation] = useLocation();
  const item = getEditorialTitle(params?.id || '');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [muted, setMuted] = useState(true);
  const [inList, setInList] = useState(() => item ? libraryManager.isInWatchlist(item.id) : false);
  const [shareFeedback, setShareFeedback] = useState('');

  useEffect(() => {
    setInList(item ? libraryManager.isInWatchlist(item.id) : false);
    setPlaying(false);
    setVideoError(false);
  }, [item?.id]);

  useEffect(() => {
    if (!playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlaying(false);
        videoRef.current?.pause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing]);

  if (!item) return <main className="min-h-[70vh] bg-[#050507] px-6 py-20 text-center text-white"><h1 className="text-2xl font-bold">This Panda story could not be found.</h1><Link href="/home" className="mt-5 inline-block text-[#ff2e63]">Back to Home</Link></main>;

  const previewId = PREVIEW_IDS[editorialTitles.findIndex(title => title.id === item.id) % PREVIEW_IDS.length];
  const previewUrl = `https://assets.mixkit.co/videos/${previewId}/${previewId}-720.mp4`;

  const toggleList = () => {
    setInList(libraryManager.toggleWatchlist({ id: item.id, title: item.title, image: item.poster }));
  };

  const openPreview = () => {
    setPlaying(true);
    window.setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = muted;
      void video.play().catch(() => setVideoError(true));
    }, 50);
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: item.title, text: `Watch ${item.title} on panda.fun`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareFeedback('Link copied');
        window.setTimeout(() => setShareFeedback(''), 1800);
      }
    } catch {
      setShareFeedback('Unable to share right now');
      window.setTimeout(() => setShareFeedback(''), 1800);
    }
  };

  const similar = editorialTitles.filter(title => title.id !== item.id && title.genres.some(genre => item.genres.includes(genre))).slice(0, 6);

  return (
    <main className="min-h-screen bg-[#050507] pb-24 text-[#f7f4f2]">
      <section className="relative min-h-[560px] overflow-hidden md:min-h-[680px]">
        <img src={item.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050507] via-[#050507]/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-transparent to-[#050507]/30" />
        <div className="relative mx-auto flex min-h-[560px] max-w-[1440px] flex-col justify-end px-5 pb-12 pt-24 md:min-h-[680px] md:px-12 md:pb-16">
          <button type="button" onClick={() => setLocation('/home')} className="absolute left-5 top-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm font-semibold md:left-12"><ArrowLeft size={16} /> Back</button>
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex rounded-full border border-[#ff2e63]/40 bg-[#ff2e63]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[.16em] text-[#ff8aa9]">A panda.fun original</span>
            <h1 className="max-w-xl text-5xl font-black tracking-[-.055em] md:text-7xl">{item.title}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#d4cfcb]">
              <span className="text-[#8dbb84]">{item.match}% Match</span><span>{item.year}</span><span>{item.maturity}</span><span>{item.kind === 'series' ? `${item.seasons.length} Season` : 'Feature Film'}</span><span>HD</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#d4cfcb]">{item.genres.map(genre => <span key={genre} className="rounded-full border border-white/15 px-3 py-1.5">{genre}</span>)}</div>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#e1dbd6] md:text-base">{item.synopsis}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button type="button" onClick={openPreview} className="inline-flex items-center gap-2 rounded-lg bg-[#ff2e63] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_8px_30px_rgba(255,46,99,.25)]"><Play size={17} fill="currentColor" /> Play Preview</button>
              <button type="button" onClick={toggleList} aria-pressed={inList} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-bold">{inList ? <Check size={17} /> : <Plus size={17} />}{inList ? 'In My List' : 'My List'}</button>
              <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-bold"><Copy size={16} /> Share</button>
              {shareFeedback && <span role="status" className="text-xs text-[#8dbb84]">{shareFeedback}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 pt-10 md:grid-cols-[minmax(0,1fr)_280px] md:px-12">
        <section>
          {item.kind === 'series' && item.seasons[0] && <>
            <div className="mb-5 flex items-end justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#ff7b9d]">Episodes</span><h2 className="mt-1 text-2xl font-extrabold">Season 1</h2></div><span className="text-xs text-[#9f9792]">{item.seasons[0].episodes.length} episodes</span></div>
            <div className="grid gap-3">{item.seasons[0].episodes.map(ep => <article key={ep.id} className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 rounded-xl border border-white/10 bg-[#111012] p-3 sm:grid-cols-[160px_minmax(0,1fr)]"><img src={ep.image} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" /><div className="min-w-0 self-center"><div className="flex flex-wrap items-center gap-2 text-xs text-[#a9a19c]"><span>Episode {ep.number}</span><span>·</span><span>{ep.duration}</span></div><h3 className="mt-1 font-bold">{ep.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#a9a19c]">{ep.synopsis}</p></div></article>)}</div>
          </>}
          <section className="mt-10"><h2 className="text-xl font-extrabold">More Like This</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{similar.map(title => <Link key={title.id} href={`/details/${title.id}?type=${title.kind}&editorial=1`} className="group overflow-hidden rounded-xl border border-white/10 bg-[#111012]"><img src={title.poster} alt="" className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" /><span className="block truncate px-3 py-2 text-sm font-bold">{title.title}</span></Link>)}</div></section>
        </section>
        <aside className="space-y-5 text-sm"><div><h2 className="font-bold">Cast</h2><p className="mt-2 leading-6 text-[#a9a19c]">{item.cast.join(', ')}</p></div><div><h2 className="font-bold">Created by</h2><p className="mt-2 leading-6 text-[#a9a19c]">{item.creators.join(', ')}</p></div><div><h2 className="font-bold">Genres</h2><p className="mt-2 leading-6 text-[#a9a19c]">{item.genres.join(', ')}</p></div></aside>
      </div>

      {playing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`${item.title} preview player`}><button type="button" onClick={() => { setPlaying(false); videoRef.current?.pause(); }} aria-label="Close preview" className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-black/60 p-3"><X size={20} /></button><div className="w-full max-w-6xl"><div className="mb-3 flex items-center justify-between gap-4"><h2 className="font-bold">{item.title} <span className="text-xs font-normal text-white/50">Preview</span></h2><button type="button" onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next; }} className="rounded-full border border-white/20 p-2" aria-label={muted ? 'Unmute preview' : 'Mute preview'}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></div><video ref={videoRef} src={previewUrl} poster={item.backdrop} controls playsInline muted={muted} preload="none" className="aspect-video w-full rounded-xl bg-black" onError={() => setVideoError(true)} onPlay={() => setVideoError(false)} />{videoError && <p role="status" className="mt-3 text-center text-sm text-white/65">This preview is unavailable right now. You can still explore the title and its episodes.</p>}</div></div>}
    </main>
  );
}

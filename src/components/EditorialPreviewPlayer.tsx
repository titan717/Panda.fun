import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { EditorialTitle } from '../data/fixtures';

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function EditorialPreviewPlayer({ item, src, onClose }: { item: EditorialTitle; src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2600);
  }, [playing]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setVideoError(true));
    else video.pause();
    revealControls();
  }, [revealControls]);

  const seek = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
    setCurrent(video.currentTime);
    revealControls();
  }, [revealControls]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    try {
      if (!document.fullscreenElement) await shell?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setFullscreen(Boolean(document.fullscreenElement));
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    void video.play().catch(() => setVideoError(true));
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    revealControls();
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      video.pause();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (!playing) {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      setControlsVisible(true);
      return;
    }
    revealControls();
    return () => { if (hideTimer.current !== null) window.clearTimeout(hideTimer.current); };
  }, [playing, revealControls]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (!document.fullscreenElement) onClose(); return; }
      if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); togglePlay(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); seek(-10); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); seek(10); }
      else if (event.key.toLowerCase() === 'm') setMuted(value => !value);
      else if (event.key.toLowerCase() === 'f') void toggleFullscreen();
      revealControls();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, revealControls, seek, toggleFullscreen, togglePlay]);

  const remaining = Math.max(0, duration - current);
  const firstEpisode = item.seasons[0]?.episodes[0];

  return (
    <div ref={shellRef} className="panda-preview-player" role="dialog" aria-modal="true" aria-label={`${item.title} preview player`} onMouseMove={revealControls} onTouchStart={revealControls}>
      <video ref={videoRef} src={src} poster={item.backdrop} autoPlay muted playsInline preload="none" className="panda-preview-player__video" onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} onDurationChange={event => setDuration(event.currentTarget.duration || 0)} onPlay={() => {
        setPlaying(true);
        revealControls();
        try {
          const previous = JSON.parse(sessionStorage.getItem('panda.editorial.trailers') || '[]') as string[];
          sessionStorage.setItem('panda.editorial.trailers', JSON.stringify([item.id, ...previous.filter(id => id !== item.id)].slice(0, 12)));
        } catch {}
      }} onPause={() => { setPlaying(false); setControlsVisible(true); }} onError={() => setVideoError(true)} />
      {videoError && <div className="panda-preview-player__error"><strong>Preview unavailable</strong><span>This preview could not be loaded. Close the player to explore the title.</span></div>}
      <div className={`panda-preview-player__chrome${controlsVisible ? ' is-visible' : ''}`}>
        <header className="panda-preview-player__top"><div><strong>{item.title}</strong><span>{item.kind === 'series' && firstEpisode ? `S1:E${firstEpisode.number} ${firstEpisode.title}` : 'Preview'}</span></div><button type="button" onClick={onClose} aria-label="Close preview"><X size={22} /></button></header>
        <div className="panda-preview-player__bottom">
          <div className="panda-preview-player__controls">
            <button type="button" onClick={() => seek(-10)} aria-label="Back 10 seconds">−10</button>
            <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
            <button type="button" onClick={() => seek(10)} aria-label="Forward 10 seconds">+10</button>
            <span className="panda-preview-player__time">{clock(current)} <i>/</i> −{clock(remaining)}</span>
            <span className="panda-preview-player__spacer" />
            <button type="button" onClick={() => setMuted(value => !value)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
            <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}</button>
          </div>
          <input aria-label="Preview progress" className="panda-preview-player__scrubber" type="range" min="0" max={Math.max(1, duration)} step="0.1" value={Math.min(current, Math.max(1, duration))} onChange={event => { const next = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = next; setCurrent(next); revealControls(); }} />
          <div className="panda-preview-player__shortcuts">Space Play/Pause · ←/→ 10s · M Mute · F Fullscreen · Esc Close</div>
        </div>
      </div>
    </div>
  );
}

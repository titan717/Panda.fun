import { useRef, useState } from "react";
import { Trailer } from "./Trailer";
import { Icon } from "./Icon";
import { Spinner } from "./ui";
import { useBackHandler, useFocusScope } from "../lib/focus";
import { usePrefs } from "../lib/store";

/** Full-screen trailer viewer for "Trailers & More" (spec 7.11, 14.8). Back or the close button exits. */
export function VideoOverlay({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const prefs = usePrefs();
  useFocusScope(ref);
  useBackHandler(() => { onClose(); });
  return (
    <div ref={ref} className="video-overlay" role="dialog" aria-modal="true" aria-label={title}>
      {!failed && <Trailer keys={[videoKey]} play sound volume={prefs.trailerVolume} loop={false} revealDelayMs={0} className="video-overlay-player" onPlaying={() => setPlaying(true)} onEnd={onClose} onFail={() => setFailed(true)} />}
      {!playing && !failed && <Spinner label="Loading trailer" />}
      {failed && <p className="video-overlay-error">This video can't be played here.</p>}
      <div className="video-overlay-bar">
        <button className="icon-btn" onClick={onClose} aria-label="Close" data-autofocus data-hover-focus><Icon name="back" /></button>
        <span className="video-overlay-title">{title}</span>
      </div>
    </div>
  );
}

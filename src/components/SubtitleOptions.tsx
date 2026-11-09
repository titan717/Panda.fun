import "./subtitle-options.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { HoldButton } from "./HoldButton";
import { CaptionPreview } from "./CaptionLayer";
import { Icon } from "./Icon";
import { focusEl } from "../lib/focus";
import { offsetLabel, SUB_BGS, SUB_COLORS, SUB_EDGES, SUB_LANGS, SUB_POS_MAX, SUB_POS_STEP, SUB_SIZES, subLangName, subLook } from "../lib/captions";
import type { Captions } from "../lib/useCaptions";
import type { Prefs } from "../lib/store";
import type { SubtitleTrack } from "../lib/types";

export type SubTab = "tracks" | "style" | "timing";

export interface SubtitleOptionsProps {
  caps: Captions;
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
  /** Called after a track is picked or subtitles are switched off (the TV chrome leaves the source's own controls). */
  onPicked?: () => void;
  toast?: (msg: string) => void;
  tab?: SubTab;
  /** TV: bigger targets and no text filter (the remote has no keyboard at hand). */
  tv: boolean;
}

const TABS: { id: SubTab; label: string }[] = [{ id: "tracks", label: "Tracks" }, { id: "style", label: "Style" }, { id: "timing", label: "Timing" }];

function Chip({ id, on, label, onPick, swatch, autoFocus }: { id: string; on: boolean; label: string; onPick: () => void; swatch?: string; autoFocus?: boolean }) {
  return (
    <button id={id} type="button" role="radio" aria-checked={on} className={`so-chip ${on ? "is-on" : ""}`} onClick={onPick} data-hover-focus data-autofocus={autoFocus ? true : undefined}>
      {swatch && <span className="so-swatch" style={{ background: swatch }} aria-hidden="true" />}
      {on && !swatch && <Icon name="check" />}
      <span>{label}</span>
    </button>
  );
}

/** Best track of a language for the profile's SDH preference. */
const bestOf = (tracks: SubtitleTrack[], lang: string, sdh: boolean) => {
  const own = tracks.filter((t) => t.language === lang);
  return own.find((t) => t.hearingImpaired === sdh) ?? own[0] ?? null;
};

/**
 * The player's Subtitles panel (v1.2.7, lazy): one-press on/off, a quick language switch, every
 * track of the language, more languages on demand, SDH, a second language (dual subtitles), the
 * look with a live preview (size, colour, background, edge, height by drag or buttons) and timing in
 * 0.1 s steps that repeat while held. Choices are remembered for the title; "Make these my
 * defaults" saves them for the profile.
 */
export function SubtitleOptions({ caps, prefs, onPrefs, onPicked, toast, tab: initial = "tracks", tv }: SubtitleOptionsProps) {
  const [tab, setTab] = useState<SubTab>(initial);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [wanted, setWanted] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const look = subLook(prefs);
  const track = caps.track;

  const base = [prefs.subtitleLang, prefs.subtitleLang2].filter((x): x is string => Boolean(x));
  const langs = useMemo(() => {
    const have = [...new Set(caps.tracks.map((t) => t.language))];
    return [...base.filter((l) => have.includes(l)), ...have.filter((l) => !base.includes(l))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caps.tracks, prefs.subtitleLang, prefs.subtitleLang2]);
  const [shownLang, setShownLang] = useState<string | null>(track?.language ?? langs[0] ?? null);
  useEffect(() => { if (track) setShownLang(track.language); }, [track]);
  const lang = shownLang && langs.includes(shownLang) ? shownLang : track?.language ?? langs[0] ?? null;
  const ofLang = caps.tracks.filter((t) => t.language === lang);

  // a language looked up under "More languages" switches on by itself once its tracks arrive
  useEffect(() => {
    if (!wanted || caps.loading) return;
    const t = bestOf(caps.tracks, wanted, prefs.subtitleSdh);
    if (t) { caps.choose(t); onPicked?.(); setShownLang(wanted); toast?.(`Subtitles: ${t.label}`); }
    else toast?.(`No ${subLangName(wanted)} subtitles for this title`);
    setWanted(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, caps.loading, caps.tracks]);

  const pickTrack = (t: SubtitleTrack) => { caps.choose(t); onPicked?.(); };
  const toggle = () => {
    const next = caps.toggle();
    onPicked?.();
    toast?.(next ? `Subtitles on: ${next.label}` : track ? "Subtitles off" : "No subtitles found for this title");
  };
  const switchTab = (t: SubTab) => { setTab(t); requestAnimationFrame(() => focusEl(root.current?.querySelector<HTMLElement>(`#so-tab-${t}`) ?? null)); };

  const dualOptions = useMemo(() => {
    const pool = [...langs, ...base, ...SUB_LANGS.slice(0, 8).map((l) => l.id)];
    return [...new Set(pool)].filter((l) => l !== track?.language).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langs, track?.language, prefs.subtitleLang, prefs.subtitleLang2]);

  const moreLangs = SUB_LANGS.filter((l) => !langs.includes(l.id) && (!filter || l.label.toLowerCase().includes(filter.trim().toLowerCase())));

  // drag the preview up or down to move the captions (phones and pointers)
  const drag = useRef<{ y: number; pos: number; h: number } | null>(null);
  const setPos = (v: number) => onPrefs({ subtitlePos: Math.max(0, Math.min(SUB_POS_MAX, Math.round(v / SUB_POS_STEP) * SUB_POS_STEP)) });

  const sample = track ? "This is how your subtitles look" : `Subtitles in ${subLangName(prefs.subtitleLang)} look like this`;

  return (
    <div ref={root} className={`so ${tv ? "so--tv" : "so--touch"}`}>
      <div className="so-tabs lrud-container" role="tablist" aria-label="Subtitle options">
        {TABS.map((t) => (
          <button key={t.id} id={`so-tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} className={`so-tab ${tab === t.id ? "is-on" : ""}`}
            onClick={() => switchTab(t.id)} data-hover-focus data-autofocus={tab === t.id ? true : undefined}>{t.label}</button>
        ))}
      </div>

      {tab === "tracks" && (
        <div className="so-body" role="tabpanel" aria-labelledby="so-tab-tracks">
          <button id="so-toggle" type="button" className={`so-row so-toggle ${track ? "is-on" : ""}`} aria-pressed={Boolean(track)} onClick={toggle} data-hover-focus>
            <Icon name="captions" />
            <span className="so-row-text"><strong>Subtitles</strong><small>{track ? `On · ${track.label}` : "Off"}</small></span>
            <span className={`so-switch ${track ? "is-on" : ""}`} aria-hidden="true"><span /></span>
          </button>

          {langs.length > 0 && (
            <section className="so-sec" aria-label="Language">
              <p className="so-label">Language</p>
              <div className="so-chips lrud-container" role="radiogroup" aria-label="Language">
                {langs.map((l) => <Chip key={l} id={`so-lang-${l}`} on={l === lang} label={subLangName(l)} onPick={() => { setShownLang(l); const t = bestOf(caps.tracks, l, prefs.subtitleSdh); if (t) pickTrack(t); }} />)}
                <Chip id="so-more" on={more} label="More languages" onPick={() => setMore((m) => !m)} />
              </div>
            </section>
          )}
          {(more || !langs.length) && (
            <section className="so-sec" aria-label="More languages">
              <p className="so-label">{langs.length ? "More languages" : `No ${base.map(subLangName).join(" or ")} subtitles yet. Try another language`}</p>
              {!tv && <input id="so-filter" className="so-filter" type="search" inputMode="search" placeholder="Search languages" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} aria-label="Search languages" />}
              <div className="so-chips so-chips--grid lrud-container" role="list">
                {moreLangs.map((l) => (
                  <button key={l.id} id={`so-find-${l.id}`} type="button" role="listitem" className={`so-chip ${wanted === l.id ? "is-busy" : ""}`} onClick={() => { caps.search(l.id); setWanted(l.id); setMore(false); }} data-hover-focus>
                    <span>{l.label}</span>
                  </button>
                ))}
                {!moreLangs.length && <p className="so-note">No language matches “{filter}”</p>}
              </div>
            </section>
          )}
          {wanted && <p className="so-note" aria-live="polite">Looking for {subLangName(wanted)} subtitles…</p>}

          {ofLang.length > 0 && (
            <section className="so-sec" aria-label="Tracks">
              <p className="so-label">{subLangName(lang)} tracks</p>
              <div className="so-list lrud-container" role="radiogroup" aria-label={`${subLangName(lang)} tracks`}>
                {ofLang.map((t) => {
                  const on = track?.id === t.id;
                  return (
                    <button key={t.id} id={`so-track-${t.id}`} type="button" role="radio" aria-checked={on} className={`so-row ${on ? "is-on" : ""}`} onClick={() => pickTrack(t)} data-hover-focus>
                      <span className="so-check" aria-hidden="true">{on && <Icon name="check" />}</span>
                      <span className="so-row-text"><strong>{t.label}{t.hearingImpaired && <em className="so-badge">SDH</em>}</strong>{t.release && <small>{t.release}</small>}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="so-sec" aria-label="Options">
            <div className="so-chips lrud-container">
              <button id="so-sdh" type="button" role="switch" aria-checked={prefs.subtitleSdh} className={`so-chip ${prefs.subtitleSdh ? "is-on" : ""}`} data-hover-focus
                onClick={() => {
                  const sdh = !prefs.subtitleSdh;
                  onPrefs({ subtitleSdh: sdh });
                  const alt = track && caps.tracks.find((t) => t.language === track.language && t.hearingImpaired === sdh);
                  if (alt) pickTrack(alt);
                  toast?.(sdh ? (alt || !track ? "SDH on: sound descriptions such as [door slams]" : "No SDH track in this language") : "SDH off");
                }}>
                {prefs.subtitleSdh && <Icon name="check" />}<span>SDH</span>
              </button>
            </div>
          </section>

          <section className="so-sec" aria-label="Second language">
            <p className="so-label">Second language <small>shown above, smaller</small></p>
            <div className="so-chips lrud-container" role="radiogroup" aria-label="Second language">
              <Chip id="so-dual-none" on={!caps.dual} label="None" onPick={() => caps.setDual(null)} />
              {dualOptions.map((l) => <Chip key={l} id={`so-dual-${l}`} on={caps.dual === l} label={subLangName(l)} onPick={() => { caps.setDual(l); if (!track) toast?.("Turn subtitles on to see the second language"); }} />)}
            </div>
            {caps.dual && track && !caps.dualTrack && !caps.loading && <p className="so-note">No {subLangName(caps.dual)} subtitles for this title</p>}
          </section>

          {track && (
            <button id="so-default" type="button" className="so-row so-row--action" data-hover-focus
              onClick={() => {
                onPrefs({ subtitleLang: track.language, subtitleLang2: prefs.subtitleLang2 === track.language ? null : prefs.subtitleLang2, subtitleSdh: track.hearingImpaired, subtitleDual: caps.dual, subtitleMode: prefs.subtitleMode === "off" ? "always" : prefs.subtitleMode });
                toast?.(`Saved for this profile: ${subLangName(track.language)}${caps.dual ? ` with ${subLangName(caps.dual)}` : ""}`);
              }}>
              <span className="so-row-text"><strong>Make these my defaults</strong><small>Use {subLangName(track.language)}{track.hearingImpaired ? " SDH" : ""}{caps.dual ? ` + ${subLangName(caps.dual)}` : ""} for every title on this profile</small></span>
            </button>
          )}
          {(caps.failed || caps.error) && <p className="so-note" aria-live="polite">{caps.error ?? "Subtitles are unavailable right now. Try again in a moment"}</p>}
        </div>
      )}

      {tab === "style" && (
        <div className="so-body" role="tabpanel" aria-labelledby="so-tab-style">
          <div className="so-preview" aria-label="Preview. Drag up or down to move subtitles" role="img"
            onPointerDown={(e) => { const el = e.currentTarget as HTMLElement; el.setPointerCapture?.(e.pointerId); drag.current = { y: e.clientY, pos: look.pos, h: el.getBoundingClientRect().height }; }}
            onPointerMove={(e) => { const d = drag.current; if (!d) return; setPos(d.pos + ((d.y - e.clientY) / Math.max(1, d.h)) * 60); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            <CaptionPreview look={look} text={sample} second={caps.dual ? `${subLangName(caps.dual)} subtitles appear here` : undefined} />
            {!tv && <span className="so-drag-hint" aria-hidden="true">Drag to move</span>}
          </div>
          <section className="so-sec" aria-label="Size">
            <p className="so-label">Size</p>
            <div className="so-chips lrud-container" role="radiogroup" aria-label="Size">
              {SUB_SIZES.map((s) => <Chip key={s.id} id={`so-size-${s.id}`} on={look.size === s.id} label={s.label} onPick={() => onPrefs({ subtitleSize: s.id })} />)}
            </div>
          </section>
          <section className="so-sec" aria-label="Colour">
            <p className="so-label">Colour</p>
            <div className="so-chips lrud-container" role="radiogroup" aria-label="Colour">
              {SUB_COLORS.map((c) => <Chip key={c.id} id={`so-color-${c.id}`} on={look.color === c.id} label={c.label} swatch={c.hex} onPick={() => onPrefs({ subtitleColor: c.id })} />)}
            </div>
          </section>
          <section className="so-sec" aria-label="Background">
            <p className="so-label">Background</p>
            <div className="so-chips lrud-container" role="radiogroup" aria-label="Background">
              {SUB_BGS.map((b) => <Chip key={b.id} id={`so-bg-${b.id}`} on={look.bg === b.id} label={b.label} onPick={() => onPrefs({ subtitleBg: b.id })} />)}
            </div>
          </section>
          <section className="so-sec" aria-label="Edge">
            <p className="so-label">Edge</p>
            <div className="so-chips lrud-container" role="radiogroup" aria-label="Edge">
              {SUB_EDGES.map((x) => <Chip key={x.id} id={`so-edge-${x.id}`} on={look.edge === x.id} label={x.label} onPick={() => onPrefs({ subtitleEdge: x.id })} />)}
            </div>
          </section>
          <section className="so-sec" aria-label="Position">
            <p className="so-label">Position <small aria-live="polite">{look.pos ? `${look.pos}% higher` : "Default height"}</small></p>
            <div className="so-chips lrud-container">
              <HoldButton id="so-pos-down" label="Lower" icon={<Icon name="chevronDown" />} disabled={look.pos <= 0} onStep={() => setPos(look.pos - SUB_POS_STEP)} />
              <HoldButton id="so-pos-up" label="Higher" icon={<Icon name="chevronUp" />} disabled={look.pos >= SUB_POS_MAX} onStep={() => setPos(look.pos + SUB_POS_STEP)} />
            </div>
          </section>
          <button id="so-style-reset" type="button" className="so-row so-row--action" data-hover-focus
            onClick={() => { onPrefs({ subtitleSize: "medium", subtitleColor: "white", subtitleBg: "none", subtitleEdge: "shadow", subtitlePos: 0 }); toast?.("Subtitle look reset"); }}>
            <span className="so-row-text"><strong>Reset look</strong><small>Medium white text with a shadow, default height</small></span>
          </button>
        </div>
      )}

      {tab === "timing" && (
        <div className="so-body" role="tabpanel" aria-labelledby="so-tab-timing">
          <p className="so-offset" aria-live="polite">{offsetLabel(caps.offset)}</p>
          <div className="so-chips so-chips--timing lrud-container">
            <HoldButton id="so-earlier" label="Earlier" sub="−0.1 s" disabled={!track} onStep={() => caps.nudge(-0.1)} />
            <HoldButton id="so-later" label="Later" sub="+0.1 s" disabled={!track} onStep={() => caps.nudge(0.1)} />
          </div>
          <p className="so-note">{track ? "Hold to move faster. Saved for this title." : "Turn subtitles on to adjust their timing."}</p>
          {track && caps.offset !== 0 && (
            <button id="so-sync-reset" type="button" className="so-row so-row--action" onClick={() => caps.resetOffset()} data-hover-focus>
              <span className="so-row-text"><strong>Back in sync</strong><small>Reset the timing to 0.0 s</small></span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}


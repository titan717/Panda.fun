import "./connect-phone.css";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { ExtraIcon } from "../components/ExtraIcons";
import { PageHeader } from "../components/PageHeader";
import { Qr } from "../components/Qr";
import { toast } from "../components/ui";
import { focusFirst } from "../lib/focus";
import { useIsTv } from "../lib/layout";
import { useNav } from "../lib/nav";
import { getRemoteInfo, REMOTE_EVENT, remoteSupported, resetRemote, startRemote, stopRemote, type RemoteInfo } from "../lib/remote";

/** Connect Phone (blueprint sidebar item, v1.2.4; no blueprint screen — BLUEPRINT_GAPS G-21). */
export function ConnectPhonePage() {
  const tv = useIsTv();
  const { go } = useNav();
  const root = useRef<HTMLDivElement>(null);
  const supported = remoteSupported();
  // opening the page is the request: the remote starts (and stays on while Panda is open)
  const [info, setInfo] = useState<RemoteInfo | null>(() => {
    if (!supported) return null;
    const now = getRemoteInfo();
    return now && !now.on ? startRemote() ?? now : now;
  });

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setInfo(getRemoteInfo());
    const t = setInterval(refresh, 2000);
    window.addEventListener(REMOTE_EVENT, refresh);
    return () => { clearInterval(t); window.removeEventListener(REMOTE_EVENT, refresh); };
  }, [supported]);

  useEffect(() => { if (tv && root.current) focusFirst(root.current); }, [tv, Boolean(info?.on)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported || !tv) {
    return (
      <div ref={root} className={tv ? "tv-page cp-page" : "m-page cp-page"}>
        <PageHeader title="Connect Phone" fallback="/my-space" />
        <div className="cp-empty">
          <span className="cp-disc" aria-hidden="true"><ExtraIcon name="phone" /></span>
          <h2>Use your phone as a TV remote</h2>
          <p>{tv ? "The phone remote is part of the Panda app for Android TV. Install it from Check for Updates on the TV." : "On your TV, open Connect Phone in the Panda sidebar and scan the QR code with this phone's camera. The phone and the TV need to be on the same Wi-Fi."}</p>
          <button className="btn btn--primary" data-autofocus onClick={() => go("/")}>Back to Home</button>
        </div>
      </div>
    );
  }

  const phones = info?.phones ?? 0;
  const ready = Boolean(info?.on && info.url);
  return (
    <div ref={root} className="tv-page cp-page">
      <PageHeader title="Connect Phone" sub="Use your phone as a remote for this TV" />
      <div className="cp-cols">
        <div className="cp-steps">
          <ol>
            <li><span className="cp-n">1</span><span><strong>Join the same Wi-Fi</strong>Your phone and this TV need to be on the same network.</span></li>
            <li><span className="cp-n">2</span><span><strong>Scan the QR code</strong>Open the phone's camera and point it at the code. No app needed.</span></li>
            <li><span className="cp-n">3</span><span><strong>Control Panda</strong>Arrows and OK, Back, play and pause, volume, and typing for search.</span></li>
          </ol>
          <p className="cp-status" id="cp-status" aria-live="polite">
            <span className={`src-dot${phones > 0 ? " src-dot--healthy" : ready ? " cp-dot-wait" : " src-dot--degraded"}`} aria-hidden="true" />
            {!info?.on ? "Phone remote is off" : !info.ip ? "This TV is not on a local network" : phones > 0 ? `${phones} phone${phones === 1 ? "" : "s"} connected` : "Waiting for your phone"}
          </p>
          <div className="cp-actions lrud-container">
            {info?.on ? (
              <>
                <button id="cp-reset" className="btn btn--secondary" data-hover-focus onClick={() => { setInfo(resetRemote()); toast("New code: every phone has to scan again"); }}><Icon name="refresh" />Disconnect phones</button>
                <button id="cp-off" className="btn btn--secondary" data-hover-focus onClick={() => { setInfo(stopRemote()); toast("Phone remote turned off"); }}><Icon name="close" />Turn off</button>
              </>
            ) : (
              <button id="cp-on" className="btn btn--primary" data-hover-focus onClick={() => { const r = startRemote(); setInfo(r); if (!r?.on) toast("Couldn't start the phone remote"); }}><ExtraIcon name="phone" />Turn on phone remote</button>
            )}
          </div>
          <p className="cp-note">Only phones that have the code can control this TV, and nothing leaves your home network. The remote works while Panda is open on the TV.</p>
        </div>
        <div className="cp-card" aria-label="Pairing">
          {ready ? (
            <>
              <Qr text={info!.url!} size={320} label="QR code that opens the phone remote" className="cp-qr" />
              <p className="cp-or">Or open <strong id="cp-address">{info!.address}</strong> on your phone and enter</p>
              <p className="cp-code" id="cp-code" aria-label={`Code ${info!.code.split("").join(" ")}`}>{info!.code}</p>
            </>
          ) : (
            <div className="cp-off">
              {info?.on ? <ExtraIcon name="signal" /> : <ExtraIcon name="phone" />}
              <p>{info?.on ? "Connect this TV to Wi-Fi or Ethernet, then come back here." : "Turn on the phone remote to show the QR code."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

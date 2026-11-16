import { Link } from "wouter";
import { Mascot } from "./Brand";

/**
 * v1.5.0 end of the Home feed: when every category has been shown, say so (with the Panda mascot) and point to
 * Browse; when the next batch failed, offer Retry instead of a spinner that never ends. On TV both are ordinary
 * focusable controls at the bottom of the page, so D-pad Down simply stops here.
 */
export function FeedEnd({ state, onRetry, tv }: { state: "end" | "error"; onRetry: () => void; tv?: boolean }) {
  const cls = tv ? "feed-end feed-end--tv" : "feed-end";
  if (state === "error") {
    return (
      <section className={cls} data-row role="status" aria-live="polite">
        <Mascot pose="peek" width={tv ? 120 : 88} className="feed-end-mascot" />
        <p className="feed-end-title">Couldn't load more rows</p>
        <p className="feed-end-sub">Check your connection, then try again.</p>
        <div className="feed-end-actions"><button type="button" className="btn btn--primary feed-end-btn" data-hover-focus onClick={onRetry}>Retry</button></div>
      </section>
    );
  }
  return (
    <section className={cls} data-row aria-label="End of your feed">
      <Mascot pose="peek" width={tv ? 120 : 88} className="feed-end-mascot" />
      <p className="feed-end-title">You're all caught up</p>
      <p className="feed-end-sub">That's every row for today. New picks arrive as you watch.</p>
      <div className="feed-end-actions">
        <Link href="/browse/movie" className="btn btn--primary feed-end-btn" data-hover-focus>Browse movies</Link>
        <Link href="/browse/tv" className="btn btn--secondary feed-end-btn" data-hover-focus>Browse series</Link>
      </div>
    </section>
  );
}

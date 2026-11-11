import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { RateEmoji } from "./RateEmoji";
import { useBackHandler, useFocusScope } from "../lib/focus";
import { actions, type Rating } from "../lib/store";
import { toast } from "./ui";

const LABEL: Record<Rating, string> = { love: "Love", like: "Like", dislike: "Not for me" };
/** Blueprint order: TV lists Love → Like → Not for me top to bottom; the phone row reads Not for me → Like → Love. */
const TV_ORDER: Rating[] = ["love", "like", "dislike"];
const M_ORDER: Rating[] = ["dislike", "like", "love"];
/** How long the picked emoji celebrates before the popover closes. */
export const RATE_SETTLE_MS = 320;

export const rateLabel = (r: Rating | null) => (r ? LABEL[r] : "Rate");

/**
 * Rating popover (spec 7.6, 14.6; v1.2.9 blueprint redesign). TV: a vertical glass card with large emoji and a
 * check on the current choice. Phone: a horizontal emoji row above the action bar. Choosing the current rating
 * again clears it. One choice per opening: further taps are ignored while the choice settles (no double saves).
 */
export function RatePopover({ itemId, current, onClose, variant = "tv", className }: { itemId: string; current: Rating | null; onClose: () => void; variant?: "tv" | "m"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [picked, setPicked] = useState<Rating | null>(null);
  useFocusScope(ref);
  useBackHandler(() => { if (!busy.current) onClose(); });
  const choose = (r: Rating) => {
    if (busy.current) return;
    busy.current = true;
    const next = current === r ? null : r;
    try {
      actions.rate(itemId, next);
    } catch {
      busy.current = false;
      toast("Couldn't save your rating. Try again.");
      return;
    }
    setPicked(r);
    toast(next ? (next === "dislike" ? "We will show less of this" : "We will show more of this") : "Rating removed");
    window.setTimeout(onClose, RATE_SETTLE_MS);
  };
  const order = variant === "tv" ? TV_ORDER : M_ORDER;
  const start = current ?? "like";
  return (
    <div ref={ref} className={`rate-pop rate-pop--${variant} lrud-container ${picked ? "is-settling" : ""} ${className ?? ""}`} role="menu" aria-label="Rate this title" aria-busy={picked ? true : undefined} data-block-exit="up down left right">
      {order.map((id) => (
        <button key={id} role="menuitemradio" aria-checked={current === id} className={`rate-opt ${current === id ? "is-selected" : ""} ${picked === id ? "is-picked" : ""}`} onClick={() => choose(id)} data-autofocus={id === start ? true : undefined} data-hover-focus>
          <RateEmoji kind={id} live />
          <span>{LABEL[id]}</span>
          {variant === "tv" && current === id && <Icon name="check" className="rate-check" />}
        </button>
      ))}
    </div>
  );
}

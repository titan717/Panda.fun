import { useRef } from "react";
import { Icon, type IconName } from "./Icon";
import { useBackHandler, useFocusScope } from "../lib/focus";
import { actions, type Rating } from "../lib/store";
import { toast } from "./ui";

const OPTIONS: { id: Rating; label: string; icon: IconName }[] = [
  { id: "dislike", label: "Not for me", icon: "thumbDown" },
  { id: "like", label: "I like this", icon: "thumbUp" },
  { id: "love", label: "Love this!", icon: "heart" }
];

export const rateLabel = (r: Rating | null) => (r ? OPTIONS.find((o) => o.id === r)!.label : "Rate");

/** Rating popover (spec 7.6, 14.6). Selecting the current rating again clears it. */
export function RatePopover({ itemId, current, onClose, className }: { itemId: string; current: Rating | null; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  useBackHandler(() => { onClose(); });
  const choose = (r: Rating) => {
    const next = current === r ? null : r;
    actions.rate(itemId, next);
    if (next) toast(next === "dislike" ? "We will show less of this" : "We will show more of this");
    onClose();
  };
  return (
    <div ref={ref} className={`rate-pop lrud-container ${className ?? ""}`} role="menu" aria-label="Rate this title" data-block-exit="up down left right">
      {OPTIONS.map((o, i) => (
        <button key={o.id} role="menuitemradio" aria-checked={current === o.id} className={`rate-opt ${current === o.id ? "is-selected" : ""}`} onClick={() => choose(o.id)} data-autofocus={i === 1 ? true : undefined} data-hover-focus>
          <Icon name={o.icon} filled={current === o.id} />
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Text fields on TV (D-45): focusing a field with the D-pad must not pop the on-screen keyboard.
 * OK opens it; Enter on the keyboard closes it and runs `onDone` (usually "move to the next control").
 * Off TV the field behaves normally.
 */
export function useRemoteField(enabled: boolean, onDone?: () => void) {
  const ref = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const open = () => {
    const el = ref.current;
    if (!el) return;
    setEditing(true);
    requestAnimationFrame(() => { el.blur(); el.focus(); });
  };
  if (!enabled) return { ref, props: {} };
  return {
    ref,
    props: {
      inputMode: editing ? ("text" as const) : ("none" as const),
      onClick: () => { if (!editing) open(); },
      onBlur: () => setEditing(false),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        if (!editing) open(); else { setEditing(false); onDone?.(); }
      }
    }
  };
}

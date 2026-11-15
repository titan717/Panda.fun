import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { FOCUS_MEMORY_KEY, recallFocus, useFocusMemory } from "../lib/focus";

function Screen() {
  const root = useRef<HTMLDivElement>(null);
  useFocusMemory(root);
  return <div ref={root}><a href="#a" id="hero">Hero</a><a href="#b" id="row-3">Card</a><a href="#c">No id</a></div>;
}

afterEach(() => { cleanup(); history.replaceState(null, ""); });

describe("history-entry focus memory (Details -> Back -> Home)", () => {
  it("remembers the last focused id in history.state and keeps the router's own state", () => {
    history.replaceState({ router: 1 }, "");
    render(<Screen />);
    document.getElementById("row-3")!.focus();
    expect(history.state).toEqual({ router: 1, [FOCUS_MEMORY_KEY]: "row-3" });
    (document.querySelector("a[href='#c']") as HTMLElement).focus();
    expect(history.state[FOCUS_MEMORY_KEY]).toBe("row-3");
  });
  it("recalls the remembered element on return, and nothing on a fresh entry", () => {
    const { container } = render(<Screen />);
    const scope = container.firstElementChild as HTMLElement;
    expect(recallFocus(scope)).toBe(false);
    history.replaceState({ [FOCUS_MEMORY_KEY]: "row-3" }, "");
    expect(recallFocus(scope)).toBe(true);
    expect(document.activeElement?.id).toBe("row-3");
    history.replaceState({ [FOCUS_MEMORY_KEY]: "gone" }, "");
    expect(recallFocus(scope)).toBe(false);
  });
});

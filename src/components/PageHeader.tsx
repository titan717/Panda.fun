import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { useNav } from "../lib/nav";
import { useIsTv } from "../lib/layout";

/** Screen header: big title on TV (spec 9.1), "← Title" bar on mobile (spec 14.9). */
export function PageHeader({ title, sub, fallback = "/", right }: { title: string; sub?: string; fallback?: string; right?: ReactNode }) {
  const tv = useIsTv();
  const { back } = useNav();
  if (tv) {
    return (
      <header className="tv-page-head">
        <div><h1 className="tv-page-title">{title}</h1>{sub && <p className="tv-page-sub">{sub}</p>}</div>
        {right}
      </header>
    );
  }
  return (
    <header className="m-bar">
      <button className="m-bar-back" onClick={() => back(fallback)} aria-label="Back"><Icon name="back" /></button>
      <h1 className="m-bar-title">{title}</h1>
      {right}
    </header>
  );
}

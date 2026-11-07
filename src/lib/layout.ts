import { createContext, useContext } from "react";
import type { LayoutMode } from "./device";

export const LayoutContext = createContext<LayoutMode>("mobile");
export const useLayout = () => useContext(LayoutContext);
export const useIsTv = () => useContext(LayoutContext) === "tv";

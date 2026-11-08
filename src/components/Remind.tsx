import { actions } from "../lib/store";
import { notifyPermission } from "../lib/notify";
import { shortDate } from "../lib/format";
import type { PandaItem } from "../lib/types";
import { toast } from "./ui";

/** Remind Me (v1.1.7): set or clear a reminder and say where it will show up. */
export function toggleReminder(item: PandaItem) {
  const on = actions.toggleReminder(item);
  if (!on) { toast("Reminder removed"); return false; }
  const when = shortDate(item.releaseDate, false);
  toast(notifyPermission() === "granted"
    ? `We'll remind you${when ? ` on ${when}` : ""} when ${item.title} is out`
    : `Reminder set. ${item.title} will show in Coming Up${when ? ` on ${when}` : ""}`);
  return true;
}

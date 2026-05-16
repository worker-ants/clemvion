import type { Dict } from "../types";

export const time: Dict["time"] = {
  justNow: "just now",
  secondsAgo: "{{seconds}}s ago",
  minutesAgo: "{{minutes}}m ago",
  hoursAgo: "{{hours}}h ago",
  daysAgo: "{{days}}d ago",
  weeksAgo: "{{weeks}}w ago",
  monthsAgo: "{{months}}mo ago",
  yearsAgo: "{{years}}y ago",
  ms: "{{value}}ms",
  seconds: "{{value}}s",
  minutesSeconds: "{{minutes}}m {{seconds}}s",
};

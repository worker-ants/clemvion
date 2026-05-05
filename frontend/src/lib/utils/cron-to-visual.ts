/**
 * 스케줄 다이얼로그의 "Cron 표현식" ↔ "시각 편집기" 양방향 변환 유틸.
 *
 * 시각 편집기는 6개 단순 패턴만 produce 한다:
 *   - "* * * * *"           every-minute
 *   - "M * * * *"           hourly (M ∈ 0..59)
 *   - "M H * * *"           daily  (M ∈ 0..59, H ∈ 0..23)
 *   - "M H * * D[,D...]"    weekly (D ∈ 0..6, 0=Sun)
 *   - "M H D * *"           monthly (D ∈ 1..31)
 *
 * `parseCronToVisualOrNull` 는 위 6개 패턴에 정확히 일치하는 cron 만 분해
 * 하고, 그 외(step `*\/N`, range `9-17`, list-with-range, month 지정 등)
 * 는 `null` 을 반환해 호출측이 안내 메시지를 표시할 수 있도록 한다.
 */

export type Frequency =
  | "every-minute"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly";

export interface VisualState {
  frequency: Frequency;
  /** 0..59 */
  minute: number;
  /** 0..23 */
  hour: number;
  /** weekly 에서 사용. 0=Sun..6=Sat */
  selectedDays: number[];
  /** monthly 에서 사용. 1..31 */
  dayOfMonth: number;
}

export const DEFAULT_VISUAL_STATE: VisualState = {
  frequency: "daily",
  minute: 0,
  hour: 9,
  selectedDays: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
};

const isIntInRange = (token: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(token)) return false;
  const n = Number(token);
  return Number.isFinite(n) && n >= min && n <= max;
};

const toInt = (token: string): number => Number(token);

export function parseCronToVisualOrNull(
  expression: string,
): VisualState | null {
  if (typeof expression !== "string") return null;
  const trimmed = expression.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, mon, dow] = parts;

  // every-minute
  if (m === "*" && h === "*" && dom === "*" && mon === "*" && dow === "*") {
    return { ...DEFAULT_VISUAL_STATE, frequency: "every-minute" };
  }

  // hourly: M * * * *
  if (
    isIntInRange(m, 0, 59) &&
    h === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    return { ...DEFAULT_VISUAL_STATE, frequency: "hourly", minute: toInt(m) };
  }

  // daily: M H * * *
  if (
    isIntInRange(m, 0, 59) &&
    isIntInRange(h, 0, 23) &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    return {
      ...DEFAULT_VISUAL_STATE,
      frequency: "daily",
      minute: toInt(m),
      hour: toInt(h),
    };
  }

  // weekly: M H * * D[,D...]
  if (
    isIntInRange(m, 0, 59) &&
    isIntInRange(h, 0, 23) &&
    dom === "*" &&
    mon === "*" &&
    dow !== "*"
  ) {
    const tokens = dow.split(",");
    const numbers: number[] = [];
    for (const tk of tokens) {
      if (!isIntInRange(tk, 0, 6)) return null;
      numbers.push(toInt(tk));
    }
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
    return {
      ...DEFAULT_VISUAL_STATE,
      frequency: "weekly",
      minute: toInt(m),
      hour: toInt(h),
      selectedDays: unique,
    };
  }

  // monthly: M H D * *
  if (
    isIntInRange(m, 0, 59) &&
    isIntInRange(h, 0, 23) &&
    isIntInRange(dom, 1, 31) &&
    mon === "*" &&
    dow === "*"
  ) {
    return {
      ...DEFAULT_VISUAL_STATE,
      frequency: "monthly",
      minute: toInt(m),
      hour: toInt(h),
      dayOfMonth: toInt(dom),
    };
  }

  return null;
}

export function buildCronFromVisual(state: VisualState): string {
  const { frequency, minute, hour, selectedDays, dayOfMonth } = state;
  switch (frequency) {
    case "every-minute":
      return "* * * * *";
    case "hourly":
      return `${minute} * * * *`;
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const days =
        selectedDays.length > 0
          ? [...selectedDays].sort((a, b) => a - b).join(",")
          : "*";
      return `${minute} ${hour} * * ${days}`;
    }
    case "monthly":
      return `${minute} ${hour} ${dayOfMonth} * *`;
    default:
      return "* * * * *";
  }
}

/**
 * 스케줄 다이얼로그의 "Cron 표현식" ↔ "시각 편집기" 양방향 변환 유틸.
 *
 * 시각 편집기는 5개 단순 패턴만 produce 한다:
 *   - "* * * * *"           every-minute
 *   - "M * * * *"           hourly (M ∈ 0..59)
 *   - "M H * * *"           daily  (M ∈ 0..59, H ∈ 0..23)
 *   - "M H * * D[,D...]"    weekly (D ∈ 0..6, 0=Sun)
 *   - "M H D * *"           monthly (D ∈ 1..31)
 *
 * `parseCronToVisualOrNull` 는 위 5개 패턴에 정확히 일치하는 cron 만 분해
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

// 새 스케줄 기본값: 평일(월~금) 오전 9시 — 가장 흔한 업무용 cron.
// 공유 참조 변이로 인한 전역 오염을 차단하기 위해 deep freeze. 파서는 반환
// 시 `cloneDefault` 로 새 배열을 emit 해 호출자가 자유롭게 mutate 할 수 있다.
export const DEFAULT_VISUAL_STATE: VisualState = {
  frequency: "daily",
  minute: 0,
  hour: 9,
  selectedDays: [1, 2, 3, 4, 5],
  dayOfMonth: 1,
};
Object.freeze(DEFAULT_VISUAL_STATE);
Object.freeze(DEFAULT_VISUAL_STATE.selectedDays);

const cloneDefault = (): VisualState => ({
  ...DEFAULT_VISUAL_STATE,
  selectedDays: [...DEFAULT_VISUAL_STATE.selectedDays],
});

const isIntInRange = (token: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(token)) return false;
  const n = parseInt(token, 10);
  return Number.isFinite(n) && n >= min && n <= max;
};

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
    return { ...cloneDefault(), frequency: "every-minute" };
  }

  // hourly: M * * * *
  if (
    isIntInRange(m, 0, 59) &&
    h === "*" &&
    dom === "*" &&
    mon === "*" &&
    dow === "*"
  ) {
    return { ...cloneDefault(), frequency: "hourly", minute: parseInt(m, 10) };
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
      ...cloneDefault(),
      frequency: "daily",
      minute: parseInt(m, 10),
      hour: parseInt(h, 10),
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
      numbers.push(parseInt(tk, 10));
    }
    const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
    return {
      ...cloneDefault(),
      frequency: "weekly",
      minute: parseInt(m, 10),
      hour: parseInt(h, 10),
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
      ...cloneDefault(),
      frequency: "monthly",
      minute: parseInt(m, 10),
      hour: parseInt(h, 10),
      dayOfMonth: parseInt(dom, 10),
    };
  }

  return null;
}

/**
 * `parseCronToVisualOrNull` 의 역함수. VisualState 를 위 5개 표준 패턴 cron
 * 으로 직렬화한다. weekly + 빈 selectedDays 는 fallback 으로 `*` 를 emit
 * 하므로 round-trip 시 daily 로 분류된다(의도된 fallback).
 */
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

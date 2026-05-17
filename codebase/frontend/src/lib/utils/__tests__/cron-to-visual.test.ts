import { describe, it, expect } from "vitest";
import {
  parseCronToVisualOrNull,
  buildCronFromVisual,
  DEFAULT_VISUAL_STATE,
  type VisualState,
} from "../cron-to-visual";

describe("parseCronToVisualOrNull", () => {
  describe("매칭되는 visual 패턴", () => {
    it('"* * * * *" → every-minute', () => {
      expect(parseCronToVisualOrNull("* * * * *")).toEqual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "every-minute",
      });
    });

    it('"0 * * * *" → hourly minute=0', () => {
      expect(parseCronToVisualOrNull("0 * * * *")).toEqual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "hourly",
        minute: 0,
      });
    });

    it('"30 * * * *" → hourly minute=30', () => {
      const result = parseCronToVisualOrNull("30 * * * *");
      expect(result?.frequency).toBe("hourly");
      expect(result?.minute).toBe(30);
    });

    it('"0 9 * * *" → daily 09:00', () => {
      expect(parseCronToVisualOrNull("0 9 * * *")).toEqual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "daily",
        minute: 0,
        hour: 9,
      });
    });

    it('"30 14 * * *" → daily 14:30', () => {
      const result = parseCronToVisualOrNull("30 14 * * *");
      expect(result?.frequency).toBe("daily");
      expect(result?.hour).toBe(14);
      expect(result?.minute).toBe(30);
    });

    it('"0 0 * * 1" → weekly days=[1]', () => {
      const result = parseCronToVisualOrNull("0 0 * * 1");
      expect(result?.frequency).toBe("weekly");
      expect(result?.selectedDays).toEqual([1]);
      expect(result?.hour).toBe(0);
      expect(result?.minute).toBe(0);
    });

    it('"0 9 * * 1,2,3,4,5" → weekly weekdays', () => {
      const result = parseCronToVisualOrNull("0 9 * * 1,2,3,4,5");
      expect(result?.frequency).toBe("weekly");
      expect(result?.selectedDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('"0 9 * * 1,3,5" → weekly Mon/Wed/Fri', () => {
      const result = parseCronToVisualOrNull("0 9 * * 1,3,5");
      expect(result?.selectedDays).toEqual([1, 3, 5]);
    });

    it('"0 9 * * 0" → weekly Sun (0)', () => {
      const result = parseCronToVisualOrNull("0 9 * * 0");
      expect(result?.selectedDays).toEqual([0]);
    });

    it('정렬되지 않은 list 도 정렬해서 반환: "0 9 * * 5,1,3"', () => {
      const result = parseCronToVisualOrNull("0 9 * * 5,1,3");
      expect(result?.selectedDays).toEqual([1, 3, 5]);
    });

    it('"0 0 1 * *" → monthly day=1', () => {
      expect(parseCronToVisualOrNull("0 0 1 * *")).toEqual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "monthly",
        minute: 0,
        hour: 0,
        dayOfMonth: 1,
      });
    });

    it('"30 14 15 * *" → monthly 15일 14:30', () => {
      const result = parseCronToVisualOrNull("30 14 15 * *");
      expect(result?.frequency).toBe("monthly");
      expect(result?.dayOfMonth).toBe(15);
      expect(result?.hour).toBe(14);
      expect(result?.minute).toBe(30);
    });
  });

  describe("매칭되지 않는 패턴 → null (visual 표현 불가)", () => {
    it("step 표현식 */5", () => {
      expect(parseCronToVisualOrNull("*/5 * * * *")).toBeNull();
    });

    it("hour range 9-17", () => {
      expect(parseCronToVisualOrNull("0 9-17 * * *")).toBeNull();
    });

    it("day-of-week range 1-5", () => {
      expect(parseCronToVisualOrNull("0 0 * * 1-5")).toBeNull();
    });

    it("month 지정 (* 가 아닌 값)", () => {
      expect(parseCronToVisualOrNull("0 0 1 1 *")).toBeNull();
    });

    it("day-of-week 0..6 범위 밖 (7=Sun 변형은 미지원)", () => {
      expect(parseCronToVisualOrNull("0 9 * * 7")).toBeNull();
    });

    it("필드 수 불일치 (4개)", () => {
      expect(parseCronToVisualOrNull("0 9 * *")).toBeNull();
    });

    it("필드 수 불일치 (6개 — second 포함 cron)", () => {
      expect(parseCronToVisualOrNull("0 0 9 * * *")).toBeNull();
    });

    it("빈 문자열", () => {
      expect(parseCronToVisualOrNull("")).toBeNull();
    });

    it("공백만", () => {
      expect(parseCronToVisualOrNull("   ")).toBeNull();
    });

    it("invalid 토큰", () => {
      expect(parseCronToVisualOrNull("invalid cron string")).toBeNull();
    });

    it("음수", () => {
      expect(parseCronToVisualOrNull("-1 * * * *")).toBeNull();
    });

    it("범위 초과 minute", () => {
      expect(parseCronToVisualOrNull("60 * * * *")).toBeNull();
    });

    it("범위 초과 hour", () => {
      expect(parseCronToVisualOrNull("0 24 * * *")).toBeNull();
    });

    it("범위 초과 day-of-month (32)", () => {
      expect(parseCronToVisualOrNull("0 0 32 * *")).toBeNull();
    });

    it("day-of-month 0", () => {
      expect(parseCronToVisualOrNull("0 0 0 * *")).toBeNull();
    });

    it("daily 와 weekly 가 동시에 지정된 cron (DOW != *, DOM != *)", () => {
      // 두 필드를 동시에 사용하는 cron 은 OR 의미라 시각 편집 표현 범위 밖
      expect(parseCronToVisualOrNull("0 9 1 * 1")).toBeNull();
    });

    it("undefined / null 안전 처리", () => {
      expect(parseCronToVisualOrNull(undefined as unknown as string)).toBeNull();
      expect(parseCronToVisualOrNull(null as unknown as string)).toBeNull();
    });
  });

  describe("round-trip: build → parse → build 동치", () => {
    const cases: VisualState[] = [
      { ...DEFAULT_VISUAL_STATE, frequency: "every-minute" },
      { ...DEFAULT_VISUAL_STATE, frequency: "hourly", minute: 15 },
      { ...DEFAULT_VISUAL_STATE, frequency: "daily", minute: 30, hour: 14 },
      {
        ...DEFAULT_VISUAL_STATE,
        frequency: "weekly",
        minute: 0,
        hour: 9,
        selectedDays: [1, 2, 3, 4, 5],
      },
      {
        ...DEFAULT_VISUAL_STATE,
        frequency: "monthly",
        minute: 30,
        hour: 14,
        dayOfMonth: 15,
      },
    ];

    it.each(cases)("$frequency 패턴은 round-trip 에서 동일 cron 을 생성", (state) => {
      const cron = buildCronFromVisual(state);
      const parsed = parseCronToVisualOrNull(cron);
      expect(parsed).not.toBeNull();
      const rebuilt = buildCronFromVisual(parsed as VisualState);
      expect(rebuilt).toBe(cron);
    });
  });
});

describe("buildCronFromVisual", () => {
  it("every-minute → '* * * * *'", () => {
    expect(
      buildCronFromVisual({ ...DEFAULT_VISUAL_STATE, frequency: "every-minute" }),
    ).toBe("* * * * *");
  });

  it("hourly → 'M * * * *'", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "hourly",
        minute: 30,
      }),
    ).toBe("30 * * * *");
  });

  it("daily → 'M H * * *'", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "daily",
        minute: 30,
        hour: 14,
      }),
    ).toBe("30 14 * * *");
  });

  it("weekly with selected days → 'M H * * D,D,...'", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "weekly",
        minute: 0,
        hour: 9,
        selectedDays: [1, 3, 5],
      }),
    ).toBe("0 9 * * 1,3,5");
  });

  it("weekly with no days selected → fallback '*' (every day)", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "weekly",
        minute: 0,
        hour: 9,
        selectedDays: [],
      }),
    ).toBe("0 9 * * *");
  });

  it("monthly → 'M H D * *'", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "monthly",
        minute: 30,
        hour: 14,
        dayOfMonth: 15,
      }),
    ).toBe("30 14 15 * *");
  });

  it("weekly: 비정렬 selectedDays 입력도 정렬해서 emit", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "weekly",
        minute: 0,
        hour: 9,
        selectedDays: [5, 1, 3],
      }),
    ).toBe("0 9 * * 1,3,5");
  });

  it("weekly: Sunday(0) 단독 선택 경계값", () => {
    expect(
      buildCronFromVisual({
        ...DEFAULT_VISUAL_STATE,
        frequency: "weekly",
        minute: 0,
        hour: 9,
        selectedDays: [0],
      }),
    ).toBe("0 9 * * 0");
  });
});

describe("DEFAULT_VISUAL_STATE 불변성", () => {
  it("Object.freeze 로 변이 차단 — 직접 변이 시 무시(strict)되거나 throw", () => {
    expect(Object.isFrozen(DEFAULT_VISUAL_STATE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_VISUAL_STATE.selectedDays)).toBe(true);
  });

  it("parser 결과는 DEFAULT 와 다른 selectedDays 배열 참조를 갖는다 (호출자 mutate 안전)", () => {
    // every-minute 분기는 cloneDefault 로 새 배열을 만들어야 한다.
    const a = parseCronToVisualOrNull("* * * * *");
    const b = parseCronToVisualOrNull("* * * * *");
    expect(a?.selectedDays).not.toBe(DEFAULT_VISUAL_STATE.selectedDays);
    expect(a?.selectedDays).not.toBe(b?.selectedDays);
    // 그리고 호출자가 mutate 해도 DEFAULT 가 영향 받지 않는다
    a?.selectedDays.push(99);
    expect(DEFAULT_VISUAL_STATE.selectedDays).toEqual([1, 2, 3, 4, 5]);
  });
});

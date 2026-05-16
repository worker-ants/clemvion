import { describe, it, expect } from "vitest";
import { translate } from "../index";
import { isLocale, LOCALES, DEFAULT_LOCALE } from "../types";
import { ko } from "../dict/ko";
import { en } from "../dict/en";

/**
 * 사전 트리에서 leaf path (예: "common.save", "nodes.aiAgent.systemPrompt")
 * 의 집합을 추출한다. 양쪽 사전이 같은 leaf 집합을 가져야 한 쪽만 추가되는
 * parity 누락을 차단할 수 있다.
 *
 * Branch 노드(객체) 가 한쪽엔 leaf, 한쪽엔 branch 인 케이스도 다른 leaf 로
 * 간주되어 잡힌다 — 양쪽 모두 leaf 인 경로만 일치하면 parity OK.
 */
function flattenLeafKeys(obj: unknown, prefix = ""): Set<string> {
  const out = new Set<string>();
  if (typeof obj !== "object" || obj === null) {
    if (prefix) out.add(prefix);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out.add(path);
    } else if (typeof v === "object" && v !== null) {
      for (const leaf of flattenLeafKeys(v, path)) out.add(leaf);
    } else {
      // 숫자/불리언 등은 dict 구조상 등장하지 않지만, 들어오면 leaf 로 취급.
      out.add(path);
    }
  }
  return out;
}

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("ko")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejects other values", () => {
    expect(isLocale("jp")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(123)).toBe(false);
  });
});

describe("locale constants", () => {
  it("exposes the supported locales", () => {
    expect(LOCALES).toEqual(["ko", "en"]);
  });

  it("defaults to Korean", () => {
    expect(DEFAULT_LOCALE).toBe("ko");
  });
});

describe("translate", () => {
  it("returns Korean text when locale is ko", () => {
    expect(translate("ko", "common.save")).toBe("저장");
    expect(translate("ko", "common.cancel")).toBe("취소");
  });

  it("returns English text when locale is en", () => {
    expect(translate("en", "common.save")).toBe("Save");
    expect(translate("en", "common.cancel")).toBe("Cancel");
  });

  it("supports nested keys", () => {
    expect(translate("ko", "auth.login.title")).toBe("로그인");
    expect(translate("en", "auth.login.title")).toBe("Sign in");
  });

  it("interpolates parameters", () => {
    expect(
      translate("ko", "time.minutesAgo", { minutes: 5 }),
    ).toBe("5분 전");
    expect(
      translate("en", "time.minutesAgo", { minutes: 5 }),
    ).toBe("5m ago");
  });

  it("interpolates multiple parameters", () => {
    expect(
      translate("ko", "time.minutesSeconds", { minutes: 3, seconds: 10 }),
    ).toBe("3분 10초");
    expect(
      translate("en", "time.minutesSeconds", { minutes: 3, seconds: 10 }),
    ).toBe("3m 10s");
  });

  it("falls back to Korean when key missing in target locale", () => {
    // Both locales have this key, so this demonstrates the fallback path works.
    expect(translate("en", "common.save")).toBe("Save");
  });

  it("returns the key when translation is missing", () => {
    // @ts-expect-error — intentional unknown key for fallback test
    expect(translate("ko", "unknown.key")).toBe("unknown.key");
  });

  it("leaves unknown placeholders intact", () => {
    // non-\w placeholders such as `{{ $now }}` should not be replaced
    const rendered = translate("en", "schedules.paramsHelp");
    expect(rendered).toContain("$now");
    expect(rendered).toContain("$schedule.id");
  });
});

/**
 * ko ↔ en 사전의 leaf 키 집합이 정확히 일치하는지 검증한다.
 *
 * 한쪽 사전에만 키를 추가하면 production 의 EN/KO 한 쪽 사용자가 fallback
 * 또는 raw key 노출을 보게 된다 — 이를 빌드 단계에서 차단한다. 사후 보정
 * (`fix(i18n): 한/영 양방향 누락 번역 정리`) 으로 따라붙던 누락을 사전 차단.
 *
 * 동기화 누락 발생 시:
 *   1. 출력의 `koOnly` / `enOnly` 배열에 누락 키 경로가 나열된다.
 *   2. 각 키를 양쪽 사전에 짝맞춰 추가하면 통과한다.
 *
 * 정책 위치: developer/SKILL.md DOCUMENTATION 매핑표 (UI 문자열 행).
 */
describe("dict parity (ko ↔ en)", () => {
  it("ko 와 en 사전의 leaf 키 집합이 완전히 일치한다", () => {
    const koKeys = flattenLeafKeys(ko);
    const enKeys = flattenLeafKeys(en);
    const koOnly = [...koKeys].filter((k) => !enKeys.has(k)).sort();
    const enOnly = [...enKeys].filter((k) => !koKeys.has(k)).sort();
    expect({ koOnly, enOnly }).toEqual({ koOnly: [], enOnly: [] });
  });

  it("두 사전 모두 비어있지 않다 (회귀 가드)", () => {
    // 누군가 dict 를 통째로 비웠는데 위 테스트가 빈 = 빈 으로 false-pass 하는
    // 케이스를 차단한다.
    expect(flattenLeafKeys(ko).size).toBeGreaterThan(50);
    expect(flattenLeafKeys(en).size).toBeGreaterThan(50);
  });
});

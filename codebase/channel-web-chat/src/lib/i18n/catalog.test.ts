import { describe, it, expect } from "vitest";
import { WIDGET_STRINGS } from "./catalog";

// ko/en leaf key parity 가드 (spec 1-widget-app §4 / i18n-userguide 자동 가드 요약 표 "2-위젯").
// 한쪽에만 키가 있으면 그 로케일에서 키 자체가 노출되거나 폴백돼 UX 결손 → hard fail 로 선차단.
describe("WIDGET_STRINGS ko/en parity", () => {
  const koKeys = Object.keys(WIDGET_STRINGS.ko).sort();
  const enKeys = Object.keys(WIDGET_STRINGS.en).sort();

  it("ko 와 en 의 키 집합이 정확히 동일", () => {
    expect(enKeys).toEqual(koKeys);
  });

  it("모든 값이 비어있지 않은 문자열", () => {
    for (const loc of ["ko", "en"] as const) {
      for (const [k, v] of Object.entries(WIDGET_STRINGS[loc])) {
        expect(typeof v, `${loc}.${k}`).toBe("string");
        expect(v.length, `${loc}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("보간 placeholder({{name}}) 가 ko/en 에서 동일하게 존재", () => {
    const holders = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort();
    for (const k of koKeys) {
      const key = k as keyof typeof WIDGET_STRINGS.ko;
      expect(holders(WIDGET_STRINGS.en[key]), k).toEqual(holders(WIDGET_STRINGS.ko[key]));
    }
  });
});

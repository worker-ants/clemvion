import { describe, it, expect } from "vitest";
import {
  summarizeDataForPreview,
  formatBytes,
} from "../edge-data-preview";

describe("summarizeDataForPreview (§5)", () => {
  it("null/undefined 는 isEmpty=true", () => {
    expect(summarizeDataForPreview(undefined).isEmpty).toBe(true);
    expect(summarizeDataForPreview(null).isEmpty).toBe(true);
  });

  it("원시값은 그대로 미리보기 + 바이트 계산", () => {
    const s = summarizeDataForPreview(123);
    expect(s.isEmpty).toBe(false);
    expect(s.preview).toBe("123");
    expect(s.bytes).toBe(3);
  });

  it("최상위 객체는 필드를 보이되 중첩 배열은 '[N items]', 중첩 객체는 '{N fields}' 로 축약", () => {
    const { preview } = summarizeDataForPreview({
      userId: 123,
      name: "Gehrig",
      items: [1, 2, 3],
      meta: { a: 1, b: 2 },
    });
    expect(preview).toContain('"userId": 123');
    expect(preview).toContain('"name": "Gehrig"');
    expect(preview).toContain('"items": "[3 items]"');
    expect(preview).toContain('"meta": "{2 fields}"');
  });

  it("최상위 배열은 앞 5개만 보이고 나머지는 '…(N more)'", () => {
    const { preview } = summarizeDataForPreview([1, 2, 3, 4, 5, 6, 7]);
    expect(preview).toContain("…(2 more)");
  });

  it("긴 문자열은 잘라서 … 를 붙인다", () => {
    const long = "x".repeat(200);
    const { preview } = summarizeDataForPreview({ text: long });
    expect(preview).toContain("…");
    expect(preview).not.toContain("x".repeat(200));
  });

  it("bytes 는 원본 JSON 직렬화 크기(축약 전)", () => {
    const value = { items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
    const s = summarizeDataForPreview(value);
    expect(s.bytes).toBe(new TextEncoder().encode(JSON.stringify(value)).length);
  });

  it("순환 참조 등 직렬화 불가여도 throw 하지 않는다", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => summarizeDataForPreview(circular)).not.toThrow();
    expect(summarizeDataForPreview(circular).bytes).toBe(0);
  });
});

describe("formatBytes (§5)", () => {
  it("1KB 미만은 bytes", () => {
    expect(formatBytes(245)).toBe("245 bytes");
  });
  it("KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("MB", () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});

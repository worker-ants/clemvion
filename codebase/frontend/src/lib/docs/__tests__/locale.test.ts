import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasExplicitSectionLabel,
  localizedSectionLabel,
  localizedSummary,
  localizedTitle,
} from "../locale";
import { LOCALES } from "@/lib/i18n/types";

describe("localizedSectionLabel", () => {
  it("returns the Korean label for known section keys", () => {
    expect(localizedSectionLabel("01-getting-started", "ko")).toBe("시작하기");
    expect(localizedSectionLabel("07-workspace-and-team", "ko")).toBe(
      "워크스페이스와 팀",
    );
    expect(localizedSectionLabel("99-faq", "ko")).toBe("자주 묻는 질문");
  });

  it("returns the English label for known section keys", () => {
    expect(localizedSectionLabel("01-getting-started", "en")).toBe("Getting Started");
    expect(localizedSectionLabel("06-integrations-and-config", "en")).toBe(
      "Integrations & Config",
    );
    expect(localizedSectionLabel("99-faq", "en")).toBe("FAQ");
  });

  it("falls back to a humanized segment for unknown keys", () => {
    expect(localizedSectionLabel("97-future-section", "ko")).toBe("Future Section");
    expect(localizedSectionLabel("97-future-section", "en")).toBe("Future Section");
  });
});

describe("localizedTitle", () => {
  it("returns title_en when locale is en and the field is set", () => {
    expect(
      localizedTitle(
        { title: "노드 개요", title_en: "Node overview", summary: "", summary_en: "" },
        "en",
      ),
    ).toBe("Node overview");
  });

  it("falls back to the Korean title when locale is en but title_en missing", () => {
    expect(
      localizedTitle({ title: "노드 개요", summary: "" }, "en"),
    ).toBe("노드 개요");
  });

  it("always returns the Korean title for ko locale", () => {
    expect(
      localizedTitle(
        { title: "노드 개요", title_en: "Node overview", summary: "", summary_en: "" },
        "ko",
      ),
    ).toBe("노드 개요");
  });
});

describe("localizedSummary", () => {
  it("returns summary_en when available for en locale", () => {
    expect(
      localizedSummary(
        { title: "t", summary: "요약", summary_en: "English summary" },
        "en",
      ),
    ).toBe("English summary");
  });

  it("falls back to Korean summary when summary_en missing", () => {
    expect(
      localizedSummary({ title: "t", summary: "요약" }, "en"),
    ).toBe("요약");
  });

  it("always returns the Korean summary for ko locale", () => {
    expect(
      localizedSummary(
        { title: "t", summary: "요약", summary_en: "English summary" },
        "ko",
      ),
    ).toBe("요약");
  });
});

/**
 * `codebase/frontend/src/content/docs/` 의 모든 (숨김 아닌) 섹션 디렉토리가
 * `SECTION_LABELS_BY_LOCALE` 의 모든 로케일에 명시적으로 등록되어 있는지
 * 검증한다.
 *
 * 누락 시 `humanize()` 폴백이 동작해 사이드바·검색 인덱스가 어색한 영문
 * 라벨로 렌더된다 (예: "Faq" 대신 "자주 묻는 질문"). 사후 보정
 * (`docs(user-guide): FAQ 섹션 이동 + locale.ts 라벨 동기화`) 패턴을
 * 사전 차단한다.
 *
 * 정책 위치: developer/SKILL.md DOCUMENTATION 매핑표 (유저 가이드 신규 섹션 행).
 * 추가 절차: spec/2-navigation/13-user-guide.md §5.
 */
describe("SECTION_LABELS_BY_LOCALE coverage", () => {
  const DOCS_DIR = join(__dirname, "..", "..", "..", "content", "docs");

  function listSectionDirs(): string[] {
    return readdirSync(DOCS_DIR)
      .filter((name) => {
        if (name.startsWith("_")) return false; // 숨김 (예: _glossary, _i18n-conventions)
        const full = join(DOCS_DIR, name);
        try {
          return statSync(full).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  }

  it("content/docs/ 디렉토리에 섹션이 하나 이상 존재한다 (회귀 가드)", () => {
    expect(listSectionDirs().length).toBeGreaterThan(0);
  });

  for (const locale of LOCALES) {
    it(`모든 섹션 디렉토리가 ${locale} 로케일에 명시적 라벨로 등록되어 있다`, () => {
      const missing = listSectionDirs().filter(
        (key) => !hasExplicitSectionLabel(key, locale),
      );
      expect(missing).toEqual([]);
    });
  }
});

describe("hasExplicitSectionLabel", () => {
  it("등록된 섹션은 true 를 반환한다", () => {
    expect(hasExplicitSectionLabel("01-getting-started", "ko")).toBe(true);
    expect(hasExplicitSectionLabel("99-faq", "en")).toBe(true);
  });

  it("등록되지 않은 섹션은 false 를 반환한다", () => {
    expect(hasExplicitSectionLabel("97-future-section", "ko")).toBe(false);
    expect(hasExplicitSectionLabel("97-future-section", "en")).toBe(false);
  });
});

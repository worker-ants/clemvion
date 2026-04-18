import { describe, expect, it } from "vitest";
import {
  localizedSectionLabel,
  localizedSummary,
  localizedTitle,
} from "../locale";

describe("localizedSectionLabel", () => {
  it("returns the Korean label for known section keys", () => {
    expect(localizedSectionLabel("01-getting-started", "ko")).toBe("시작하기");
    expect(localizedSectionLabel("06-faq", "ko")).toBe("자주 묻는 질문");
  });

  it("returns the English label for known section keys", () => {
    expect(localizedSectionLabel("01-getting-started", "en")).toBe("Getting Started");
    expect(localizedSectionLabel("05-integrations-and-config", "en")).toBe(
      "Integrations & Config",
    );
  });

  it("falls back to a humanized segment for unknown keys", () => {
    expect(localizedSectionLabel("07-advanced-topics", "ko")).toBe("Advanced Topics");
    expect(localizedSectionLabel("07-advanced-topics", "en")).toBe("Advanced Topics");
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

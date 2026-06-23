import { describe, it, expect } from "vitest";
import { draftToBootInput } from "../snippet-input";
import { DEFAULT_DRAFT } from "../use-appearance-draft";
import { buildBootConfig } from "@/lib/web-chat/snippet";

describe("draftToBootInput", () => {
  it("줄바꿈 추천질문을 배열로 분리하고 빈 줄 제거", () => {
    const input = draftToBootInput(
      {
        ...DEFAULT_DRAFT,
        suggestions: "제품 소개\n\n  가격 안내  \n",
      },
      { apiBase: "https://api.example.com", triggerEndpointPath: "abc-123" },
    );
    expect(input.welcome?.suggestions).toEqual(["제품 소개", "가격 안내"]);
    expect(input.launcher?.suggestions).toEqual(["제품 소개", "가격 안내"]);
  });

  it("apiBase·endpointPath 를 그대로 전달, 외형을 매핑", () => {
    const input = draftToBootInput(
      { ...DEFAULT_DRAFT, primaryColor: "#000000", position: "bottom-left", locale: "en" },
      { apiBase: "https://api.example.com", triggerEndpointPath: "ep-1" },
    );
    expect(input.apiBase).toBe("https://api.example.com");
    expect(input.triggerEndpointPath).toBe("ep-1");
    expect(input.appearance).toEqual({ primaryColor: "#000000", position: "bottom-left" });
    expect(input.locale).toBe("en");
  });

  it("기본 draft(빈 콘텐츠)는 buildBootConfig 후 필수 필드만 남는다", () => {
    const input = draftToBootInput(DEFAULT_DRAFT, {
      apiBase: "https://api.example.com",
      triggerEndpointPath: "ep-1",
    });
    const config = buildBootConfig(input);
    expect(config).toEqual({
      apiBase: "https://api.example.com",
      triggerEndpointPath: "ep-1",
      locale: "ko",
      appearance: { primaryColor: "#5B4FE9", position: "bottom-right" },
    });
  });
});

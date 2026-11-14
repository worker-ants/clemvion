import { describe, it, expect } from "vitest";
import { nodeConfigs as koNodeConfigs } from "@/lib/i18n/dict/ko/nodeConfigs";
import { nodeConfigs as enNodeConfigs } from "@/lib/i18n/dict/en/nodeConfigs";
import { sidebar as koSidebar } from "@/lib/i18n/dict/ko/sidebar";
import { sidebar as enSidebar } from "@/lib/i18n/dict/en/sidebar";
import { models as koModels } from "@/lib/i18n/dict/ko/models";

/**
 * CLE-T-TS6AQF — 노드 설정의 「기본 LLM 없음」 안내(`noDefaultHint`)는 사용자가 찾아갈
 * 메뉴를 지금 이름(사이드바의 모델 설정)으로 가리킨다. 백엔드
 * `MODEL_CONFIG_DEFAULT_MISSING` 문구(`llm.service.ts`)처럼 Chat 기본 모델을 지정하라고
 * 안내한다. 메뉴 이름은 사이드바 사전에서 읽어 메뉴 이름이 바뀌면 이 테스트가 깨진다.
 */
describe("nodeConfigs.llmConfigSelector.noDefaultHint", () => {
  it.each([
    ["ko", koNodeConfigs.llmConfigSelector.noDefaultHint, koSidebar.models],
    ["en", enNodeConfigs.llmConfigSelector.noDefaultHint, enSidebar.models],
  ])("%s 문구가 사이드바의 모델 설정 메뉴 이름을 쓴다", (_locale, hint, menu) => {
    expect(hint).toContain(menu);
  });

  it.each([
    ["ko", koNodeConfigs.llmConfigSelector.noDefaultHint, "LLM 설정"],
    ["en", enNodeConfigs.llmConfigSelector.noDefaultHint, "LLM Settings"],
  ])("%s 문구에 옛 메뉴 이름이 남지 않는다", (_locale, hint, oldMenu) => {
    expect(hint).not.toContain(oldMenu);
  });

  it.each([
    ["ko", koNodeConfigs.llmConfigSelector.noDefaultHint],
    ["en", enNodeConfigs.llmConfigSelector.noDefaultHint],
  ])("%s 문구가 Chat 기본 모델을 지정하라고 안내한다", (_locale, hint) => {
    // 모델 설정 화면의 Chat 탭 이름과 같은 표기를 쓴다.
    expect(hint).toContain(koModels.tabChat);
  });
});

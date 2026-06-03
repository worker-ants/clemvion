// 데모 호스트(dev 전용) 순수 헬퍼 — boot config 조립 / 게이팅. React 비의존이라 단위테스트 대상.
import type { BootMessage } from "@/widget/host-bridge";

/** 데모 호스트 좌측 설정 폼의 편집 상태. `buildBootConfig` 가 이를 wc:boot 페이로드로 변환한다. */
export interface DemoFormState {
  apiBase: string;
  triggerEndpointPath: string;
  locale: "ko" | "en";
  primaryColor: string;
  position: "bottom-right" | "bottom-left";
  headerTitle: string;
  welcomeText: string;
  welcomeSuggestions: string; // 줄바꿈/콤마 구분 원시 입력
  launcherSuggestions: string; // 줄바꿈/콤마 구분 원시 입력
  disclaimer: string;
}

// 기본 폼 — backend 로컬 기본(:3011) 가정. trigger 는 사용자가 공개 webhook UUID 를 붙여넣어야 부팅 가능.
export const defaultDemoForm: DemoFormState = {
  apiBase: "http://localhost:3011/api",
  triggerEndpointPath: "",
  locale: "ko",
  primaryColor: "#5B4FE9",
  position: "bottom-right",
  headerTitle: "AI 어시스턴트",
  welcomeText: "안녕하세요! 무엇을 도와드릴까요?",
  welcomeSuggestions: "제품 소개를 받아볼 수 있나요?\n설치는 어떻게 하나요?",
  launcherSuggestions: "제품 소개를 받아볼 수 있나요?",
  disclaimer: "AI는 한정된 데이터로 동작하며 답변이 정확하지 않을 수 있습니다.",
};

/** 줄바꿈/콤마로 구분된 입력을 추천질문 배열로. 공백 trim + 빈 항목 제거. */
export function parseSuggestions(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 위젯이 applyConfig 를 통과하려면 apiBase·trigger 둘 다 필요(use-widget §applyConfig). */
export function isBootReady(form: DemoFormState): boolean {
  return form.apiBase.trim().length > 0 && form.triggerEndpointPath.trim().length > 0;
}

/** 폼 상태 → wc:boot 페이로드(BootMessage). 빈 선택 필드는 생략. */
export function buildBootConfig(form: DemoFormState): BootMessage {
  const welcomeSuggestions = parseSuggestions(form.welcomeSuggestions);
  const launcherSuggestions = parseSuggestions(form.launcherSuggestions);

  // 필드별 1회 trim 후 재사용(중복 trim 제거).
  const primaryColor = form.primaryColor.trim();
  const headerTitle = form.headerTitle.trim();
  const welcomeText = form.welcomeText.trim();
  const disclaimer = form.disclaimer.trim();

  const cfg: BootMessage = {
    apiBase: form.apiBase.trim(),
    triggerEndpointPath: form.triggerEndpointPath.trim(),
    locale: form.locale,
  };

  const appearance: NonNullable<BootMessage["appearance"]> = { position: form.position };
  if (primaryColor) appearance.primaryColor = primaryColor;
  cfg.appearance = appearance;

  if (headerTitle) cfg.headerTitle = headerTitle;

  const welcome: NonNullable<BootMessage["welcome"]> = {};
  if (welcomeText) welcome.text = welcomeText;
  if (welcomeSuggestions.length) welcome.suggestions = welcomeSuggestions;
  if (welcome.text || welcome.suggestions) cfg.welcome = welcome;

  if (launcherSuggestions.length) cfg.launcher = { suggestions: launcherSuggestions };
  if (disclaimer) cfg.disclaimer = disclaimer;

  return cfg;
}

/**
 * 데모 라우트 게이팅 — dev(non-production)에서는 항상 노출, production static export
 * 에서는 기본 제외. prod 미리보기는 opt-in `NEXT_PUBLIC_ENABLE_DEMO=1` 로만.
 */
export function isDemoEnabled(env: { nodeEnv?: string; enableFlag?: string }): boolean {
  return env.nodeEnv !== "production" || env.enableFlag === "1";
}

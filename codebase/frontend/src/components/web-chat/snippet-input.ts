import type { WebChatBootInput } from "@/lib/web-chat/snippet";
import type { WebChatDraft } from "./use-appearance-draft";

/** textarea 의 줄바꿈 구분 추천질문을 배열로. (빈 줄 제거는 buildBootConfig 가 처리) */
function splitSuggestions(raw: string): string[] {
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

/**
 * 외형 draft + 인스턴스 정보를 위젯 boot 입력으로 매핑.
 * (빈 값 정리·undefined 제거는 buildBootConfig 가 수행하므로 여기서는 그대로 전달.)
 */
export function draftToBootInput(
  draft: WebChatDraft,
  opts: { apiBase: string; triggerEndpointPath: string },
): WebChatBootInput {
  const suggestions = splitSuggestions(draft.suggestions);
  return {
    apiBase: opts.apiBase,
    triggerEndpointPath: opts.triggerEndpointPath,
    locale: draft.locale,
    appearance: {
      primaryColor: draft.primaryColor,
      position: draft.position,
    },
    headerTitle: draft.headerTitle,
    welcome: { text: draft.welcomeText, suggestions },
    launcher: { suggestions },
    disclaimer: draft.disclaimer,
  };
}

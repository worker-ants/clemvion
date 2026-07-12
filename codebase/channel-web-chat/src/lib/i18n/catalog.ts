// 위젯 chrome 문자열 카탈로그 (ko/en). SoT: spec/7-channel-web-chat/1-widget-app §4.
// 위젯은 별도 정적 export 번들이라 메인 앱 frontend/src/lib/i18n/dict 를 import 할 수 없어 자체 경량 catalog 를 둔다.
// 대상 = 위젯 소유 chrome 만. 운영자 제공 콘텐츠(headerTitle·welcome·disclaimer)·backend payload·AI 본문은 비대상.
// ko/en 키 집합은 반드시 동일해야 한다(catalog.test.ts parity 가드 — hard fail).

export type WidgetLocale = "ko" | "en";

/** 재귀 동결: `Object.freeze` 는 얕게(최상위만) 얼리므로 leaf 문자열까지 방어하려면 중첩 객체도 동결한다. */
function deepFreeze<T>(obj: T): T {
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") deepFreeze(v);
  }
  Object.freeze(obj);
  return obj;
}

// deepFreeze: `as const` 는 컴파일타임 readonly 만 보장 — 개별 번역 문자열(leaf)까지 런타임 변형(실수/외부 조작)을
// 재귀 동결로 차단한다(`WIDGET_STRINGS.ko["composer.send"] = ...` 도 실패). 검증: catalog.test.ts.
export const WIDGET_STRINGS = deepFreeze({
  ko: {
    // composer (입력창)
    "composer.placeholder": "메시지를 입력해 주세요.",
    "composer.inputLabel": "메시지 입력",
    "composer.sendBusy": "AI 응답 중",
    "composer.send": "전송",
    // panel header / 세션 컨트롤
    "panel.ariaLabel": "채팅 패널",
    "header.newChat": "새 대화",
    "header.endChat": "대화 종료",
    "header.close": "닫기",
    "header.defaultTitle": "AI 어시스턴트", // headerTitle 미지정 시 위젯 기본값(§4 경계규칙 1: 기본값=chrome)
    // 2단계 확인
    "confirm.ariaLabel": "확인",
    "confirm.newPrompt": "새 대화를 시작할까요? 현재 대화 내용은 사라져요.",
    "confirm.newYes": "새 대화 시작",
    "confirm.endPrompt": "대화를 종료할까요? 종료하면 이어서 대화할 수 없어요.",
    "confirm.yesAria": "{{label}} 확정",
    "confirm.noAria": "확인 취소",
    "confirm.no": "취소",
    // panel body
    "group.choices": "선택지",
    "group.suggestions": "추천 질문",
    "ended.text": "대화가 종료되었어요.",
    // launcher
    "launcher.open": "채팅 열기",
    "launcher.unread": "읽지 않은 메시지 {{count}}개",
    // presentations
    "carousel.prev": "이전",
    "carousel.next": "다음",
    "table.truncatedWithCount": "총 {{count}}개 중 일부만 표시돼요.",
    "table.truncated": "일부 행만 표시돼요.",
    "carousel.truncatedWithCount": "총 {{count}}개 중 일부만 표시돼요.",
    "carousel.truncated": "일부만 표시돼요.",
    "chart.legend": "범례",
    "chart.cartesianLabel": "{{type}} 차트",
    "chart.pie": "원형 차트",
    "chart.donut": "도넛 차트",
    // dynamic form
    "form.selectPlaceholder": "선택",
    "form.submit": "제출",
    // 전역 에러 (유일 사용자 노출 에러 — use-widget GENERIC_ERROR_MESSAGE 가 이 값을 state 로 저장, 표시는 t 경유)
    "error.generic": "일시적인 오류로 대화를 진행할 수 없어요. 잠시 후 새 대화로 다시 시도해 주세요.",
  },
  en: {
    "composer.placeholder": "Type a message.",
    "composer.inputLabel": "Message input",
    "composer.sendBusy": "AI is responding",
    "composer.send": "Send",
    "panel.ariaLabel": "Chat panel",
    "header.newChat": "New chat",
    "header.endChat": "End chat",
    "header.close": "Close",
    "header.defaultTitle": "AI Assistant",
    "confirm.ariaLabel": "Confirm",
    "confirm.newPrompt": "Start a new chat? Your current conversation will be lost.",
    "confirm.newYes": "Start new chat",
    "confirm.endPrompt": "End this conversation? You won't be able to continue afterward.",
    "confirm.yesAria": "Confirm {{label}}",
    "confirm.noAria": "Cancel",
    "confirm.no": "Cancel",
    "group.choices": "Options",
    "group.suggestions": "Suggested questions",
    "ended.text": "This conversation has ended.",
    "launcher.open": "Open chat",
    "launcher.unread": "{{count}} unread messages",
    "carousel.prev": "Previous",
    "carousel.next": "Next",
    "table.truncatedWithCount": "Showing some of {{count}} items.",
    "table.truncated": "Showing some rows only.",
    "carousel.truncatedWithCount": "Showing some of {{count}} items.",
    "carousel.truncated": "Showing some items only.",
    "chart.legend": "Legend",
    "chart.cartesianLabel": "{{type}} chart",
    "chart.pie": "Pie chart",
    "chart.donut": "Donut chart",
    "form.selectPlaceholder": "Select",
    "form.submit": "Submit",
    "error.generic": "Something went wrong. Please start a new chat and try again shortly.",
  },
} as const);

/** 번역 키 — ko 사전을 SoT 로 삼는다(en 은 parity 강제). */
export type WidgetTranslationKey = keyof typeof WIDGET_STRINGS.ko;

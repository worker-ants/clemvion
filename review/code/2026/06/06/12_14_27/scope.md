# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `_product-overview.md` 내비게이션 링크 추가 — 범위 연접 수정
- 위치: `spec/7-channel-web-chat/_product-overview.md` 상단 nav 블록
- 상세: 구성요소 nav 에 `[아키텍처](./0-architecture.md)` 링크가 추가됨. eager-start 작업이 `0-architecture.md`를 변경하는 과정에서 해당 파일이 nav 에 누락된 것을 발견하고 함께 수정한 것으로 보인다. eager-start 기능 자체와 직접적 연관은 없으나, `0-architecture.md` 에 `pending_plans` 추가와 동일 파일군 수정 맥락이므로 무관한 기회주의적 수정으로 볼 수 있다.
- 제안: 범위 엄격 준수 관점에서는 별도 커밋으로 분리하는 것이 이상적이나, 실질적 영향이 nav 링크 1개 추가이고 오류 수정 성격이 강하므로 수용 가능 수준이다.

### [INFO] `panel.tsx` Composer `disabled` 조건 확장 — 범위 내 동작 변경
- 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx`, Composer `disabled` prop
- 상세: 기존 `disabled={pending?.type === "form"}` 에서 `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 으로 확장됨. eager 시작으로 인해 `booting`/`streaming` 단계에서 입력창이 활성화되면 안 되므로 phase 조건 추가는 직접 필요한 변경이다. `buttons` 조건 추가도 buttons 표면에서 텍스트 입력을 막는 기존 의도를 명시적으로 코드화한 것으로, eager 시작 후 표면 렌더 정책을 반영한 범위 내 변경이다.

### [INFO] `use-widget.ts` `newChat` 로직 확장 — 범위 내 필수 변경
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`, `newChat` 콜백
- 상세: 기존 `newChat`은 단순 `dispatch({ type: "NEW_CHAT" })` 였으나, eager 시작 도입으로 새 대화도 즉시 execution을 시작해야 하므로 세션/스트림 정리 + `startedRef` 리셋 + `void start()` 호출이 추가됨. 이는 eager 시작 요구사항의 논리적 연장이다.

### [INFO] 주석 추가 — 모두 범위 관련 설명
- 위치: 모든 변경 파일 전반
- 상세: 추가된 주석은 모두 `§R6`(eager 시작 근거) 또는 eager 시작 동작을 설명하는 내용이다. 무관한 주석 정리나 삭제는 없으며, 기존 주석 변경도 `panel` 위치의 lazy→eager 전환 설명 업데이트뿐이다.

## 요약

총 11개 파일 변경 중 10개는 eager 시작(§R6) 전환 — `firstMessage` 제거, `START` 액션에서 `userText` 파라미터 제거, `startedRef` 가드 도입, `open()`에서 `start()` 자동 호출, `Composer` disabled 조건 강화, 관련 spec·plan 문서 갱신 — 으로 구성되며 명확히 요청 범위 내다. `_product-overview.md` 에 `0-architecture.md` 링크를 추가한 변경 1건이 eager-start 작업의 직접 요구사항은 아니나, 동일 파일군 수정 중 발견된 누락 수정으로 실질적 피해 없는 소규모 편의 수정이다. 불필요한 리팩토링, 기능 추가, 무관한 임포트 변경, 설정 파일 변경은 없다.

## 위험도

NONE

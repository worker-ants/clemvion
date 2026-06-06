# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `spec/7-channel-web-chat/_product-overview.md` 내비게이션 링크 추가 — 범위 인접 수정
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/spec/7-channel-web-chat/_product-overview.md` nav 블록
- 상세: 구성요소 nav 에 `[아키텍처](./0-architecture.md)` 링크 1개 추가. eager-start 작업이 `0-architecture.md` 를 수정하면서 해당 파일이 nav 에 누락됐던 것을 발견하여 함께 수정한 것으로 보인다. eager-start 기능 자체의 직접 요구사항은 아니나, 동일 파일군(`spec/7-channel-web-chat/`) 수정 맥락에서 발생한 오류 수정(누락 링크 복원) 성격이 강하다.
- 제안: 범위 엄격 준수 관점에서는 별도 커밋으로 분리하는 것이 이상적이나, nav 링크 1건 추가이고 실질적 피해가 없으므로 수용 가능 수준이다.

### [INFO] `panel.tsx` Composer `disabled` 조건 확장 — 범위 내 필수 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/components/panel.tsx` Composer `disabled` prop
- 상세: 기존 `disabled={pending?.type === "form"}` 에서 `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 으로 확장. eager 시작으로 `booting`/`streaming` 단계가 패널 표시 중 발생하게 되어 그 동안 입력창 비활성화가 필요하다. `buttons` 조건 추가도 버튼 표면 렌더 정책을 명시적으로 코드화한 것이다. 모두 eager-start 요구사항의 직접 귀결이다.

### [INFO] `use-widget.ts` `newChat` 로직 확장 — 범위 내 필수 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` 콜백
- 상세: 기존 `dispatch({ type: "NEW_CHAT" })` 1행에서 세션/스트림 정리 + `refreshTimerRef` clearTimeout + `startedRef` 리셋 + `void start()` 호출로 확장됐다. 새 대화도 eager 시작이 필요하므로 이 확장은 eager-start 요구사항의 논리적 연장이다.

### [INFO] 주석 추가 — 모두 eager-start 범위 관련
- 위치: 변경된 모든 파일 전반
- 상세: 추가된 주석은 예외 없이 `§R6`(eager 시작 근거) 또는 eager 시작 동작을 설명하는 내용이다. 기존 주석의 의미 변경도 lazy→eager 전환을 반영하는 내용 수정(`updateProfile` 주석 "첫 메시지" → "패널 open/새 대화" 등)으로 범위 내다. 무관한 주석 정리·삭제·추가는 없다.

### [INFO] review/code/2026/06/06/12_14_27/ 하위 신규 파일들 — 이전 리뷰 세션 산출물, 범위 외 파일 아님
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-eager-start-2a7b86/review/code/2026/06/06/12_14_27/` 전체
- 상세: 이전 리뷰 라운드(12_14_27 세션)의 SUMMARY, RESOLUTION, 각 reviewer 산출물, resolution 상태 JSON 등이 신규 추가됐다. 이는 이번 변경 diff 에 포함된 것이나, 코드 리뷰 프로세스 자체의 산출물로서 `review/code/` 경로에 위치한다. 이 경로는 프로젝트 규약상 리뷰 산출물 보관 위치이며, 의도치 않은 코드 변경이나 기능 확장과는 무관하다.
- 제안: 이상 없음.

## 요약

이번 변경의 핵심은 채널 웹챗 위젯의 lazy 시작(첫 입력 시)을 eager 시작(패널 open 시)으로 전환하는 것(§R6)이다. 코드 변경 파일 8개(`eia-client.ts`, `eia-client.test.ts`, `widget-state.ts`, `widget-state.test.ts`, `panel.tsx`, `panel.test.tsx`, `use-widget-eager-start.test.ts`, `use-widget.ts`)는 모두 이 전환의 직접 구현이며, 스펙 4개(`0-architecture.md`, `1-widget-app.md`, `3-auth-session.md`, `_product-overview.md`)와 플랜 1개(`webchat-eager-start.md`) 변경도 해당 작업의 spec 정합 및 진행 추적이다. 유일한 범위 인접 수정은 `_product-overview.md` nav 에 `0-architecture.md` 링크를 추가한 것인데, 이는 오류 수정 성격으로 실질적 위험이 없다. 불필요한 리팩토링, 기능 추가, 무관 임포트 변경, 설정 파일 변경은 없다.

## 위험도

NONE

STATUS: SUCCESS

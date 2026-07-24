# 신규 식별자 충돌 검토 — webchat-apibase-binding (impl-done)

대상: `spec/7-channel-web-chat/` (세션 ↔ 발급 `apiBase` 바인딩 diff, `origin/main...HEAD`).
SoT 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-apibase-binding-a14e68` (절대경로 기준 확인).

본 diff 는 순수 코드 변경(신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 키·spec 파일 경로 없음)이며, 유일한 spec 변경은
`spec/7-channel-web-chat/3-auth-session.md` §3.1 1단계 서술에 `apiBase` 필드 언급을 추가한 것(신규 `R` 항목 없음, 기존
번호 R3~R6 과 충돌 없음). 신규 식별자는 `codebase/channel-web-chat/src/lib/api-base.ts` 의 `stripTrailingSlash` 함수,
`PersistedSession.apiBase` 필드, `loadSession(triggerEndpointPath, expectedApiBase, storage?)` 시그니처 확장이다.

## 발견사항

- **[INFO]** 직전 세션(22_35_51)이 지적한 `normalizeApiBase` 이름 충돌 CRITICAL — 현재 워킹트리에서 해소 확인됨
  - target 신규 식별자: (해소 전) `codebase/channel-web-chat/src/lib/session-store.ts` 의 로컬 `normalizeApiBase` wrapper.
  - 기존 사용처: `codebase/channel-web-chat/src/app/demo/demo-config.ts:51` `export function normalizeApiBase(raw: string): string` — 후행 슬래시 **+ 후행 `/api` 세그먼트까지 제거**(데모 입력 편의용), 데모 전용, 이번 diff 대상 아님.
  - 상세: 이전 검토(`review/consistency/2026/07/24/22_35_51/naming_collision.md`)는 `session-store.ts` 가 `stripTrailingSlash` 로 위임하면서도 로컬 wrapper 이름을 여전히 `normalizeApiBase` 로 남겨 `demo-config.ts` 의 동명 함수(경로 제거까지 하는 반대 계약)와 이름이 겹친다고 CRITICAL 로 판정했다. 현재 워킹트리 `session-store.ts:60-97` 확인 결과 그 로컬 wrapper 는 **제거**됐고, `loadSession` 은 공용 `stripTrailingSlash`(`./api-base`)를 직접 호출한다(`session-store.ts:87-90`). 남은 것은 `demo-config.ts::normalizeApiBase` 하나뿐이며, `session-store.ts:80-83` 주석이 "동명 `normalizeApiBase` 는 정반대 계약이라 통합 금지"를 명시적으로 남겨 향후 오인 통합을 사전 차단한다(주석이 직전 CRITICAL 을 근거로 인용).
  - 판정: 식별자 자체(`stripTrailingSlash` vs `normalizeApiBase`)가 이제 서로 다르므로 "동일 식별자의 의미 충돌"은 존재하지 않는다. **재-flag 불필요** — 해소된 CRITICAL 을 다시 올리지 않는다.
  - 제안: 없음(이미 처리됨). 유지보수 시 `session-store.ts:80-83` 주석을 지우지 않도록 코드리뷰에서 상기.

- **[INFO]** `stripTrailingSlash` 동일 함수명이 `codebase/frontend` 에도 module-private 으로 존재 — 앱 경계 격리로 충돌 아님
  - target 신규 식별자: `codebase/channel-web-chat/src/lib/api-base.ts:8` `export function stripTrailingSlash(base: string): string`.
  - 기존 사용처: `codebase/frontend/src/lib/utils/webhook-url.ts:19`, `codebase/frontend/src/lib/web-chat/widget-base.ts:19` — 둘 다 module-private `function stripTrailingSlash(url: string)`, 동작도 사실상 동일(후행 슬래시 1개 이상 제거).
  - 상세: 이름·의미가 일치하고 서로 다른 앱의 module-private 헬퍼라 import 충돌은 없다. 관용구 중복(모노레포에서 각 앱이 독립적으로 재발명)일 뿐 신규 식별자 **충돌**은 아니다.
  - 제안: 조치 불요. 굳이 정리한다면 `codebase/packages/` 공유 유틸 승격은 별개 리팩터 논의 사안.

- **[INFO]** `apiBase` 필드/파라미터명은 영역 전체에서 의미 일관 — 충돌 없음
  - `PersistedSession.apiBase`(신규, `session-store.ts`), `EiaClientDeps.apiBase`(`eia-client.ts`), `BootConfig.apiBase`(`2-sdk.md`, `web-chat-sdk`), `DemoFormState.apiBase`(`demo-config.ts`) 전부 "EIA API origin(+선택적 경로)" 동일 의미. `spec/7-channel-web-chat/0-architecture.md §4`·`3-auth-session.md §3.1`(이번 diff 갱신분 포함)도 같은 의미로 서술해 spec-코드 용어 일치.
  - `loadSession` 시그니처 확장(신규 필수 파라미터 `expectedApiBase`)의 유일한 non-test 호출부(`use-widget.ts:1000`)는 갱신 반영 확인(`cfg.apiBase` 전달) — 잔존 구-시그니처 호출 없음.

## 요약

이번 diff(세션 ↔ 발급 `apiBase` 바인딩)는 신규 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 키·spec 파일 경로를 새로 선언하지 않는 순수 코드 변경(+ 관련 서술 1곳 spec 갱신)이다. 같은 세션의 직전 검토(22_35_51)가 지적한 `normalizeApiBase` 이름 충돌 CRITICAL 은 현재 워킹트리에서 로컬 wrapper 제거 + 주석 근거 명시로 **해소**됐음을 코드 직접 확인으로 재검증했다. 남은 항목(`stripTrailingSlash` 앱 경계 중복, `apiBase` 필드명 전역 일관성)은 모두 참고용 INFO 로 실질적 충돌이 아니다.

## 위험도
NONE

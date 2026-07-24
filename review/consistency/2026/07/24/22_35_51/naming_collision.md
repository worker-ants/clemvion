# 신규 식별자 충돌 검토 — webchat-apibase-binding (impl-done)

대상: `spec/7-channel-web-chat/` (세션 ↔ 발급 `apiBase` 바인딩 diff, `origin/main...HEAD` +
워킹트리 미커밋 변경분). SoT 워크트리: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-apibase-binding-a14e68`
(절대경로 기준으로 확인).

## 발견사항

- **[CRITICAL]** `normalizeApiBase` 함수명이 같은 패키지 안에서 **서로 반대되는 계약**으로 중복 정의됨
  - target 신규 식별자: `codebase/channel-web-chat/src/lib/session-store.ts:38` `function normalizeApiBase(apiBase: string): string` — 이번 작업(`f70c845f9` "세션을 발급 apiBase 에 바인딩")이 도입. 현재는 `stripTrailingSlash`(신규 `lib/api-base.ts`, DRY 리팩터 후)로 위임하는 얇은 wrapper 이지만 **이름은 여전히 `normalizeApiBase`**.
  - 기존 사용처: `codebase/channel-web-chat/src/app/demo/demo-config.ts:51` `export function normalizeApiBase(raw: string): string` — 2026-06-03 데모 하니스 PR 부터 존재. 후행 슬래시 제거 **+ 후행 `/api` 세그먼트 1개 제거**까지 수행(`raw.trim().replace(/\/+$/, "").replace(/\/api$/i, "")`).
  - 상세: 두 함수는 **동일 식별자·동일 도메인 개념(`apiBase` 문자열 정규화)**을 다루지만 의미가 정반대다.
    - `demo-config.ts::normalizeApiBase` — origin 만 남기도록 **경로(`/api`)를 벗겨낸다**. 목적: 데모 폼에 사용자가 `…/api` 를 붙여넣어도 EIA 클라이언트가 이중 `/api/api/hooks` 를 만들지 않게 함.
    - `session-store.ts::normalizeApiBase` — 후행 슬래시만 제거하고 **경로는 반드시 보존**한다. 이 diff 의 JSDoc·주석이 명시적으로 강조하는 지점: "`apiBase` 는 `/api` 등 경로 포함이 정상이므로 origin 만 비교하면 `…/api` 와 `…/api-v2` 를 같다고 본다"(`session-store.ts:1696` 부근 주석) — 이는 세션 발급-origin 바인딩(이번 diff 의 보안 핵심 불변식: 옛 origin 세션 토큰이 새 origin 으로 새지 않게 함)을 위해 **의도적으로 demo 쪽과 반대 동작**을 하도록 설계된 것.
    - 이미 같은 세션의 `/ai-review` 코드 리뷰(`review/code/2026/07/24/22_09_46/maintainability.md`)가 독립적으로 이 위험을 지적했다: "`session-store.ts` 의 `normalizeApiBase` 는 '경로는 보존'(origin 만이 아니라 path 도 비교)이라는 미묘한 의미를 갖는데, 이 차이가 다른 두 곳과 공유되지 않아 향후 누군가 세 곳 중 하나만 보고 동일 동작이라 오인할 수 있다." 그 리뷰의 제안대로 공용 `stripTrailingSlash`(`lib/api-base.ts`) 로 3곳의 "후행 슬래시 제거" 중복은 이미 통합됐으나(워킹트리 반영 확인: `eia-client.ts`·`use-widget.ts`·`session-store.ts` 모두 `stripTrailingSlash` import), **`normalizeApiBase` 라는 이름 자체의 충돌은 해소되지 않았다** — `session-store.ts` 가 여전히 그 이름의 로컬 wrapper 를 두고 있고, `demo-config.ts` 의 (더 넓게 동작하는) 동명 export 는 그대로 남아 있다.
    - 실질 위험: 향후 누군가 "이미 `normalizeApiBase` 가 있으니 재사용하자"며 `session-store.ts` 호출부를 `demo-config.ts` 의 export 로 치환(또는 두 함수를 하나로 "통합")하면, 세션 비교가 origin-only 로 완화되어 **이번 diff 가 막으려는 정확히 그 취약점**(다른 apiBase 로 발급된 세션 토큰이 유효한 것으로 오판되어 재전송/전송됨)이 재도입된다. 이름이 동일하다는 사실 자체가 그 오인식을 유발하는 조건이다.
  - 제안: `session-store.ts` 의 로컬 `normalizeApiBase` 를 제거하고 `stripTrailingSlash` 를 직접 호출하거나(현재 1-line delegate 이므로 인라인 가능), 유지해야 한다면 의미가 겹치지 않는 이름(예: `normalizeSessionApiBase` / `normalizeApiBaseOrigin`) 으로 개명해 `demo-config.ts::normalizeApiBase`(경로 제거) 와 구분한다. 두 함수의 차이("경로 보존 vs 경로 제거")를 어느 한쪽 JSDoc 에서 상호 참조로 명시하는 것도 최소 조치로 유효하다.

- **[INFO]** `stripTrailingSlash` 동일 식별자가 다른 패키지(`codebase/frontend`)에도 모듈-private 으로 중복 존재
  - target 신규 식별자: `codebase/channel-web-chat/src/lib/api-base.ts:8` `export function stripTrailingSlash(base: string): string` (신규 공유 유틸, 이번 워킹트리 변경분).
  - 기존 사용처: `codebase/frontend/src/lib/utils/webhook-url.ts:19`, `codebase/frontend/src/lib/web-chat/widget-base.ts:19` — 둘 다 module-private `function stripTrailingSlash(url: string)`, 동작(후행 슬래시 1개 이상 제거)도 사실상 동일.
  - 상세: 이름·의미가 **일치**하고(모순 아님), 서로 다른 애플리케이션(`codebase/frontend` vs `codebase/channel-web-chat`)의 module-private 헬퍼라 import 충돌은 없다. 위 CRITICAL 항목과 달리 "다른 의미로 사용 중"이 아니라 단순 관용구 중복(각 앱이 독립적으로 같은 1줄짜리 정규화를 재발명)이므로 신규 식별자 **충돌**로 보긴 어렵다 — 참고용으로만 기록.
  - 제안: 조치 불요(모노레포에서 앱 경계를 넘는 강제 통합은 별개 리팩터 논의 사안). 굳이 정리한다면 `codebase/packages/` 공유 유틸로 승격 검토.

- **[INFO]** `apiBase` 필드/파라미터명은 영역 전체에서 일관 — 충돌 없음(참고 확인)
  - `PersistedSession.apiBase`(신규, `session-store.ts`), `BootMessage.apiBase`/`BootConfig.apiBase`(`2-sdk.md`, `web-chat-sdk`), `DemoFormState.apiBase`(`demo-config.ts`), frontend `WebChatSnippetInput.apiBase`(`snippet.ts`) 전부 "EIA API origin(+선택적 경로)" 이라는 동일 의미로 쓰여 진짜 개념 충돌은 없다. `spec/7-channel-web-chat/0-architecture.md §4`·`3-auth-session.md §3.1`(워킹트리 미커밋 갱신분 포함)도 같은 의미로 서술해 spec-코드 용어가 일치한다.

## 요약

이번 diff(세션 ↔ 발급 `apiBase` 바인딩) 자체가 새로 선언하는 요구사항 ID·엔티티·API endpoint·이벤트명·ENV 키·spec 파일 경로는 없다(순수 코드 변경, `PersistedSession` 필드 추가 + `loadSession` 시그니처 확장뿐). 다만 이 작업이 손댄 영역에서 **함수명 `normalizeApiBase` 가 `codebase/channel-web-chat` 패키지 안에 두 벌 존재**하며, 하나(`demo-config.ts`, 기존)는 경로를 제거하고 다른 하나(`session-store.ts`, 이번 diff 도입)는 경로를 반드시 보존해야 하는 정반대 계약을 갖는다. 이는 이미 같은 세션의 코드 리뷰가 "향후 오인 가능"으로 독립 지적한 사안이고, DRY 통합(`stripTrailingSlash` 추출)은 이뤄졌지만 이름 충돌 자체는 남아 있다 — 향후 리팩터가 두 함수를 "같은 것"으로 오인해 통합하면 이번 diff 가 막으려던 cross-origin 토큰 유출 취약점이 재도입될 수 있어 CRITICAL 로 판단한다. 그 외 식별자(필드명 `apiBase`, 신규 공유 헬퍼 `stripTrailingSlash`)는 전 영역에서 의미가 일관되거나 앱 경계로 격리돼 실질 충돌이 없다.

## 위험도
MEDIUM

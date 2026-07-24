# 정식 규약 준수 검토 — spec/7-channel-web-chat/ (impl-done, diff: webchat apiBase 세션 바인딩)

## 검토 범위 메모

- 이번 diff(`origin/main...HEAD`)는 `codebase/channel-web-chat/src/lib/session-store.{ts,test.ts}`·
  `codebase/channel-web-chat/src/widget/use-widget.ts`·`use-widget-eager-start.test.ts`·`use-token-refresh.test.ts` 만
  변경한다 — **`spec/**` 파일 diff 는 0건**. 즉 이번 변경 자체가 신규 명명·출력 포맷·문서 구조를 도입하지 않는다
  (기존 `PersistedSession`에 `apiBase: string` 필드 1개 추가 + `loadSession` 시그니처에 필수 인자 추가).
- target 인 `spec/7-channel-web-chat/**`(0-architecture·1-widget-app·2-sdk·3-auth-session·4-security·
  5-admin-console·_product-overview) 은 **이미** `3-auth-session.md §3.1`에 `{executionId, token, expiresAt,
  endpoints, apiBase}` 스키마와 발급-origin 바인딩 근거를 명시해 두고 있어(이 diff 이전 시점 spec 서술과 diff 가
  기술하는 코드가 이미 정합), 이번 diff 만으로 인한 신규 spec 컨벤션 위반 표면은 확인되지 않았다.
- 프롬프트에 번들된 `spec/conventions/**` 발췌는 컨텍스트 예산 초과로 `audit-actions.md` + `cafe24-api-catalog`
  일부만 포함되고 **channel-web-chat 과 실제 관련 있는 컨벤션(`swagger.md`·`error-codes.md`·
  `interaction-type-registry.md`·`conversation-thread.md`·`frontend-layering.md`·`spec-impl-evidence.md`)은
  생략**되어 있었다. 해당 파일들은 대상 워크트리(`.claude/worktrees/webchat-apibase-binding-a14e68`)에서 직접
  절대경로로 열어 대조했다.

## 점검 관점별 결과

### 1) 명명 규약
- `PersistedSession.apiBase: string` — 이미 공개 계약으로 존재하는 `BootConfig.apiBase`([2-sdk §4](../../../../spec/7-channel-web-chat/2-sdk.md))와 동일 camelCase 이름을 그대로 재사용. 새 이름을 발명하지 않았다.
- `loadSession(triggerEndpointPath, expectedApiBase, storage?)` — 기존 위치 인자 순서·스타일과 일관.
- `spec/7-channel-web-chat/*.md` 6개 파일의 frontmatter `id:` 값(`web-chat-architecture`/`web-chat-widget-app`/`web-chat-sdk`/`web-chat-auth-session`/`web-chat-security`/`web-chat-admin-console`)은 전 spec 트리에서 유일함을 확인(중복 없음). `4-security.md`는 `id`가 basename(`4-security`)과 의도적으로 다른데, 그 사유(타 영역 `4-security` 슬러그 충돌 회피)를 인라인 YAML 주석으로 명문화해 두었고, 이는 [`spec-impl-evidence.md §2.1`](../../../../spec/conventions/spec-impl-evidence.md) 이 규정한 "basename 불일치는 의도된 패턴(영역 prefix 충돌 회피)" 예시와 정확히 부합한다. 위반 아님.
- `_product-overview.md`는 파일명이 언더스코어 prefix로 CLAUDE.md 규약(`spec/<영역>/_product-overview.md`)과 일치하고, `0-architecture.md`도 루트 cross-cutting 성격이 아니라 **영역 내부** 진입 문서(아키텍처)이므로 `0-` prefix 사용이 CLAUDE.md의 "cross-cutting 루트 문서만 0- prefix" 규정과 충돌하는지 확인했으나, 이는 영역별 번호 체계(0=아키텍처,1=위젯,2=SDK...)의 첫 문서일 뿐이며 다른 영역(`spec/5-system/0-overview.md` 등)과 동일 패턴이라 위반 아님.

### 2) 출력 포맷 규약
- diff가 다루는 `PersistedSession`은 **API 응답이 아니라 클라이언트 sessionStorage 내부 스키마**라 `swagger.md`/`error-codes.md`의 응답-wrapping·DTO 규약 적용 대상이 아니다.
- target spec 본문이 인용하는 API 출력 서술(`{ data: {...} }` 전역 wrap, `embed-config` 응답, `EXECUTION_NOT_FOUND`/`WEBCHAT_IDLE_TIMEOUT`/`STATE_MISMATCH` 등 에러 코드)을 [`swagger.md §2-5`](../../../../spec/conventions/swagger.md)·[`error-codes.md §1`](../../../../spec/conventions/error-codes.md)과 대조한 결과 — 응답 wrap 서술, `UPPER_SNAKE_CASE` 표기, 도메인 prefix(`WEBCHAT_*`) 사용 모두 규약과 일치. 위반 없음.

### 3) 문서 구조 규약
- `0-architecture.md`·`1-widget-app.md`·`2-sdk.md`·`3-auth-session.md`·`4-security.md`·`5-admin-console.md` 6개 파일 전부 `## Overview` → 번호 본문 → `## Rationale` 3섹션 구조를 준수.
- `_product-overview.md`는 리터럴 `## Overview` 헤더 대신 `## 1. 개요 / 문제`로 시작하는데, 이는 저장소 전역의 다른 `_product-overview.md`(`spec/2-navigation/`·`spec/3-workflow-editor/`·`spec/4-nodes/`·`spec/5-system/` 등)와 동일 패턴이며 끝에 `## Rationale`도 갖추고 있어 정상 컨벤션 준수(위반 아님, 오탐 방지 차원에서 명시).
- frontmatter 스키마(`id`/`status`/`code`)는 `status: implemented`인 6개 문서 모두 `code:` 글로브가 실제 파일에 매치함을 절대경로로 확인(`3-auth-session.md`의 4개 `code:` 경로 전부 실존). [`spec-impl-evidence.md §3`](../../../../spec/conventions/spec-impl-evidence.md) 의 `implemented` 상태 요건 충족.

### 4) API 문서 규약 (swagger/OpenAPI)
- 이번 diff는 신규 NestJS 컨트롤러·DTO를 추가하지 않는다(순수 프론트엔드 `channel-web-chat` 라이브러리 변경). `swagger.md`의 DTO 데코레이터·wrapping 규약이 적용될 신규 표면이 없음.
- target spec이 참조하는 기존 백엔드 표면(`embed-config-response.dto.ts`, `TransformInterceptor` wrap)에 대한 서술도 변경되지 않았다.

### 5) 금지 항목
- `spec/conventions/**`에서 명시적으로 금지하는 패턴(예: swagger.md의 "빈 껍데기 스키마", "닫힌 union을 additionalProperties로 뭉개기" 등)에 해당하는 신규 표면이 이번 diff/target 문서에 없음.
- `frontend-layering.md`의 계층 경계 규약은 `codebase/frontend/src/**`에만 적용되며(문서 §Overview 명시), `codebase/channel-web-chat/src/lib/session-store.ts`는 그 규약의 적용 범위 밖 — 이 diff에 오적용할 근거 없음(체크했으나 해당 없음, 오탐 방지 차원에서 명시).

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 신규 `pending_plans`/`plan/` cross-link 점검 여지
  - target 위치: 없음(신규 발견 아님, 사전 점검 기록)
  - 위반 규약: 해당 없음
  - 상세: 이번 diff는 `plan/**` 문서를 변경하지 않았고 target spec 6개 파일 모두 `status: implemented`(`pending_plans` 의무 없음)이므로 `spec-impl-evidence.md §3` lifecycle 관점에서 추가 조치 불필요함을 확인.
  - 제안: 없음(단순 확인 기록).

## 요약

이번 diff는 `codebase/channel-web-chat`의 세션 스토리지에 발급 `apiBase` 바인딩을 추가하는 순수 코드 변경으로, `spec/**` 파일을 전혀 건드리지 않는다. target 문서(`spec/7-channel-web-chat/**`)는 이미 이 필드·바인딩 동작을 §3.1에 서술해 두고 있었고, frontmatter(`id`/`status`/`code`) 스키마·문서 3섹션 구조(Overview/본문/Rationale)·`_product-overview.md`/`0-` prefix 명명·API 응답 wrap·에러 코드 표기 등 관련 정식 규약(`spec-impl-evidence.md`·`swagger.md`·`error-codes.md`·`interaction-type-registry.md`·`frontend-layering.md`)을 절대경로로 대조 확인한 결과 위반 사항을 찾지 못했다. 프롬프트에 번들된 컨벤션 발췌가 예산 초과로 관련성 낮은 cafe24 카탈로그 위주였고 정작 관련 있는 컨벤션 파일들이 생략돼 있었던 점은, 대상 워크트리에서 직접 열어 보완했다.

## 위험도
NONE

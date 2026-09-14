# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

1. `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) 을 Read.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 + "자주 누락되는 항목") 을 보조로 Read.
3. `git diff origin/main...HEAD --name-only` 로 이번 변경 set 전체 파일을 확인 (prompt 의 21개 파일 목록과 일치).
4. 각 파일을 매트릭스 왼쪽 trigger(glob/semantic) 에 매칭.

## 변경 파일 전수 (origin/main...HEAD)

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` / `.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts` / `.web-chat.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/repo-guards/__tests__/**` (정적 가드 3파일)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규)
- `plan/in-progress/trigger-config-lost-update.md`
- `review/code/**`, `review/consistency/**` (선행 리뷰 산출물)

frontend(`codebase/frontend/**`), `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `*.controller.ts`, `dto/**`, `spec/**` — 어디에도 변경이 없다.

## 매트릭스 매칭 검토

이번 변경은 트리거(webhook) 엔티티의 `config` JSONB 컬럼에 대한 **동시 쓰기 lost-update 를 advisory lock 으로 닫는 서비스/영속성 계층 버그 수정**이다. 아래 후보 trigger 를 개별 검토했다.

- **`new-node` / `node-schema-change`** (glob `codebase/backend/src/nodes/**`) — 미매칭. 변경 파일은 `modules/triggers`, `modules/hooks` 아래에 있고 `src/nodes/**` (워크플로 노드 타입 구현) 는 건드리지 않았다. 트리거 엔티티(DB 모델)와 노드 카탈로그는 서로 다른 디렉터리다.
- **`new-ui-string` / `new-widget-chrome-string`** — 미매칭. `*.tsx` / `channel-web-chat/**` 변경 0건.
- **`integration-provider-change`** (semantic, target: `06-integrations-and-config/<provider>.{mdx,en.mdx}`) — 검토했으나 미매칭으로 판단. `chat-channel-binder.service.ts`·`hooks.service.ts` 가 다루는 것은 이미 존재하는 chat-channel provider 의 웹훅 서명 검증 **내부 동시성 처리**이며, 사용자가 겪는 provider 연동 절차(필드·설정 화면·문서에 적힌 단계)는 이 PR 로 전혀 바뀌지 않는다. 새 provider 추가도, 기존 provider 의 사용자 대면 설정 항목 변경도 없다 — `review/code/2026/09/14/18_17_44/api_contract.md` 가 이미 "컨트롤러·DTO·라우트 정의는 일절 건드리지 않았다" 를 확인했다.
- **`auth-session-flow-change`** (glob `codebase/backend/src/modules/auth/**`, target: `07-workspace-and-team/`) — 미매칭. `chatChannel.inboundSigningRef` 는 **인입 웹훅 서명 검증**(provider→우리 서버) 이지 워크스페이스 로그인·팀 초대·권한·세션(사용자→우리 앱) 흐름이 아니다. `modules/auth/**` 파일은 diff 에 전혀 등장하지 않는다.
- **`new-warning-code` / `new-error-code`** — 미매칭. `warningRules`, `error-codes.ts` 변경 없음.
- **`expression-language-change`** — 미매칭. `packages/expression-engine/**` 변경 없음.
- **`run-debug-flow-change`** (semantic, target `05-run-and-debug/`) — 미매칭. `engine.execute()` 호출 자체는 그대로이고, 바뀐 것은 트리거 실행 **이후** `lastTriggeredAt` 을 기록하는 방식(`save()` 전체 저장 → `update()` 컬럼 한정)뿐이다. 실행 엔진의 동작·디버그 로깅·사용자가 보는 실행 흐름에는 영향이 없다.
- **`new-userguide-section-dir`**, **`backend-api-change`**, **`new-bullmq-queue`**, **`new-cross-cutting-enum`**, **`new-backend-ui-zod-value`**, **`new-handler-output-field`**, **`auth-config-type-enum-change`**, **`spec-major-change`**, **`userguide-gui-flow-section`** — 전부 trigger 글로브/의미가 이번 diff 와 무관 (해당 디렉터리·엔티티·enum 자체가 변경 set 에 없음).

## i18n / backend-labels 개별 점검

- 신규 TSX 문자열: 0건 (frontend 변경 없음) → parity 가드 대상 없음.
- 신규 warningCode/errorCode: 0건 → `WARNING_KO`/`ERROR_KO` 매핑 불요.
- 신규 zod `ui.label/hint/group`: 0건.

## 결론

이번 변경 set 은 코드 리뷰 관점(동시성·DB·아키텍처)에서는 실질적인 수정이지만, **유저 가이드 동반 갱신 매트릭스의 어떤 trigger 에도 매칭되지 않는다** — 사용자에게 노출되는 노드 카탈로그·문서·i18n 사전·backend-labels·워크스페이스 가이드·표현식 언어 문서·실행/디버깅 문서 중 어느 것도 이 PR 이 바꾸는 표면과 겹치지 않는다. 순수 내부 동시성 버그 수정(advisory lock + 락 안 재읽기)이며 API 계약·UI 문구·에러 코드·provider 설정 절차 모두 불변이다.

## 발견사항

없음 — 해당 없음.

## 요약

매트릭스 21개 trigger 행을 전수 검토했으나 이번 변경(`modules/triggers`·`modules/hooks`·`repo-guards` 내부 동시성 버그 수정, frontend/docs/i18n/spec 변경 0건) 과 매칭되는 trigger 가 없어 동반 갱신 누락도 0건이다.

## 위험도

NONE

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — trigger-config-lost-update

## 검토 범위

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) 을 SSOT 로 적재했고, `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인했다. 변경 파일 전수는 `git diff --name-only origin/main...HEAD` 로 재확인했다 (orchestrator 가 넘긴 목록과 일치):

- `CHANGELOG.md`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규, 테스트 유틸)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` (신규)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts`
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규 e2e)
- `plan/in-progress/trigger-config-lost-update.md`
- `review/code/2026/09/14/18_17_44/**` (직전 라운드 리뷰 산출물, 코드 아님)
- `review/consistency/2026/09/14/17_10_16/**` (consistency 산출물, 코드 아님)

## trigger 매칭 분석

이번 변경은 `codebase/backend/src/modules/triggers/` 안의 `trigger.config`(JSONB) 재작성 동시성 결함(lost-update로 인한 `chatChannel.inboundSigningRef` 유실 → 인입 웹훅 서명 검증 fail-open) 을 advisory lock + 락 안 재읽기로 막는 서비스/영속성 계층 수정이다. 매트릭스 21개 행을 전수로 대조했다.

- **new-node** (`codebase/backend/src/nodes/**`) — 미매칭. 변경 경로는 `src/modules/triggers/`(트리거 CRUD·채널 바인딩 서비스)이지 `src/nodes/`(워크플로 노드 구현) 가 아니다.
- **node-schema-change** — 미매칭 (동일 사유).
- **new-ui-string** (`codebase/frontend/src/**/*.tsx`) — 미매칭. frontend 파일 변경 0건.
- **new-widget-chrome-string** — 미매칭. `channel-web-chat` 변경 0건.
- **integration-provider-change** — 미매칭. slack/discord 등 채널 provider adapter(`setupChannel` 내부) 자체는 건드리지 않았고, 그 결과를 담는 config 재작성 배선만 바뀌었다.
- **new-userguide-section-dir** — 미매칭. `content/docs/` 변경 0건.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 미매칭. `git diff` 확인 결과 controller·DTO 파일 변경 없음. 같은 changeset 안의 `api_contract.md` 리뷰(이미 존재)도 "컨트롤러·DTO·라우트 정의는 일절 건드리지 않았다" 로 독립 확인.
- **new-bullmq-queue** — 미매칭.
- **new-warning-code / new-error-code** — 미매칭. `warningRules`, `error-codes.ts` 변경 없음.
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 미매칭. zod ui 스키마·output 필드 변경 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 미매칭. 변경 경로는 `src/modules/triggers/` 이지 `src/modules/auth/` 가 아니다. 트리거의 `inboundSigningRef`(웹훅 인입 서명)는 "세션·로그인 인증" 이 아니라 채널 어댑터(slack/discord/webchat 등)의 웹훅 서명 검증 키이며, 07-workspace-and-team(워크스페이스·팀 멤버십) 문서 영역과도 무관하다.
- **auth-config-type-enum-change** — 미매칭.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** — 미매칭. `05-run-and-debug/` 는 실행 엔진의 실행/디버그 로깅 흐름을 다루는데, 이번 수정은 트리거 config 저장 동시성이라 실행 엔진 자체나 디버그 로깅 표면과는 무관하다.
- **env-runtime-change** — 미매칭.
- **spec-major-change** (`spec/2-*` ~ `spec/conventions/**`) — 미매칭. `spec/` 파일 변경 0건(단, 본문 JSDoc 이 `spec/2-navigation/4-integration.md` 의 Cafe24 advisory-lock 기각 선례를 **참조**만 할 뿐 그 문서를 수정하지 않는다).
- **userguide-gui-flow-section** — 미매칭.
- **spec-defect-found** — 해당 없음(발견된 spec 결함 없음).

## 발견사항

없음. 이번 변경은 매트릭스의 어떤 trigger 에도 매칭되지 않는다 — `codebase/backend/src/modules/triggers/`(노드 구현이 아닌 트리거 CRUD/채널 바인딩 서비스)의 내부 동시성 버그 수정이며, 신규 노드·노드 schema 변경·신규 UI 문자열·통합 provider 변경·신규 섹션 디렉토리·인증/세션 흐름 변경·표현식 언어 변경·실행/디버깅 흐름 변경·신규 warning/error code 발행 중 어느 것도 아니다. `CHANGELOG.md` 갱신(사용자 대상 변경 로그)은 이미 이 PR 안에 포함되어 있다.

## 요약

매트릭스 21개 trigger 전수를 대조한 결과 매칭 0건 — 이번 changeset(트리거 `config` JSONB lost-update 를 advisory lock + 락 안 재읽기로 막는 백엔드 서비스/영속성 계층 수정, 프런트엔드·docs·i18n·spec 파일 변경 0건)은 유저 가이드 동반 갱신 관점에서 해당 없음이다.

## 위험도

NONE

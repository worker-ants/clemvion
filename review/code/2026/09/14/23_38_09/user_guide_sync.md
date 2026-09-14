# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- `.claude/config/doc-sync-matrix.json` (rows: 21) Read 완료.
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 은 보조로 참고(동일 spine).

## 변경 파일 식별
`git diff origin/main...HEAD --stat` 기준 실제 코드 변경 set (review/ 하위 산출물 제외, 이전
라운드 리뷰 output 이므로 본 리뷰 대상 아님):

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.{ts,spec.ts}`
- `codebase/backend/src/modules/schedules/schedules.service.{ts,spec.ts}`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.{ts,spec.ts}`
- `codebase/backend/src/modules/triggers/trigger-config-lock.{ts,spec.ts}` (신규)
- `codebase/backend/src/modules/triggers/triggers.service.{ts,spec.ts}`
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/**` (정적 AST 가드 + fixture, harness 내부)
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `plan/in-progress/trigger-config-lost-update.md` (`spec_impact: none`)

## trigger 매칭 검토

전 파일을 매트릭스 21행에 대조했다.

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 파일 전무. 미매칭.
- **new-ui-string / new-widget-chrome-string** — `codebase/frontend/**`, `codebase/channel-web-chat/**` 변경 0건. 미매칭.
- **integration-provider-change** (semantic) — `chat-channel-binder.service.ts`·`chat-channel-input-rules.ts` 가 채널(Slack/Discord 등) 셋업 코드를 건드리지만, **사용자가 보는 설정 흐름·필드는 변경되지 않는다** — 요청 시작 시점 스냅샷 대신 advisory lock 안에서 `config` 를 다시 읽어 병합하는 내부 동시성 수정뿐이다. provider 신규 추가·옵션 변경 없음. 미매칭.
- **new-userguide-section-dir** — `content/docs/**` 변경 0건. 미매칭.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 해당 파일 변경 0건. 미매칭.
- **new-warning-code / new-error-code** — `warningRules`·`error-codes.ts` 변경 0건. 미매칭.
- **new-backend-ui-zod-value / new-handler-output-field / new-cross-cutting-enum** — 해당 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 변경 파일이 `modules/triggers`·`hooks`·`schedules` 이고 `modules/auth/**` 는 건드리지 않는다. `chatChannel.inboundSigningRef`(웹훅 인입 서명 검증)는 로그인/세션/워크스페이스 권한 흐름이 아니라 트리거별 웹훅 서명 검증 설정이며, 이 PR 은 **그 기존 보장을 동시성 버그로부터 지키는 수정**이지 흐름 자체를 바꾸지 않는다(사용자에게 보이는 설정 UI·문서 내용 변경 없음). 07-workspace-and-team 문서가 다루는 로그인/팀 권한 흐름과는 다른 층. 미매칭으로 판단(그레이존 — 아래 INFO 참고).
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 변경 0건. 미매칭.
- **run-debug-flow-change** (semantic) — `engine.execute(...)` 호출부는 그대로이고 실행 엔진·디버그 로깅 자체는 변경되지 않는다. 미매칭.
- **spec-major-change** (`spec/2-*`~`spec/conventions/**`) — `spec/` 변경 0건. plan frontmatter 도 `spec_impact: none` 으로 일치. 미매칭.
- **userguide-gui-flow-section** (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) — 미매칭.
- **new-bullmq-queue / auth-config-type-enum-change / env-runtime-change / spec-defect-found** — 전부 미매칭.

## 발견사항

- **[INFO]** `modules/auth/**` 외부에서 발생한 웹훅 서명 검증(`inboundSigningRef`) 관련 수정이 매트릭스 auth-session-flow-change 행과 표면적으로 인접
  - 변경 파일: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `codebase/backend/src/modules/triggers/triggers.service.ts`
  - 매트릭스 항목: `auth-session-flow-change` — targets: "codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"
  - 누락된 동반 갱신: 없음(판단) — 이 PR 은 기존 웹훅 서명 검증 보장을 동시성 버그(lost update)로부터 지키는 내부 수정이며, `07-workspace-and-team/` 이 다루는 로그인·팀 권한 흐름과 무관하고 사용자가 보는 채널 설정 UI/문서 내용도 바뀌지 않는다.
  - 상세: `modules/auth/**` glob 자체는 매칭되지 않으나, "인증" 이라는 단어가 겹쳐 회색지대로 기록해 둔다. e2e 보강은 이미 `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` 로 커버됨(단 이는 `05-run-and-debug` 류가 아니라 backend jest e2e).
  - 제안: 별도 조치 불요. 후속 세션에서 웹훅 서명/채널 설정 UI 자체가 바뀌는 PR 이 나오면 그때 07-workspace-and-team 또는 06-integrations-and-config 동반 갱신 여부를 재판정.

## 요약
매트릭스 21개 trigger 중 이번 changeset 과 매칭되는 행은 **0건**이다. 전 변경(`CHANGELOG.md` + backend `modules/{hooks,schedules,triggers}` + `repo-guards` 정적 가드 + e2e/unit spec + `plan/in-progress/`)은 `trigger.config` 동시 PATCH lost-update 를 advisory lock + 컬럼 한정 `update` 로 닫는 순수 백엔드 동시성/데이터 무결성 버그 수정이며, 신규 노드·UI 문자열·통합 provider·문서 섹션·표현식 언어·실행 엔진·warning/error code·auth 모듈·spec 변경이 전무해 유저 가이드 동반 갱신 매트릭스의 어떤 trigger 도 발동하지 않는다. `plan/in-progress/trigger-config-lost-update.md` 의 `spec_impact: none` 도 이와 일치한다.

## 위험도
NONE

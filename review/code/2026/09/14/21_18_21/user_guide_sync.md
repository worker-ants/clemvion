# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(표 + "자주 누락되는 항목")을 Read 했다.

## 변경 파일 전수 (`git diff origin/main...HEAD --name-only`)

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts`, `hooks.service.spec.ts`
- `codebase/backend/src/modules/triggers/{chat-channel-binder.service.ts, chat-channel-input-rules.ts, chat-channel-input-rules.spec.ts, trigger-config-lock.ts, trigger-config-lock.spec.ts, triggers.service.ts, triggers.service.spec.ts, triggers.web-chat.spec.ts, __test-utils__/trigger-transaction-mock.ts}`
- `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts, endpoint-path-conflict-wrap.spec.ts, fixtures/endpoint-path-save.fixture.ts}`
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `plan/in-progress/trigger-config-lost-update.md`
- `review/code/**`, `review/consistency/**` (선행 리뷰 산출물 — 코드 아님)

frontend/`spec/`/`README.md`/`codebase/packages/**` 변경 0건.

## 매칭 판정

매트릭스 21개 trigger 를 전수 대조했다.

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 파일 없음. 불일치.
- **new-ui-string / new-widget-chrome-string** (frontend·channel-web-chat `*.tsx`) — 변경 없음. 불일치.
- **integration-provider-change** — provider 관련 코드 변경 없음 (chat-channel adapter 자체가 아니라 그 config 를 쓰는 서비스 계층 락킹만 변경). 불일치.
- **new-userguide-section-dir** (`content/docs/*/`) — 변경 없음. 불일치.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 컨트롤러·DTO 변경 없음 (선행 리뷰 `api_contract.md` 도 동일 결론: "컨트롤러·DTO·라우트 정의는 일절 건드리지 않았다"). 불일치.
- **new-bullmq-queue** — `system-status.constants.ts` 변경 없음. 불일치.
- **new-warning-code / new-error-code** — `warningRules`·`error-codes.ts` 변경 없음. 불일치.
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 패턴 변경 없음. 불일치.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — glob 자체가 불일치(변경은 `modules/triggers`·`modules/hooks`). semantic 판단으로도: 이번 변경은 **사용자 로그인/세션/워크스페이스 멤버 권한**이 아니라 **외부 웹훅 인입 서명 검증**(`chatChannel.inboundSigningRef`)의 lost-update 를 advisory lock 으로 막는 것이다. 매트릭스가 이 trigger 에 대해 지목하는 대상(`07-workspace-and-team/` — 워크스페이스/팀/초대/역할 안내)과 웹훅 서명 키 보존은 다른 층의 개념이라 판단을 semantic 불일치로 내렸다. (그레이존으로 인지했음을 기록 — 근거는 대상 문서 성격의 불일치.)
- **auth-config-type-enum-change** — `AuthConfig.type` enum 변경 없음. 불일치.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 변경 없음. 불일치.
- **run-debug-flow-change** — 실행 엔진(`ExecutionEngineService`) 자체나 디버그 로깅 변경 없음. `handleWebhook` 이 `engine.execute()` 를 호출하는 지점은 그대로이고, 바뀐 것은 그 앞뒤의 `config` 쓰기 원자성뿐이다. 불일치.
- **env-runtime-change** — 환경변수·기동 방법 변경 없음. 불일치.
- **spec-major-change / userguide-gui-flow-section / spec-defect-found** — `spec/**` 변경 0건. 불일치.

전 21개 trigger 중 매칭되는 것이 없다.

## 발견사항

없음 — 해당 없음.

## 요약

이번 변경 set 은 `modules/triggers`·`modules/hooks`·`repo-guards`(정적 가드) 내부에 국한된 순수 concurrency/lost-update 버그 수정(advisory lock + 락 안 재읽기, `save()`→`update()` 컬럼 한정화, 정적 가드의 `manager.transaction` 콜백 추적 보강)과 그에 딸린 테스트·CHANGELOG·plan 갱신이다. `codebase/frontend/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`, `spec/**` 어디에도 변경이 없어 doc-sync-matrix 의 21개 trigger 중 매칭되는 것이 없다(글로브 매칭 0 / semantic 판단도 0 — `auth-session-flow-change` 는 대상 문서 성격이 달라 불일치로 판단). 유저 가이드 동반 갱신 관점에서 누락은 0건이며, 선행 리뷰 라운드(`review/code/2026/09/14/20_49_15/user_guide_sync.md`)의 동일 결론과도 일치한다.

## 위험도

NONE

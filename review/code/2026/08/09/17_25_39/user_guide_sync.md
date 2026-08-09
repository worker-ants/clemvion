# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]` 22건, id: `new-node` ~ `spec-defect-found`) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 119-190) 을 Read 했다.

## 변경 파일 목록 (24개, `_prompts/user_guide_sync.md` 전체 확인)

1. `.claude/tests/README.md` — 신규 test 행 문서화
2. `.claude/tests/test_backend_typecheck_ratchet.py` — 신규 harness 테스트
3. `.claude/tests/test_required_check_skip_jobs.py` — `CONVERTED` 목록에 `backend-checks.yml` 추가
4. `.claude/tests/test_workflow_yaml_structure.py` — 레지스트리 3곳(`if:` 조건, `_SKIP_JOB_WORKFLOWS`, `_PULL_REQUEST_KEYS`) 갱신
5. `.github/workflows/backend-checks.yml` — 신규 워크플로 (lint/unit/typecheck-ratchet)
6. `.github/workflows/harness-checks.yml` — `paths:` 필터에 신규 스크립트/baseline 등재
7. `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.spec.ts` — 테스트 인자 정합(TS2554) 수정
8. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 목 타입 시그니처 정합(4번째 인자 `opts`) 수정
9. `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` — 누락 인자(8번째, `workspacesService`) 보강
10. `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.spec.ts` — 누락 인자(8번째, `cafe24RefreshQueue`) 보강
11. `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` — `deleteByPrefix` LIKE 메타문자 거부 신규 테스트
12. `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` — `deleteByPrefix` 에 LIKE 메타문자(`% _ \`) 거부 가드 추가 (내부 안전장치, plain `throw new Error(...)`)
13. `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — 누락 import(`SaveCanvasDto`, TS2304) 수정
14. `plan/in-progress/backend-lint-gate-broken-on-main.md` — plan 체크박스 갱신
15-22. `review/consistency/2026/08/09/16_45_26/*` — 직전 consistency-check 산출물(리뷰 대상 아님, 메타)
23. `scripts/backend-typecheck-baseline.json` — 신규 ratchet baseline
24. `scripts/check-backend-typecheck-ratchet.py` — 신규 ratchet 스크립트

## 매트릭스 trigger 매칭 검토

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. `codebase/backend/src/nodes/**` 아래 변경 파일 0건 (workflows.service.spec.ts 가 `node-component.registry` 를 import 하지만 해당 경로 자체를 변경하지 않음).
- **신규 UI 문자열 (TSX)** — 매칭 없음. `codebase/frontend/src/**/*.tsx` 변경 0건.
- **신규 위젯 chrome 문자열** — 매칭 없음. `codebase/channel-web-chat/**` 변경 0건.
- **통합 신규/제공자 변경** — 매칭 없음. slack/chat-channel·integrations 관련 파일이 있지만 전부 `*.spec.ts`(테스트 인자 정합)뿐이고 provider 동작·설정 UI 변경 아님.
- **유저 가이드 신규 섹션 디렉토리** — 매칭 없음. `codebase/frontend/src/content/docs/*/` 변경 0건.
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — 매칭 없음.
- **신규 BullMQ 큐 추가** — 매칭 없음. `system-status.constants.ts` 변경 0건.
- **신규 warningCode/errorCode 발행** — 매칭 없음. `codebase/backend/src/nodes/core/error-codes.ts` 변경 0건. `secret-resolver.service.ts` 의 신규 guard 는 plain `throw new Error(...)` 이며 `ErrorCode` enum·`warningRules` 시스템 밖의 내부 불변식 가드다(triggers.service.ts 내부 호출 경로에서만 쓰이고, 정상 호출부는 UUID 라 메타문자가 섞일 수 없어 실질적으로 트리거되지 않는 방어 코드). 사용자에게 영문 그대로 노출되는 시나리오가 아니다.
- **인증·권한·세션 흐름 변경** — 매칭 없음. `codebase/backend/src/modules/auth/**` 변경 0건.
- **표현식 언어 변경** — 매칭 없음. `codebase/packages/expression-engine/**` 변경 0건.
- **실행·디버깅 흐름 변경** — 매칭 없음. `execution-engine.service.spec.ts` / `executions-rerun.service.spec.ts` 는 **테스트 파일의 목(mock) 타입 시그니처만** 프로덕션 실제 시그니처에 맞춰 정합화한 것으로, 프로덕션 실행 엔진 로직(`execution-engine.service.ts` 등) 자체는 이번 diff 에 없다. 실행 흐름의 실제 동작 변경이 아니라 "테스트가 프로덕션 타입과 어긋나 있던 stale drift 를 잡은 것"이므로 사용자 가시 실행/디버깅 경험에 영향 없음.
- **환경 변수·기동 방법·런타임 변경** — 매칭 애매 (회색지대) — CI 워크플로(`backend-checks.yml`) 신설은 "런타임"이 아니라 빌드/CI 인프라이며, README.md 가 다루는 "제품 최종 상태(기동 방법)" 범주가 아니다. 필수 갱신 아님으로 판단.

## 발견사항

(없음 — 매칭된 trigger 없음)

이번 변경 set 은 (1) `.claude/tests/**` + `.github/workflows/**` 하버니스/CI 인프라(backend CI 게이트 신설), (2) backend `*.spec.ts` 5개의 **테스트 전용** 타입 정합 수정(TS2554/TS2304, 프로덕션 로직 변경 없음), (3) `secret-resolver.service.ts` 의 내부 방어 가드 1건(공개 API·에러코드 체계 밖), (4) plan/review 메타 문서로 구성된다. 매트릭스 22개 행 중 어느 것도 이 변경 set 의 파일들과 매칭되지 않는다 — 노드/UI/i18n/docs/provider/auth/expression-engine/run-debug 표면을 건드리는 파일이 하나도 없다.

## 요약
매트릭스 22개 trigger 행을 전수 대조한 결과 매칭된 trigger 0건, 따라서 누락도 0건이다. 이번 변경은 backend CI 게이트 신설(신규 `backend-checks.yml` 3잡: lint/unit/typecheck-ratchet)과 그로 인해 드러난 `*.spec.ts` 타입 drift 5건의 정합 수정 + `secret-resolver.deleteByPrefix` 내부 안전 가드 1건으로, 전부 harness/CI/테스트 인프라 또는 사용자 비가시 내부 코드 범주이며 유저 가이드(docs MDX)·i18n dict·backend-labels·locale.ts 어느 것도 이 turn 에서 동반 갱신 대상이 아니다.

## 위험도
NONE

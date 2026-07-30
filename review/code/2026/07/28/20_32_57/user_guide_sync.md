# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — retry_last_turn 재진입 원자 claim (#10 동반)

대상 커밋: `b351731f0` (`fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체`)
대상 파일 (`git diff --name-only HEAD~1 HEAD` 로 실제 변경 fileset 대조 완료):
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
- (리뷰 payload 밖, 참고: `execution-engine.service.spec.ts`, `spec/5-system/4-execution-engine.md`, `plan/in-progress/*.md` 2건 — 모두 spec/plan 계열이라 본 리뷰어 영역 밖)

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(116-144행) 본문을 함께 Read 함.

## 매칭 분석

변경 fileset 4개 파일을 21개 trigger 행 전체와 대조:

| trigger id | glob/semantic | 매칭 여부 |
| --- | --- | --- |
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 불일치 — 대상 파일은 `modules/execution-engine/`, `nodes/` 아님 |
| new-ui-string / new-widget-chrome-string | `*.tsx` | 불일치 — TSX 파일 없음 |
| integration-provider-change | semantic | 불일치 — provider 관련 코드 없음 |
| new-userguide-section-dir | docs 디렉토리 | 불일치 — docs 파일 없음 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 |
| new-bullmq-queue | `system-status.constants.ts` | 불일치 — 신규 `@Processor`/큐 등록 아님(기존 `ContinuationExecutionProcessor` 로직 수정) |
| new-warning-code / new-error-code | semantic / `error-codes.ts` | 불일치 — `error-codes.ts` 미변경, 신규 enum 값 없음. `RetryLastTurnError.notFound/notRetryable/tooEarly` 호출은 모두 기존 코드 재사용 |
| new-cross-cutting-enum | semantic | 불일치 — 신규 enum 값 없음 |
| new-backend-ui-zod-value | semantic | 불일치 |
| new-handler-output-field | semantic | 불일치 — `outputData`/`inputData` 는 내부 `_retryState` 키 조작(제거)일 뿐 신규 `output.result.*` 키 아님 |
| auth-session-flow-change | `modules/auth/**` | 불일치 |
| auth-config-type-enum-change | semantic | 불일치 |
| expression-language-change | `packages/expression-engine/**` | 불일치 |
| **run-debug-flow-change** | semantic (glob 없음) | **그레이존 — 아래 상세 검증** |
| env-runtime-change | semantic | 불일치 — 신규 env var/기동 방법 없음 |
| spec-major-change / userguide-gui-flow-section | glob/semantic | 불일치 — 본 리뷰 payload 안엔 spec/docs mdx 파일 없음 |

## 발견사항

- **[INFO]** "실행·디버깅 흐름 변경" (semantic trigger, `run-debug-flow-change`) 그레이존 검토 — 검증 결과 사용자 가시 흐름 불변, docs 갱신 불요로 판정
  - 변경 파일: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (310-339행 `ATOMIC CLAIM` 신설 블록, `applyRetryLastTurn`), `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (83-92행 주석 정정)
  - 매트릭스 항목: `run-debug-flow-change` — trigger 는 `{ "globs": [], "match": "semantic" }` (glob 없음, 의미 판단 필요). targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: 이 커밋은 `execution-engine` 모듈 내부의 `retry_last_turn` 재진입 가드를 read-then-branch(비원자) 에서 조건부 UPDATE 원자 claim 으로 교체하는 **동시성 버그 수정**이다. "실행 엔진" 코드를 건드린다는 점에서 표면적으로 `run-debug-flow-change` semantic trigger 와 유사해 보여 직접 검증했다:
    - `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`(+`.en.mdx`) 는 이미 재시도 흐름을 상세 문서화하고 있다 — [다시 시도] 버튼 등장 조건, 60분 재시도 윈도우, `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 에러 코드 표, "재시도가 성공하면 AI 노드 다음에 연결된 노드가 일반 실행과 동일하게 이어서 실행돼요"(downstream 계속 진행) 서술까지 포함.
    - 이번 커밋은 이 중 **어느 것도 바꾸지 않는다** — 응답 계약(`{ spawnedNodeExecutionId }`), 에러 코드 4종, 60분 TTL 판정 로직, downstream graph 진행 여부(`resumeGraphAfterRetry`) 모두 그대로다. 변경 대상은 오직 "동시에 두 BullMQ delivery 가 같은 spawn row 를 재진입 시도할 때 하나만 통과시키는" 내부 원자성 보장 — 사용자가 정상 경로에서 관측 가능한 차이는 없다(버그가 있었을 때조차 "중복 실행 가능성"은 문서화된 기대 동작이 아니라 결함이었으므로, 고쳤다고 문서를 바꿀 대상도 아니다).
    - `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY` 는 `codebase/backend/src/nodes/core/error-codes.ts`(`ErrorCode` enum, 신규 발행 시 `backend-labels.ts` `ERROR_KO` 매핑 대상)가 아니라 별도 클래스 `RetryLastTurnError`(`workflow-errors.ts`, 본 diff 밖) 소속이며, frontend 는 `codebase/frontend/src/lib/websocket/use-execution-interaction-commands.ts` 에서 전용 처리한다 — 이 파일도 본 diff 밖. 즉 이 3개 코드는 이번 PR 이전부터 존재했고 이번 PR 로 추가/변경되지 않았다.
    - 참고로 developer 는 같은 커밋에서 `spec/5-system/4-execution-engine.md` (§4.2 각주, §7.4 Worker 동시성 셀, §7.5 Rationale 신설) 를 이미 갱신했다(`git show HEAD --stat` 로 확인, 49줄 변경) — 이는 기술 spec SoT 동반 갱신이며 본 user-guide-sync 리뷰어의 영역(`codebase/frontend/src/content/docs/**`, dict, backend-labels)과는 별도 축이다.
  - 결론: 이 grey-zone 은 실제 갭이 아니다. 매칭 판정 없음.

## 요약

매트릭스 21개 trigger 행 전체를 실제 변경 fileset(`git diff --name-only HEAD~1 HEAD` 로 확정한 4개 backend 파일 — nodes/**, frontend/**, auth/**, expression-engine/**, error-codes.ts, system-status.constants.ts 등 어떤 glob 도 불일치)과 대조한 결과, glob 기반 trigger 는 전부 불일치했고 유일한 semantic 그레이존(`run-debug-flow-change`, execution-engine 내부 변경이라는 표면적 유사성)도 `05-run-and-debug/run-results.mdx`+`.en.mdx` 의 기존 재시도 서술(에러 코드 3종·60분 윈도우·downstream 계속 진행)이 이번 원자성 버그 수정으로 전혀 달라지지 않음을 직접 대조해 배제했다. 이번 변경은 노드 신규/schema 변경, 신규 UI 문자열, 통합/제공자 변경, 신규 docs 섹션, 인증·세션 흐름, 표현식 언어, 신규 warning/error code 어느 카테고리에도 해당하지 않는 순수 backend 동시성 내부 수정이다. 동반 갱신 누락 0건.

## 위험도

NONE

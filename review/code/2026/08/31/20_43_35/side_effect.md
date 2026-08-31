# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/backend/src/nodes/core/error-codes.ts` — 신규 `EngineErrorCode` const + `EngineErrorCodeValue` 타입 추가
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `ErrorCode.LLM_RATE_LIMIT`/`ErrorCode.LLM_CALL_FAILED` 리다이렉트(4지점)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `EngineErrorCode.WEBCHAT_IDLE_TIMEOUT`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT` 리다이렉트
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `EngineErrorCode.SERVER_INTERRUPTED` 리다이렉트 ×2
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}` (신규) — 재발 방지 AST 가드
- `plan/complete/exec-intake-followups.md`(신규) / `plan/in-progress/exec-intake-followups.md`(삭제) — plan lifecycle 이동
- `CHANGELOG.md` — 변경 이력 항목 추가(직전 라운드 WARNING 반영분)
- `review/code/2026/08/31/20_27_29/*` — 직전 라운드(1라운드) 리뷰 산출물 그 자체(신규 파일). 코드 부작용 관점에서는 실행 경로 없는 정적 문서/JSON

본 라운드는 직전 라운드(`20_27_29`)의 fan-out 산출물이 이미 포함된 총 diff 를 대상으로 하므로, 직전 `side_effect.md`(위험도 NONE)가 이미 다룬 항목을 실제 소스(`Read`/`grep`)로 재검증하고 그 위에 신규 확인 사항만 추가한다.

## 발견사항

- **[INFO]** 리다이렉트된 9지점 전부 원본 리터럴과 값이 정확히 일치함(직접 대조 재검증)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`EngineErrorCode` 블록, `WEBCHAT_IDLE_TIMEOUT`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`), `ai-turn-orchestrator.service.ts` (`ErrorCode.LLM_RATE_LIMIT`/`LLM_CALL_FAILED` 4지점), `execution-engine.service.ts:1147,2873,3336`, `shutdown-state.service.ts:194,222`
  - 상세: `EngineErrorCode`/`ErrorCode` 모두 `KEY: 'KEY'` 자기거울 패턴으로, 대체 전 맨 문자열과 1:1 일치를 `Read` 로 재확인했다. `Execution.error.code`/`NodeExecution.error.code` 는 DB 영속값이자 FE·알림·chat-channel 분류기가 값으로 분기하는 계약이므로, 리다이렉트 과정에서 값이 한 글자라도 달라지면 그 자체가 breaking 회귀가 된다 — 이번 diff 는 그런 드리프트가 없다.
  - 제안: 조치 불필요 — 확인 목적의 기록.

- **[INFO]** 신규 public export(`EngineErrorCode`, `EngineErrorCodeValue`) — 표면 확장은 barrel 재수출 없이 국소적
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts` (`export const EngineErrorCode` / `export type EngineErrorCodeValue`)
  - 상세: `nodes/core/index.ts` 에 `error-codes` 재수출이 없음을 `grep` 으로 재확인했다 — 이 파일을 직접 import 하는 3개 소비 파일(engine-execution.service, shutdown-state.service, ai-turn-orchestrator.service) 밖으로 인터페이스가 넓어지지 않는다. 순수 추가(additive)이며 기존 `ErrorCode`/`ErrorCodeValue` export 는 그대로다.
  - 제안: 조치 불필요.

- **[INFO]** import 상대 경로 깊이 재검증 — 3개 파일 모두 정확
  - 위치: `ai-turn-orchestrator.service.ts:20`(`'../../nodes/core/error-codes'`), `execution-engine.service.ts:82`(`'../../nodes/core/error-codes'`), `shutdown-state.service.ts:11`(`'../../../nodes/core/error-codes'`)
  - 상세: `shutdown/` 서브디렉터리 파일만 한 단계 더 깊은 `../../../` 을 쓰고 있고, 이는 실제 디렉터리 구조(`modules/execution-engine/shutdown/`)와 일치한다. 순환 import·모듈 미해결로 인한 부팅 실패 위험 없음(경로를 직접 열어 확인).
  - 제안: 조치 불필요.

- **[INFO]** 신규 repo-guard 3파일은 파일시스템에 대해 read-only이며 테스트 실행 범위에만 한정
  - 위치: `engine-error-code-anchor-guard.ts` 의 `readDeclaredCodes`/`walkTsFiles`/`collectBoundCodes`(`fs.readFileSync`/`fs.readdirSync` 호출부)
  - 상세: `fs` 호출은 전부 읽기 전용이고 쓰기·삭제 API 는 사용하지 않는다. `codebase/backend/jest.config.ts` 의 `testRegex: '.*\.spec\.ts$'` 를 재확인했다 — `-guard.ts`/`-fixture.ts` (spec 아님)는 Jest 테스트 스위트로 수집되지 않으므로 별도 부작용이 없다. `nodes/core/index.ts` 등 프로덕션 barrel 에도 이 `__tests__/*` 파일 재수출이 없어(grep) 프로덕션 런타임 경로에 파일시스템 스캔이 섞여 들어갈 여지가 없다.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서 이동은 diff 표시상 delete+add 형태이나, git 은 rename 으로 인식함(재검증)
  - 위치: `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md`
  - 상세: 해당 파일을 만든 커밋(`adc4a3ff6`)을 `git show --stat -M` 으로 재조회한 결과 `.../exec-intake-followups.md | 71 ++++++-` 한 줄로 rename 탐지됨을 확인했다(RESOLUTION.md 의 기존 주장과 일치). 프로젝트 메모리의 "git mv + multi-pathspec add → 침묵 stale 커밋" 함정과는 다른 케이스임을 실제 커밋으로 재확인.
  - 제안: 조치 불필요.

- **[INFO]** 직전 라운드 WARNING(CHANGELOG 미갱신)이 실제로 반영됨
  - 위치: `CHANGELOG.md` `## Unreleased — 엔진 에러 코드가 반만 상수였다…`
  - 상세: side_effect 관점과는 직접 관련 없으나, 이번 라운드가 "이전 라운드 fix 반영 여부"를 재검토하는 성격이므로 기록. 문서 전용 변경으로 실행 부작용 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경은 엔진 레이어 에러 코드 4종과 AI-turn 레이어 2종(4지점)을 맨 문자열에서 `EngineErrorCode`/`ErrorCode` 상수 참조로 리다이렉트하는 순수 리팩터이며, 신규 `EngineErrorCode` const 추가·읽기 전용 AST 회귀 가드 3파일 신설·plan 문서 lifecycle 이동·CHANGELOG 갱신이 동반됐다. 대체된 9지점 전부 원본 문자열과 값이 정확히 일치함을 직접 대조로 재검증했으므로 DB 영속값·FE/알림 분기 계약에 드리프트가 없고, 신규 export 는 barrel 재수출이 없어 표면이 국소적이며, 신규 repo-guard 는 프로덕션 경로와 분리된 읽기 전용 테스트 코드다. 전역 상태·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 발행 로직은 어느 파일에서도 변경되지 않았다. plan 문서 이동은 git 이 rename 으로 인식하는 것을 재확인해 침묵 stale 커밋 우려가 해당하지 않는다. 부작용 관점에서 실질적 위험은 발견되지 않았다.

## 위험도

NONE

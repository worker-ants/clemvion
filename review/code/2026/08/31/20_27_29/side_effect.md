# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `ErrorCode.LLM_RATE_LIMIT`/`ErrorCode.LLM_CALL_FAILED` 리다이렉트
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `EngineErrorCode.WEBCHAT_IDLE_TIMEOUT`/`EngineErrorCode.EXECUTION_QUEUE_WAIT_TIMEOUT`/`EngineErrorCode.WORKER_HEARTBEAT_TIMEOUT` 리다이렉트
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `EngineErrorCode.SERVER_INTERRUPTED` 리다이렉트 ×2
- `codebase/backend/src/nodes/core/error-codes.ts` — 신규 `EngineErrorCode` const + `EngineErrorCodeValue` 타입 추가
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-fixture.ts` (신규), `engine-error-code-anchor-guard.ts` (신규), `engine-error-code-anchor.spec.ts` (신규) — 재발 방지 가드
- `plan/complete/exec-intake-followups.md` (신규) / `plan/in-progress/exec-intake-followups.md` (삭제) — plan lifecycle 이동

## 발견사항

- **[INFO]** 신규 public export 추가 (`EngineErrorCode`, `EngineErrorCodeValue`)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:140`(`export const EngineErrorCode`), `:166`(`export type EngineErrorCodeValue`)
  - 상세: 순수 추가(additive)이며 기존 `ErrorCode`/`ErrorCodeValue` export 는 그대로다. `nodes/core/index.ts` 에 재수출(barrel)도 없어 이 파일을 직접 import 하는 3개 소비 파일 밖으로 표면이 넓어지지 않는다. 실제 side effect 는 없으나, 인터페이스가 늘었다는 사실만 기록.
  - 제안: 조치 불필요.

- **[INFO]** 4개 리다이렉트 지점의 문자열 값이 원래 리터럴과 정확히 일치함을 확인
  - 위치: `ai-turn-orchestrator.service.ts` 의 `classifyLlmError`(1297~1311줄 부근) — `ErrorCode.LLM_RATE_LIMIT`='LLM_RATE_LIMIT', `ErrorCode.LLM_CALL_FAILED`='LLM_CALL_FAILED' / `execution-engine.service.ts:1147,2873,3336` / `shutdown-state.service.ts:194,222`
  - 상세: `EngineErrorCode`/`ErrorCode` 두 const 모두 `KEY: 'KEY'` 형태(자기거울 패턴)이고, 대체 전 리터럴과 1:1 로 일치한다(오타 없음). DB에 영속되는 `Execution.error.code`/`NodeExecution.error.code` 값이 이번 변경으로 조용히 달라져 FE/알림 분기가 깨질 위험은 없다. 반환 타입도 두 함수(`classifyLlmError`, `extractAiTurnErrorPayload`) 모두 `code: string` 으로 명시돼 있어 리터럴 타입이 유니온으로 넓혀져도(`as const` 이므로 실제로는 그대로 좁은 리터럴 유지) 호출부 타입 영향이 없다.
  - 제안: 조치 불필요 — 확인 목적의 기록.

- **[INFO]** import 경로 상대 깊이 수동 검증 — 3개 파일 모두 정확
  - 위치: `ai-turn-orchestrator.service.ts` / `execution-engine.service.ts` (둘 다 `'../../nodes/core/error-codes'`), `shutdown-state.service.ts` (`'../../../nodes/core/error-codes'`)
  - 상세: 디렉터리 깊이(`modules/execution-engine/*.ts` vs `modules/execution-engine/shutdown/*.ts`)에 맞게 `../` 개수가 각각 정확하다. 순환 import·미해결 모듈 경로로 인한 부팅 실패 위험 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 repo-guard 3파일은 파일시스템 read-only, 실행 범위가 테스트에 한정됨
  - 위치: `engine-error-code-anchor-guard.ts` 의 `readDeclaredCodes`/`collectBoundCodes`(`fs.readFileSync`, `fs.readdirSync` 호출부), `engine-error-code-anchor.spec.ts`
  - 상세: `fs` 호출은 전부 읽기 전용(`readFileSync`/`readdirSync`)이며 쓰기·삭제는 없다. `codebase/backend/jest.config.ts` 의 `testRegex: '.*\.spec\.ts$'` 로 인해 `-guard.ts`/`-fixture.ts` (spec 이 아님)는 별도 테스트 스위트로 수집되지 않는다 — Jest 가 빈 스위트로 오판해 실패하는 부작용은 없다. `nodes/core/index.ts` 등 프로덕션 barrel 에서 이 `__tests__/*` 파일을 재수출하는 곳도 없어(grep 확인) 프로덕션 런타임에 `fs` 스캔이 섞여 들어갈 경로가 없다.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서 이동은 delete+add 형태 (git mv 아님) — lifecycle 문서상 의도된 이동으로 확인
  - 위치: `plan/in-progress/exec-intake-followups.md` (전체 삭제) → `plan/complete/exec-intake-followups.md` (신규, frontmatter `status: complete`/`spec_impact: none` 추가 + 본문 대폭 확장)
  - 상세: 코드 실행에 영향 없는 문서 파일시스템 변경이며, `.claude/docs/plan-lifecycle.md` 가 규정하는 in-progress→complete 이동 관례에 부합한다(단순 rename 이 아니라 완료 근거 본문을 덧붙였으므로 diff 상 delete+add 로 나타나는 것은 예상된 형태). 프로젝트 메모리의 "git mv + multi-pathspec add" 함정은 **커밋 시점의 스테이징 방식** 문제이지 이 diff 자체의 결함이 아니므로, 커밋 시 `git show HEAD:plan/complete/exec-intake-followups.md` 로 최종 내용을 재확인할 것을 권장(정보성).
  - 제안: 커밋 전 스테이징 결과만 재확인. 코드 자체 조치는 불필요.

## 요약

이번 변경은 엔진 레이어 에러 코드 4종(`WEBCHAT_IDLE_TIMEOUT`, `EXECUTION_QUEUE_WAIT_TIMEOUT`, `WORKER_HEARTBEAT_TIMEOUT`, `SERVER_INTERRUPTED`)과 AI-turn 레이어 2종(`LLM_RATE_LIMIT`, `LLM_CALL_FAILED`, 3지점)을 맨 문자열에서 새 `EngineErrorCode`/기존 `ErrorCode` const 참조로 리다이렉트하는 순수 리팩터다. 모든 대체 값이 원본 문자열과 정확히 일치함을 직접 대조로 확인했고, 두 소비 함수의 반환 타입이 이미 `code: string` 으로 넓어져 있어 타입 레벨 영향도 없다. 신규 export(`EngineErrorCode`)는 barrel 재수출이 없어 표면이 넓어지지 않으며, 신규 repo-guard 3파일은 읽기 전용 fs 접근이 테스트 실행 시점(`*.spec.ts` 만 수집)에 한정돼 프로덕션 경로에 섞이지 않는다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 발행 로직은 어느 파일에서도 건드리지 않았다. plan 문서 이동은 프로젝트 lifecycle 관례에 부합하는 의도된 파일시스템 변경이다. 부작용 관점에서 실질적 위험은 발견되지 않았다.

## 위험도

NONE

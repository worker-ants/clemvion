# 테스트(Testing) 리뷰 — retry-ie-residuals-c4a1b2 (RESOLUTION 라운드)

## 배경

이 changeset 은 직전 라운드(`review/code/2026/09/01/17_55_50`)의 SUMMARY 가 지적한
WARNING 5건에 대한 `RESOLUTION.md` 조치분을 포함한다. 그중 testing 관점 WARNING 2건
(W2·W3 — "관측 로그를 추가했지만 검증하지 않았다")이 이번 라운드의 핵심 diff다.
아래는 그 조치의 실효성을 소스와 대조해 재검증한 결과다.

## 발견사항

- **[INFO]** `execution-engine.service.spec.ts` 신규 테스트에서 `warnSpy` 가 명시적으로 `mockRestore()` 되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3791-3835` (`timeout 경로 — reload 이후 guarded UPDATE 를 동시 cancel 이 선점하면(0행) naked save 로 폴백하지 않는다 (실제 race)`)
  - 상세: 같은 테스트 안의 `runExecutionSpy` 는 `runExecutionSpy.mockRestore()` 로 명시 복원하는데, 새로 추가한 `warnSpy`(`jest.spyOn(service.logger, 'warn').mockImplementation(...)`)는 복원 호출이 없다. 이 파일의 최상위 `describe('ExecutionEngineService', ...)` (106줄~18970줄)에는 전역 `afterEach(() => jest.restoreAllMocks())` 가 없다(그 패턴은 훨씬 뒤 별개의 top-level `describe('NF-OB-07 ...')` 블록에만 있다 — 대상 밖). 실제로는 `service`(및 `service.logger`)가 `beforeEach` 마다 `Test.createTestingModule(...).compile()` 로 매번 새 인스턴스로 재생성되므로 스파이가 다음 테스트로 누출되지는 않는다 — 기능적 회귀는 아니다.
  - 제안: 필수는 아니나, 같은 테스트 안에서 형제 spy(`runExecutionSpy`)와 스타일을 맞추기 위해 `warnSpy.mockRestore()` 를 추가하는 것이 일관적이다.

- **[INFO]** `retry-turn.service.spec.ts` 신규 테스트 2건이 ~10줄짜리 mock-캡처 블록(`NOT_CALLED` sentinel + `updateExecutionStatus` mockImplementation)을 그대로 복제한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:982-991`(자연 종결), `:1054-1063`(fallback 종결)
  - 상세: 두 테스트가 "COMPLETED 호출 시점의 `exec.error` 스냅샷" 로직을 문자 그대로 반복한다. 새로 지적하는 결함이 아니다 — 직전 라운드 SUMMARY INFO #7 이 이미 이 중복을 지목했고 plan 의 W6 백로그(테스트 위생)로 이월 처리됐다. 참고용으로만 기록.
  - 제안: 조치 불요(이미 우선순위 판단 완료, 로컬 헬퍼 추출은 W6 와 함께).

- **[INFO]** `assertLinkedTransitionApplied` 신규 회귀 테스트의 로그 페이로드 단언이 `phase` 필드는 포함하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:308-311` (`expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ne-1'))` / `'DB write failed'`)
  - 상세: 실제 로그 문자열은 `nodeExec.id`·`phase`·원본 에러 메시지 셋을 모두 싣는다(`ai-turn-orchestrator.service.ts:426-431`). 신규 테스트는 앞의 둘만 단언한다 — 직전 라운드 리뷰어가 제안한 최소선("nodeExec.id 와 원본 에러 메시지")은 충족하지만, 로그 문구에서 `phase=` 부분만 깨뜨리는 뮤턴트는 이 테스트로 잡히지 않는다.
  - 제안: 낮은 우선순위. 필요 시 `expect.stringContaining('AI turn — re-park')` 류로 phase 도 함께 고정 가능.

## 검증한 것 (재확인, 신규 결함 아님)

직전 라운드 WARNING W2·W3 이 실제로 닫혔는지 소스와 테스트를 직접 대조했다:

- **W2 (executeSync timeout `persisted` warn)** — `execution-engine.service.ts:4313-4322` 의 `if (!persisted) { this.logger.warn(...) }` 블록과 `execution-engine.service.spec.ts:3823-3832` 의 `expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/executeSync\(.*\): 동시 cancel 이 이미 terminal 로 선점/))` 를 직접 대조 — 로그 포맷과 정규식이 정확히 일치한다. `mockExecutionRepo.query.mockResolvedValueOnce([])` 로 guarded UPDATE 0행을 재현해 `persisted=false` 분기가 실제로 진입함을 확인했다. 이 warn 블록을 지우면 이 단언은 RED 로 떨어진다.
- **W3 (`assertLinkedTransitionApplied` catch `logger.error`)** — `ai-turn-orchestrator.service.ts:409-432` 의 신규 `try/catch` 와 `ai-turn-orchestrator.service.spec.ts:267-312` 의 신규 테스트를 대조 — `driver.updateExecutionStatus.mockResolvedValueOnce(false)` 로 `!shouldProceed` 분기를, `driver.markNodeCancelled.mockRejectedValueOnce(...)` 로 catch 분기를 정확히 겨냥한다. `[전제] markNodeCancelled 를 실제로 호출했다` 단언으로 vacuous pass 를 차단하고, `errorSpy` 로 로그 페이로드(nodeExec.id·원본 에러 메시지)를 실제로 검증한다. try/catch 를 통째로 제거하면 `.rejects.toBeInstanceOf(ExecutionCancelledError)` 가 RED 로 떨어진다 — plan 이 주장한 "뮤턴트 → RED 1" 은 소스 구조상 타당하다.
- **신규 edge-case 3건(`retry-turn.service.spec.ts` — row 부재 / `retryAfterSec` fallback / 양쪽 타임스탬프 부재)** — `retry-turn.service.ts:112-206` 의 실제 분기 순서(`!nodeExec` → INVALID_EXECUTION_STATE, `details.retryAfterSec` → `_retryState.retryAfterSec` fallback, `typeof finishedAtMs === 'number'` 가드)와 세 fixture 를 대조 — 각 fixture 가 실제로 그 분기를 가르는 값(예: `details` 에서 `retryAfterSec` 를 빼고 `_retryState` 에만 남김, `startedAt`/`finishedAt` 를 둘 다 `null`)으로 구성돼 있음을 확인했다.
- **atomic-consume SQL 테스트** — `retry-turn.service.ts:217-228` 의 실제 `set({ outputData: () => \`output_data - '${RETRY_STATE_KEY}'\` })` / `.andWhere(\`jsonb_exists(output_data, '${RETRY_STATE_KEY}')\`)` 와 신규 테스트의 문자열 단언이 정확히 일치한다.
- **`markSpawnedRowFailed` 추출** — 기존 회귀 테스트 "(d) marks spawned row FAILED when parent execution is not found" / "(e) …node definition is not found"(`retry-turn.service.spec.ts:669-708`)가 리팩터 후에도 `row.status`/`row.error`/`row.finishedAt`/`save` 호출을 그대로 검증하며 통과 경로가 보존됨을 확인했다(두 not-found 분기가 헬퍼로 수렴했지만 관측 가능한 동작은 diff 전후 동일).
- **JSDoc 재배치(W1)** — `retry-turn.service.ts:711`(`markSpawnedRowFailed` JSDoc) / `:777`(`completeRetryExecution` 실제 선언, 자기 JSDoc 회복 확인) 를 직접 읽어 문서가 올바른 함수 위로 옮겨졌음을 확인했다(테스트 가독성/차후 테스트 작성자의 오독 위험 해소 — documentation 리뷰어 영역과 중복되므로 별도 WARNING 으로 올리지 않음).
- 테스트 격리: `ai-turn-orchestrator.service.spec.ts` 는 `beforeEach` 로 orchestrator 를 매번 재생성 + `afterEach(() => jest.restoreAllMocks())` 로 spy 를 전역 복원한다. `execution-engine.service.spec.ts` 는 대상 describe 블록에 전역 restore 가 없지만 `service`(및 `.logger`)가 `beforeEach` 마다 새 인스턴스로 교체되므로 실질적 누수는 없음을 확인했다(위 INFO 참고).

## 요약

직전 라운드가 지적한 두 testing WARNING("관측 로그를 추가했지만 지워도 초록이었다")은 모두 실제 소스 코드의 로그 포맷·분기 조건과 정확히 대조되는 스파이 단언으로 닫혔다 — премise 체크([전제] 단언)와 call-time 스냅샷(`NOT_CALLED` sentinel) 패턴을 재사용해 vacuous pass 위험을 의식적으로 차단했고, 신규 edge-case 3건(row 부재/`retryAfterSec` fallback/양쪽 타임스탬프 부재)도 실제 분기를 가르는 fixture 로 구성돼 있음을 소스 대조로 확인했다. 새로 발견한 CRITICAL/WARNING 급 결함은 없다. INFO 3건은 전부 사소한 완성도 여지(spy 명시적 mockRestore 누락이나 로그 페이로드 중 `phase` 필드 미검증, 이미 백로그로 이월된 mock-캡처 중복)이며 기능적 리스크는 없다.

## 위험도

NONE

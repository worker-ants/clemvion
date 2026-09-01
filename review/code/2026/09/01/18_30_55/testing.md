# 테스트(Testing) 코드 리뷰 — retry-ie-residuals-c4a1b2 (3라운드, 누적 diff `origin/main...HEAD`)

## 배경

이번 대상은 `59dd12869`(원 수정) + `15374b657`(1라운드 WARNING 5건 fix) +
`91c817608`(2라운드 WARNING 1건 fix) 누적 diff다. 앞선 두 라운드(`17_55_50`, `18_13_45`)의
testing 리뷰가 이미 WARNING 2건(관측 로그 미검증)을 지적·조치 확인했고, 3라운드 리뷰가
INFO 3건(phase 필드 미단언 포함)을 추가로 남겼다. 본 라운드는 그 누적 결과를 **정적 대조 +
실제 테스트 실행 + 2건의 독립 뮤테이션 재현**으로 재검증한다.

## 검증 방법 (본 라운드 독립 실측)

- `npx jest retry-turn.service.spec.ts ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts`
  실행 → **3 suites / 595 tests 전부 PASS** (직접 실행 확인, RESOLUTION.md 의 스위트 수 주장과 일치).
- **독립 뮤테이션 1 (신규)**: `retry-turn.service.ts` 의 `prepareSuccessTermination` 에서
  `execution.error = null;` 한 줄을 제거 → `retry-turn.service.spec.ts` 의 "자연 종결이 이전
  시도의 error 를 비운다…" **및** "fallback 종결(completeRetryExecution)도…" **두 테스트 모두
  RED**(`Expected: null / Received: {"message": "이전 시도의 실패"}`). 두 호출부가 공유하는
  헬퍼가 실제로 두 회귀 테스트 각각에 load-bearing 함을 실측 확인 — 이전 라운드 RESOLUTION 이
  주장만 하고 직접 재현하지 않았던 항목이다.
- **독립 뮤테이션 2 (신규)**: `ai-turn-orchestrator.service.ts` 의 `assertLinkedTransitionApplied`
  catch 블록에서 `phase=${phase}` 보간을 `phase=REDACTED` 상수로 치환 → 신규 테스트의
  `expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('AI turn — re-park'))` 단언이
  **RED**. 2라운드 testing.md 가 "phase 미검증" 으로 지적했던 갭이 이번 라운드에서 실제로
  닫혔음을 직접 재현으로 확인(라운드 2 RESOLUTION 문서의 "phase 도 고정" 주장이 vacuous 하지
  않음).
- 두 뮤테이션 모두 저장소 밖 scratch 사본(`mktemp` 아님, 세션 scratch 디렉터리)으로 원본을
  백업한 뒤 `cp` 로 원복. `git status --short` 로 이 세션 리뷰 산출물 외 트리가 clean 함을 확인.

## 발견사항

- **[INFO]** `execution-engine.service.spec.ts` 의 신규 `warnSpy` 가 명시적으로 `mockRestore()` 되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3791-3797`(`warnSpy` 선언), `:3834`(같은 테스트의 `runExecutionSpy.mockRestore()`만 존재)
  - 상세: 같은 테스트 안 형제 spy `runExecutionSpy` 는 명시 복원되는데 `warnSpy` 는 그렇지 않다. 다만 `service`(및 `service.logger`)는 파일 최상위 `beforeEach`(`:253`)가 매 테스트 `Test.createTestingModule(...).compile()` 로 재생성하므로(`:706` `service = module.get(...)`) 스파이가 다음 테스트로 실제 누출되지는 않는다 — 직접 확인. 2라운드 testing.md 가 이미 같은 근거로 INFO 처리한 항목과 동일하며, 이번 라운드에서도 미해소 상태 그대로 재확인됐다.
  - 제안: 급하지 않음. 형제 spy 와 스타일을 맞추려면 `warnSpy.mockRestore()` 한 줄 추가.

- **[INFO]** `retry-turn.service.spec.ts` 신규 테스트 2건이 "COMPLETED 호출 시점 `error` 스냅샷" mock-구성 블록(`NOT_CALLED` sentinel + `updateExecutionStatus.mockImplementation`)을 문자 그대로 반복한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:982-991`(자연 종결)과 `:1054-1063`(fallback 종결) — 10줄 블록이 동일
  - 상세: 두 테스트가 검증하는 불변식(성공 종결 시 `error` 가 비워진다)이 서로 다른 호출부(`resumeGraphAfterRetry` 자연 종결 vs `completeRetryExecution` fallback)를 겨냥하므로 각자 존재해야 하는 것은 맞지만, 캡처 로직 자체는 헬퍼로 추출 가능하다. `retry-turn-terminal-guard.md` 의 W6 테스트 위생 백로그에 이미 같은 성격의 mock-capture 중복이 등재돼 있고 1·2라운드 testing.md 도 동일하게 INFO/비조치로 판단했다 — 신규 결함 아님, 재확인.
  - 제안: 조치 불요(우선순위 판단 완료). 로컬 헬퍼(`captureErrorAtCompletion(mockDriver)`) 추출은 W6 정리 시점에.

- **[INFO]** `assertLinkedTransitionApplied` catch 블록의 `logger.error` 페이로드 단언이 이제 `nodeExec.id`·원본 에러 메시지·`phase` 세 요소를 전부 검증하지만, 여전히 실행 순서(`try` 블록 안에서 `driver.markNodeCancelled` 가 정확히 언제 reject 하는지)는 단언하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:302-316`
  - 상세: 사소한 관찰이며 현재 요구되는 계약(마킹 실패 → 관측 로그 → 취소 분류 유지)을 검증하는 데는 충분하다. 새로운 조치를 요구할 정도는 아니다.
  - 제안: 조치 불요.

## 확인한 것 (재검증, 신규 결함 아님)

- **JSDoc 오귀속(1라운드 W1)** — `retry-turn.service.ts` 를 `grep`/`Read` 로 직접 확인: `markSpawnedRowFailed`(:724)·`prepareSuccessTermination`(:751) 은 각자 올바른 JSDoc 바로 아래 위치하고, `completeRetryExecution`(:779) 도 자신의 JSDoc(:759 "retry 성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback…") 바로 아래로 정정돼 있다. 오귀속 없음.
- **atomic-consume SQL 테스트** — `retry-turn.service.spec.ts` 의 `consumeSetArgs`/`consumeAndWhereSql` 캡처 mock 이 `jsonb_exists(output_data, '_retryState')` 가드와 `output_data - '_retryState'` 키 제거식을 문자 그대로 단언하며, `[전제]` 단언(`toHaveLength(1)`)으로 vacuous pass 를 차단한다. 소스(`retry-turn.service.ts` 원자 consume 블록)와 대조해 일치 확인.
- **신규 edge-case 3건**(row 부재 / `retryAfterSec` `_retryState` fallback / 양쪽 타임스탬프 부재) — 각 fixture 가 실제로 해당 분기를 가르는 값(예: `details` 에서 `retryAfterSec` 를 빼고 `_retryState` 에만 남김, `startedAt`/`finishedAt` 를 둘 다 `null`)으로 구성돼 있음을 소스의 분기 순서와 대조해 확인. 이미 두 라운드가 확인한 항목이라 재확인만.
- **execution-engine.service.spec.ts 의 `persisted` warn 테스트** — `mockExecutionRepo.query.mockResolvedValueOnce([])` 로 guarded UPDATE 0행 매칭을 재현해 `persisted=false` 분기를 실제로 태우는지 소스(`updateExecutionStatus` 의 `query()` 경유 guarded UPDATE)와 대조해 확인. 정규식 단언(`stringMatching(/executeSync\(.*\): 동시 cancel 이 이미 terminal 로 선점/)`)이 실제 로그 포맷과 문자 그대로 일치.
- **테스트 격리** — `ai-turn-orchestrator.service.spec.ts` 는 `beforeEach` 로 `driver`/`orchestrator` 를 매번 재생성 + `afterEach(() => jest.restoreAllMocks())` 로 전역 복원. `execution-engine.service.spec.ts` 는 최상위 `describe` 에 전역 restore 훅이 없지만 `service`(및 `logger`) 자체가 `beforeEach` 마다 새 모듈 인스턴스로 교체되므로 스파이 누출은 실질적으로 없다(위 INFO 항목에서 직접 확인). `retry-turn.service.spec.ts` 는 `installRetryMocks()` 가 매 테스트 mock 상태(`consumeSetArgs`/`consumeAndWhereSql`/`createdEntities`)를 초기화해 독립 실행 가능.

## 요약

이번 라운드에서 새로 발견한 CRITICAL/WARNING 급 테스트 결함은 없다. 1·2라운드가 지적한
WARNING 2건(관측 로그 미검증)은 실제로 닫혔음을 이번 라운드에서 처음으로 **독립 뮤테이션
재현**(phase 보간 제거 → RED)으로 확인했고, `prepareSuccessTermination` 의 핵심 불변식(`error`
클리어)도 두 호출부 모두에서 뮤테이션(속성 대입 제거 → 양쪽 RED)으로 load-bearing 함을
실측했다 — 이전 라운드들의 RESOLUTION 주장이 vacuous 하지 않음을 코드 실행으로 뒷받침한다.
잔여 INFO 3건은 전부 1·2라운드에서 이미 같은 근거로 처분된 항목의 재확인(warnSpy 명시적
미복원·mock-capture 중복·실행순서 미단언)이며 기능적 위험은 없다. 전체 스위트(595 tests)는
그대로 GREEN.

## 위험도

NONE

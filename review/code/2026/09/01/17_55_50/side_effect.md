# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `Execution.error` 타입을 `| null` 로 넓히면서, 그 넓히지 **않음**을 전제로
  적힌 다른 파일의 설계 근거 주석이 지금 이 diff 로 인해 거짓이 됐다(문서만 stale — 그
  파일 자체는 이번 diff 대상이 아니다).
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
    (`error: Record<string, unknown> | null;` — 변경된 줄)이 무효화하는 대상은
    `codebase/backend/src/modules/executions/executions.service.ts:74-89`
    (`ResponseExecution` 타입 JSDoc) 와 같은 파일 `:1052-1060`
    (`toResponseExecution` 의 "반환 타입이 `Execution` 이 아닌 이유" JSDoc).
  - 상세: `executions.service.ts` 의 두 JSDoc 은 각각 "엔티티는 이 셋(`error`·`inputData`·
    `outputData`)을 `Record<string, unknown>` 로 **`| null` 없이** 선언" 이라고 명시하고,
    그 전제 위에서 `ResponseExecution`/`toResponseExecution` 이 `error` 를 별도로
    `Record<string, unknown> | null` 로 재선언해야 하는 이유(egress 마스킹이 `null` 을
    돌려주는데 엔티티는 그걸 못 담아서)를 설명한다. 이번 diff 로 `Execution.error` 엔티티
    필드 자체가 `| null` 이 되어 그 전제가 셋 중 하나(`error`)에 대해서는 더 이상 사실이
    아니다. 기능적으로 깨지진 않는다 — `ResponseExecution` 의 `error` 재선언이 이제는
    (그 필드에 한해) 엔티티 타입과 동일해져 불필요해졌을 뿐 틀린 타입은 아니다. 다만
    다음에 이 주석을 읽는 사람은 "엔티티가 null 을 못 담는다" 는 틀린 전제로 판단하게 된다
    — 이 저장소가 반복해 지적해 온 "인터페이스 변경이 다른 곳의 문서화된 근거를 무효화"
    패턴과 같은 계열이다. `git blame` 상 이 diff 의 작성자가 그 주석도 쓴 사람인지는
    확인하지 않았다(같은 PR 계열이 아닐 수 있음 — CLAUDE.md 의 "자기반증형 소정정" 예외
    대상인지는 planner/developer 가 별도 판단할 사안).
  - 제안: `executions.service.ts:74-89`·`:1052-1060` 의 "`| null` 없이 선언" 서술을
    "`error` 는 이제 엔티티도 `| null` 이지만 `inputData`/`outputData` 는 여전히 아니다"
    식으로 갱신하거나, 최소한 `error` 항목만 표에서 빼거나 각주로 구분할 것.

- **[INFO]** `assertLinkedTransitionApplied` 가 `markNodeCancelled` 의 reject 를
  삼키고 로그만 남긴 채 항상 `ExecutionCancelledError` 로 종결하도록 바뀌었다 — 의도된
  수정이고(취소 **분류**를 유지하는 것이 목적) 뮤테이션 테스트(RED 1)로도 뒷받침되지만,
  "예외를 삼키고 로그로만 관측" 패턴 자체는 부작용 관점에서 한 번은 짚어 둔다.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432`
    (`try { await this.driver.markNodeCancelled(...) } catch (err) { this.logger.error(...) }`).
  - 상세: 마킹 실패(예: DB write 실패) 시 짝 `NodeExecution` 은 non-terminal(RUNNING)로
    잔류하고, 그 사실은 `this.logger.error` 로만 남는다 — 상위 호출자에게는 여전히
    `ExecutionCancelledError` 만 보이므로 "마킹이 실패했다" 는 신호가 예외 체인에는 없다.
    이건 이 diff 가 고치려는 결함의 **의도된 트레이드오프**(분류 정확성 vs 마킹 완전성)이고
    plan(`ie-resume-turn-boundary-cancel.md` C-4)이 `#1259` 감사 적재 실패와 동일한
    판단이라고 명시했으므로 결함으로 보지 않는다. 다만 로그만으로 관측한다는 것은 이
    실패 경로에 대한 알림/모니터링이 로그 파이프라인에 의존한다는 뜻이라 기록해 둔다.
  - 제안: 조치 불요(설계 의도). 로그 레벨(`error`)이 실제 알림 채널로 이어지는지만
    운영 관점에서 확인 권고.

- **[INFO]** `executeSync` timeout catch 가 `updateExecutionStatus` 반환값을 소비해
  `false` 일 때 `this.logger.warn` 을 새로 남긴다 — 제어 흐름 변경은 없고(뒤이은
  `throw err;` 는 그대로) 순수 추가 관측이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4313-4322`.
  - 상세: 실측 확인 — 이 블록 이후 `throw err;` (동일 catch 블록의 마지막 문장, 이번
    diff 밖)는 `persisted` 값과 무관하게 항상 실행된다. 즉 이 변경은 분기 추가가 아니라
    로그 추가뿐이다. 형제 경로 `failFirstSegmentSetup` 과 동일한 관측 패턴으로 통일한
    것이라 부작용 위험은 낮다. 로그 볼륨이 늘어나는 것(동시 cancel 선점 시마다 warn 1줄
    추가)은 의도된 변경.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.ts` 의 `markSpawnedRowFailed`/`prepareSuccessTermination`
  추출은 private 헬퍼라 외부 시그니처 영향은 없다. 다만 `prepareSuccessTermination` 이
  `execution.error = null` 을 새로 대입하는 것은 **의도된 상태 변경 확장**이다(문서화·
  두 호출부 모두에 뮤테이션 테스트로 고정 확인).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:770-775`
    (`prepareSuccessTermination`), 호출부 `:781`(`completeRetryExecution`)·`:957`
    (`resumeGraphAfterRetry` 자연 종결).
  - 상세: `markSpawnedRowFailed` 로 옮겨진 4단계(로그·status·error·finishedAt+save)가
    원본과 동일한 문자열을 만들어내는지 직접 대조했다 — `logContext` 인자에 접미사가
    없고 헬퍼가 `${logContext} — marking spawned row FAILED to avoid zombie` 로 접미를
    붙이므로 두 호출부(execution not found / node not found) 모두 원문과 동일한 로그
    문자열을 낸다. 순수 리팩터로 확인. `prepareSuccessTermination` 의 `error = null`
    은 diff 이전에는 `completeRetryExecution`/자연 종결 양쪽 다 하지 않던 새 대입이지만,
    같은 diff 가 추가한 회귀 테스트(`retry-turn.service.spec.ts` 두 건, `errorAtCompletion`
    을 `finalizeGuarded`/`updateExecutionStatus` 호출 시점에 스냅샷)가 이 상태 변경을
    검증하므로 결함으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `Execution.error` 타입 확장이 런타임에 새 null 가능성을 만들어내는 것은
  아니다(DB 컬럼은 diff 이전부터 `nullable: true`) — 타입만 실제 스키마를 뒤늦게
  반영한 것이라 신규 컴파일 에러 유발 여부를 직접 확인했다.
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`.
  - 상세: `npx tsc --noEmit`(backend) 를 이 워크트리에서 직접 실행해 총 309줄의 에러
    출력을 확인했으나, `error`/`Execution`/`execution.entity`/`retry-turn`/
    `ai-turn-orchestrator`/`execution-engine.service` 관련 에러 중 이번 diff 가 원인이
    될 만한 항목(`.error` 접근·엔티티 nullable 관련)은 없었다 — 전부 diff 와 무관한
    선재 오류(`"ai_conversation"` 리터럴 유니온·carousel/table 테스트의 `unknown`
    캐스팅 등)였다. `execution.error` 를 null 체크 없이 체이닝하는 프로덕션 코드도
    grep 으로 0건 확인(기존 코드가 이미 `?.`/`== null` 로 방어).
  - 제안: 조치 불요 — plan 이 주장한 "신규 tsc 에러 0" 과 일치.

## 요약

핵심 코드 변경 5건(취소 마킹 실패 흡수, timeout 반환값 로깅, retry 종결 헬퍼 추출 2건,
`Execution.error` 엔티티 타입 정정)은 전부 문서화된 의도를 가진 국소 수정이고, 전역
변수·환경 변수·네트워크 호출·파일시스템 부작용은 관측되지 않았다. `markSpawnedRowFailed`
추출은 원본 로그 문자열까지 동일함을 직접 대조해 순수 리팩터임을 확인했고, `executeSync`
반환값 소비는 제어 흐름을 바꾸지 않는 순수 관측 추가임을 실측(뒤이은 `throw err;` 무조건
실행)으로 확인했다. 가장 주목할 부작용은 `Execution.error` 엔티티 필드를 `| null` 로
넓힌 것이 diff 범위 밖의 `executions.service.ts` 에 있는 "엔티티는 `| null` 없이
선언돼 있다" 는 설계 근거 주석 두 곳을 무효화한다는 점이다 — 기능 결함은 아니지만 다음
독자를 오도할 수 있는 문서 drift 라 WARNING 으로 등재한다. `assertLinkedTransitionApplied`
의 예외 흡수는 의도된 트레이드오프로 판단했다(뮤테이션 테스트 존재, plan 문서의 선례와
정합).

## 위험도

LOW

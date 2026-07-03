# 동시성(Concurrency) Review

## 발견사항

- **[INFO]** `execMismatch` mutable-flag → `ResumeClaimExecTerminalError` 타입 sentinel 전환은 안전한 순수 리팩터
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `claimResumeEntry` (L281-289, L874-931)
  - 상세: 기존에는 트랜잭션 콜백 클로저 바깥의 `let execMismatch = false`를 콜백 내부에서 set 하고, `.catch()`에서 그 클로저 변수를 읽어 정상 discard 경로(false)와 실제 DB 오류를 구분했다. 이 패턴은 "콜백이 실행되고 예외가 catch에 도달하기 전엔 항상 flag가 먼저 세팅된다"는 실행 순서 가정에 기대는 것이라 미묘하게 깨지기 쉬웠다(예: 향후 다른 throw 경로가 추가되며 flag를 세팅하지 않고 reject 하는 경우 오탐 가능). 새 코드는 `instanceof ResumeClaimExecTerminalError` 판별로 대체해 상태를 클로저에 fan-out 하지 않고 예외 객체 자체에 판별 정보를 실어 전달한다. `dataSource.transaction()`은 단일 논리 흐름(단일 호출, 단일 in-flight)이라 원래도 경쟁 조건은 없었지만, 새 구조가 더 견고하고 가독성도 낫다.
  - 제안: 없음 (개선으로 간주).

- **[INFO]** `recordRunningSegmentStart` 헬퍼 추출 — `segmentStartMs` Map에 대한 두 write 지점 통합
  - 위치: `execution-engine.service.ts` L6886-6895 (헬퍼 정의), `claimResumeEntry` L928, `updateExecutionStatus` L6922
  - 상세: `segmentStartMs`는 인스턴스 필드 `Map<string, number>`로, 클래스 주석(L2054-2059)에 이미 문서화된 설계 불변식이 있다: "단일 Execution은 한 번에 하나의 active 세그먼트만 처리"되며 "execution-run/execution-continuation 큐가 동일 Execution에 대해 동시 job을 발행하지 않으므로 set/delete 쌍 상호 배제가 보장"된다. `claimResumeEntry`의 원자 DB claim(조건부 UPDATE, affected 검사)이 레이스의 실질적 결정자이고, `recordRunningSegmentStart`는 claim에 **성공한 단일 호출자만** 도달하는 후속 부수효과이므로, Map 자체에 대한 동시 write 경쟁은 여전히 발생하지 않는다. 순수 코드 중복 제거이며 동시성 특성 변화 없음.
  - 제안: 없음.

- **[INFO]** 신규 e2e 동시 재개 테스트 — 원자 claim의 실효성을 실제 병렬 요청으로 검증
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (신규 `it('06 C-2 — 동시 재개(2 continue 병렬)...')`)
  - 상세: `Promise.all([mkContinue('a'), mkContinue('b')])`로 동일 waiting 노드에 2건의 `POST /continue`를 병렬 발행하고, 최종적으로 form 노드 row가 정확히 1건만 `completed`로 존재하며 `running` 잔류가 없음을 DB 직접 쿼리로 검증한다. 테스트 자체 주석이 명시하듯 단일 인스턴스·concurrency=1 e2e 환경이라 실제 DB row-level 레이스를 유발하진 않지만(§7.5.1 publisher 사전검증이 한쪽을 조기 거부할 수도 있음), "동시 재개 진입점의 end-to-end 이중 실행 0" 회귀 가드로서 가치가 있다. assertion이 200/202/422 모두를 허용해 어느 경로로 리졸브되든 통과하도록 설계된 점도 타이밍에 안정적이다.
  - 제안: 없음. 실제 DB row-level 레이스(양쪽 요청이 정확히 동시에 조건부 UPDATE를 경합)까지 결정적으로 재현하려면 워커 concurrency>1 환경이나 DB 레벨 지연 주입이 필요하나, 이는 기존 unit 레벨의 `affected` mock 기반 테스트가 이미 로직 정합성을 커버하고 있어 별도 조치 불필요.

- **[INFO]** unit spec 신규 케이스 — claim 이후 RUNNING skip-guard
  - 위치: `execution-engine.service.spec.ts` (신규 `it('claim 후 Execution=RUNNING → 재개 sentinel 전이(updateExecutionStatus(RUNNING)) skip')`)
  - 상세: `driveResumeAwaited`가 claim이 이미 RUNNING으로 전이시킨 Execution에 대해 재개 sentinel 전이(`updateExecutionStatus(..., RUNNING)`)를 중복 호출하지 않는지 검증한다. `assertTransition`의 RUNNING→RUNNING throw 회피를 가드하는 회귀 테스트로, `Promise.race([..., guard])` + `finally`에서 stub들을 원상복구하는 패턴을 사용해 테스트 간 상태 누수를 방지한다. 문제 없음.
  - 제안: 없음.

## 요약
이번 diff의 실질 production 코드 변경은 `claimResumeEntry`(§7.5 원자 claim, 이미 별도 작업 PR #791에서 도입·검증된 로직) 내부의 두 가지 순수 리팩터에 국한된다 — (1) 클로저 mutable flag를 타입 sentinel 예외로 교체(더 견고한 오류 판별), (2) `segmentStartMs` 세그먼트 기록 write를 공유 헬퍼로 추출(중복 제거). 두 변경 모두 `dataSource.transaction()`의 단일 원자 UPDATE(조건부 `affected` 검사)로 확보되는 레이스 결정 지점 자체는 건드리지 않으며, 클래스 주석에 이미 문서화된 `segmentStartMs` 상호 배제 불변식(큐가 동일 Execution에 동시 job을 발행하지 않음)도 그대로 유지된다. 나머지 변경은 테스트 추가뿐으로, 특히 신규 e2e 테스트가 동시 `continue` 2건 병렬 발행 시나리오로 "이중 실행 0" 불변식을 직접 검증해 회귀 방어력을 높인다. 새로운 공유 자원, 락, async/await 오용, 이벤트 루프 블로킹 요소는 발견되지 않았다.

## 위험도
NONE

STATUS=success ISSUES=0

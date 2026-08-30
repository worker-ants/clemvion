# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[WARNING]** self-deadlock 회피를 뒷받침하는 "호출부 11곳 전수 대조" 주장이 실제 호출 표면의 절반만 세고 있다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8570` (`updateExecutionStatus` JSDoc — "현재 호출부 11곳은 전부 top-level 이라 해당 없음 (`17_36_15` concurrency INFO 2 가 전수 대조)")
  - 상세: `updateExecutionStatus` 의 두 분기가 이제 **둘 다** 내부에서 `dataSource.transaction()` 을 열기 때문에, 이미 열린 트랜잭션 콜백 안에서 이 함수를 부르면 같은 `execution` 행을 두 커넥션이 잠그려 해 self-deadlock(사실상 무기한 hang)이 된다는 문서화는 정확하다. 그런데 그 완전성 주장("11곳 전부")은 `this.updateExecutionStatus(...)` 형태의 클래스 내부 직접 호출만 센 것이다. `grep -rn "\.updateExecutionStatus(" codebase/backend/src` 로 실측하면 `this.driver.updateExecutionStatus(...)` 형태의 외부 호출부가 `form-interaction.service.ts`(2곳) · `button-interaction.service.ts`(2곳) · `retry-turn.service.ts`(2곳) · `ai-turn-orchestrator.service.ts`(3곳), 총 9곳 더 있다(전체 20곳). `driver: EngineDriver` 는 통상 이 서비스 자신이 구현체이므로 같은 메서드·같은 self-deadlock 위험을 공유하는데, JSDoc 의 "전수 대조" 는 이 9곳을 포함하지 않는다. 직접 표본 확인(`form-interaction.service.ts:110`, `retry-turn.service.ts:696/915` — 후자 둘은 같은 파일의 유일한 `dataSource.transaction` 블록(15-244줄) 밖에 있음, `button-interaction.service.ts`/`ai-turn-orchestrator.service.ts` 에는 자체 `.transaction(` 호출이 없음)으로는 지금 이 순간 self-deadlock 을 촉발하는 호출부는 못 찾았지만, 그 9곳이 호출 스택 상위(예: 다른 서비스가 이미 연 트랜잭션 안)에서 진입되는지는 이번 리뷰에서 전수 확인하지 못했다. 문서의 "전수 대조" 문구는 다음 사람이 "이미 다 확인됐다"고 믿고 재검증을 건너뛰게 만들 수 있다.
  - 제안: JSDoc 의 "11곳" 을 "internal 11곳(직접) + EngineDriver 경유 9곳(간접)" 으로 갱신하거나, 최소한 "internal 호출부만 대조했다" 로 범위를 좁혀 적을 것. 여유가 되면 9곳도 상위 호출 스택에 열린 트랜잭션이 없는지 확인해 실제로 완전한 전수 대조로 채울 것.

- **[INFO]** else 분기가 매 상태 전이마다 신규 DB 트랜잭션(커넥션 획득)을 여는 리소스 side effect — 이미 인지·수용됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8698-8734` (`updateExecutionStatus` else 분기, `await this.dataSource.transaction(async (manager) => {...})`)
  - 상세: 종전엔 `this.executionRepository.query(...)` 단발 autocommit UPDATE 였으나 이번 변경으로 else 분기도 `linkedNodeExec` 분기와 마찬가지로 매 호출마다 트랜잭션(커넥션 풀에서 커넥션 획득 → BEGIN → UPDATE → COMMIT)을 연다. 이 함수는 "상태 전이 단일 choke point" 로 hot path 라 커넥션 점유 시간이 늘어난다. 롤백 보장이라는 목적에 필요한 의도된 트레이드오프이고, `17_36_15` concurrency reviewer 가 이미 INFO 로 관측·수용한 항목이라 여기서는 재확인만 한다.
  - 제안: 조치 불요(이미 처분됨). 커넥션 풀이 작은 배포 환경이면 모니터링에 풀 사용률을 포함할 것.

- **[INFO]** 트랜잭션 실패(shape 위반 throw) 시에도 인메모리 `execution.status` 는 이미 새 값으로 오염된 채 예외가 올라간다 — 기존 결함, 이번 diff 로 신규 발생 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8677` (`execution.status = newStatus;` — `dataSource.transaction(...)` 호출보다 먼저 실행)
  - 상세: DB 트랜잭션은 이제 shape 위반 시 UPDATE 를 롤백해 DB 는 일관되게 유지되지만, JS 힙에 있는 `execution` 객체의 `status` 필드는 트랜잭션 시작 전에 이미 `newStatus` 로 대입돼 있다. 호출부가 throw 를 catch 하고 그 `execution` 인스턴스를 재사용/로깅하면 "DB 는 롤백됐는데 메모리 상 status 는 새 값" 인 불일치를 볼 수 있다. 이 대입 위치 자체는 이번 diff 가 옮기거나 새로 만든 것이 아니라 트랜잭션 도입 이전부터 있던 코드라 회귀는 아니다.
  - 제안: 조치 불요(기존 동작). 필요하면 후속으로 `execution.status` 대입을 트랜잭션 콜백 안, `updateReturningRows` 성공 확인 이후로 옮겨 메모리·DB 일관성을 맞출 수 있다.

- **[INFO]** `finishStatusTransition` 추출은 두 분기의 부작용 순서(트랜잭션 커밋 후 세그먼트 기록/메트릭 발행)를 그대로 보존한다 — 확인만
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8654-8659`(linkedNodeExec 분기), `:8735-8741`(else 분기), `:8757-8768`(`finishStatusTransition` 정의)
  - 상세: 두 분기 모두 `await this.dataSource.transaction(...)` 이 완전히 resolve(=commit)된 **이후에** `finishStatusTransition` 을 호출하고, 그 안에서 `recordRunningSegmentStart`(in-memory 상태 변경) 와 `emitTerminalExecutionMetrics`(메트릭 이벤트 발행)를 수행한다. 리팩터 전에도 같은 순서였고, 헬퍼 추출로 순서가 바뀌지 않았다 — DB 커밋 전에 부작용이 먼저 나가는 회귀는 없다.
  - 제안: 조치 불요. 확인 목적의 기록.

- **[INFO]** 테스트 mock 변경은 프로덕션 side effect 없음, 위임 구조만 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:275-291`(`mockTxManagerQuery`), `:4812-4864`(신규 테스트 2건)
  - 상세: `mockTxManagerQuery` 가 `UPDATE execution` 매칭 시 `mockExecutionRepo.query(sql, ...rest)` 로 위임하도록 바뀐 것은 테스트 더블 내부 배선일 뿐이며 프로덕션 코드 경로에 영향이 없다. `mockExecutionRepo` 는 같은 `beforeEach` 안에서 이 클로저보다 뒤에 할당되지만, 실제 호출은 테스트 바디 실행 시점(모든 `beforeEach` 완료 후)이라 TDZ/undefined 참조 문제는 없다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 `updateExecutionStatus` else 분기의 guarded UPDATE 를 `dataSource.transaction()` 으로 감싸 shape-위반 throw 시 실제 DB 롤백을 보장하는 것이다. 공개 시그니처·전역 변수·환경 변수·네트워크 호출은 손대지 않았고, 새로 추출된 `finishStatusTransition` 은 private 이며 두 분기의 부작용(세그먼트 기록, 메트릭 발행) 순서를 트랜잭션 커밋 이후로 그대로 보존한다. 유일하게 눈에 띄는 것은 self-deadlock 회피 근거로 든 "호출부 11곳 전수 대조" 라는 완전성 주장이 `EngineDriver` 경유 외부 호출 9곳을 빠뜨리고 있다는 점이다 — 표본 확인 결과 지금 당장 self-deadlock 이 촉발되는 지점은 못 찾았지만, 문서가 실제보다 넓은 보장을 약속하고 있어 다음 사람이 재검증을 건너뛸 위험이 있다. 나머지(커넥션 풀 점유 증가, 트랜잭션 실패 시 인메모리 status 오염)는 이미 이전 리뷰 라운드가 인지·수용했거나 이번 diff 이전부터 있던 것으로 신규 회귀가 아니다.

## 위험도
LOW

# 유지보수성(Maintainability) 리뷰 — orphan pending backstop

## 스코프

`git diff origin/main...HEAD` 와 payload 가 정확히 일치(14 files, mis-scope 없음). 실질 코드 변경은 3개 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 `recoverOrphanPendingExecutions` + `recoverStuckExecutions` early-return 제거)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (신규 유닛 테스트 3건)
- `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (신규 e2e 테스트 2건 + helper 2개)

나머지(`plan/*.md`, `review/consistency/**`, `spec/**`)는 문서/산출물이며 코드 유지보수성 평가 대상이 아니라 제외.

## 발견사항

- **[INFO]** `recoverOrphanPendingExecutions` 는 read-then-act(non-atomic scan)로 인접 `reclaimStuckRunningExecution`(atomic claim UPDATE...RETURNING)과 원자성 모델이 다름
  - 위치: `execution-engine.service.ts:2885-2924` (`recoverOrphanPendingExecutions`) vs `2860-2884` (`reclaimStuckRunningExecution`)
  - 상세: 바로 위 형제 메서드는 "스캔=claim" 을 단일 원자 UPDATE 로 겸하는 반면(`§1.3` 패턴 재사용), 신규 메서드는 `find()` 로 후보를 읽은 뒤 개별 `markQueueWaitTimeout(id)` 호출로 최종 전이만 원자적으로 보장한다. 코드만 보면 같은 파일 내 두 인접 recovery 헬퍼가 왜 다른 패턴을 쓰는지 즉시 드러나지 않아 향후 독자가 재확인해야 한다. (동일 사안이 이미 `review/consistency/2026/07/04/21_50_44/convention_compliance.md` INFO 항목으로 지적·BLOCK 아님으로 판정됨 — 실질 안전성 결함은 없음, `markQueueWaitTimeout` 자체가 idempotent 조건부 UPDATE 이므로 read-then-act 라도 race 안전.)
  - 제안: JSDoc 안에 "스캔 자체는 non-atomic find 이며, 상태 전이 원자성은 `markQueueWaitTimeout` 의 조건부 UPDATE 단독으로 보장한다(재-claim 불요, cancel 은 idempotent)" 한 줄을 명시하면 코드만 읽어도 의도가 드러난다. 이미 docstring 이 상세하므로 한두 문장 추가로 해결 가능한 저비용 개선.

- **[INFO]** `recoverStuckExecutions` 함수가 이번 변경으로 책임이 하나 더 늘어 길어짐(RUNNING re-claim + fire-and-forget re-drive + PENDING orphan 스캔, 3개 관심사가 한 함수에 순차 존재)
  - 위치: `execution-engine.service.ts:2807-2848` (`recoverStuckExecutions` 본체)
  - 상세: `if (reclaimedIds.length > 0) { ... }` 블록과 새로 추가된 `(c) orphan pending backstop` 호출이 한 `try` 블록 안에 나열되어 함수 하나가 "RUNNING 복구"와 "PENDING 복구" 두 orchestration 을 모두 담당한다. 각 세부 로직은 이미 잘 분리된 private 메서드(`reclaimStuckRunningExecution`, `recoverOrphanPendingExecutions`)로 위임되어 있어 현재 길이(약 40줄)와 중첩 깊이(2단계)는 아직 과도하지 않으나, 향후 §8 계열 backstop 이 추가되면 이 함수가 계속 커질 여지가 있다.
  - 제안: 현재로선 리팩터링 불필요(가독성 문제 없음, 각 단계에 주석 `(a)/(b)/(c)` 로 단계 구분 명확). 다만 향후 세 번째 backstop 이 추가될 경우 "recovery step list" 배열 순회 형태로 일반화하는 것을 고려할 만하다는 점만 기록.

- **[INFO]** 매직 넘버 없음, 네이밍 일관성 양호
  - 위치: `recoverOrphanPendingExecutions` 전체
  - 상세: `resolveQueueWaitTimeoutMs()` 헬퍼 재사용으로 하드코딩 없음. 메서드명 `recoverOrphanPendingExecutions` 는 기존 `recoverStuckExecutions`/`reclaimStuckRunningExecution`/`failOrphanRunningNodeExecutions` 네이밍 계열과 자연스럽게 정합(`recover<Target>Executions` + `Orphan` 어휘 조합). 문제 없음.

- **[INFO]** 테스트 코드의 `as unknown as {...}` private 메서드 접근 캐스팅이 파일 전체 기존 패턴과 일치
  - 위치: `execution-engine.service.spec.ts:44-59, 96-120`
  - 상세: 신규 테스트가 private 메서드(`markQueueWaitTimeout`, `recoverOrphanPendingExecutions`, `recoverStuckExecutions`, `redriveStuckExecution`)에 접근하기 위해 반복적으로 `service as unknown as { methodName: ... }` 캐스팅을 사용한다. 다소 장황하지만 같은 spec 파일의 기존 `redriveStuckExecution (PR3 case B)` describe 블록(바로 아래, 128번째 줄)에서도 동일 패턴을 쓰고 있어 파일 내 일관성은 유지된다. 개선 여지는 있으나 이번 diff 범위를 벗어나는 기존 관행이므로 이번 PR 책임 아님.
  - 제안(선택): 반복되는 `as unknown as {...}` 캐스팅 타입을 파일 상단에 공용 헬퍼 타입(`ServiceInternals` 같은)으로 뽑으면 각 테스트의 인라인 타입 선언이 줄어들 수 있음 — 다만 기존 파일도 이 패턴이므로 강제 사항 아님.

- **[INFO]** e2e 신규 헬퍼(`insertPending`, `recoverStuck`)는 기존 `insertRunningBlocker` 헬퍼와 스타일·이름 일관
  - 위치: `execution-concurrency-cap.e2e-spec.ts:468-491`
  - 상세: 파라미터 네이밍(`queuedAtAgo`), SQL 파라미터 바인딩 스타일, 주석 위치 모두 기존 `insertRunningBlocker`/`createCapWorkflow` 와 동일한 관례를 따른다. 문제 없음.

CRITICAL/WARNING 등급 발견사항 없음.

## 요약

이번 변경은 기존 `recoverStuckExecutions` 부팅 backstop 에 orphan pending 스캔 한 단계를 추가하는 국소적이고 응집도 높은 변경이다. 신규 메서드 `recoverOrphanPendingExecutions` 는 docstring 이 설계 근거(§8 SoT, race 안전성, best-effort 성격)를 상세히 기술하고 있어 가독성이 좋고, 네이밍도 기존 `recover*/reclaim*/failOrphan*` 계열과 정합하며, 매직 넘버나 중복 코드도 없다. 유일하게 짚을 만한 점은 인접한 `reclaimStuckRunningExecution`(atomic claim)과 신규 메서드(read-then-act)의 원자성 모델 차이가 코드 주석만으로는 "왜 다른가"가 완전히 드러나지 않는다는 것인데, 이는 이미 consistency-check 단계에서 INFO 로 포착되어 안전성 결함이 아님이 확인됐고 한두 문장 보강으로 해결 가능한 저위험 사안이다. `recoverStuckExecutions` 함수 자체는 이번 변경으로 관심사가 하나 늘었지만 각 단계가 이미 잘 분리된 헬퍼로 위임되어 있어 현재 길이·중첩은 문제 수준이 아니다. 테스트 코드(유닛·e2e) 역시 기존 파일의 스타일·헬퍼 패턴을 그대로 따라 일관성이 유지된다.

## 위험도

NONE

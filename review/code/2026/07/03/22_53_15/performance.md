### 발견사항

없음 (성능에 영향을 주는 이슈 미발견).

- **[INFO]** 실패 경로 한정 추가 DB round-trip (findOneBy + save + emitExecution)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:497-531` (`failFirstSegmentSetup`), 신규 호출부 `:3398-3409` (`executeInline`/sub-workflow의 `runExecution(...).catch`)
  - 상세: `failFirstSegmentSetupBestEffort` → `failFirstSegmentSetup` 은 setup 단계 throw 시에만 실행되는 예외 경로다. 내부적으로 `executionRepository.findOneBy` 1회 + (조건부) `save` 1회 + `emitExecution` 1회로 구성돼 있어 read-then-write 패턴이지만, 정상 실행 경로(hot path)에는 전혀 영향이 없다. sub-workflow 실패는 드물게 발생하므로 이 정도의 추가 쿼리는 무시 가능한 수준이다.
  - 제안: 조치 불요. 별도 배치/캐싱 불필요.

- **[INFO]** 헬퍼 추출로 인한 코드 중복 제거 — 성능상 중립
  - 위치: `execution-engine.service.ts:541-556` (`failFirstSegmentSetupBestEffort`), 호출부 `:2869-2872`, `:3404-3409`
  - 상세: 기존에 `runExecutionFromQueue` catch 블록에 인라인돼 있던 "best-effort 마감 + 2차 실패 로그 흡수" 로직을 private 헬퍼로 추출해 `executeAsync`(sub-workflow) catch 블록도 재사용하도록 확장한 diff. 함수 호출 오버헤드는 무시할 수준이며 알고리즘 복잡도·메모리 할당 패턴에 변화가 없다.
  - 제안: 조치 불요.

- **[INFO]** fire-and-forget catch 콜백 async화(`.catch(async (err) => {...})`)
  - 위치: `execution-engine.service.ts:3398`
  - 상세: 기존에는 콜백이 동기 로그만 남겼으나 이제 `await this.failFirstSegmentSetupBestEffort(...)`를 포함해 async 콜백이 됐다. `runExecution(...).catch(...)` 자체는 여전히 fire-and-forget(반환값 미대기)이므로 caller 를 블로킹하지 않는다. 콜백 내부의 await 는 Promise 체인 내에서만 순차화되며 이벤트루프를 블로킹하지 않는다.
  - 제안: 조치 불요. 기존 큐 경로(W7)와 동일한 패턴이라 일관성도 유지됨.

### 요약
이번 diff는 이미 큐 실행 경로(`runExecutionFromQueue`)에서 검증된 "best-effort 실패 마감 + 2차 실패 로그 흡수" 로직을 `failFirstSegmentSetupBestEffort` 라는 private 헬퍼로 추출해 sub-workflow 비동기 실행 경로(`executeAsync`/`executeInline`)에도 동일하게 적용한 작은 규모의 변경이다. 알고리즘 복잡도 변화 없음, 반복문 내 N+1 호출 없음, 신규 대규모 메모리 할당 없음, 추가된 DB round-trip은 실패 시(예외 경로)에만 발생하므로 정상 실행(hot path) 성능에 영향이 없다. 테스트 코드(spec.ts) 변경도 `setImmediate` flush 를 이용한 기존 관용구를 재사용해 테스트 성능에 부정적 영향이 없다. 전반적으로 성능 관점에서 우려할 사항이 없다.

### 위험도
NONE

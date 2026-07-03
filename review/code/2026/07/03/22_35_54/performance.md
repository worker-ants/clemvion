# 성능(Performance) Review

## 발견사항

- **[INFO]** `executeAsync` 실패 경로에 추가 DB round-trip(추가 SELECT/UPDATE + 이벤트 emit) 발생
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3383-3407` (`executeAsync` 의 `runExecution(...).catch(...)`), `failFirstSegmentSetup` 정의 (동일 파일 497-538 부근, `runExecutionFromQueue` 의 기존 catch 대칭 경로 2844-2852)
  - 상세: `runExecution` 의 setup 단계(row 조회 전/그래프 로드 전 등)에서 throw 하는 실패 케이스에 한해 `failFirstSegmentSetup` 이 `executionRepository.findOneBy` 1회 + (조건부) `save` 1회 + `eventEmitter.emitExecution` 1회를 추가로 수행한다. 이는 **오류 경로에서만** 실행되고, `executeAsync` 의 정상(success) 경로나 `runExecution` 본연의 성공 흐름에는 어떤 추가 쿼리도 추가하지 않는다. 호출 빈도도 sub-workflow 비동기 실행이 실패하는 드문 케이스로 제한된다.
  - 제안: 별도 조치 불필요. 이미 기존 큐 경로(`runExecutionFromQueue`)와 동일한 best-effort 마감 패턴을 그대로 재사용해 새로운 쿼리 패턴을 도입하지 않았다.

- **[INFO]** 2차 실패(catch 내부의 catch) 시 로그만 남기고 재시도/backoff 없음
  - 위치: `executeAsync` 내 `await this.failFirstSegmentSetup(executionId, err).catch((secondaryErr) => { this.logger.error(...) })`
  - 상세: DB 장애 등으로 `failFirstSegmentSetup` 자체가 실패하면 즉시 로그로 흡수하고 종료한다. 성능 관점에서는 무한 재시도/폴링이 없어 리소스 고갈 위험이 없다는 점이 오히려 안전한 설계다. §7.1 stale-fail(30분 recovery) 이 최종 안전망으로 남아있어 이중 방어가 유지된다.
  - 제안: 조치 불필요 (설계 의도).

- **[INFO]** fire-and-forget 패턴 유지 — `executeAsync` 는 여전히 `runExecution` 을 await 하지 않고 즉시 `executionId` 반환
  - 위치: `executeAsync` 반환 시점 (3383, 3409)
  - 상세: 이번 diff 는 fire-and-forget 자체 구조를 바꾸지 않는다. 추가된 코드는 `.catch()` 콜백 내부에 한정되어 caller(호출자)의 응답 지연에 영향이 없다.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`execution-engine.service.spec.ts`)의 신규 2개 테스트 — `setImmediate` 를 이용한 flush 패턴
  - 위치: `execution-engine.service.spec.ts:49-105` (M-4 관련 두 개 `it` 블록)
  - 상세: `await new Promise((r) => setImmediate(r))` 로 fire-and-forget catch 체인이 settle 하기를 기다린다. 테스트 실행 시간에 미미한 영향(수 ms)만 있고 프로덕션 코드 성능과는 무관.
  - 제안: 없음.

## 요약

이번 변경(M-4, 06 concurrency Option B)은 `executeAsync`(sub-workflow 비동기 실행)의 오류 처리 경로에 `failFirstSegmentSetup` best-effort 마감 호출을 추가한 것으로, 기존에 `runExecutionFromQueue` 큐 경로에 이미 존재하던 동일 패턴을 그대로 재사용한다. 추가되는 DB 조회/저장/이벤트 발행은 오직 setup 단계 실패라는 드문 예외 케이스에서만 발동하며, 정상 실행 경로(hot path)나 성공 흐름에는 어떤 추가 연산도 발생시키지 않는다. 알고리즘 복잡도, N+1 쿼리, 메모리 할당, 블로킹 I/O, 캐싱 전략 등 어느 관점에서도 성능 저하나 리스크 요인이 발견되지 않았다. 실패 시 무한 재시도 없이 로그로 흡수하는 설계도 리소스 고갈을 방지하는 안전한 선택이다.

## 위험도

NONE

# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** BullMQ 토큰 갱신 프로세서의 경쟁 조건 테스트 케이스 삭제 (파일 17)
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` — diff 상단 삭제 블록 (TEST-C2 주석 포함)
  - 상세: diff 에서 `TEST-C2` 라고 표시된 `propagates refreshAccessToken failure` 테스트가 **삭제**되었다가, 전체 파일 컨텍스트를 보면 동일 테스트가 파일 하단(1421~1435행)에 이미 존재한다. 즉 중복 위치에 있던 테스트가 정리된 것으로, 테스트 자체는 유지되어 있다. BullMQ가 job을 `failed`로 마킹하는 것은 `process()` 가 예외를 re-throw 할 때만 동작하므로, 이 propagation invariant 테스트가 파일 끝에 남아 있는 것은 올바르다.
  - 제안: 현재 상태는 문제 없음. 다만 TEST-C2 라벨이 파일 하단에만 남아 있으므로, 해당 테스트가 반드시 실행되는지 CI 파이프라인에서 확인할 것.

- **[INFO]** `Cafe24TokenRefreshProcessor` — `source`-무관 status 검증 테스트 추가 (파일 17)
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-token-refresh.processor.spec.ts` — `CONC H-2` 주석 블록
  - 상세: `proactive`/`background` source에 관계없이 status가 `connected`가 아닐 때 refresh를 건너뛰는 동작을 검증하는 테스트가 추가되었다. BullMQ의 `jobId` dedup 경쟁 조건(proactive enqueue 후 background가 동일 job을 재사용할 때 source 분기 우회)을 회귀 방지하는 것으로, 동시성 관점에서 올바른 방향이다.
  - 제안: 테스트 외에 실제 `Cafe24TokenRefreshProcessor.process()` 구현에서도 source와 무관하게 status를 먼저 검증하는 guard가 존재하는지 프로덕션 코드를 함께 확인할 것을 권장한다.

- **[INFO]** `Flyway executeInTransaction=false` 설정 추석 추가 (파일 1)
  - 위치: `backend/migrations/V050__integration_cafe24_connected_rotated_idx.conf`
  - 상세: `CREATE INDEX CONCURRENTLY`는 트랜잭션 블록 내에서 실행이 불가능하며, 이를 위해 `executeInTransaction=false`로 트랜잭션 감싸기를 해제한 것은 동시성 관점에서 정확한 처리다. CONCURRENTLY 옵션 자체가 운영 테이블의 쓰기 잠금 시간을 최소화하므로 운영 중 인덱스 생성이 가능하다. 변경은 기존 설정에 주석을 추가한 것뿐이며 동작 변경은 없다.
  - 제안: `executeInTransaction=false` 상태에서 인덱스 생성 중 마이그레이션이 실패하면 Flyway가 자동 롤백을 하지 않으므로, 실패 시 수동 `DROP INDEX IF EXISTS` 후 재실행이 필요하다는 점을 운영 가이드에 명시할 것을 권장한다.

나머지 변경 파일(파일 2~16, 18~23)은 Swagger 데코레이터 추가/리팩토링, DTO 분리, 테스트 설명 문자열의 언어 표기 변경(Korean → 영문)으로 구성되어 있으며, 동시성과 무관한 변경이다.

## 요약

이번 변경의 동시성 관련 핵심은 두 가지다. 첫째, Flyway `CREATE INDEX CONCURRENTLY`에 대한 `executeInTransaction=false` 설정에 주석이 추가되어 의도가 명확해졌다 — 동작 자체는 이전부터 올바르게 구성되어 있었다. 둘째, BullMQ `Cafe24TokenRefreshProcessor`에서 source-무관 status 검증이 `CONC H-2` 회귀 방지로 테스트 커버리지가 확충되었다. 삭제된 것처럼 보인 TEST-C2(`propagates refreshAccessToken failure`) 테스트는 파일 하단에 그대로 존재하므로 propagation invariant 검증은 유지된다. 전반적으로 동시성 관점의 위험 요소는 발견되지 않았으며, 기존 race-safe 패턴이 올바르게 유지되고 있다.

## 위험도

LOW

# 성능(Performance) Review — rotate() lost-update 수정

## 발견사항

- **[INFO]** 락 안에서 `update()` 뒤 행을 다시 `findOne()` 으로 재조회 — 추가 SELECT 라운드트립
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 내부 `dataSource.transaction` 콜백, `const row = affected ? await repo.findOne(...) : null;` (라인 1202-1204)
  - 상세: `pessimistic_write` 트랜잭션 안에서 `UPDATE` 실행 후 응답용 최신 값(`updated_at` 등)을 얻기 위해 별도 `SELECT` 를 한 번 더 왕복한다. TypeORM `update()` 는 `RETURNING` 을 기본 지원하지 않아 이 패턴 자체는 리팩터 이전에도 있던 형태이고(트랜잭션 밖에서 동일하게 재조회), 이번 변경은 그 재조회를 트랜잭션/락 **안**으로 옮긴 것뿐이다 — 왕복 1회가 늘거나 준 것이 아니라 락 보유 구간에 포함되도록 위치만 바뀌었다.
  - 제안: `manager.createQueryBuilder().update(Integration).set(changes).where(...).returning('*')` 형태로 바꾸면 UPDATE 한 번으로 갱신된 행을 함께 받아 이 SELECT 왕복을 없앨 수 있다. 다만 이 rotate 호출 전체가 실제 접속 연결 테스트로 이미 수 초가 걸리는 경로이고 이 SELECT 는 로컬 PK 조회(밀리초 이하)라 체감 효과는 미미 — 우선순위 낮음.

- **[INFO]** `pessimistic_write` 락으로 동시 `rotate` 요청이 같은 행에서 직렬화됨 — 대기 상한 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 의 `repo.findOne({ where: { id: entity.id, workspaceId }, lock: { mode: 'pessimistic_write' } })` (라인 1168-1171)
  - 상세: 같은 통합 행을 대상으로 한 동시 `rotate` 호출은 이제 DB 행 락으로 순차화된다. 임계 구간(재읽기 → 권한/검증 재계산 → `UPDATE` → 재조회)에 외부 I/O 가 없어 대기 시간 자체는 밀리초 단위로 짧고, 느린 연결 테스트는 락 획득 **이전**에 이미 끝나 있으므로 커넥션 풀 고갈 위험은 없다. 락 대기 타임아웃(`statement_timeout`/`lock_timeout`)은 설정돼 있지 않다.
  - 제안: 별도 조치 불요 — `plan/in-progress/rotate-lost-update.md` §B/§D 및 CHANGELOG 에 "같은 모듈 선례(CONC H-3)와 동일 설계, 임계 구간에 외부 호출 없어 대기는 밀리초"로 이미 의도적 유예가 명시돼 있다. 재지적하지 않음.

- **[INFO]** `mergeAndValidateCredentials`(및 내부 `validateCredentials`/`isUnreadableCredentials`)가 요청당 최대 2회(락 전 스냅샷, 락 안 재읽은 행) 호출됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` 라인 1138(락 전)과 1182-1185(락 안)
  - 상세: 순수 함수이며 입력이 소규모 JSON(credentials 객체) 이라 중복 실행 비용은 무시 가능한 수준. 코드 주석에도 "순수 함수라 임계 구간을 늘리지 않는다"로 의도가 명시돼 있다.
  - 제안: 조치 불요.

## 요약
이번 변경은 `rotate()` 의 lost-update 를 막기 위해 트랜잭션 + `pessimistic_write` 락과 락 안 재읽기/재검증을 추가했다. 성능 관점에서 새로 추가된 비용은 (a) 짧은 로컬 트랜잭션 하나(BEGIN/락 획득 SELECT/UPDATE/재조회 SELECT/COMMIT, 전부 PK 인덱스 접근)와 (b) 순수 검증 함수의 최대 1회 추가 호출뿐이며, 느린 외부 연결 테스트는 여전히 락/트랜잭션 **밖**에서 실행돼 DB 커넥션을 오래 점유하지 않는다 — 이는 커넥션 풀 고갈을 피하는 바람직한 배치다. N+1 쿼리, 불필요한 대량 메모리 할당, 블로킹 I/O 확대, 알고리즘 복잡도 악화 등 CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다. 유일한 개선 여지(update+재조회 라운드트립 병합)는 전체 지연(수 초)에 비해 영향이 미미해 INFO 로 남긴다. 저장소 트리에 뮤테이션을 가하지 않았고 `git status --short` 로 워킹트리 상태 변화가 없음을 확인했다.

## 위험도
NONE

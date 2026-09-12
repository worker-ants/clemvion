# 성능(Performance) Review — keyset 커서 UUID 검증 배치

## 발견사항

발견된 CRITICAL/WARNING 없음. 참고용 INFO 1건만 기재한다.

- **[INFO]** 검증 추가가 오히려 불필요한 DB 왕복을 줄인다 (긍정적 부수효과)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61` (`decodeCursor` 의 `if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`decodeCursor` 내부 `if (!isUuidShaped(parsed.i)) { throw new Error(...); }`)
  - 상세: 두 검증 모두 고정 길이(36자) 문자열에 대한 단순 정규식 매치(`UUID_SHAPE_PATTERN`, `codebase/backend/src/common/utils/uuid.ts:59-64`)로 O(1)/요청이며, 중첩 정량자가 없어 ReDoS 우려도 없다. 이 검증이 없던 종전에는 잘못된 id 가 그대로 `qb.andWhere(...)` 바인딩까지 흘러가 Postgres 라운드트립 후 SQLSTATE 22P02 로 거부되고, 그 예외가 `GlobalExceptionFilter` 를 거쳐 500 으로 변환되는 비용(쿼리 실행 + 예외 처리 + 로깅)을 매번 치렀다. 지금은 입구에서 즉시 거부하므로 무효 커서에 대해서는 DB 왕복 자체가 사라진다. `background-runs.service.ts` 쪽은 `verifyExecutionAccess`(소유권 조회 쿼리)보다 먼저 `decodeCursor` 가 실행되는 기존 호출 순서 그대로라, 잘못된 커서인 경우 소유권 조회 쿼리도 함께 절약된다.
  - 제안: 조치 불필요 — 그대로 유지 권장.

## 요약

이번 diff 의 실질 프로덕션 코드 변경은 두 `decodeCursor` 함수에 `isUuidShaped()` 정규식 검사 한 줄씩을 추가한 것이 전부다(`uuid.ts` 자체는 문서 주석만 확장, 새 런타임 로직 없음). 정규식은 고정 길이·비중첩 패턴이라 시간/공간 복잡도에 영향이 없고, 반복문 내 DB 호출(N+1)·불필요한 객체 생성·블로킹 I/O·캐싱 필요성·비효율 자료구조 등 점검 관점 어디에도 해당하는 변경이 없다. 오히려 무효 커서를 입구에서 조기 거부함으로써 종전에 Postgres 까지 갔다가 22P02 예외로 500 을 만들던 낭비 왕복을 없애는 방향이라 성능상 중립~미세 개선이다. 나머지 파일(테스트·CHANGELOG·plan 문서)은 런타임 경로에 영향이 없다. `background-runs.service.ts`/`login-history.service.ts` 의 기존 페이지네이션·배치 삭제(`pruneOlderThanRetention`)·집계 쿼리 로직은 이번 diff 의 변경 대상이 아니며 그대로 유지된다.

## 위험도

NONE

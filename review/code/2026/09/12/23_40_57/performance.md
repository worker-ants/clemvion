# 성능(Performance) Review

## 발견사항

- **[INFO]** 커서 `id` 검증 추가는 실질적으로 성능을 개선하는 방향의 변경이다 (회귀 아님)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178` (`decodeCursor`)
  - 상세: 두 곳 모두 `isUuidShaped()` 검사를 **DB 쿼리 바인딩 이전**에 추가했다. 종전에는 비-UUID id 가 그대로 `qb.andWhere(...)` 에 바인딩되어 Postgres 왕복 후 SQLSTATE 22P02 로 거부당하는 흐름이었다 — 즉 실패 판정이 네트워크 왕복 + DB 파싱 비용을 쓴 뒤에야 일어났다. 이번 변경은 그 판정을 애플리케이션 레이어의 정규식 매칭(O(1), 고정 길이 36자)으로 앞당겨 실패 케이스에서 불필요한 DB 왕복을 제거한다. 정상 케이스(유효 UUID)의 경로에는 문자열 정규식 매칭 1회(무시 가능한 비용)만 추가된다.
  - 제안: 없음 — 개선 방향이므로 그대로 유지.

- **[INFO]** `isUuidShaped`/`UUID_SHAPE_PATTERN` 정규식은 ReDoS 위험이 없다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:42-47`
  - 상세: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` 는 각 그룹이 고정 길이 정량자(`{8}`,`{4}`,`{12}`)만 쓰고 중첩 정량자·모호한 알터네이션이 없어 백트래킹 폭발 여지가 없다(선형 시간, 입력 길이와 무관하게 사실상 상수 시간 — 커서 문자열은 애초에 짧다). 사용자 입력(`cursor`)이 그대로 이 정규식에 들어가는 경로이므로 확인했으나 문제 없음.
  - 제안: 없음.

- **[INFO]** 신규 회귀 테스트(`login-history.service.spec.ts`)는 성능 관점에서 특이사항 없음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:165-182`, `194-204`
  - 상세: 추가된 두 테스트 케이스는 mock 기반 unit test 로 실제 DB/네트워크 호출이 없다. 반복 루프나 대량 fixture 생성도 없어 테스트 실행 비용에 미치는 영향은 무시 가능하다.

- **[INFO]** `CHANGELOG.md`, `plan/in-progress/*.md` 변경은 문서 전용 — 성능 관점 대상 아님
  - 위치: `CHANGELOG.md`, `plan/in-progress/keyset-cursor-uuid-validation.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 런타임에 로드/파싱되지 않는 정적 마크다운 문서이므로 성능 검토 범위 밖.

리뷰 대상 diff 전체에서 알고리즘 복잡도 악화, N+1 쿼리, 불필요한 메모리 할당, 캐싱 필요 지점, 블로킹 I/O 신설, O(n²) 문자열 누적, 부적절한 자료구조, 선행 로딩 이슈는 발견되지 않았다. `background-runs.service.ts` 의 나머지 부분(`Promise.all` 병렬화, 단일 집계 쿼리, cursor 기반 keyset pagination, `take(limit + 1)` 패턴)은 이번 diff 로 손대지 않았고 기존 구조 그대로 유지된다 — 별도 지적 사항 없음.

## 요약

이번 변경은 keyset 커서의 `id`/`i` 성분에 대해 고정 길이·비역추적 정규식 검사 한 줄을 DB 호출 이전에 추가하는 것이 전부다. 추가된 연산은 상수 시간이고, 오히려 잘못된 커서에 대해 불필요한 DB 왕복(파싱 실패로 귀결되는)을 제거해 실패 경로의 지연을 줄인다. N+1, 메모리, 캐싱, 블로킹 I/O, 자료구조 선택 등 다른 관점에서도 새로 도입된 위험은 없다. 성능 관점에서 이 변경은 중립~약간 긍정적이다.

## 위험도

NONE

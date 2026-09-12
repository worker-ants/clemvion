# Database 리뷰

## 발견사항

- **[INFO]** 파라미터화 유지 확인 — SQL 인젝션 관점에서는 회귀 없음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:118-122` (`qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', …)`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:265-273` (`qb.andWhere('… ne.id > :lastId …', { lastId: cursor.i })`)
  - 상세: 이번 diff 가 추가하는 `isUuidShaped(id)` / `isUuidShaped(parsed.i)` 검증은 TypeORM 의 named parameter 바인딩(`:cursorId`, `:lastId`) 앞단에서 실행되며, 바인딩 방식 자체는 diff 전후로 변경되지 않았다. 즉 이 변경은 **인젝션 방어가 아니라 타입 캐스팅 실패(SQLSTATE 22P02)로 인한 500 마스킹을 막는 것**이 목적이고, 파라미터화는 원래부터 지켜지고 있었다. 리뷰 관점 8개 중 "SQL 인젝션" 항목에 해당하는 위험은 diff 전후 모두 없음.
  - 제안: 없음(확인용 기록).

- **[INFO]** `uuid` 컬럼에 바인딩되는 값을 DB 왕복 전에 앱 레이어에서 조기 거부 — 불필요한 라운드트립·DB 에러 회피
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61` (`if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error('cursor id is not uuid-shaped'); }`)
  - 상세: 두 `decodeCursor` 모두 검증을 **쿼리를 던지기 전**(pure 함수, DB 접근 없음)에 수행하므로, 파싱 불가능한 id 가 더 이상 Postgres 까지 도달해 `invalid input syntax for type uuid` (22P02) 예외를 유발하지 않는다. 이전에는 이 경로가 DB 커넥션을 하나 소모해 쿼리를 실행하고 드라이버 에러로 실패한 뒤 `GlobalExceptionFilter` 에서 500 으로 마스킹됐다 — 지금은 그 라운드트립 자체가 없어져 DB 부하·에러 로그 노이즈도 함께 준다. 순수 방어적 개선이며 부작용은 확인되지 않는다.
  - 제안: 없음(확인용 기록, 긍정적 변경).

- **[INFO]** `isUuidShaped` 는 Postgres `uuid` 컬럼의 실제 파싱 규칙과 의도적으로 정확히 일치 — 과잉 제약으로 정상 조회를 막지 않음
  - 위치: `codebase/backend/src/common/utils/uuid.ts:59-64` (`UUID_SHAPE_PATTERN` / `isUuidShaped`)
  - 상세: 술어가 canonical 8-4-4-4-12 hex 형태만 보고 version/variant nibble 을 검사하지 않는다. 이는 Postgres 가 nil UUID·v6/v7·비-RFC variant 도 `uuid` 컬럼 값으로 정상 파싱·조회한다는 사실과 일치한다. 만약 여기서 더 엄격한 `isValidUuid`(RFC v1–v5) 를 썼다면 DB 가 실제로 조회 가능한 keyset 커서 값(예: nil UUID)까지 400 으로 걷어차게 되어 **DB 관점에서 불필요한 false rejection** 이 생겼을 것 — 술어 선택이 DB 파싱 의미론과 정합적임을 확인. `uuid.spec.ts` 의 경계 테스트(M3/M4 뮤테이션)가 이 정합성을 회귀 테스트로 고정하고 있다.
  - 제안: 없음(확인용 기록).

- **[INFO]** keyset 페이지네이션·인덱스 사용 패턴은 이번 diff 로 변경되지 않음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:110-123` (`findForUser`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:255-278` (`fetchBodyPage`)
  - 상세: 두 쿼리 모두 `(created_at, id)` / `(startedAt, id)` composite tiebreaker 를 사용하는 기존 keyset 페이지네이션 구조를 그대로 유지한다(`take(limit+1)` 로 hasMore 판정, OFFSET 미사용 — 대용량 테이블에 적합). 이번 diff 는 이 쿼리가 실행되기 **이전** 단계(문자열 파싱)에만 검증을 추가했을 뿐 쿼리 형태·정렬·인덱스 활용에는 변화가 없다. `background-runs.service.ts` 상단 주석이 언급하는 V047 부분 expression 인덱스도 diff 대상 밖.
  - 제안: 없음(확인용 기록).

- **[INFO]** 두 디코더의 실패 계약(무시 vs 400)이 다르게 유지됨 — DB 부하 관점에서는 양쪽 다 안전
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:45-63` (`decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:149-188` (`decodeCursor`)
  - 상세: `login-history` 는 검증 실패 시 커서를 조용히 무시하고 1페이지를 반환(500→200), `background-runs` 는 400 `INVALID_CURSOR` 를 던진다(500→400). 두 계약이 다른 것은 `plan/in-progress/keyset-cursor-uuid-validation.md §C`에 문서화된 제품 결정이며 이 리뷰의 범위(DB) 밖의 API 계약 문제다. DB 관점에서는 두 경로 모두 이제 잘못된 값이 쿼리에 바인딩되지 않으므로 동일하게 안전하다.
  - 제안: 없음(참고 — API 계약 통일 여부는 별도 planner 항목).

- **[INFO]** `pruneOlderThanRetention` 배치 삭제(diff 비대상)는 기존 방식 그대로 — 트랜잭션 미사용이 의도적으로 문서화됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:138-163`
  - 상세: 이번 diff 로 수정되지 않은 코드지만 참고로 확인함. subquery(`SELECT id … LIMIT PRUNE_BATCH`) 결과를 `DELETE … WHERE id IN (subquery)` 로 배치 삭제하며, 각 배치를 별도 트랜잭션(암시적 autocommit)으로 실행해 잠금 경합·WAL 팽창을 제한하는 것이 주석에 명시돼 있다. 이 부분은 이번 변경의 대상이 아니므로 새 결함으로 등재하지 않음.
  - 제안: 없음(참고, 비대상 확인).

## 요약
이번 변경은 keyset 커서의 `id` 성분이 검증 없이 Postgres `uuid` 컬럼에 바인딩되어 SQLSTATE 22P02(`invalid input syntax for type uuid`)를 유발하고 이것이 `GlobalExceptionFilter`에서 500으로 마스킹되던 결함을 막는 입구 검증 추가다. 두 소비처(`login-history.service.ts`, `background-runs.service.ts`) 모두 기존 TypeORM 파라미터화 바인딩(named parameter) 방식을 그대로 유지하며 새로운 SQL 인젝션 표면을 만들지 않는다. 검증이 DB 호출 이전(순수 함수) 단계에서 이루어져 오히려 잘못된 값으로 인한 불필요한 DB 라운드트립·드라이버 에러를 없앤다. `isUuidShaped` 술어는 Postgres `uuid` 타입의 실제 파싱 규칙(버전/variant 무관)과 정확히 일치하도록 설계되어 정상 조회 가능한 값을 과잉 거부하지도 않는다. 쿼리 형태·인덱스 사용·페이지네이션 전략(keyset, OFFSET 미사용)은 diff 로 변경되지 않았고 트랜잭션·마이그레이션·커넥션 풀 관련 코드도 이번 변경 범위에 없다. 전반적으로 DB 신뢰성을 개선하는 방어적 수정이며 새로운 DB 관점 위험은 발견되지 않았다.

## 위험도
NONE

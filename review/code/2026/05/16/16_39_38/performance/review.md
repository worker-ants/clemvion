# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `getActivity` — 동일 테이블에 두 번의 쿼리 실행
  - 위치: `integrations.service.ts` — `getActivity` 메서드 내 `items` 쿼리 + `summaryRows` 쿼리
  - 상세: `usageLogRepository`에 대해 `items` 조회와 `summaryRows` 집계를 별도 쿼리로 두 번 실행한다. 두 쿼리 모두 동일한 `integration_id = :id AND at >= :since` 조건을 공유하므로 DB 왕복이 2회 발생한다. 일반적인 사용량에서 큰 문제는 아니지만 `limit` 상한이 100, `days` 상한이 30으로 제한되어 있어 결과 집합 크기는 통제된다.
  - 제안: 단일 쿼리로 통합하거나 (CTE/window function), 또는 현 구조를 유지하되 `Promise.all`로 두 쿼리를 병렬 실행하여 순차 대기 시간을 제거한다. 예: `const [items, summaryRows] = await Promise.all([itemsQuery, summaryQuery])`.

- **[INFO]** `getUsages` 내 이중 DB 조회 (ownership 검증 + 실제 조회)
  - 위치: `integrations.service.ts` — `getUsages` 메서드 (1419–1421행)
  - 상세: `getUsages`는 첫 줄에서 `findById`를 호출해 소속 검증용 SELECT를 수행한 뒤, 이어서 `nodeRepository` JOIN 쿼리를 실행한다. `remove` 호출 경로에서도 `findOne` 후 `getUsages`를 호출해 총 3번의 별도 쿼리가 발생한다. 핫 패스보다는 관리 UI 액션이므로 실제 영향은 제한적이다.
  - 제안: `workspaceId` 조건을 `nodeRepository` JOIN 쿼리에 직접 포함시키면 소속 검증 전용 SELECT를 제거할 수 있다. 단, 404 에러 메시지 일관성을 위한 의도적 분리일 수 있으므로 수정 전 요건 확인 필요.

- **[INFO]** `findAll` 에서 `getCount` + `getMany` 두 번의 쿼리 실행
  - 위치: `integrations.service.ts` — `findAll` 메서드 (1213–1217행)
  - 상세: 페이지네이션 구현을 위해 `qb.getCount()`와 `qb.skip().take().getMany()`를 순차 실행한다. TypeORM의 `getManyAndCount()` 단일 호출로 대체하면 쿼리 왕복을 절반으로 줄일 수 있다. 현재 구조는 잠재적으로 두 쿼리 사이에 데이터가 변경될 경우 count와 rows가 불일치할 수 있다는 부가적인 정합성 문제도 있다.
  - 제안: `const [rows, totalItems] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();` 로 교체한다.

- **[INFO]** `resolveRole`의 반복 호출 — `create`, `rotate`, `requestScopes`, `updateScope`에서 각각 별도 호출
  - 위치: `integrations.controller.ts` — `create`, `rotate`, `requestScopes`, `updateScope` 액션 핸들러 (704, 774, 830, 863행)
  - 상세: 동일 요청 생명주기 안에서 `resolveRole(workspaceId, userId)` 결과를 캐싱하지 않는다. 각 엔드포인트 핸들러가 개별 호출이므로 cross-request 중복은 아니지만, 미래에 단일 핸들러에서 여러 번 호출되는 패턴이 추가되면 N+1이 될 수 있다. 현재는 한 요청당 1회 호출이므로 실질적 영향 없음.
  - 제안: 현 구조는 문제없으나, 향후 하나의 핸들러에서 role을 여러 번 참조하게 될 경우 결과를 로컬 변수로 캐싱하는 패턴을 유지한다.

- **[INFO]** `buildFakeCafe24Integration` — 테스트 전용 팩토리, 프로덕션 성능 무관
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 함수 (42–87행)
  - 상세: 이 변경은 테스트 코드 리팩터링이다. 각 테스트 케이스마다 팩토리 함수를 호출해 소규모 인메모리 객체를 생성하는 것은 성능상 완전히 무해하다. 오히려 이전 방식(인라인 객체 리터럴 반복)보다 유지보수성이 향상되었으며, 성능 영향은 전무하다.
  - 제안: 조치 불필요.

- **[INFO]** `AbortController` 도입으로 in-flight 요청 취소 — 긍정적 성능 개선
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — `useEffect` debounce 블록 (120–178행)
  - 상세: 기존 `cancelled` 불리언 플래그 방식은 응답이 도착한 후에만 상태 업데이트를 무시했으나, 실제 HTTP 요청은 계속 진행되었다. 이번 변경에서 `AbortController`를 도입해 이전 debounce가 cleanup될 때 `controller.abort()`를 호출함으로써 in-flight 요청을 네트워크 레벨에서 취소한다. 사용자가 빠르게 타이핑할 때 불필요한 throttle 카운터 소비와 서버 부하를 줄이는 실질적인 성능 개선이다. `cafe24Precheck` API 함수가 signal을 실제로 `fetch` 옵션에 전달하는지 여부가 효과의 전제 조건이다.
  - 제안: `integrationsApi.cafe24Precheck` 내부에서 `signal`을 `fetch` 또는 axios의 `signal` 옵션으로 전달하고 있는지 확인한다. 전달되지 않으면 `AbortController` 도입의 서버 부하 절감 효과가 실현되지 않는다.

- **[INFO]** `EXPIRING_SOON_INTERVAL` 인라인 문자열 SQL 삽입
  - 위치: `integrations.service.ts` — `findAll` 메서드 (1183–1207행)
  - 상세: `EXPIRING_SOON_INTERVAL = "INTERVAL '7 days'"` 상수를 템플릿 리터럴로 SQL에 직접 보간한다. 이 값은 상수이고 사용자 입력이 아니므로 SQL 인젝션 위험은 없다. 다만 해당 쿼리가 파라미터화되지 않아 PostgreSQL 쿼리 플랜 캐시 재사용률이 소폭 감소할 수 있다. 빈도가 낮은 관리 UI 엔드포인트이므로 실질적 영향은 미미하다.
  - 제안: `qb.setParameter('interval', '7 days')`와 `NOW() + CAST(:interval AS INTERVAL)` 형태로 파라미터화하거나, 현재대로 유지하되 `interval` 값 변경이 spec과 frontend 양쪽에 동기화되어야 한다는 주석을 강화한다 (이미 주석 있음).

## 요약

이번 변경은 주로 테스트 코드 리팩터링(`buildFakeCafe24Integration` 팩토리 도입), Swagger description 보완, 그리고 프론트엔드 debounce 로직에 `AbortController`를 추가하는 내용으로 구성된다. 성능 관점에서 심각하거나 높은 위험도의 문제는 발견되지 않았다. 프론트엔드의 `AbortController` 도입은 오히려 긍정적인 성능 개선이다. 서비스 레이어(`integrations.service.ts`)에서 `getActivity`의 순차 쿼리를 `Promise.all` 병렬화하거나 `getManyAndCount()`로 통합하면 소폭의 레이턴시 개선이 가능하나, 현재 사용 패턴(관리 UI 빈도)에서는 병목으로 작용하지 않는다. 변경된 코드 범위 내에서 N+1 쿼리, 메모리 누수, 블로킹 I/O 등의 주요 성능 문제는 없다.

## 위험도

LOW

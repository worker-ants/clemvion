# 성능(Performance) 코드 리뷰

## 발견사항

- **[WARNING]** `findAllCafe24RowsForMall` — 항상 2회 DB 쿼리 발행
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (신규 헬퍼, diff line +456~+469)
  - 상세: `findAllCafe24RowsForMall` 는 `mallId` 직접 조회(primary path)와 `mallId IS NULL` 인 legacy row 조회를 항상 두 번 순차 실행한다. legacy fallback 이 필요한 시나리오(V045 이전 row 존재 시)는 backfill 완료 전까지만 유효하지만, 현재 코드는 backfill 완료 여부에 무관하게 두 번째 쿼리를 항상 실행한다. primary 결과가 이미 `connected` row 를 포함하는 경우에도 두 번째 쿼리를 실행하는 것은 불필요한 DB 왕복이다. 이 헬퍼는 `begin` (private), `begin` (public), `precheckCafe24Mall` 세 경로에서 모두 호출되므로 debounce precheck 가 초당 수회 호출되는 상황에서는 쿼리 수가 배로 증가한다.
  - 제안: primary 결과(`direct`)를 먼저 확인해 `connected` 상태 row 가 있으면 legacy 쿼리를 건너뛰는 early-exit 조건을 추가한다. `findConnectedCafe24MallIntegration` 에서는 첫 번째 쿼리 결과만으로도 충분히 반환 가능하므로 별도 오버로드를 고려할 수 있다. 또한 backfill 완료 시 legacy 분기 전체를 제거해 단일 쿼리로 최적화한다.

    ```typescript
    // 제안 예시
    private async findAllCafe24RowsForMall(
      workspaceId: string,
      mallId: string,
    ): Promise<Integration[]> {
      const direct = await this.integrationRepository.find({
        where: { workspaceId, serviceType: 'cafe24', mallId },
      });
      // connected 가 이미 있으면 legacy 쿼리 생략 가능 (begin/precheck 모두)
      // 단, precheckCafe24Mall 은 전체 status 가 필요하므로 connected 만으로
      // early-exit 하면 pending/expired/error 를 놓친다 — 아래처럼 direct 가 비어있을 때만 legacy 조회.
      if (direct.length > 0) return direct; // backfill 완료 후 이 한 줄이 최종 형태
      const legacy = (
        await this.integrationRepository.find({
          where: { workspaceId, serviceType: 'cafe24', mallId: IsNull() },
        })
      ).filter((row) => row.credentials?.mall_id === mallId);
      return legacy;
    }
    ```

    단, `direct` 가 비어있을 때만 legacy 를 조회하도록 바꾸면 "direct 에 pending, legacy 에 connected 가 동시 존재"하는 혼합 케이스를 놓칠 수 있다. backfill 이 완전하지 않은 기간 동안은 해당 케이스가 실제로 발생 가능한지 스펙과 대조해 검토 후 적용 여부를 결정한다.

- **[WARNING]** `precheckCafe24Mall` — in-memory 선형 탐색(O(n × k)) 반복
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (diff line +511~+527)
  - 상세: `PRIORITY` 배열(길이 4) 을 순회하면서 각 항목마다 `all.find(...)` 를 호출한다. 결과적으로 최악의 경우 `4 × all.length` 번의 비교가 이루어진다. 현실적으로 `all` 이 수십 개를 넘기 어렵기 때문에 절대적인 CPU 부담은 미미하지만, 동일한 결과를 단일 패스로 얻을 수 있다.
  - 제안: `all` 을 한 번만 순회해 status 별 최초 row 를 Map 에 저장한 뒤 PRIORITY 순으로 lookup 한다.

    ```typescript
    const byStatus = new Map<string, Integration>();
    for (const row of all) {
      if (!byStatus.has(row.status)) byStatus.set(row.status, row);
    }
    for (const status of PRIORITY) {
      const hit = byStatus.get(status);
      if (hit) return { conflict: true, existingIntegrationId: hit.id, existingName: hit.name, status };
    }
    ```

- **[WARNING]** legacy row 의 in-memory `credentials.mall_id` 비교 — 암호화된 JSONB 를 전체 적재
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (diff line +463~+467)
  - 상세: `mallId IS NULL` 조건으로 가져오는 legacy 쿼리는 해당 workspace 의 cafe24 통합 중 V045 이전 row 를 **전체** 조회한다. `credentials` 가 암호화된 JSONB 이면 모든 행의 credentials 를 메모리로 가져와 복호화한 뒤 in-memory `filter` 로 `mall_id` 를 비교한다. workspace 당 legacy row 가 많을수록 불필요한 데이터 전송·복호화가 발생한다.
  - 제안: V045 이전 row 가 여전히 많은 환경이라면 backfill 스크립트를 우선 실행해 `mallId` 컬럼을 채우고 legacy 분기 자체를 제거하는 것이 가장 효율적이다. backfill 전 단기 완화책으로는 쿼리에 `LIMIT` 을 걸거나 TypeORM `select` 옵션으로 필요한 컬럼만 조회하는 방법이 있다.

- **[INFO]** `findConnectedCafe24MallIntegration` — `findAllCafe24RowsForMall` 를 내부 호출 후 `find` 로 connected 만 추출
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts` (diff line +476~+482)
  - 상세: connected 여부만 필요한 `begin` 가드 경로에서도 전체 status row 를 가져와 in-memory `find` 로 좁힌다. 향후 로우 수가 늘어날 경우 미미하지만 불필요한 데이터 전송이 발생한다.
  - 제안: `findConnectedCafe24MallIntegration` 내부에서 TypeORM `where: { ..., status: 'connected' }` 조건을 직접 추가하는 별도 쿼리로 분리하거나, `findAllCafe24RowsForMall` 에 optional status 필터 파라미터를 추가하는 것을 검토한다. 단, begin 가드에서 둘 다 동일 mallId 에 대해 `findAll` 을 이미 호출하는 private 흐름(`createPrivatePendingIntegration`) 과의 중복 호출을 줄이는 리팩토링을 먼저 고려한다.

- **[INFO]** frontend debounce — `useEffect` + `setTimeout` 직접 구현, 취소 로직 누락 엣지케이스
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` (diff line +1268~+1297)
  - 상세: 현재 구현은 `cancelled` 플래그와 `clearTimeout` 을 사용해 경쟁 상태(race condition)를 방지한다. 기능적으로는 올바르나, 컴포넌트 언마운트 순간 `setCafe24PrecheckLoading(false)` 가 실행되어 "Can't perform a React state update on an unmounted component" 경고가 발생할 수 있다. 성능 관점에서는 `cancelled` 플래그 검사로 불필요한 상태 업데이트는 막히지만, 이미 진행 중인 네트워크 요청 자체는 취소되지 않아 브라우저 커넥션을 점유한다.
  - 제안: `AbortController` 를 활용해 cleanup 시 진행 중인 fetch 를 실제로 중단한다. 혹은 `useDebouncedCallback` (예: `use-debounce` 라이브러리) 을 도입하면 debounce + 취소 로직을 단순화할 수 있다.

- **[INFO]** throttle 설정 — rate limiter 가 인메모리 기반일 경우 다중 인스턴스 환경 미적용
  - 위치: `backend/src/modules/integrations/integrations.controller.ts` (diff line +596)
  - 상세: `@Throttle({ default: { limit: 60, ttl: 60_000 } })` 가 선언되어 있으나, NestJS throttler 의 기본 저장소가 인메모리인 경우 로드밸런서 뒤에 여러 인스턴스가 뜨면 인스턴스별로 60회가 독립적으로 카운트되어 사실상 `60 × 인스턴스 수` 가 허용된다.
  - 제안: 프로덕션 환경에서 Redis 기반 throttler store(`@nestjs/throttler` + `ThrottlerStorageRedisService`)를 사용 중인지 확인하고, 미사용 시 적용을 검토한다.

---

## 요약

이번 변경의 핵심인 `findAllCafe24RowsForMall` 헬퍼는 V045 이전 legacy row 지원을 위해 항상 2회 DB 쿼리를 실행하도록 설계되어 있다. precheck endpoint 가 프론트의 350ms debounce 패턴으로 빈번하게 호출되는 점을 고려하면, primary 쿼리 결과가 비어있을 때만 legacy 쿼리를 실행하는 short-circuit 조건을 추가해 불필요한 DB 왕복을 줄이는 것이 권장된다. backfill 완료 후 legacy 분기 전체를 제거하면 단일 인덱스 쿼리(V045 partial UNIQUE 를 활용한 O(1) 조회)로 최적화된다. `precheckCafe24Mall` 의 반복 `find` 는 현재 데이터 규모에서 영향이 거의 없으나 단일 패스 Map 방식으로 개선 가능하다. 프론트엔드 debounce 구현은 기능적으로 올바르나 `AbortController` 미사용으로 인한 불필요한 네트워크 점유 엣지케이스가 있다. 전반적으로 치명적인 성능 결함은 없으며, 주요 병목은 legacy fallback 이중 쿼리에 집중되어 있다.

## 위험도

LOW

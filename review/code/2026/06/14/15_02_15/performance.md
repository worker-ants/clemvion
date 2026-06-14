# 성능(Performance) 코드 리뷰

대상 변경: §A.3 호출 이력 — Execution.source_ip/response_code 컬럼 추가 + getUsage periodCounts + frontend BarChart
검토일: 2026-06-14

---

## 발견사항

### 1. **[WARNING]** `getUsage` 내 순차 실행되는 DB 쿼리 3개 — 병렬화 가능
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage` 메서드 (diff hunk lines ~521~590)
- **상세**: `getUsage` 는 세 개의 DB 쿼리를 순차 await 한다.
  1. `this.triggerRepository.find(...)` — triggerIds 조회
  2. `this.executionRepository.createQueryBuilder('e').getCount()` — totalCalls
  3. `this.executionRepository.createQueryBuilder('e').getRawOne()` — periodCounts (COUNT FILTER)
  4. `this.executionRepository.createQueryBuilder('e').getMany()` — recentCalls

  2·3·4번 쿼리는 모두 동일한 `triggerIds` 를 조건으로 하며 서로 의존성이 없다. 현재 코드는 이를 직렬로 실행해 불필요한 레이턴시를 발생시킨다. 각 쿼리가 독립적이므로 `Promise.all([getCount, getRawOne, getMany])` 패턴으로 병렬화할 수 있다.
- **제안**:
  ```ts
  const [totalCalls, periodRaw, recentExecutions] = await Promise.all([
    this.executionRepository.createQueryBuilder('e')
      .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
      .getCount(),
    this.executionRepository.createQueryBuilder('e')
      .select(...)
      .where(...)
      .setParameters(...)
      .getRawOne(),
    this.executionRepository.createQueryBuilder('e')
      .innerJoinAndSelect(...)
      .where(...)
      .orderBy(...)
      .limit(USAGE_RECENT_CALLS_LIMIT)
      .getMany(),
  ]);
  ```
  트리거 수(N)에 비례해 실행 수(M)가 많은 경우 세 쿼리가 수백ms씩 걸릴 수 있으므로 병렬화 효과가 크다.

---

### 2. **[WARNING]** `execution` 테이블 전체에 인덱스 없이 `trigger_id IN (...)` + `started_at >=` 범위 쿼리
- **위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` + `auth-configs.service.ts` getUsage periodCounts/recentCalls 쿼리
- **상세**: `getUsage` 가 발행하는 쿼리들은 `execution.trigger_id IN (:...triggerIds)` 조건과 `started_at >= :since24h` 같은 범위 조건을 함께 사용한다. `execution` 테이블은 워크플로 실행 이력의 핵심 테이블로 행이 빠르게 증가한다. `trigger_id` 단독 인덱스가 있더라도 `(trigger_id, started_at)` 복합 인덱스가 없으면 `COUNT FILTER (WHERE started_at >= ...)` 절이 `trigger_id IN` 필터 후 전체 범위를 스캔한다. 마이그레이션 V096 은 두 컬럼만 추가하고 인덱스를 추가하지 않는다.
- **제안**: V096 마이그레이션 또는 별도 마이그레이션에 아래 인덱스를 추가한다.
  ```sql
  CREATE INDEX IF NOT EXISTS idx_execution_trigger_started
    ON execution (trigger_id, started_at DESC)
    WHERE trigger_id IS NOT NULL;
  ```
  이 인덱스는 `trigger_id IN (...)` 필터와 `started_at >= :since*` 범위를 모두 커버하며, `LIMIT 20` recentCalls 쿼리에도 사용된다. 이미 해당 인덱스가 이전 마이그레이션에 존재한다면 무시해도 되나, V096 코멘트에 언급이 없으므로 확인이 필요하다.

---

### 3. **[INFO]** `getUsage` — `totalCalls` 를 별도 `getCount()` 로 분리하지 않고 `periodCounts` 의 30d 윈도로 대체 가능 여부 검토
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getCount()` 호출 (~line 555)
- **상세**: `totalCalls` 는 기간 제한 없이 전체 실행 수를 반환(`getCount()`). `periodCounts.last30d` 는 최근 30일로 제한된다. 두 값은 의미가 달라 통합 불가이나, `totalCalls` 쿼리가 `execution` 전체를 스캔한다는 점에서 테이블 크기에 따라 느려질 수 있다. 현재는 별도 쿼리지만, `COUNT(*)` 와 `COUNT(*) FILTER (WHERE ...)` 를 단일 쿼리로 결합하면 쿼리를 하나 줄일 수 있다.
  ```sql
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE started_at >= :since24h) AS last24h,
    COUNT(*) FILTER (WHERE started_at >= :since7d) AS last7d,
    COUNT(*) FILTER (WHERE started_at >= :since30d) AS last30d
  FROM execution
  WHERE trigger_id IN (:...triggerIds)
  ```
  이렇게 하면 2번 쿼리(`getCount`)와 3번 쿼리(`periodCounts getRawOne`)가 단일 쿼리로 합쳐져 DB 왕복 1회 절감.
- **제안**: `getCount()` 와 `getRawOne()` 을 `COUNT(*)` 포함 단일 `getRawOne()` 으로 통합한다.

---

### 4. **[INFO]** `chat-channel` handleChatChannelWebhook 에서 `extractClientIp` 를 다시 호출 — `handleWebhook` 과 달리 재사용 없음
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` — handleChatChannelWebhook 내부 (~line 599)
- **상세**: `handleWebhook` 은 `extractClientIp` 결과를 `clientIp` 변수에 저장해 인증과 호출 이력 영속에 재사용(diff 패치 올바름). 반면 `handleChatChannelWebhook` 는 `sourceIp: extractClientIp(input.headers) ?? undefined` 로 다시 함수를 호출한다. `extractClientIp` 가 헤더 파싱만 하는 순수 함수라 비용이 낮지만, 동일 헤더를 두 번 파싱하는 것은 불일치 패턴이다. `handleChatChannelWebhook` 도 상단에서 한 번만 추출하고 재사용하도록 일관성을 맞추면 된다.
- **제안**: `handleChatChannelWebhook` 상단에 `const clientIp = extractClientIp(input.headers);` 를 추출하고, 하단에서 `sourceIp: clientIp ?? undefined` 로 참조한다.

---

### 5. **[INFO]** 프론트엔드 BarChart `data` 배열이 렌더링마다 새 객체 생성
- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — BarChart data prop (~line 1432)
- **상세**: `BarChart` 의 `data` prop 에 인라인 배열 리터럴(`[{ label: ..., count: ... }, ...]`)이 전달된다. 이 배열은 컴포넌트가 렌더링될 때마다 새 참조로 생성된다. recharts 는 `data` 참조가 바뀌면 차트를 재계산·재렌더링하므로, `usageData.periodCounts` 가 변하지 않아도 부모 리렌더링 시 불필요한 차트 재계산이 발생한다. `usageData` 는 React Query 캐시에서 오므로 변경 빈도가 낮다.
- **제안**: `useMemo` 로 data 배열을 메모이즈한다.
  ```ts
  const periodChartData = useMemo(() => [
    { label: t("authentication.period24h"), count: usageData.periodCounts.last24h },
    { label: t("authentication.period7d"), count: usageData.periodCounts.last7d },
    { label: t("authentication.period30d"), count: usageData.periodCounts.last30d },
  ], [usageData.periodCounts, t]);
  ```
  단, `authentication/page.tsx` 가 이미 God Component 지적을 받은 상황(plan 후속 항목)이므로, 이 개선은 컴포넌트 분리 시 함께 적용하는 것도 합리적이다.

---

## 요약

이번 변경은 `execution` 테이블에 두 컬럼을 추가하고, `getUsage` 에 기간별 집계 쿼리(COUNT FILTER 단일 쿼리)와 recentCalls 에 소스 IP/응답 코드를 추가하는 전형적인 "새 컬럼 집계 추가" 패턴이다. 전반적으로 성능 설계는 합리적이며, 특히 기간별 3종 카운트를 단일 쿼리(COUNT FILTER)로 처리하는 부분은 우수하다. 주요 성능 리스크는 두 가지다: (1) `getUsage` 내 세 DB 쿼리(totalCalls·periodCounts·recentCalls)를 직렬 실행하는 부분은 `Promise.all` 병렬화로 개선 가능하고, (2) `(trigger_id, started_at)` 복합 인덱스 부재 시 대규모 execution 테이블에서 범위 스캔 비용이 커진다. 이 두 항목 외에는 INFO 수준의 소규모 개선이며 현재 트래픽 규모에서는 즉각적인 블로킹 이슈가 아니다.

---

## 위험도

MEDIUM

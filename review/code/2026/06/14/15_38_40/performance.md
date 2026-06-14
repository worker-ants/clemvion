# 성능(Performance) 리뷰

## 발견사항

### 발견 1: **[WARNING]** `totalCalls` 쿼리와 기간별 집계 쿼리의 중복 스캔
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 내 `Promise.all` 블록 (diff lines +430~+461)
- **상세**: `totalCalls`(getCount)와 `periodCounts`(getRawOne) 두 쿼리가 동일한 `WHERE e.trigger_id IN (:...triggerIds)` 조건으로 `execution` 테이블을 각각 독립 스캔한다. totalCalls는 전체 기간 COUNT, periodCounts는 3개 윈도 조건부 COUNT — 둘 다 같은 파티션을 읽는다. `COUNT(*)`와 `COUNT(*) FILTER (WHERE started_at >= :since30d)` 를 하나의 `getRawOne` 쿼리에서 함께 집계(`addSelect('COUNT(*)', 'total')`)하면 DB 왕복을 3→2회로 줄일 수 있다.
- **제안**: `getRawOne` 쿼리에 `COUNT(*) AS total` 을 추가 select하여 `getCount` 쿼리를 제거하고, `totalCalls = safeUsageCount(periodRaw?.total)` 로 가져온다. `Promise.all` 은 2개 쿼리(periodRaw + recentExecutions)로 유지하면 DB 왕복 1회 절감.

### 발견 2: **[WARNING]** `recentCalls` 쿼리의 `innerJoinAndSelect` 가 트리거 전체 엔티티를 로드
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` recentQb (diff +455~+460)
- **상세**: `innerJoinAndSelect('e.trigger', 't')` 는 `Trigger` 엔티티의 모든 컬럼을 SELECT 한다. 사용하는 필드는 `trigger.name` 하나뿐이다. Trigger 엔티티에 `config`(JSON 대형 컬럼 가능성), `authConfigId`, 기타 컬럼이 포함될 경우 네트워크·직렬화 비용이 낭비된다.
- **제안**: `innerJoinAndSelect` 대신 `innerJoin` + `addSelect('t.name', 't_name')` 로 필요한 컬럼만 select. 또는 `leftJoinAndMapOne` 없이 subquery 로 name만 가져오는 방식. `getMany()` 결과에서 `e.trigger?.name` 접근 패턴을 `e['t_name'] ?? 'Unknown'` 으로 전환.

### 발견 3: **[INFO]** `extractClientIp` 호출이 `handleWebhook`과 `handleChatChannelWebhook`에서 각각 1회씩 발생 — 구조 상 문제 없으나 향후 비용 증가 위험
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook` diff +133~+141, `handleChatChannelWebhook` diff +238~+239
- **상세**: 현재는 각 메서드 진입 직후 1회씩만 호출하므로 중복이 아니다. 그러나 `extractClientIp` 가 헤더 파싱 + IP 검증 로직을 포함한다면 향후 재호출 경로 추가 시 누적 가능성이 있다. 코드 주석에도 "인증 IP whitelist 검증과 호출 이력 영속에 공용 — 한 번만 추출"이라고 명시되어 있어 의도는 올바르다.
- **제안**: 현재 구조 유지. 다만 `extractClientIp` 가 외부 API를 호출하거나 정규식이 복잡해질 경우 결과를 상위에서 캐싱하는 전략을 추가 고려.

### 발견 4: **[INFO]** `USAGE_PERIOD_WINDOWS_MS` 상수 계산이 모듈 로드 시점에 단 한 번 평가됨 — 런타임 오버헤드 없음
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` diff +351~+356
- **상세**: `24 * 60 * 60 * 1000` 등의 곱셈은 `as const` 로 선언된 모듈-스코프 객체에 리터럴로 평가된다. JS 엔진이 컴파일 타임에 상수 폴딩(constant folding)하므로 런타임 비용 없음. 양호한 패턴.
- **제안**: 없음.

### 발견 5: **[INFO]** 프런트엔드 `BarChart` 데이터 배열이 렌더링마다 새 객체로 생성됨
- **위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` diff +1456~+1469
- **상세**: `BarChart` 의 `data` prop에 `[ { label: t(...), count: ... }, ... ]` 리터럴 배열이 인라인으로 정의되어 있다. 부모 컴포넌트 리렌더링 시마다 새 배열 참조가 생성되어 recharts 내부에서 deep comparison 없이 re-render가 발생한다. `usageData` 가 변경될 때만 배열을 재생성하는 `useMemo` 를 적용하면 불필요한 차트 재렌더를 방지할 수 있다.
- **제안**: `const chartData = useMemo(() => [ { label: t('authentication.period24h'), count: usageData.periodCounts.last24h }, ... ], [usageData.periodCounts, t])` 로 추출 후 `data={chartData}` 전달.

### 발견 6: **[INFO]** V096 마이그레이션의 파셜 인덱스(`WHERE trigger_id IS NOT NULL`) 설계 — 올바른 선택
- **위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` diff +67~+69
- **상세**: `idx_execution_trigger_started` 가 `trigger_id IS NOT NULL` 파셜 인덱스로 생성되어 schedule/manual 실행 행을 인덱스에서 제외한다. `getUsage` 쿼리가 `WHERE trigger_id IN (...)` 로 항상 NULL 을 제외하므로 파셜 인덱스가 완전히 활용된다. 인덱스 크기 최소화 + 선택도 향상 — 성능 상 적절한 결정.
- **제안**: 없음. 다만 `execution` 테이블 규모가 수억 건 이상으로 커질 경우 `(trigger_id, started_at DESC)` 복합 인덱스의 `started_at DESC` 방향이 PostgreSQL 11+ 에서는 정렬 최적화에 유효하다는 점은 현재도 반영되어 있어 양호.

### 발견 7: **[INFO]** `safeUsageCount` 의 `Number(raw ?? 0)` — 불필요한 `?? 0` 분기
- **위치**: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` diff +361~+364
- **상세**: `Number(null)` 은 `0`, `Number(undefined)` 는 `NaN`. `raw ?? 0` 은 null/undefined 를 `0` 으로 치환한 뒤 `Number(0)` = `0` 을 반환한다. 단, undefined 에 대해서는 `Number(undefined)` = `NaN` → `isNaN` 체크로 `0` 폴백하므로 동일 결과다. `raw ?? 0` 없이 `Number(raw)` 만 해도 동일하게 동작하나 가독성 이슈이고 성능 영향은 무시할 수준.
- **제안**: 기능상 영향 없으므로 유지 가능. 명확성을 위해 `Number(raw ?? '0')` 또는 `raw == null ? 0 : Number(raw)` 로 의도를 명시하는 것도 허용.

---

## 요약

이번 변경의 핵심 성능 포인트는 `getUsage()` 의 3개 쿼리 `Promise.all` 병렬화(이전 직렬 2쿼리 → 병렬 3쿼리)로, 네트워크 레이턴시 관점에서 개선된 구조다. 다만 `totalCalls(getCount)`와 `periodCounts(getRawOne)` 두 쿼리가 동일 테이블 파티션을 중복 스캔하므로 하나의 `getRawOne` 쿼리로 통합하면 DB 왕복을 2회로 줄일 수 있다(WARNING). `recentCalls` 조회에서 Trigger 엔티티를 통째로 JOIN하는 대신 필요한 `name` 컬럼만 select하면 전송 데이터를 줄일 수 있다(WARNING). V096 파셜 인덱스 설계, 상수 사전 계산, `extractClientIp` 단일 호출 패턴은 모두 올바른 선택이다. 프런트엔드의 `BarChart` data prop 인라인 배열은 `useMemo` 로 감싸면 불필요한 리렌더를 방지할 수 있다(INFO). 전반적으로 심각한 성능 결함은 없으나 DB 쿼리 수 최적화 여지가 존재한다.

---

## 위험도

LOW

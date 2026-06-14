# 성능(Performance) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `getUsage` — `findById` + `Trigger.find` 직렬 실행 후 3-parallel 쿼리
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (getUsage 메서드, 변경 라인 398~452)
  - 상세: `getUsage` 는 내부적으로 `findById` (authConfig 조회) → `triggerRepository.find` (triggerIds 수집) → `Promise.all([getCount, getRawOne, getMany])` 순서로 동작한다. 앞 두 쿼리는 직렬로 실행된다. 이는 설계 상 불가피한 의존 관계이므로 blocking 자체는 허용 가능하나, `findById` 가 내부에서 추가 쿼리(예: 소속 workspace 검증)를 발생시키는지 확인이 필요하다. 트리거 조회 결과가 없으면 early return 하는 패턴은 올바르다.
  - 제안: 현재 구조로도 허용 범위이나, `trigger.find` 가 인덱스 지원을 받는지 확인한다(`auth_config_id` 컬럼에 인덱스가 있어야 한다). 없을 경우 full-scan 이 발생할 수 있다.

### 발견사항 2
- **[INFO]** `Promise.all` 3-쿼리 병렬화는 적절하나 `totalCalls` 쿼리가 중복 스캔을 유발한다
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 422~452)
  - 상세: `getCount` 쿼리(triggerIds IN + COUNT(*))와 `getRawOne` 쿼리(triggerIds IN + COUNT(*) FILTER 3종)는 동일 `trigger_id IN (...)` 필터 조건 위에서 같은 테이블을 두 번 스캔한다. `totalCalls` 는 사실상 `last30d` 이상 범위의 총 누적 카운트이지 `last30d` 기간 카운트가 아닌데, 이 둘이 분리된 쿼리이기 때문에 DB 왕복이 1회 추가 발생한다. 두 쿼리를 하나로 합치면 DB 왕복을 줄일 수 있다. 예: `getRawOne` 에 `COUNT(*) FILTER (WHERE ...)` 없는 전체 `COUNT(*)` 를 `total` alias 로 함께 추가.
  - 제안: 단일 `getRawOne` 쿼리에 `COUNT(*) AS total, COUNT(*) FILTER (WHERE e.started_at >= :since24h) AS last24h, ...` 를 통합하면 3-쿼리를 2-쿼리로 줄일 수 있다. 단, 현재 구현도 `Promise.all` 로 병렬 실행되므로 레이턴시 증가는 없다. 최적화 우선순위는 낮다.

### 발견사항 3
- **[INFO]** `USAGE_PERIOD_WINDOWS_MS` 상수: 모듈 로딩 시 1회만 계산되므로 문제 없음
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 351~355)
  - 상세: ms 상수는 컴파일 타임 리터럴 연산이므로 런타임 중복 계산 없음. 올바른 패턴이다.

### 발견사항 4
- **[INFO]** `safeCount` 헬퍼가 매 호출마다 인라인으로 정의됨
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 454~458)
  - 상세: `safeCount` 는 `getUsage` 메서드 바디 안에서 매번 함수 객체로 재생성된다. 성능 영향은 무시 가능하나 모듈 레벨 순수 함수로 올리면 GC 압력이 줄고 테스트가 용이해진다.
  - 제안: `safeCount` 를 모듈 상단으로 올린다. 기능상 변경은 없고 명확성만 개선된다.

### 발견사항 5
- **[INFO]** `recentExecutions.map` — N개 행에 대해 `e.sourceIp ?? null` 와 `e.responseCode ?? e.status` 를 인라인 처리
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (변경 라인 470~479)
  - 상세: `USAGE_RECENT_CALLS_LIMIT = 20` 이므로 최대 20건 순회. 각 항목에서 단순 nullish coalescing 연산만 수행하므로 성능 문제는 없다.

### 발견사항 6
- **[INFO]** V096 마이그레이션 — 부분 인덱스(`WHERE trigger_id IS NOT NULL`) 설계는 적절
  - 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` (라인 67~69)
  - 상세: `idx_execution_trigger_started` 는 `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 부분 인덱스로, schedule/manual(NULL) 행을 제외해 인덱스 크기를 최소화한다. `getUsage` 의 `WHERE e.trigger_id IN (:...triggerIds)` 쿼리 패턴과 정확히 부합한다. 인덱스 설계가 쿼리 패턴과 일치한다.
  - 제안: `started_at DESC` 방향이 `ORDER BY started_at DESC LIMIT 20` 에 최적화되어 있으나, `getCount` 쿼리(정렬 없음)와 `getRawOne` 쿼리(집계, 정렬 없음)는 이 인덱스를 타지 않을 수 있다. `trigger_id` 단독 인덱스가 기존에 있는지 확인한다. 없다면 `(trigger_id)` 단독 인덱스도 추가하거나, 옵티마이저가 부분 인덱스의 앞 컬럼을 집계에 활용할 수 있는지 `EXPLAIN ANALYZE` 로 검증한다.

### 발견사항 7
- **[INFO]** `extractClientIp` 를 `handleWebhook` / `handleChatChannelWebhook` 각각 1회씩만 호출 — 중복 호출 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (변경 라인 1048, 1082)
  - 상세: 이전 코드는 authConfig 인증 검증에서 `extractClientIp(input.headers)` 를 호출하고 `execute()` 호출 시에는 전달하지 않았다. 변경 후에는 `const clientIp = extractClientIp(input.headers)` 를 메서드 상단에서 1회 추출하여 인증·이력 공용으로 재사용한다. 중복 호출이 제거된 올바른 개선이다.

### 발견사항 8
- **[INFO]** 프론트엔드 recharts BarChart — `data` 배열이 매 렌더마다 새 배열 리터럴로 생성됨
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (변경 라인 1455~1470)
  - 상세: `BarChart` 의 `data` prop 에 `[{ label: ..., count: ... }, ...]` 인라인 배열 리터럴을 전달하므로, `usageData` 가 변경되지 않아도 부모 컴포넌트가 리렌더될 때마다 새 배열이 생성된다. 현재 `page.tsx` 가 God Component 이므로 상태 변경이 잦을 수 있다.
  - 제안: `useMemo` 로 `data` 배열을 memoize 하거나, 추후 God Component 분리 시 해당 섹션을 별도 컴포넌트로 추출하면 자연스럽게 해소된다. 현재 배열 크기가 3개 고정이므로 성능 영향은 미미하다. 우선순위 낮음.

### 발견사항 9
- **[INFO]** `response_code VARCHAR(10)` 컬럼 — 전체 execution 행 스캔 시 추가 컬럼 반환 비용
  - 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` (라인 55~57)
  - 상세: `source_ip VARCHAR(45)` + `response_code VARCHAR(10)` 두 컬럼이 execution 테이블 전체에 추가된다. `getMany` (recentCalls 조회) 는 Execution 엔티티 전체를 로딩하므로 두 컬럼이 항상 포함된다. 최대 20건 로딩이므로 실질적인 오버헤드는 없다. NULL 기본값이므로 기존 행의 스토리지 영향도 최소(PostgreSQL TOAST 없음, 컬럼당 1바이트 NULL bitmap).

## 요약

이번 변경은 `execution` 테이블에 `source_ip`/`response_code` 컬럼을 추가하고 `getUsage` API 를 3-쿼리 `Promise.all` 병렬화로 구현한 내용이다. 핵심 쿼리 패턴(`WHERE trigger_id IN (...)`)에 부합하는 부분 인덱스(`idx_execution_trigger_started`)를 마이그레이션에 포함한 점은 올바른 설계다. `extractClientIp` 중복 호출 제거, 트리거 미존재 시 early return, `USAGE_RECENT_CALLS_LIMIT = 20` 고정 상한 등 기본적인 성능 배려가 갖춰져 있다. 주요 개선 포인트는 `totalCalls` 와 `periodCounts` 를 별도 쿼리로 분리하는 것이 DB 왕복을 불필요하게 추가한다는 점이나(INFO 수준), `Promise.all` 병렬 실행 덕에 레이턴시 영향은 없다. `trigger_id` 단독 인덱스의 존재 여부를 `getCount`/`getRawOne` 집계 쿼리 관점에서 확인하는 것을 권장한다.

## 위험도

LOW

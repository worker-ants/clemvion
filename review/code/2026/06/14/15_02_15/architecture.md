# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [WARNING] AuthConfigsService 가 Execution 엔티티에 직접 의존 — 도메인 경계 위반
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (전체 파일, `@InjectRepository(Execution)`)
- 상세: `AuthConfigsService` 는 auth-configs 도메인 서비스임에도 `executions` 모듈의 `Execution` 엔티티 리포지토리와 `triggers` 모듈의 `Trigger` 엔티티 리포지토리에 직접 주입받아 쿼리를 수행한다. 이번 변경에서 `source_ip`/`response_code` 컬럼과 `periodCounts` 집계 쿼리까지 추가되어 auth-configs 서비스가 executions·triggers 도메인의 스키마 세부 사항을 더 많이 알게 됐다. 이는 도메인 간 결합도를 높인다. Integration 도메인이 `IntegrationUsageLog` 전용 엔티티를 통해 집계하는 패턴과 대비된다.
- 제안: `ExecutionsService` 또는 별도 `UsageQueryService`(혹은 `AuthConfigUsageService`)에 `getUsageForAuthConfig(configId, workspaceId)` 메서드를 위임하고, `AuthConfigsService` 는 집계 결과만 받아 DTO 로 변환한다. 단기 해소가 어려우면 최소한 `ExecutionRepository` 쿼리 로직을 private helper method 로 분리하여 향후 이전을 쉽게 만든다.

### [WARNING] `ExecuteOptions` 유니온 타입에 webhook 전용 필드가 triggerId variant 에 혼재 — 인터페이스 분리 원칙 위반
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 558-685 (diff 기준)
- 상세: `ExecuteOptions` 유니온의 `triggerId` 변형에 `sourceIp?` 와 `responseCode?` 가 추가됐다. 이 두 필드는 webhook/chat-channel HTTP 트리거에만 의미가 있고 schedule·manual 트리거에서는 항상 `undefined`/`null` 이다. `triggerId` variant 가 모든 트리거 유형을 포괄하는 상황에서 HTTP 전용 필드가 같은 variant 에 섞이면, 소비측(schedule 트리거 경로)에서 의미 없는 선택적 필드를 계속 시야에 두게 된다. 인터페이스 분리(ISP) 측면에서 불필요한 계약을 클라이언트에 노출하는 구조다.
- 제안: `triggerId` variant 를 `WebhookTriggerOptions`(with `sourceIp?`/`responseCode?`)와 `ScheduleTriggerOptions`(without)로 분리하거나, `triggerType: 'webhook' | 'schedule' | ...` 판별자 필드를 추가해 tagged union 으로 명확히 한다. 단기적으로는 현행 구조도 동작하나, 트리거 유형별 메타데이터가 계속 늘어날 경우 타입이 비대해질 위험이 있다.

### [WARNING] `authentication/page.tsx` 에 차트 렌더링 로직 직접 인라인 — 단일 책임 원칙 위반 심화
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` (diff 라인 1426-1490)
- 상세: 이미 이전 ai-review(WARNING 1·4)에서 God Component 문제가 식별된 `authentication/page.tsx` 에 recharts `BarChart` 설정(data transform, margin, axis props, tooltip style 등 50+ 라인)이 직접 추가됐다. 차트 데이터 변환(`usageData.periodCounts.*` → label/count 배열)과 렌더링 구성이 페이지 컴포넌트 JSX 에 인라인으로 존재한다. 시각화 책임이 페이지 레이어에 있어 단일 책임 원칙(SRP)을 추가로 위반한다.
- 제안: `AuthConfigUsagePeriodChart` 또는 `PeriodCountsBarChart` 컴포넌트를 별도 파일로 추출하고 `periodCounts: UsagePeriodCounts` prop 을 받도록 한다. 이는 기존 계획된 God Component 분리(plan 내 후속 항목)와 동일 방향이며, 차트 추출이 가장 독립성이 높아 분리 비용이 낮다.

### [INFO] `hooks.service.ts` 의 `handleChatChannelWebhook` 에서 `extractClientIp` 중복 호출
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 라인 599-606 (diff 기준)
- 상세: `handleWebhook` 에서는 `extractClientIp(input.headers)` 를 변수 `clientIp` 에 한 번 추출해 인증과 이력 영속에 공용하도록 리팩터링됐다(diff 라인 1037). 반면 `handleChatChannelWebhook` 에서는 `extractClientIp(input.headers) ?? undefined` 를 인라인으로 직접 호출한다. 두 메서드 간 추출 패턴이 일관되지 않아 향후 `extractClientIp` 로직 변경 시 한쪽만 반영할 위험이 있다.
- 제안: `handleChatChannelWebhook` 에서도 지역 변수 `const clientIp = extractClientIp(input.headers)` 를 먼저 추출한 뒤 인증 검증과 `execute()` 호출에 재사용하는 패턴을 동일하게 적용한다.

### [INFO] `getUsage` 에서 3개 별도 쿼리 실행 — 레이어 내 응집도 개선 여지
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (diff 라인 319-357)
- 상세: `getUsage` 는 `totalCalls`(getCount), `periodCounts`(getRawOne), `recentCalls`(getMany) 를 3개의 독립 쿼리로 실행한다. `periodCounts` 쿼리는 `COUNT(*) FILTER` 조건부 집계로 이미 단일 쿼리에서 3개 윈도를 처리하도록 잘 설계됐다. `totalCalls` 도 같은 쿼리에 `COUNT(*) FILTER (WHERE 1=1)` 또는 `COUNT(*)` 로 통합 가능하다. 현재 구조는 기능상 문제없으나 DB 왕복이 3회로 연결 부하가 있다.
- 제안: `totalCalls` 를 `periodCounts` 쿼리에 `COUNT(*)` select 로 통합해 쿼리를 2회로 줄이는 것을 고려한다. 단 이는 성능 최적화 영역이며 현재 규모에서 블로킹 이슈는 아니다.

### [INFO] `response_code VARCHAR(10)` 타입 선택 — 미래 확장성 제약 가능성
- 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` 라인 57, `codebase/backend/src/modules/executions/entities/execution.entity.ts` 라인 748
- 상세: `response_code` 를 `VARCHAR(10)` 으로 정의했다. 현재 HTTP 상태 코드(3자리)와 status enum 폴백('completed', 'failed' 등, 최대 약 20자)을 담기에 10자로 충분하다. 그러나 `ExecutionStatus` 에 `WAITING_FOR_INPUT` 과 같은 긴 enum 값이 있어 폴백 경로에서 잘림이 발생할 수 있다. `getUsage` 의 폴백 로직 `e.responseCode ?? e.status` 에서 status 값이 DB 에 저장되는 것이 아니라 서비스 레이어에서 반환 시 조합되는 방식이므로 현재 저장 경로에서는 문제없다. 단, 향후 다른 코드가 `responseCode` 컬럼에 status 값을 직접 저장하려 할 경우 `WAITING_FOR_INPUT`(17자) 등이 잘릴 위험이 있다.
- 제안: 컬럼 주석에 "status enum 값은 이 컬럼에 저장되지 않고 서비스 레이어에서 폴백 표시됨"을 명확히 해둔다(이미 일부 명시되어 있으나 코드 주석에서 더 강조). 또는 길이를 30자로 늘려 안전 여유를 확보한다.

## 요약

이번 변경은 §A.3 호출 이력(소스 IP·응답 코드·기간별 호출 수)을 기존 `Execution` 테이블에 컬럼 추가(V096)로 구현한 결정을 전 계층(마이그레이션 → 엔티티 → 서비스 → DTO → 프론트엔드)에 일관되게 반영한 작업이다. 각 레이어 책임 분리는 대체로 적절하며 순환 의존성은 없다. 그러나 `AuthConfigsService` 가 `executions` 도메인 리포지토리에 직접 접근해 집계 쿼리를 실행하는 패턴은 도메인 경계를 침범하며(Integration 의 `IntegrationUsageLog` 전용 엔티티 패턴과 상이), 이번 변경으로 결합도가 추가로 심화됐다. `ExecuteOptions` 유니온에 HTTP 전용 메타데이터가 범용 triggerId variant 에 혼재하는 점과 God Component(`authentication/page.tsx`)에 차트 로직이 추가로 인라인된 점도 향후 유지보수 비용을 높이는 구조적 부채다. 기능적으로는 올바르게 동작하나, 서비스 간 경계 정비와 컴포넌트 분리는 단기 후속 작업으로 처리되어야 한다.

## 위험도

MEDIUM

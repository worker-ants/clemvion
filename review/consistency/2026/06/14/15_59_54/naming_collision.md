# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope=`spec/2-navigation/6-config.md`, diff-base=`origin/main`

## 발견사항

### 요구사항 ID 충돌

해당 없음. 구현 diff 는 새 요구사항 ID 를 부여하지 않으며, 기존 spec §A.3 에 이미 정의된 항목을 구현한다.

### 엔티티/타입명 충돌

- **[INFO]** `AuthConfigUsagePeriodCountsDto` — main 코드베이스에 동일 이름 없음
  - target 신규 식별자: `AuthConfigUsagePeriodCountsDto` (`codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`)
  - 기존 사용처: 없음. 동일 파일에 이미 `AuthConfigUsageCallDto`, `AuthConfigUsageDto` 가 존재하나 의미가 다름
  - 상세: 충돌 없음. 네이밍 패턴(`AuthConfig + Usage + <역할> + Dto`)이 기존 DTO 계열과 일관
  - 제안: 없음

- **[INFO]** `UsagePeriodCounts` (frontend interface)
  - target 신규 식별자: `interface UsagePeriodCounts` (`codebase/frontend/src/app/(main)/authentication/page.tsx`)
  - 기존 사용처: 없음
  - 상세: frontend local interface 로 충돌 없음
  - 제안: 없음

### API Endpoint 충돌

해당 없음. diff 는 새 endpoint 를 추가하지 않는다. 기존 `GET /api/auth-configs/:id/usage` 의 응답 shape 를 확장하는 것이다.

### DB 컬럼 충돌

- **[INFO]** `source_ip` / `response_code` 컬럼 (execution 테이블)
  - target 신규 식별자: `execution.source_ip VARCHAR(45)`, `execution.response_code VARCHAR(10)` (V096 마이그레이션)
  - 기존 사용처: spec/1-data-model.md §2.13 Execution 필드 목록에 두 컬럼 모두 미등재. 기존 migrations (V001–V095) 에서 `source_ip` / `response_code` 이름 사용 없음
  - 상세: 충돌 없음. TypeORM entity 에도 기존에 없었음
  - 제안: 없음

### DB 인덱스명 충돌

- **[INFO]** `idx_execution_trigger_started`
  - target 신규 식별자: `CREATE INDEX IF NOT EXISTS idx_execution_trigger_started` (V096)
  - 기존 사용처: `migrations/V002__indexes.sql` 에 `idx_execution_workflow_started`, `idx_execution_status`; `V006`, `V060`, `V067` 에 `idx_execution_*` 계열. `idx_execution_trigger_started` 는 기존 파일 어디에도 없음
  - 상세: 충돌 없음. `CREATE INDEX IF NOT EXISTS` 이므로 동명 충돌 시 에러 없이 skip 되나, 동명 인덱스는 실제로 존재하지 않음
  - 제안: 없음

### 상수명 충돌

- **[INFO]** `USAGE_PERIOD_WINDOWS_MS`, `safeUsageCount`, `WEBHOOK_ACCEPTED_RESPONSE_CODE`
  - target 신규 식별자: 3개 모두 파일-스코프 상수/함수
  - 기존 사용처: main 브랜치 `auth-configs.service.ts` 및 `hooks.service.ts` 에 동명 없음. `USAGE_RECENT_CALLS_LIMIT` 만 기존에 존재(의미 다름)
  - 상세: 충돌 없음

### 이벤트/메시지명 충돌

해당 없음. diff 에 새 webhook·queue·SSE 이벤트명 도입 없음.

### 환경변수·설정키 충돌

해당 없음. 새 ENV var 또는 config key 도입 없음.

### 파일 경로 충돌

- **[INFO]** `V096__execution_source_ip_response_code.sql`
  - target 신규 식별자: 파일명 및 버전 번호 V096
  - 기존 사용처: main 에 V095 까지 존재. V096 은 미사용. `V095__node_execution_exec_status_active_index.sql` 이 현재 최상위
  - 상세: 충돌 없음. 순차 버전 다음 번호를 올바르게 사용
  - 제안: 없음

### i18n 키 충돌

- **[WARNING]** `period7d` / `period30d` 키명이 `statistics` 네임스페이스와 중복
  - target 신규 식별자: `authentication.period7d`, `authentication.period30d` (en/ko authentication.ts)
  - 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/statistics.ts:20–21`, `codebase/frontend/src/lib/i18n/dict/en/statistics.ts:22–23` 에 동일 키명이 `statistics` 네임스페이스로 이미 존재
  - 상세: TypeScript i18n 타입 시스템이 `Dict["authentication"]` / `Dict["statistics"]` 를 별개 네임스페이스로 분리해 런타임 충돌은 없다. 단, `authentication.period7d` = "Last 7d" 와 `statistics.period7d` = "7 Days" 가 의미·포맷이 달라 유지보수 시 혼동 가능. 또한 `statistics` 는 `period24h` 를 갖지 않고 `authentication` 은 `period90d` 를 갖지 않아 두 도메인의 윈도 세트가 불일치한다.
  - 제안: 실제 충돌은 아니므로 blocking 불필요. 향후 공통 키 추출을 검토하거나, 현재 상태를 기록으로 남길 것.

## 요약

이번 구현 diff(`spec/2-navigation/6-config.md §A.3` 호출 이력)가 도입하는 신규 식별자(DB 컬럼 `source_ip`/`response_code`, DTO `AuthConfigUsagePeriodCountsDto`, 상수 `USAGE_PERIOD_WINDOWS_MS`/`safeUsageCount`/`WEBHOOK_ACCEPTED_RESPONSE_CODE`, migration V096, i18n 키 7개)는 main 브랜치 기준으로 기존에 동일 의미 또는 충돌 의미로 사용되는 곳이 없다. i18n `period7d`/`period30d` 키명이 `statistics` 네임스페이스와 같은 이름을 사용하나 TypeScript 네임스페이스가 분리되어 런타임 충돌은 없으며, 다른 의미를 표현(포맷·세트 불일치)할 뿐이다. 전반적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW

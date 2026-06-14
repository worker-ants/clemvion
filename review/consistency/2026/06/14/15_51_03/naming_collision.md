# 신규 식별자 충돌 검토 결과

대상: `spec/2-navigation/6-config.md` §A.3 구현 변경 (diff-base: origin/main)

---

## 발견사항

충돌로 분류할 항목이 없습니다. 아래는 검토한 6개 관점 전체에 대한 확인 결과입니다.

### 1. 요구사항 ID 충돌

구현 diff 는 새 요구사항 ID 를 도입하지 않습니다. 참조된 기존 ID `WH-MG-05` 는 `/Volumes/project/private/clemvion/.claude/worktrees/config-call-history-929994/spec/5-system/12-webhook.md` 라인 93 에 정의되어 있으며, "호출 이력에서 요청 시각·상태·응답 코드 확인" 요건과 일치합니다. 섹션 앵커 `§A.3` 은 `spec/2-navigation/6-config.md` 본문에 이미 존재합니다.

**결과: 충돌 없음.**

### 2. 엔티티/타입명 충돌

신규 도입 이름:

| 이름 | 위치 |
|------|------|
| `AuthConfigUsagePeriodCountsDto` | `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:44` |
| `UsagePeriodCounts` (frontend local interface) | `codebase/frontend/src/app/(main)/authentication/page.tsx:69` |
| `USAGE_PERIOD_WINDOWS_MS` | `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:35` |
| `safeUsageCount` | `codebase/backend/src/modules/auth-configs/auth-configs.service.ts:45` |
| `WEBHOOK_ACCEPTED_RESPONSE_CODE` | `codebase/backend/src/modules/hooks/hooks.service.ts:54` |

이 중 `AuthConfigUsagePeriodCountsDto` 는 이미 존재하는 `AuthConfigUsageCallDto` / `AuthConfigUsageDto` 와 동일 파일에 존재하며 naming 계층이 일관됩니다. 나머지 이름들은 해당 모듈 내부 상수/함수로 스코프가 격리됩니다. 코드베이스 전체에서 동명이 다른 의미로 사용되는 경우를 발견하지 못했습니다.

**결과: 충돌 없음.**

### 3. API endpoint 충돌

구현 diff 에서 새 endpoint 를 추가하지 않습니다. `GET /api/auth-configs/:id/usage` 는 기존에 이미 정의된 라우트이며(`auth-configs.controller.ts:144`), 이번 변경은 응답 shape 에 `periodCounts` 필드를 추가한 것입니다. 응답 필드 추가는 기존 path+method 와 충돌하지 않습니다.

**결과: 충돌 없음.**

### 4. 이벤트/메시지명 충돌

구현 diff 에 webhook event / SSE event / queue 이름 신규 도입이 없습니다.

**결과: 해당 없음.**

### 5. 환경변수·설정키 충돌

구현 diff 에 새 ENV var 또는 config key 도입이 없습니다. `USAGE_PERIOD_WINDOWS_MS` / `USAGE_RECENT_CALLS_LIMIT` / `WEBHOOK_ACCEPTED_RESPONSE_CODE` 은 모두 모듈 내부 상수(exported 아님)입니다.

**결과: 해당 없음.**

### 6. 파일 경로 충돌

신규 추가 파일:
- `codebase/backend/migrations/V096__execution_source_ip_response_code.sql` — Flyway 마이그레이션 버전 번호 V096 은 기존 V095 다음으로 연속하며 중복이 없습니다. V095 는 `.sql` + `.conf` 쌍으로 존재하고 V096 은 `.sql` 단독입니다.
- `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` — 신규 테스트 파일. `__tests__` 폴더 규약과 일치하며 동명 파일 없습니다.

**결과: 충돌 없음.**

---

## DB 컬럼 이름 혼동 가능성 (INFO)

- **[INFO]** `source_ip` vs `ip_address`
  - target 신규 식별자: `execution.source_ip` (V096, `codebase/backend/migrations/V096__execution_source_ip_response_code.sql:60`)
  - 기존 사용처: `audit_log.ip_address`, `login_history.ip_address`, `refresh_token.ip_address` (모두 `VARCHAR(45)`, 동일 의미의 클라이언트 IP)
  - 상세: 다른 테이블에서는 IP 컬럼명을 `ip_address` 로 통일하고 있으나, `execution` 테이블만 `source_ip` 를 사용합니다. 의미는 동일(클라이언트 IP, length 45)하지만 이름이 다릅니다. 실제 혼동이나 런타임 충돌은 없습니다 — 서로 다른 테이블이며 `spec/1-data-model.md §2.13` 에도 `source_ip` 로 명시적으로 기록되어 이미 확정된 선택입니다.
  - 제안: 필요 시 후속 spec 에서 `source_ip` 를 `execution` 전용 도메인 용어로 명시하거나, 향후 IP 관련 신규 컬럼 추가 시 `source_ip` / `ip_address` 선택 기준을 `spec/conventions/migrations.md` 에 한 줄 추가하면 일관성이 높아집니다. 현재 구현에는 문제 없습니다.

---

## 요약

target 구현이 도입하는 신규 식별자(`AuthConfigUsagePeriodCountsDto`, `USAGE_PERIOD_WINDOWS_MS`, `safeUsageCount`, `WEBHOOK_ACCEPTED_RESPONSE_CODE`, DB 컬럼 `source_ip`/`response_code`, 인덱스 `idx_execution_trigger_started`, i18n 키 7종, 마이그레이션 V096)는 기존 사용처와 의미 또는 도메인이 충돌하는 경우가 없습니다. DB 컬럼 이름 `source_ip` 가 타 테이블의 `ip_address` 와 다른 이름 패턴을 사용하지만, 이는 이미 spec 에서 확정된 선택이며 런타임 혼선은 없습니다.

---

## 위험도

NONE

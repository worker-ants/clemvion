# 신규 식별자 충돌 검토

검토 모드: --impl-done  
scope: spec/2-navigation/6-config.md  
diff-base: origin/main

---

## 발견사항

충돌에 해당하는 항목이 발견되지 않았다. 아래는 경계 사례와 INFO 수준 관찰을 포함한 전체 검토 결과다.

### [INFO] i18n 키 `period7d` / `period30d` 가 `authentication` 과 `statistics` 두 네임스페이스에 동시 존재

- target 신규 식별자: `authentication.period7d`, `authentication.period30d`, `authentication.period24h`, `authentication.callCount`, `authentication.periodCounts`  
  (`codebase/frontend/src/lib/i18n/dict/en/authentication.ts` + `dict/ko/authentication.ts`)
- 기존 사용처: `statistics.period7d` ("7 Days" / "7일"), `statistics.period30d` ("30 Days" / "30일")  
  (`codebase/frontend/src/lib/i18n/dict/en/statistics.ts` line 22–23, `ko/statistics.ts` line 20–21)
- 상세: i18n Dict 의 루트 구조는 `ko/index.ts` 에서 `authentication` 과 `statistics` 를 별개 최상위 키로 병합하므로, 동일한 하위 키 이름이 각 네임스페이스 안에 따로 존재해도 런타임 충돌 없음 (`t("authentication.period7d")` 와 `t("statistics.period7d")` 는 독립). 의미도 유사(롤링 윈도 레이블)하므로 혼동 가능성도 낮다.
- 제안: 현 상태 유지 가능. 장기적으로 `authentication.period7d` 의 한국어 값이 `statistics.period7d`("7일")와 달리 "최근 7일"로 더 명시적인 것은 의도적 분기로 보이며 적절하다.

### [INFO] `response_code` 키가 Cafe24 API Catalog 문서에도 존재

- target 신규 식별자: `Execution.response_code` VARCHAR(10) 컬럼 (V096 마이그레이션)
- 기존 사용처: `spec/conventions/cafe24-api-catalog/order/payments.md` — Cafe24 외부 결제 PG 응답 필드 `response_code`
- 상세: 이 `response_code` 는 Cafe24 외부 API 의 JSON 응답 필드명으로, 프로젝트 자체 DB 스키마·DTO 와는 완전히 분리된 외부 API 카탈로그 문서 내 참조다. 엔티티·DTO·마이그레이션 레벨에서 충돌하지 않는다.
- 제안: 조치 불필요.

---

## 각 점검 관점별 요약

### 1. 요구사항 ID 충돌

신규 도입된 요구사항 ID 로는 R-6 (spec/2-navigation/6-config.md §Rationale R-6) 이 있다. 동일 파일 내 R-1~R-5 와 번호가 연속으로 부여돼 있으며, 다른 spec 파일의 R-6 과 혼동될 수 있으나 Rationale 번호는 파일 범위 내에서만 유효한 로컬 ID 로 사용되는 관행이 확인되므로 CRITICAL 충돌에 해당하지 않는다. 또한 WH-MG-05 는 `spec/5-system/12-webhook.md` 에 이미 정의된 기존 요구사항을 이행 표기한 것이며 신규 중복 부여가 아니다.

### 2. 엔티티/타입명 충돌

- `AuthConfigUsagePeriodCountsDto` (신규): 기존 DTO 파일(`auth-config-response.dto.ts`) 안의 다른 DTO 명과 충돌 없음.
- `UsagePeriodCounts` (frontend interface): `codebase/frontend/src/app/(main)/authentication/page.tsx` 에만 선언되어 있으며 같은 파일의 기존 `UsageRecentCall`, `AuthConfigUsage` 와 이름 충돌 없음.
- `ExecuteOptions` 타입에 `sourceIp?`, `responseCode?` 필드 추가: 기존 다른 variant 에 동명 필드 없음.

### 3. API endpoint 충돌

변경은 기존 `GET /api/auth-configs/:id/usage` 의 응답 shape 확장(periodCounts 추가, recentCalls 아이템에 sourceIp/responseCode 추가)이다. 신규 endpoint 를 추가하지 않았으므로 endpoint 충돌 없음.

### 4. 이벤트/메시지명 충돌

이번 변경은 webhook/SSE/queue 이벤트 이름을 새로 도입하지 않는다. `WEBHOOK_ACCEPTED_RESPONSE_CODE` 는 모듈-스코프 상수로, 이벤트명이 아니다.

### 5. 환경변수·설정키 충돌

신규 ENV var 또는 config key 도입 없음. `USAGE_PERIOD_WINDOWS_MS`, `USAGE_RECENT_CALLS_LIMIT`, `WEBHOOK_ACCEPTED_RESPONSE_CODE` 는 모두 모듈 내 상수이며 프로세스 환경변수가 아니다.

### 6. 파일 경로 충돌

- 신규 마이그레이션: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`. 기존 V094, V095 와 번호 순서 정상. 이름 중복 없음.
- 신규 테스트: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx`. 기존 파일 목록과 충돌 없음.
- spec 파일 경로 변경 없음.

---

## 요약

이번 구현(config-call-history §A.3)이 도입한 신규 식별자(`source_ip`/`response_code` DB 컬럼, `AuthConfigUsagePeriodCountsDto`, `UsagePeriodCounts`, `periodCounts` 응답 필드, `sourceIp`/`responseCode` DTO/entity 필드, `WEBHOOK_ACCEPTED_RESPONSE_CODE`/`USAGE_PERIOD_WINDOWS_MS` 상수, `idx_execution_trigger_started` 인덱스, i18n 키 7종)는 기존 영역에서 다른 의미로 사용 중인 식별자와 충돌하지 않는다. Cafe24 API Catalog 문서의 `response_code` 는 외부 API 참조 필드로 프로젝트 엔티티와 무관하며, i18n `period7d`/`period30d` 는 별개 네임스페이스(`authentication` vs `statistics`)에 격리되어 런타임 충돌이 없다. CRITICAL 또는 WARNING 등급의 충돌 없음.

---

## 위험도

NONE

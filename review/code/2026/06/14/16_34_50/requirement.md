# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] `AuthConfigUsagePeriodCountsDto` — `type: Number` 명시 추가 (Swagger 정합성 개선)
- 위치: `auth-config-response.dto.ts` lines 46–66 (`last24h`, `last7d`, `last30d` 각 `@ApiProperty`)
- 상세: 기존 코드는 `type` 을 생략해 Swagger 스키마 추론에 의존했다. 변경 후 `type: Number` 를 명시해 Swagger 문서에서 `integer` 대신 `number` 로 명확히 표시된다. 이는 spec §A.3 의 "롤링 윈도 호출 건수(정수)"와 의미상 완전히 일치한다. 기능 변경 없는 문서 개선.

### [INFO] `sourceIp` `@ApiProperty` — `type: String` 추가 (nullable 필드 Swagger 정합성)
- 위치: `auth-config-response.dto.ts` line 87
- 상세: `nullable: true` 필드에 `type: String` 을 함께 명시한 것. NestJS/Swagger 에서 `nullable: true` 단독이면 일부 Swagger 버전에서 타입 추론 오류가 발생하므로 명시가 바람직하다. spec §A.3 소스 IP 정의(nullable)와 일치.

### [INFO] `AuthConfigUsageCallDto.responseCode` — `type` 필드 미명시 (잠재적 비일관성)
- 위치: `auth-config-response.dto.ts` lines 95–99
- 상세: 같은 파일의 `sourceIp` 는 `type: String` 을 명시했는데, `responseCode` 의 `@ApiProperty` 에는 `type: String` 이 없다. `responseCode` 는 non-null `string` 이므로 기능 오류는 아니지만, 같은 DTO 내 일관성을 위해 `type: String` 추가를 고려할 수 있다.

### [INFO] `spec/5-system/12-webhook.md` — chat-channel 경로 ExecutionEngineService.execute 호출 시그니처 갱신
- 위치: `spec/5-system/12-webhook.md` diff line +984
- 상세: 변경된 spec 행에서 `sourceIp`·`responseCode: '202'` 전달을 명시하고 R-6/config §A.3 를 cross-link 했다. 코드 구현과 spec 서술이 일치한다.

### [INFO] `spec/1-data-model.md` — `idx_execution_trigger_started` partial 인덱스 항목 추가
- 위치: `spec/1-data-model.md` diff line +216
- 상세: `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 인덱스를 인덱스 테이블에 추가. spec §2.13 AuthConfig 호출 집계 경로와 정합하며, V096 마이그레이션 식별자도 일치. `spec/2-navigation/6-config.md R-6` 및 `spec/1-data-model.md §2.13` authConfig 집계 경로 설명(trigger_id IN (...) + started_at 집계)이 신규 인덱스와 선형으로 일치한다.

---

## spec fidelity 점검

### `AuthConfigUsageCallDto` 필드 vs spec §A.3 응답 스펙

spec `6-config.md` line 265:
```
응답 `data`: `{ totalCalls, lastUsedAt, periodCounts: { last24h, last7d, last30d }, recentCalls: [{ id, triggerName, status, sourceIp, responseCode, startedAt }] }` (최근 20건)
```

코드의 `AuthConfigUsageCallDto` 필드:
- `id` (string UUID) ✅
- `triggerName` (string) ✅
- `status` (string) ✅
- `startedAt` (string, date-time) ✅
- `sourceIp` (string | null) ✅
- `responseCode` (string, non-null) ✅

`AuthConfigUsageDto` 최상위:
- `totalCalls` (number) ✅
- `lastUsedAt` (string | null, optional) ✅
- `periodCounts` (AuthConfigUsagePeriodCountsDto) ✅
- `recentCalls` (AuthConfigUsageCallDto[]) ✅ — 주석에 "Up to 20 most recent" 명시

`AuthConfigUsagePeriodCountsDto`:
- `last24h`, `last7d`, `last30d` (number) ✅

**전 필드가 spec §A.3 정의와 line-level 로 일치한다.**

### `responseCode` nullability

spec §A.3 (6-config.md line 102): "응답 코드 … `Execution.response_code`: webhook 은 실제 HTTP 코드, 비-HTTP 트리거는 워크플로 `status` enum 으로 폴백 표시 (R-6, WH-MG-05)"

spec §2.13 (1-data-model.md line 476): "`response_code VARCHAR(10)? NULL 허용` … 비-HTTP 트리거는 NULL → `getUsage` 가 워크플로 `status` enum 으로 폴백 표시"

코드 DTO 주석(lines 92–94): "항상 non-null — HTTP 트리거는 실제 코드, 비-HTTP 트리거는 status enum 폴백"
코드 TypeScript 타입: `responseCode: string` (non-null)

**평가**: DB 컬럼 `response_code` 는 nullable(VARCHAR(10)?) 이지만, `getUsage` 서비스가 null 인 경우 `status` enum 으로 폴백해 항상 string 을 반환하도록 설계되어 있다. DTO 의 `string` (non-null) 타입은 서비스 레이어 폴백 보장을 전제한 것이며, 이는 spec R-6·§A.3 의 "폴백 표시" 설명과 일치한다. 구현 위험 없음. 단, 서비스 레이어에서 실제 폴백 로직이 구현됐는지는 본 diff 범위 밖이므로 INFO 로 기록한다.

---

## 요약

이번 변경은 `AuthConfigUsagePeriodCountsDto` 세 필드에 `type: Number` 를 추가하고 `sourceIp` 의 `@ApiProperty` 에 `type: String` 을 보강한 Swagger 문서 정합성 개선이다. 두 spec 파일(`1-data-model.md`, `5-system/12-webhook.md`)의 변경은 V096 마이그레이션 및 R-6 구현 결정을 spec 본문에 동기화하며, 인덱스 정의·webhook execute 호출 시그니처가 코드 구현 의도와 정확히 일치한다. 기능 요구사항 누락, 필드 불일치, 에러 경로 미정의, TODO/FIXME 는 없다. `responseCode` non-null DTO 타입은 서비스 레이어 폴백을 전제한 합리적 설계이며 spec 서술과 일관된다. `responseCode` 의 `type: String` 미명시(INFO)는 개선 여지이나 기능 결함이 아니다.

## 위험도
NONE

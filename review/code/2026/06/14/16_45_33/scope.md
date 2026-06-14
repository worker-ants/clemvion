# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

- **[INFO]** JSDoc 주석 추가 (`AuthConfigUsagePeriodCountsDto` 3개 필드)
  - 위치: diff 기준 라인 35, 44, 53
  - 상세: `last24h`, `last7d`, `last30d` 에 `/** ... */` TSDoc 블록이 신규 추가됐다. 기존에 없던 주석이다.
  - 판단: 이전 리뷰(16_34_50)의 RESOLUTION I-1 조치 항목 — TSDoc 주석과 `@ApiProperty.description` 불일치("캘린더 일 경계 아님" 문구) 동기화가 목적이다. 기능 변경 없는 메타데이터 보강으로 의도된 범위 내 변경이다.

- **[INFO]** `@ApiProperty` 에 `type: Number` / `type: String` 명시 추가
  - 위치: `AuthConfigUsagePeriodCountsDto` 3개 필드, `AuthConfigUsageCallDto.sourceIp`, `AuthConfigUsageCallDto.responseCode`
  - 상세: 기존에 `type` 키가 없던 `@ApiProperty` 에 `type: Number` 또는 `type: String` 을 추가했다. RESOLUTION I-3/I-9 조치(인접 `sourceIp` 와 패턴 통일)에 해당하며 기능 변화 없는 Swagger 스키마 정합 목적이다.
  - 판단: 범위 내 변경. 단, 파일 내 다른 필드(`AuthConfigDto`, `AuthConfigUsageDto.totalCalls` 등)는 여전히 `type` 없이 추론에 의존 — 이는 이전 리뷰에서 I-2로 이미 인식하고 "본 슬라이스는 변경 필드만 정합" 으로 명시 비조치된 항목이다.

- **[INFO]** `description` 한국어 전환 (`AuthConfigUsagePeriodCountsDto` 3개 필드)
  - 위치: diff 라인 40, 49, 58
  - 상세: 영문 description(`'Rolling 24-hour window count (not calendar day).'` 등)을 한국어로 교체했다. 이전 리뷰 I-7(코드베이스 한국어 정책 확인 권장, 차단 아님)로 기록된 사항이며 RESOLUTION 에서 "코드베이스 다수 DTO 가 한국어 — 일관(차단 아님)"으로 비조치 처리됐다. 이번 변경은 RESOLUTION의 I-1(description 에 "캘린더 일 경계 아님" 추가) 조치와 함께 이루어졌으며 의도된 범위다.

### 파일 2: `spec/1-data-model.md`

- **[INFO]** `§3 인덱스 표`에 단일 행 추가
  - 위치: Execution 인덱스 섹션, `idx_execution_trigger_started` 행 (V096)
  - 상세: `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 인덱스를 §A.3 getUsage 집계 가속 항목으로 추가. PR #602 에서 실제 마이그레이션(V096)이 구현됐으나 spec 인덱스 목록에 누락됐던 내용으로, consistency follow-up 의 핵심 목적과 직접 일치한다.
  - 판단: 범위 내 변경. diff 는 정확히 1행 추가뿐이며 나머지 파일 내용에 변경 없다.

### 파일 3: `spec/5-system/12-webhook.md` (이전 리뷰 16_34_50 대상, 이번 diff 에 재포함)

- **[INFO]** step 7e/8b execute() 인자 및 `R-6` 링크 변경
  - 위치: §7 처리 흐름 step 7e, step 8b
  - 상세: 이전 리뷰 W-1 조치(schedule/manual 은 두 인자 생략 → 컬럼 NULL 명시)와 I-5 조치(R-6 텍스트 참조를 `[R-6](../2-navigation/6-config.md#rationale)` 링크로 교체)에 해당한다. 두 조치 모두 spec 문구 명확화·앵커 링크 정합으로 기능 변경 없다.
  - 판단: 범위 내 변경. RESOLUTION 에 명시된 조치 항목을 이행한 것이다.

### 파일 4-13: `review/code/2026/06/14/16_34_50/` 하위 신규 파일들 (RESOLUTION.md, SUMMARY.md, _retry_state.json 등)

- **[INFO]** 이전 리뷰 세션(16_34_50) 산출물 파일들
  - 위치: `review/code/2026/06/14/16_34_50/` 디렉터리 전체
  - 상세: SUMMARY.md, RESOLUTION.md, database.md, documentation.md, maintainability.md, meta.json, requirement.md, scope.md, security.md, side_effect.md, testing.md, _retry_state.json 은 모두 이전 리뷰 세션의 정규 산출물이다. 이들은 `review/code/**` 경로에 신규 생성됐으며 프로젝트 컨벤션상 코드 리뷰 산출물 저장 위치가 맞다.
  - 판단: 범위 내 파일. 리뷰 인프라 산출물이며 의도된 생성이다.

## 요약

이번 변경은 PR #602(`§A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수`)에 대한 consistency follow-up(spec-sync-602-followup) 슬라이스로, 이전 리뷰(16_34_50)의 RESOLUTION 조치 항목을 이행한 것이다. DTO Swagger 메타데이터 보강(TSDoc 추가, `type` 명시, description 동기화), spec 인덱스 표 갱신(1-data-model.md), webhook 처리 흐름 spec 명확화(12-webhook.md)가 모두 기능 변경 없는 문서·메타데이터 정합 범위 안에 있다. 의도와 무관한 파일 수정, 불필요한 리팩토링, 기능 확장, 설정 파일 변경은 없다. 파일 내 `type` 명시 일관성 미완(다른 필드 미처리)은 이전 리뷰에서 이미 I-2(비조치)로 확인된 사항이므로 범위 이탈이 아니다.

## 위험도

NONE

STATUS=success ISSUES=0

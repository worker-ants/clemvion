# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

- **[INFO]** JSDoc 주석 추가 (`AuthConfigUsagePeriodCountsDto` 3개 필드)
  - 위치: 라인 35, 44, 53 (diff 기준)
  - 상세: `last24h`, `last7d`, `last30d` 에 `/** ... */` JSDoc 블록을 새로 추가했다. 이는 기존에 없던 주석이다.
  - 판단: commit 메시지가 "swagger.md §1-1·§1-4·§3 스타일 정합"을 목적으로 명시하고 있으며, @ApiProperty description 과 내용이 중복되나 관련 스타일 규약 반영이라 의도된 추가다. 기능 변경 없음.

- **[INFO]** `@ApiProperty` 에 `type: Number` / `type: String` 명시 추가
  - 위치: `AuthConfigUsagePeriodCountsDto` 3개 필드 + `AuthConfigUsageCallDto.sourceIp`
  - 상세: 기존에 `type` 키가 없던 `@ApiProperty`에 `type: Number` 또는 `type: String` 을 추가했다. NestJS/Swagger 에서 원시 타입 필드는 명시하지 않아도 reflect-metadata 로 추론되므로 기능 변화는 없다. 단, swagger.md 스타일 규약에 따른 명시적 정합 목적이라 의도된 변경이다.

- **[INFO]** `description` 한국어 전환
  - 위치: `AuthConfigUsagePeriodCountsDto` 3개 필드
  - 상세: 영문 description (`'Rolling 24-hour window count (not calendar day).'` 등)을 한국어(`'최근 24시간 롤링 윈도 호출 건수.'`)로 교체했다. 다른 파일에서 기존에 영문 description 을 유지하고 있는 다른 DTO와 일관성이 다를 수 있다.
  - 제안: 코드베이스 내 다른 DTO의 description 언어 정책과 일치하는지 확인 필요. 이 변경 단독으로는 범위 이탈보다 스타일 결정이다.

### 파일 2: `spec/1-data-model.md`

- **[INFO]** `§3 인덱스 표`에 단일 행 추가
  - 위치: Execution 인덱스 섹션, `idx_execution_trigger_started` 행 (V096)
  - 상세: `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` 인덱스를 §A.3 getUsage 집계 가속을 위한 항목으로 추가. PR #602에서 실제 마이그레이션(V096)이 구현됐으나 spec 인덱스 목록에는 누락됐던 내용으로, consistency follow-up의 핵심 목적과 직접 일치한다.

- **[NONE]** 나머지 파일 내용: 변경 없음. 전체 파일 컨텍스트가 제공됐으나 diff는 정확히 1행 추가뿐이다.

### 파일 3: `spec/5-system/12-webhook.md`

- **[INFO]** step 7e(chat-channel 분기) execute() 인자 현행화
  - 위치: `§7 처리 흐름` step 7e
  - 상세: 구버전 `ExecutionEngineService.execute(workflowId, input, { triggerId: trigger.id })` 에서 `{ triggerId: trigger.id, sourceIp, responseCode: '202' }` 로 시그니처를 현행화했고, §A.3 / R-6 cross-ref 를 추가했다. 실제 구현(PR #602)이 이미 이 인자를 전달하고 있으므로 spec ↔ 코드 gap 해소다.

- **[INFO]** step 8b(일반 webhook 분기) 설명 확장
  - 위치: `§7 처리 흐름` step 8b
  - 상세: 기존 1-line 설명에 `sourceIp`·`responseCode` 전달 의미와 Execution 컬럼 영속 경로에 대한 설명 행을 추가했다. 정보량은 늘었으나 새로운 요구사항 추가가 아니라 기존 구현의 문서화다.

## 요약

3개 파일 모두 PR #602 (`§A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수`) 의 consistency --impl-done 잔여 항목을 해소하는 목적으로, 기능 변경이 없는 spec 현행화 및 DTO swagger 메타데이터 보완이다. 의도와 무관한 파일 수정, 불필요한 리팩토링, 기능 확장, 설정 파일 변경은 없다. DTO description 의 한국어 전환이 코드베이스 내 다른 DTO의 언어 정책과 일치하는지 확인이 권장되나 차단 수준은 아니다. 전반적으로 범위를 잘 준수하고 있다.

## 위험도

NONE

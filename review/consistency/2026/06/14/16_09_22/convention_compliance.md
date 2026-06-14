# 정식 규약 준수 검토 결과

검토 대상: `spec/2-navigation/6-config.md` (--impl-done, diff-base=origin/main)
검토 일시: 2026-06-14

---

## 발견사항

### [INFO] `AuthConfigUsagePeriodCountsDto` 필드에 JSDoc 없음 — `@ApiProperty` 직접 기재
- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 43~62행
- 위반 규약: `spec/conventions/swagger.md §1-1` — "DTO 에서는 JSDoc 주석을 추가하고, 설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 보강"
- 상세: `AuthConfigUsagePeriodCountsDto` 의 `last24h`, `last7d`, `last30d` 세 필드가 JSDoc 없이 `@ApiProperty({ example, description })` 를 직접 달았다. `swagger.md` 권장 패턴은 JSDoc 으로 description 을 공급하고 example 만 `@ApiProperty` 로 보강하는 순서다. 클래스 레벨에도 `/** ... */` 주석은 있으나 필드 레벨에 JSDoc 이 없다.
- 제안: 각 필드에 `/** 롤링 24시간 윈도 호출 건수 (캘린더 버킷 아님). */` 형태의 JSDoc 을 추가하고 `@ApiProperty` 는 `example` 보강으로 축소. 단 `@ApiProperty` 만 단독 사용도 CLI 플러그인이 `description` 필드를 인식하므로 기능적 문제는 없다 — 규약 일관성 이슈.

### [INFO] `AuthConfigUsageCallDto.sourceIp` — `@ApiProperty` 에 `type` 명시 누락
- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 81행
- 위반 규약: `spec/conventions/swagger.md §1-4` — nullable union 필드는 type 을 명시적으로 선언
- 상세: `@ApiProperty({ nullable: true, example: '203.0.113.7' })` 에 `type: String` 이 없다. TS 타입이 `string | null` 인 필드는 CLI 플러그인이 union 으로 추론할 때 `null` 을 포함한 `oneOf` 로 잘못 생성하거나 `type: 'string'` 단독으로 놓칠 수 있다. `spec/conventions/swagger.md §1-4` 는 union/nullable 에 `type` 을 명시하도록 지시한다.
- 제안: `@ApiProperty({ type: String, nullable: true, example: '203.0.113.7' })` 로 `type: String` 추가.

### [INFO] `AuthConfigUsagePeriodCountsDto` description 이 영문 — swagger 주석 톤 규약 불일치
- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` 47행, 52행
- 위반 규약: `spec/conventions/swagger.md §3` — "한국어, 간결, ~한다/합니다 혼용 가능 (기존 프로젝트 문서 스타일 유지)"
- 상세: `description: 'Rolling 24-hour window count (not calendar day).'` 와 `'Rolling 7-day window count.'` 가 영문이다. 동일 파일의 `AuthConfigUsageCallDto.responseCode` description 은 한국어(88~93행)인 반면, `AuthConfigUsagePeriodCountsDto` 의 description 만 영문으로 불일치한다.
- 제안: `description: '롤링 24시간 윈도 호출 건수 (캘린더 일 기준 아님).'` 등 한국어로 통일.

---

## 요약

구현 diff 전반에 걸쳐 정식 규약의 핵심 요구사항(마이그레이션 명명 `spec/conventions/migrations.md`, DTO 파일 위치 `spec/conventions/swagger.md §5-1`, audit action 명명 `spec/conventions/audit-actions.md`)을 모두 준수한다. `V096__execution_source_ip_response_code.sql` 의 snake_case 설명자·단조 증가 번호 체계가 올바르고, `AuthConfigUsagePeriodCountsDto` / `AuthConfigUsageCallDto` 는 `dto/responses/` 위치에 적절히 위치한다. `spec/2-navigation/6-config.md` 의 frontmatter(`status: partial`, `pending_plans`, `code:` glob)는 `spec/conventions/spec-impl-evidence.md §2` 스키마를 충족한다. 발견된 항목은 모두 INFO 등급으로, `swagger.md §1-1·§1-3·§1-4·§3` 의 JSDoc 우선/nullable type 명시/한국어 톤 등 스타일 일관성 제안에 국한된다.

---

## 위험도

LOW

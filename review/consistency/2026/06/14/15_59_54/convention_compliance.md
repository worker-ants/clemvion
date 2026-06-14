# 정식 규약 준수 검토 결과

- **검토 대상**: `spec/2-navigation/6-config.md` (구현 완료 후 검토, diff-base=origin/main)
- **검토 범위**: 구현 diff 에 포함된 모든 파일 (migration, entity, service, DTO, controller test, frontend)
- **검토 일시**: 2026-06-14

---

## 발견사항

### [INFO] DTO JSDoc 언어 혼재 — swagger.md §1-1 권장과 불일치
- **target 위치**: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsagePeriodCountsDto` 3개 필드의 `@ApiProperty({ description: '...' })`
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)"
- **상세**: `AuthConfigUsagePeriodCountsDto` 의 `last24h`/`last7d`/`last30d` 필드는 JSDoc 주석 없이 `@ApiProperty({ description: 'Rolling 24-hour window count (not calendar day).' })` 형태로 영문 description 을 직접 인라인으로 제공했다. 프로젝트 규약은 JSDoc `/** 한국어 ... */` 로 먼저 달고 부족한 경우만 `@ApiProperty` 로 보강하는 패턴을 규정한다. 같은 파일의 `AuthConfigUsageCallDto.sourceIp` / `.responseCode` 는 한국어 JSDoc 을 올바르게 사용하고 있어 이 파일 내에서도 일관성이 없다.
- **제안**: 세 필드에 한국어 JSDoc(`/** 롤링 24시간 윈도 호출 건수 (캘린더 일 아님). */` 등)을 추가하고, `description` 인라인은 제거하거나 영문이 필요한 경우 JSDoc 에 포함시킨다.

---

### [INFO] `AuthConfigUsagePeriodCountsDto` 클래스 레벨 JSDoc 미흡 — swagger.md §1-1
- **target 위치**: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsagePeriodCountsDto` 클래스 선언부 주석
- **위반 규약**: `spec/conventions/swagger.md §1-1` — 한국어 JSDoc 패턴
- **상세**: `/** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d) 호출 건수 (캘린더 버킷 아님) */` 형태로 클래스 레벨 주석이 있어 의도는 명확하다. 단 이 주석이 한글이고 내용도 충분해 사실상 규약 준수에 해당하므로 위반보다는 형식 정도 차이다. 클래스 선언 위 `/** ... */` 주석은 규약 요구사항을 충족한다.
- **제안**: 현재 상태 유지 가능. 필드 레벨 주석만 한국어 JSDoc 으로 통일하면 된다.

---

### [INFO] migration 파일명 설명자가 두 도메인을 혼합 — migrations.md §1 snake_case 권장 준수
- **target 위치**: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- **위반 규약**: `spec/conventions/migrations.md §1` — "설명자는 snake_case. 권장 문자집합은 영문 소문자 + 숫자 + `_`"
- **상세**: 파일명 자체는 `snake_case` 권장 문자집합을 준수한다. `execution_source_ip_response_code` 는 의미를 잘 기술하고 있고 규약 위반이 아니다. 규약이 허용하는 형식 범위 내에 있다.
- **제안**: 없음. 규약 완전 준수.

---

### [WARNING] spec §A.3 의 "기간별 호출 수 미구현(Planned)" 표기가 구현 완료 후에도 갱신되지 않은 채 남아 있음
- **target 위치**: `spec/2-navigation/6-config.md §A.3` 표 — "기간별 호출 수" 행 및 "호출 이력 테이블" 행
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `status` 및 `code:` frontmatter 의 정확성 유지; CLAUDE.md "단일 진실 원칙" — 구현 상태를 spec 에 반영해야 함
- **상세**: `spec/2-navigation/6-config.md §A.3` 의 "기간별 호출 수" 행은 `🚧 미구현 (Planned)` 으로 표기되어 있고, "호출 이력 테이블" 행은 "소스 IP·응답 코드 컬럼은 미구현 / Planned" 로 표기되어 있다. 이번 구현 diff 는 두 항목을 모두 완료했다(migration V096, `AuthConfigUsagePeriodCountsDto`, `sourceIp`/`responseCode` 필드 추가, 프론트엔드 UI). 그러나 spec 문서의 구현 상태 표기는 갱신되지 않았다. `spec-impl-evidence.md` 는 spec 의 `status` 와 `code:` 를 구현 사실의 증거(evidence)로 관리하도록 요구한다. spec 이 아직 "미구현" 상태를 나타내면 frontmatter-evidence 가드가 잘못된 상태를 기준으로 검증할 수 있다.
- **제안**: `spec/2-navigation/6-config.md §A.3` 의 두 행 상태 표기를 갱신한다:
  - "기간별 호출 수" 행: `🚧 미구현 (Planned)` → `✅ periodCounts (24h/7d/30d 롤링 윈도)`
  - "호출 이력 테이블" 행: "소스 IP·응답 코드 컬럼은 미구현 / Planned" → "소스 IP·응답 코드 컬럼 포함 ✅ 구현" (또는 유사한 완료 표현)

  단, spec 수정은 `developer` 역할이 아닌 `project-planner` 권한이므로, 별도 위임이 필요하다. 구현 PR 에 spec 업데이트를 포함시키거나 `project-planner` 에게 위임해야 한다.

---

### [INFO] `spec/2-navigation/6-config.md` frontmatter `status: partial` — 구현 완료 후 `implemented` 로 갱신 여부 검토 필요
- **target 위치**: `spec/2-navigation/6-config.md` frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — status 5 값 lifecycle
- **상세**: frontmatter `status: partial` 은 "spec 내 일부만 구현됨" 을 의미한다. §A.3 의 `기간별 호출 수` 와 `소스 IP·응답 코드` 가 이번 diff 에서 완료되었으므로, 남은 `pending_plans` (`plan/in-progress/spec-sync-config-gaps.md`)의 내용에 따라 여전히 partial 이거나 implemented 로 승격할 수 있는 상황일 수 있다. 자체 결정 불가 — pending_plans 의 범위에 달려 있다.
- **제안**: `plan/in-progress/spec-sync-config-gaps.md` 를 확인해 이번 구현으로 spec 전체가 covered 되었는지 판단한다. 나머지 갭이 없다면 `status: implemented` 로 승격하고 `pending_plans` 를 제거한다. 여전히 미구현 항목이 있다면 현 `partial` 유지.

---

## 요약

구현 diff 는 migration 명명 (`V096__execution_source_ip_response_code.sql`), DTO 파일 위치 (`dto/responses/`), 래퍼 헬퍼 패턴, 감사 액션 미사용(해당 없음) 등 주요 규약을 전반적으로 준수했다. 가장 주목할 이슈는 **[WARNING]**: spec §A.3 의 "미구현(Planned)" 표기가 구현 완료 후에도 갱신되지 않아 단일 진실 원칙(`spec-impl-evidence.md`)이 위반된 상태다. DTO 필드 일부에서 한국어 JSDoc 대신 영문 `description` 인라인을 사용한 패턴 불일치 ([INFO]) 도 확인됐다. CRITICAL 위반은 없다.

---

## 위험도

LOW

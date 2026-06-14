# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/2-navigation/6-config.md`, diff-base=`origin/main`

---

## 발견사항

### 발견 없음 — CRITICAL

해당 등급의 위반은 발견되지 않았다.

---

### 발견 없음 — WARNING

해당 등급의 위반은 발견되지 않았다.

---

### [INFO] 마이그레이션 V096 번호 — 연속성 확인 양호

- target 위치: `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`
- 위반 규약: `spec/conventions/migrations.md §1·§2`
- 상세: 현재 `origin/main` 기준 max(V) = V095 (`V095__node_execution_exec_status_active_index.sql`). 신규 마이그레이션 V096 은 +1 단조 증가 규칙을 준수한다. 파일명 설명자도 `snake_case` 영문 소문자·숫자·`_` 만 사용하여 권장 문자집합을 따른다. 이상 없음.
- 제안: 없음. 정보성 확인 결과.

---

### [INFO] `AuthConfigUsagePeriodCountsDto` DTO 명명 — 규약 허용 범위 내

- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 위반 규약: `spec/conventions/swagger.md §5-1`
- 상세: 신규 `AuthConfigUsagePeriodCountsDto` 는 응답 DTO 파일 위치(`dto/responses/`)와 `Dto` suffix 규약을 준수한다. 필드에 `@ApiProperty` 가 `example`·`description` 과 함께 선언되어 있고 JSDoc 대신 직접 decorator 를 사용한 것은 플러그인 추론이 안 되는 숫자 예시값을 명시하는 올바른 패턴(`swagger.md §1-2`)이다. 이상 없음.
- 제안: 없음. 정보성 확인 결과.

---

### [INFO] `AuthConfigUsageCallDto.responseCode` — `@ApiProperty` nullable 누락 여부

- target 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `responseCode` 필드
- 위반 규약: `spec/conventions/swagger.md §1-4` (nullable 명시)
- 상세: `responseCode: string` 은 TypeScript 타입이 non-null 이고 JSDoc·decorator 설명도 "항상 non-null" 이라고 명확히 기술하고 있으므로 `nullable: true` 생략이 맞다. 반면 `sourceIp` 는 `@ApiProperty({ nullable: true })` 가 올바르게 선언되어 있다. 차이가 의도적임이 DTO 주석에서 확인된다. 이상 없음.
- 제안: 없음. 정보성 확인 결과.

---

### [INFO] `spec/2-navigation/6-config.md` frontmatter `status: partial` 유지 여부 — spec 갱신 미포함

- target 위치: `spec/2-navigation/6-config.md` frontmatter (diff 에 spec 파일 변경 없음)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1` 전이 규칙
- 상세: 구현 diff 는 §A.3 의 "미구현 / Planned" 항목(기간별 호출 수, 소스 IP·응답 코드 컬럼)을 완성했다. 그러나 `spec/2-navigation/6-config.md` §A.3 표의 🚧 기재 및 `status: partial`·`pending_plans` frontmatter 는 이번 diff 에 갱신되지 않았다. 본 검토는 구현 diff 범위이므로 spec 파일 변경이 동반 PR 에 포함되어야 하는지 추적이 필요하다.
  - 현재 spec frontmatter: `status: partial`, `pending_plans: [plan/in-progress/spec-sync-config-gaps.md]`
  - §A.3 표의 두 항목이 완성됐으므로 plan 완료 후 `status` 전이 조건(`pending_plans` 모두 complete)이 도래할 가능성이 있다. 다만 `spec-sync-config-gaps.md` plan 이 §A.3 외에도 다른 항목을 다루는지에 따라 달라지므로 즉각 fail 조건은 아니다. build-time 가드(`spec-status-lifecycle.test.ts`)가 최종 판정한다.
- 제안: §A.3 표의 🚧 항목을 ✅ 로 갱신하고, plan `spec-sync-config-gaps.md` 의 해당 체크박스를 완료 처리하는 spec/plan 갱신 커밋을 동반할 것을 권장. 단, 이는 `project-planner` 역할 범위이며 build 가드가 강제하기 전까지 INFO 수준이다.

---

## 요약

이번 구현 diff(V096 마이그레이션, `auth-configs.service.ts` `getUsage` 확장, `execution-engine.service.ts` `ExecuteOptions` 확장, `hooks.service.ts` 소스 IP/응답 코드 전달, 프론트엔드 usage drawer UI·i18n)는 정식 규약(`spec/conventions/migrations.md`, `swagger.md`, `audit-actions.md`, `error-codes.md`, `spec-impl-evidence.md`)의 요구사항을 전반적으로 잘 준수하고 있다. 마이그레이션 번호 연속성(V095→V096)·파일명 snake_case·DTO 위치와 suffix·`@ApiProperty` nullable/example 패턴이 모두 규약에 부합한다. 유일한 주의 사항은 §A.3 완성에 따른 spec frontmatter 및 plan 상태 갱신이 diff 에 포함되지 않은 점이나, 이는 build-time 가드가 자동 감지할 수 있는 INFO 수준 사항이며 CRITICAL·WARNING 위반은 발견되지 않았다.

---

## 위험도

LOW

# 정식 규약 준수 검토 결과

**검토 모드**: `--impl-done`, scope=`spec/2-navigation/6-config.md`, diff-base=`origin/main`  
**Target 문서**: `spec/2-navigation/6-config.md`  
**실제 변경 대상 코드**: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

---

## 발견사항

### [INFO] JSDoc + @ApiProperty description 중복 기재

- **target 위치**: `auth-config-response.dto.ts` — `AuthConfigUsagePeriodCountsDto` 의 `last24h` / `last7d` / `last30d` 필드 (라인 45–67)
- **위반 규약**: `spec/conventions/swagger.md §1-1` — "JSDoc 주석 → `description` 필드로 전환 (`introspectComments: true`)" / `§1-2` — "설명만으로 부족한 경우에만 `@ApiProperty({ ... })`로 예시(example) 등을 보강"
- **상세**: 변경 후 각 필드에 JSDoc `/** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */` 과 `@ApiProperty({ description: '최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님).' })` 가 동일 텍스트로 중복 기재된다. CLI 플러그인이 `introspectComments: true` 로 활성화된 상태에서 JSDoc 이 `description` 으로 자동 전환되므로, `@ApiProperty` 의 `description` 을 별도로 명시할 필요가 없다. 중복 자체가 런타임 오류를 유발하지는 않으나 유지보수 시 두 곳의 내용이 어긋날 위험이 있다.
- **제안**: `@ApiProperty` 에서 `description` 키를 제거하고 `type` / `example` 만 남긴다.  
  예:
  ```ts
  /** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */
  @ApiProperty({ type: Number, example: 5 })
  last24h: number;
  ```

### [INFO] `AuthConfigUsageCallDto.responseCode` JSDoc + @ApiProperty description 중복 기재

- **target 위치**: `auth-config-response.dto.ts` — `AuthConfigUsageCallDto.responseCode` (라인 91–100)
- **위반 규약**: `spec/conventions/swagger.md §1-1·§1-2` — 동일 사유
- **상세**: 블록 JSDoc 주석과 `@ApiProperty({ description: "webhook 실제 HTTP..." })` 가 다른 텍스트이긴 하지만, JSDoc 이 description 으로 이미 자동 주입되므로 `@ApiProperty.description` 은 이를 덮어쓰는 형태가 된다. 두 텍스트가 서로 다른 수준의 설명을 담고 있어 어느 쪽이 Swagger UI 에 노출될지 혼란을 줄 수 있다.
- **제안**: JSDoc 을 Swagger UI 용 단일 설명으로 통일하고 `@ApiProperty` 에서 `description` 제거. JSDoc 이 충분히 상세하다면 `@ApiProperty({ type: String, example: '202' })` 만 남긴다.

### [INFO] spec frontmatter `status: partial` 유지 — 검토 범위 확인 메모

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter (라인 1–14)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1` — "`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)"
- **상세**: frontmatter 에 `status: partial` + `pending_plans: [plan/in-progress/spec-sync-config-gaps.md]` 가 유지 중이다. 이번 diff 는 DTO 코드의 `@ApiProperty type`·한국어 설명 보강이며 `spec-sync-config-gaps.md` plan 의 완료를 수반하지 않는다. 따라서 현재 `partial` 유지는 규약에 부합한다 — 이 항목은 위반이 아니라 현황 확인용 메모다. plan 이 완료되는 시점에 `implemented` 승격 + `pending_plans` 제거가 동반돼야 build 가드(`spec-status-lifecycle.test.ts §4 (c)`)를 통과한다.
- **제안**: 이번 변경에서 조치 불요. plan 완료 commit 에서 spec frontmatter 승격을 반드시 병행.

---

## 요약

이번 diff(`auth-config-response.dto.ts` 의 `@ApiProperty type: Number/String` 추가 및 description 한국어화)는 정식 규약(`spec/conventions/`) 의 CRITICAL·WARNING 수준 위반을 포함하지 않는다. 유일한 지적 사항은 `spec/conventions/swagger.md §1-1·§1-2` 에서 규정한 "JSDoc 이 `description` 으로 자동 전환되므로 `@ApiProperty.description` 중복 기재 불필요" 원칙과의 INFO 수준 불일치 2건이다 — 런타임 오동작은 없으나 유지보수 시 JSDoc 과 `description` 텍스트가 어긋날 위험이 있다. spec frontmatter 의 `status: partial` 유지는 현재 구현 상태와 부합하며 위반이 아니다.

## 위험도

LOW

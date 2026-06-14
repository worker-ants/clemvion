# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done`
대상 scope: `spec/2-navigation/6-config.md`
Diff 대상: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
Diff base: `origin/main`

---

## 전체 위험도

**LOW** — INFO 2건(JSDoc + @ApiProperty description 중복 기재) 외 실질적 위배 없음.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

해당 없음.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | `AuthConfigUsagePeriodCountsDto` — JSDoc 주석과 `@ApiProperty({ description: ... })` 동일 텍스트 중복 기재. `introspectComments: true` 환경에서 JSDoc 이 description 으로 자동 주입되므로 `@ApiProperty.description` 중복 불필요. 유지보수 시 두 곳이 어긋날 위험. | `auth-config-response.dto.ts` 라인 45–67 (`last24h`, `last7d`, `last30d`) | `@ApiProperty` 에서 `description` 키 제거, `type`/`example` 만 유지. 예: `@ApiProperty({ type: Number, example: 5 })` |
| 2 | Convention Compliance | `AuthConfigUsageCallDto.responseCode` — JSDoc 과 `@ApiProperty({ description: "webhook 실제 HTTP..." })` 텍스트가 서로 달라 Swagger UI 노출 내용 혼란 가능. JSDoc 이 이미 description 으로 주입됨. | `auth-config-response.dto.ts` 라인 91–100 (`responseCode`) | JSDoc 을 단일 설명으로 통일하고 `@ApiProperty.description` 제거. `@ApiProperty({ type: String, example: '202' })` 만 남김. |
| 3 | Convention Compliance | `spec/2-navigation/6-config.md` frontmatter `status: partial` + `pending_plans: [plan/in-progress/spec-sync-config-gaps.md]` 유지 중. 이번 diff 범위에서 plan 완료를 수반하지 않으므로 현재 상태는 규약 부합 (위반 아님). | `spec/2-navigation/6-config.md` frontmatter | plan 완료 commit 시점에 `status: implemented` 승격 + `pending_plans` 제거를 반드시 병행할 것 (`spec-status-lifecycle.test.ts §4(c)` build 가드). |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 타입·API 계약·RBAC·상태 전이 모두 spec 과 일치. `responseCode` DB nullable vs DTO non-null 은 서비스 레이어 폴백(`?? e.status`)으로 해소됨. |
| Rationale Continuity | NONE | `R-6` 롤링 윈도·소스 IP·응답 코드 결정, `R-2` 마스킹 원칙, `spec/1-data-model.md` 컬럼 invariant 모두 침해 없음. 기각된 캘린더 버킷·전용 call-log 엔티티 대안 재도입 없음. |
| Convention Compliance | LOW | `spec/conventions/swagger.md §1-1·§1-2` 의 JSDoc→description 자동 전환 규약과의 INFO 2건(중복 기재). CRITICAL·WARNING 없음. |
| Plan Coherence | NONE | `spec-sync-config-gaps.md` §A.3 완료 표기 정합. 잔여 미결(God Component 분리·§3 spec 보완·§4 rate limiting)과 이번 diff 교차 없음. |
| Naming Collision | NONE | 신규 식별자 도입 없음. 클래스명·필드명·엔드포인트 변경 없음. |

---

## 권장 조치사항

1. **(즉시 불필요, BLOCK 없음)** 이번 변경은 통과. 차단 사유 없음.
2. **(후속 권장 — INFO 1·2)** `auth-config-response.dto.ts` 의 `@ApiProperty({ description: ... })` 중복 제거: `last24h`/`last7d`/`last30d` 및 `responseCode` 에서 `description` 키 삭제, `type`/`example` 만 유지. 다음 DTO 수정 commit 에 포함하면 충분하며 별도 긴급 수정 불필요.
3. **(plan 완료 시 필수 — INFO 3)** `plan/in-progress/spec-sync-config-gaps.md` 완료 commit 에서 `spec/2-navigation/6-config.md` frontmatter 를 `status: implemented` 로 승격하고 `pending_plans` 항목을 제거해야 `spec-status-lifecycle.test.ts §4(c)` build 가드를 통과함.
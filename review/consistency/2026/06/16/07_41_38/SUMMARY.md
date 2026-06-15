# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 순수 리팩터링(God Component 분리)으로 spec·Rationale·Plan 위반 없음. 명명 혼동 가능성(WARNING 1건) 및 추적 누락(INFO 3건) 존재.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `STATUS_BADGE_VARIANT` 동명 상수 중복 — 두 정의가 다른 키 집합을 가짐 | `codebase/frontend/src/app/(main)/authentication/page.tsx` line 59 (module-local) | `codebase/frontend/src/lib/utils/execution-status.ts` line 23 (exported) | authentication page 상수를 `AUTH_USAGE_STATUS_BADGE_VARIANT` 또는 `USAGE_CALL_STATUS_BADGE_VARIANT`로 rename해 도메인 명시. 런타임 충돌은 없으나 혼동 가능성 제거 권장. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Convention Compliance | `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 파일 5개 미등재 (두 checker 동일 지적 — 통합) | `spec/2-navigation/6-config.md` frontmatter lines 6–13 | `code:` 에 `codebase/frontend/src/app/(main)/authentication/**` glob 또는 신규 5개 파일 각각 추가. `project-planner` 역할 담당. |
| 2 | Convention Compliance | hook 테스트 파일에 JSX 없는데 `.tsx` 확장자 사용 | `codebase/frontend/src/app/(main)/authentication/__tests__/use-auth-config-form.test.tsx` | 파일명을 `.test.ts`로 변경 (관행 정렬, 규약 갱신 불필요). |
| 3 | Naming Collision | 프론트엔드 `UsageRecentCall` / `UsagePeriodCounts`가 백엔드 DTO `AuthConfigUsageCallDto` / `AuthConfigUsagePeriodCountsDto`와 prefix 체계 불일치 | `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` | 프론트엔드 인터페이스를 `AuthConfigUsageCall` / `AuthConfigUsagePeriodCounts`로 rename하거나, 향후 공유 타입 추출 시 단일 명명 체계 채택. 기능 충돌 없음. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 영역 간 직접 충돌 없음. God Component 분리 후 frontmatter `code:` 추적 누락(INFO)만 존재. |
| Rationale Continuity | NONE | 30초 자동 hide·type 편집 차단·regenerate 단일 경로 등 모든 Rationale invariant 유지. |
| Convention Compliance | LOW | `spec-impl-evidence` 컨벤션의 구현 경로 최신 유지 취지와 frontmatter 불일치(INFO). 테스트 확장자 관행 불일치(INFO). |
| Plan Coherence | NONE | plan 항목(`[x]` 완료)과 구현 완전 정합. 후속 RBAC UI 가드·webhook followup은 별도 plan에서 독립 추적 중. |
| Naming Collision | LOW | `STATUS_BADGE_VARIANT` 동명·다른 키집합 상수(WARNING). 프론트/백 DTO prefix 불일치(INFO). |

## 권장 조치사항

1. **(WARNING 해소 — 권장)** `authentication/page.tsx`의 `STATUS_BADGE_VARIANT` 상수를 `AUTH_USAGE_STATUS_BADGE_VARIANT` 등 도메인 명시 이름으로 rename. BLOCK 사유는 아니지만 코드베이스 혼동 방지를 위해 이번 PR 또는 후속 소형 PR에서 처리 권장.
2. **(INFO — 다음 planner 작업 시)** `spec/2-navigation/6-config.md` frontmatter `code:` 갱신. `project-planner` 역할로 glob 또는 파일 목록 추가.
3. **(INFO — 선택)** `use-auth-config-form.test.tsx` → `.test.ts` 파일명 변경.
4. **(INFO — 선택)** 프론트엔드 usage 타입 인터페이스 rename 또는 향후 공유 타입 추출 시 일관 명명 체계 적용.
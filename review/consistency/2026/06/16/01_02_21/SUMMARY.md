# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 모드: `--impl-done`
Target scope: `spec/2-navigation/6-config.md`
diff-base: `1899c05e`
검토 일시: 2026-06-16

---

## 전체 위험도

**MEDIUM** — RBAC UI 가드 누락(Warning 2건)이 존재하나 백엔드가 403으로 차단하므로 기능 보안은 유지됨. Critical 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | "Add Auth Method" 버튼에 `isAdmin` 가드 없음 — Editor/Viewer 가 버튼을 보고 클릭해 백엔드 403 혼란 유발 | `codebase/frontend/src/app/(main)/authentication/page.tsx` line 236 (`<Button onClick={form.openCreate}>`) | `spec/5-system/1-auth.md §3.2 RBAC 매트릭스` — Auth Config CRUD = Owner/Admin only | `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 로 감쌈. Edit 버튼(line 502)과 동일 패턴 적용 |
| W-2 | Cross-Spec | Regenerate 버튼에 `isAdmin` 가드 없음 (diff 이전부터 존재하는 pre-existing 이슈) | `codebase/frontend/src/app/(main)/authentication/page.tsx` line ~518 (`onClick={() => setRegenerateTarget(config.id)}`) | `spec/5-system/1-auth.md §4.1 감사 액션` — `auth_config.regenerate` = Admin+ 액션; `§3.2 RBAC` | `{isAdmin && (...)}` 로 Regenerate 버튼을 감싸는 별도 fix. Reveal·Edit 과 동일 패턴 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec / Convention-Compliance / Plan-Coherence | `spec/2-navigation/6-config.md` frontmatter `code:` 에 신규 분리 5파일 미등재 (3개 checker 동일 발견 — 통합) | `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 | `codebase/frontend/src/app/(main)/authentication/page.tsx` 항목을 `codebase/frontend/src/app/(main)/authentication/**` glob 으로 교체. 빌드 가드(spec-code-paths.test.ts)는 page.tsx 존재로 즉시 실패 없음 |
| I-2 | Convention-Compliance | `spec/2-navigation/6-config.md` `status: partial` — `pending_plans` 완료 여부 재점검 필요 | `spec/2-navigation/6-config.md` frontmatter `status` / `pending_plans` | `plan/in-progress/spec-sync-config-gaps.md` 완료 시 plan 을 `plan/complete/` 이동 + `status: implemented` 승격 + `pending_plans:` 제거 |
| I-3 | Cross-Spec | `AuthConfig` 인터페이스 이동 — 데이터 모델 spec 정합 이상 없음 | `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` | 별도 액션 불필요 |
| I-4 | Naming-Collision | `AuthConfig` (프론트엔드 인터페이스) vs `AuthConfigOption` (triggers) — 동일 엔티티 가리키는 의미 중복 (pre-existing) | `auth-config-types.ts` L9 / `codebase/frontend/src/components/triggers/auth-config-select.tsx` L7 | 후속 정리 작업에서 `AuthConfigOption` 을 `AuthConfig` 로 단일화 검토 |
| I-5 | Naming-Collision | `AUTH_CONFIG_TYPE_LABEL_KEYS` (auth-config-select.tsx 하드코딩) vs `AUTH_TYPES` (auth-config-types.ts 파생) — 의미 중복 (pre-existing) | `auth-config-select.tsx` L13 | 후속 PR 에서 `auth-config-select.tsx` 를 `AUTH_TYPES` 에서 동적 파생하도록 변경해 단일 SoT 완성 |
| I-6 | Convention-Compliance | `auth-config-types.ts` 분리 파일 명명 및 `UseAuthConfigForm` 인터페이스 명 — 규약 위반 없음 | `use-auth-config-form.ts` | 별도 액션 불필요 |
| I-7 | Naming-Collision | `AuthDialogMode`, `UseAuthConfigForm`, `useAuthConfigForm`, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `pickPlaintextSecret`, `UsageRecentCall`, `UsagePeriodCounts`, `AuthConfigUsage` — 전체 코드베이스 충돌 없음 | `use-auth-config-form.ts`, `auth-config-types.ts` 등 | 별도 액션 불필요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | RBAC UI 가드 누락 2건 (Warning). 데이터 모델·API 계약·상태 전이 충돌 없음 |
| Rationale-Continuity | N/A (재시도 필요) | output_file 미존재 — 결과 없음 |
| Convention-Compliance | LOW | Critical/Warning 없음. spec frontmatter `code:` 미갱신 및 status 승격 검토 INFO 2건 |
| Plan-Coherence | LOW | plan 정합 양호. spec frontmatter `code:` 미갱신 INFO 1건 (cross-checker 통합) |
| Naming-Collision | NONE | 신규 식별자 전체 충돌 없음. pre-existing 의미 중복 2건 INFO 기록 |

---

## 권장 조치사항

1. **(W-1 해소, 권장)** `page.tsx` line 236 의 "Add Auth Method" 버튼을 `{isAdmin && <Button onClick={form.openCreate}>...</Button>}` 로 감싸 spec `§3.2 RBAC` 와 일치시킨다.
2. **(W-2 해소, 별도 PR 권장)** Regenerate 버튼도 `{isAdmin && (...)}` 로 감싸는 fix 를 추가한다. plan 이 "별도 작은 PR" 로 분리 명시했으므로 현 PR 또는 후속 PR 에서 처리한다.
3. **(I-1 권장)** `spec/2-navigation/6-config.md` frontmatter `code:` 의 page.tsx 단건 항목을 `codebase/frontend/src/app/(main)/authentication/**` glob 으로 교체한다.
4. **(I-2 확인 후 조치)** `plan/in-progress/spec-sync-config-gaps.md` 완료 여부를 확인하고, 완료됐으면 `plan/complete/` 이동 + `status: implemented` 승격 + `pending_plans:` 제거를 수행한다.
5. **(I-4/I-5 후속)** 향후 정리 작업에서 `AuthConfigOption` / `AUTH_CONFIG_TYPE_LABEL_KEYS` 를 `auth-config-types.ts` SoT 로 통합 검토한다.

---

*rationale_continuity checker 결과 파일 미존재 — 해당 checker 결과는 "재시도 필요" 로 표기됨. 나머지 4개 checker 기반으로 통합 판정함.*
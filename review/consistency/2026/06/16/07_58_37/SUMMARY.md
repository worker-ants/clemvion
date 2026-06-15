# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 차단 불필요.

검토 대상: `spec/2-navigation/6-config.md` (diff-base: `47119617`)
검토 모드: `--impl-done` (구현 완료 후)
검토 일시: 2026-06-16 07:58:37

---

## 전체 위험도

**LOW** — 기능 모순·데이터 모델 충돌·API 계약 위반 없음. spec 본문 문서화 gap 4건(INFO) 존재.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

없음.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/2-navigation/6-config.md §3 API` 표에 POST·PATCH·DELETE·regenerate 행의 Admin+ 권한 주석 누락 | `spec/2-navigation/6-config.md §3 Authentication API` 표 | POST·PATCH·DELETE·regenerate 행 설명에 "(Admin+)" 주석 추가, 또는 표 상단에 일괄 주석 기재 |
| 2 | Cross-Spec | `spec/2-navigation/6-config.md §A.1` 화면 구조에 Add·Toggle·Edit·Regenerate·Delete 버튼의 Admin+ UI 가드 기술 없음 | `spec/2-navigation/6-config.md §A.1` | §A.1 또는 별도 권한 소절에 "변경 액션 버튼은 Admin+에만 노출" 명시 |
| 3 | Rationale Continuity | spec §A.4 가 Reveal 버튼만 "Admin+ 노출" 명시, 전체 mutation 버튼 UI 가드 범위 기술 없어 동일 버그 재발 여지 | `spec/2-navigation/6-config.md §A.4` | §A.2 또는 §A.4 에 "모든 변경 액션 버튼(Add·Toggle·Reveal·Edit·Regenerate·Delete)은 Admin+에만 노출" 한 줄 추가 권장 |
| 4 | Convention Compliance | `useHasRole("admin")` 가 Owner 역할을 포함하는지 미확인 — RBAC 매트릭스 "Owner=CRUD"와 정합 여부 | `codebase/frontend` 의 `role-gate.tsx` | `useHasRole` 구현 확인; Owner 가 Admin 역할 포함이면 현행 유지, 그렇지 않으면 `useHasRole(["owner", "admin"])` 으로 수정 |
| 5 | Convention Compliance | `spec/2-navigation/6-config.md` frontmatter `status: partial` — 이번 구현으로 plan 전체 완료 시 `implemented` 승격 및 `pending_plans` 제거 미수행 시 빌드 가드 차단 가능 | `spec/2-navigation/6-config.md` frontmatter | `plan/in-progress/spec-sync-config-gaps.md` 완료 확인 후 동일 PR 에서 (a) plan → `plan/complete/` 이동, (b) frontmatter `status: implemented` 승격 + `pending_plans` 제거 |
| 6 | Plan Coherence | `spec-sync-config-gaps.md` 가 Auth Config RBAC UI 가드를 `[x]` 완료 처리 — 구현과 plan 일치, 조치 불요 | `plan/in-progress/spec-sync-config-gaps.md` | 추적 메모만. 갱신 불요. |
| 7 | Naming Collision | 출력 파일 미생성 — checker 가 결과를 기록하지 않음 (status=success 로 보고됐으나 파일 없음) | — | 재시도 또는 수동 확인 권장 (기능 차단 사유 아님) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec/2-navigation/6-config.md API 표 및 §A.1 화면 구조에 Admin+ 권한 주석 누락 (기능 모순 없음) |
| Rationale Continuity | NONE | 구현이 spec §3.2 RBAC 매트릭스와 완전 일치. 기각된 대안 재도입 없음. spec §A.4 문서화 gap만 권장 |
| Convention Compliance | NONE | frontmatter 구조 준수, API/명명 위반 없음. useHasRole Owner 포함 여부 확인 및 status 승격 타이밍 INFO 수준 |
| Plan Coherence | NONE | 구현이 spec-sync-config-gaps.md 명시 항목과 일치. 미해결 결정 우회 없음 |
| Naming Collision | 재시도 필요 | 출력 파일 미생성 (status=success 보고에도 불구하고 파일 없음) |

---

## 권장 조치사항

1. **(spec 문서화 — project-planner 위임)** `spec/2-navigation/6-config.md §A.4` 에 "Reveal 외 모든 mutation 액션(Add Config·isActive 토글·Edit·Regenerate·Delete)도 Admin+ 만 노출; Editor·Viewer 는 UI 에서 미노출, API 직접 호출 시 403 FORBIDDEN" 추가. 동시에 §3 API 표 POST·PATCH·DELETE·regenerate 행에 Admin+ 주석 추가.
2. **(frontmatter 승격 확인 — developer)** `plan/in-progress/spec-sync-config-gaps.md` 의 완료 여부 확인 후, 완료 시 동일 PR 에서 plan 이동 + `spec/2-navigation/6-config.md` frontmatter `status: implemented` 승격 처리. 미이행 시 `spec-status-lifecycle.test.ts` 빌드 가드 차단 가능.
3. **(구현 검증 — developer)** `role-gate.tsx` 의 `useHasRole("admin")` 이 Owner 역할을 포함하는지 확인. Owner > Admin 계층 구조로 Owner 가 암묵적으로 admin 역할을 갖는다면 현행 유지, 그렇지 않다면 `useHasRole(["owner", "admin"])` 수정 필요.
4. **(Naming Collision checker 재확인)** 출력 파일이 없어 검토 결과를 확인할 수 없음. 필요 시 checker 단독 재실행 권장.
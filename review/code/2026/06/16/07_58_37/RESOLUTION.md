# RESOLUTION — Auth Config 액션 버튼 RBAC UI 가드 (config-c1b-auth-rbac-guard)

> 대상 리뷰: `review/code/2026/06/16/07_58_37/SUMMARY.md` — **RISK LOW / Critical 0 / WARNING 3**.
> 짝 게이트: consistency `--impl-done` `07_58_37` — **BLOCK: NO** (LOW, Critical·WARNING 0).
> 변경: `authentication/page.tsx` 의 모든 변경 액션 버튼(Add Config·Toggle·Reveal·Edit·Regenerate·Delete)을 `{isAdmin && (...)}` RBAC 가드로 통합. spec/5-system/1-auth.md §3.2(Auth Config: Admin=CRUD, Editor/Viewer=R).

## 핵심 정합성 검증 (Critical 후보 사전 반증)
- **`useHasRole("admin")` 가 Owner 를 포함하는가?** ✅ — `role-gate.tsx` `ROLE_LEVEL`(viewer1<editor2<admin3<owner4) + `>=` 비교라 owner(4) ≥ admin(3) = **true**. spec "Owner/Admin=CRUD" 와 정합 (ai-review INFO-7·impl-done INFO-4 모두 이슈 없음 확인). 백엔드 `RolesGuard` 와 동일 계층.
- **이중 방어**: UI `isAdmin` 가드 + 백엔드 `auth-configs.controller.ts` 의 create/update(toggle)/regenerate/reveal/delete 전부 `@Roles('admin')`. UI 우회해도 403.

## WARNING 3건 disposition (전부 test-quality/UX nit — Critical 0)

| # | 발견 | 처분 |
| --- | --- | --- |
| W1 | `useHasRole` mock 이 역할 계층 무시 boolean 플래그 | **ACCEPT** — auth 페이지 테스트는 `useHasRole` 를 의도적으로 boolean 으로 격리 mock 하는 게 적정(역할 계층 `ROLE_LEVEL>=` 로직은 `role-gate` 자체 단위 테스트 책임). 페이지 테스트가 admin/비-admin 이진 가드를 검증하는 것으로 RBAC surface 는 충분히 가드됨 |
| W2 | `isActive=false` 의 "Activate" 라벨 미커버(`MUTATION_BUTTON_NAMES` 에 Deactivate 만) | **ACCEPT** — "Activate"/"Deactivate" 는 동일 토글 버튼의 라벨 삼항(동일 코드 경로·동일 가드)이라 isActive=false fixture 추가는 저가치. 가드 자체는 커버됨 |
| W3 | 비-admin 에 Actions 컬럼 `<th>` 헤더가 빈 칸으로 잔존(UX) | **ACCEPT(문서화된 결정)** — 모든 액션이 Admin+ 라 비-admin 은 빈 Actions 칸을 본다. 헤더/셀을 isAdmin 으로 조건부 제거하면 테이블 구조 복잡도가 늘고, read-only 사용자에게 빈 액션 칸은 흔한 패턴이라 **수용**. 컬럼 조건부 숨김은 후속 UX 개선으로 분리(리뷰어도 "결정 문서화" 를 유효 옵션으로 제시) |

## INFO disposition (요약)
- **spec 문서화 (impl-done INFO-1·2·3 / cross-spec·rationale)**: `6-config.md §A.4`(현재 Reveal 만 Admin+ 명시)·§A.1·§3 API 표에 "모든 mutation 액션 버튼 = Admin+, Editor/Viewer 미노출" 기술 누락 → **planner 위임**(developer spec/ read-only). 본 RESOLUTION 하단 위임 노트 + plan 추적.
- **frontmatter status 승격 / plan 이동 (impl-done INFO-5)**: `spec-sync-config-gaps.md` 전건 [x] 가 됐으나, spec `6-config.md` 는 Part B/C(Models, `unified-model-management.md` 담당)와 frontmatter 공유 → status 승격은 Models 완료 여부에 종속이라 **본 PR 에서 미수행(planner 판단)**. 빌드 가드 `spec-status-lifecycle.test.ts` 는 현재 전체 unit 스위트(4440 pass)에서 통과 — 차단 아님.
- **테스트 정리 (ai-review INFO-11·12·13·14·15·16)**: `MUTATION_BUTTON_NAMES` describe 위치·`beforeEach` roleState 방어초기화·비-admin row-click 회귀테스트·JSDoc — 경미, 현행 유지(수렴; codebase 추가편집은 게이트 재무장 유발 [[feedback_review_gate_loop_avoidance]]).
- **plan 비고 stale 라인참조 (INFO-18)**: 경미, 후속.
- **security INFO 6건**: 전부 "현 상태 양호"(이중방어·30초 자동클리어·React 이스케이프) — 조치 불요.

## 스펙 승격 위임 노트 (planner)
`spec/2-navigation/6-config.md` §A.4(또는 §A.2 권한 소절)에 **"Reveal 외 모든 변경 액션(Add Config·isActive 토글·Edit·Regenerate·Delete)도 Admin+ 에만 UI 노출; Editor/Viewer 는 미노출 + API 직접호출 시 403"** 추가 권장. §3 API 표 POST/PATCH/DELETE/regenerate 행 "(Admin+)" 주석. 근거: spec/5-system/1-auth.md §3.2.

## 게이트 (최종)
- lint·tsc·eslint clean, frontend unit **4440 pass**(RBAC 가드 테스트 2건 포함), build PASS.
- ai-review 07_58_37: **Critical 0** (RISK LOW). 7 reviewer(side_effect·maintainability 재실행 포함) 완료. consistency `--impl-done` 07_58_37: **BLOCK: NO**.
- 잔여 WARNING/INFO 전부 test-quality/UX/문서 nit 또는 planner 위임 — 본 RESOLUTION + 산출물 codebase 무변경으로 가드 종결.

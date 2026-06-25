# Consistency Check 통합 보고서 (impl-prep)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — 식별자 충돌(openOAuthPopup 시그니처 불일치)과 plan-code 명칭 불일치(useDraftRestore vs useUnsavedChangesWarning) 2건의 WARNING 이 존재하나, 착수 전 또는 착수 시 처리 가능한 수준.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING) — 처분

| # | Checker | 위배 | 처분 |
|---|---------|------|------|
| W1 | Naming Collision / Cross-Spec | `openOAuthPopup` 동명 함수 두 구현체 — `[id]/open-oauth-popup.ts`(void) vs new(Window\|null) | **Option B 채택** — openOAuthPopup 을 공유 `lib/integrations/open-oauth-popup.ts` 로 추출하지 않고 `use-oauth-popup-return.ts` 내 module-private 로 유지. `[id]` 통합은 scope 밖 후속(I2). 충돌 없음. |
| W2 | Convention / Naming | hook 이름 plan `useDraftRestore` vs 구현 `useUnsavedChangesWarning` | 구현명이 실제 동작(beforeunload, draft 복원 없음)에 정확. plan §m-3 갱신(plan-update 단계). |
| W3 | Convention | plan §m-3 컴포넌트 `SaveStep` 명기 vs 실제 `Cafe24PrivatePendingStep`·`MakeshopPendingStep`(SaveStep 없음) | plan §m-3 갱신(plan-update 단계). |

## 참고 (INFO) — 처분

| # | Checker | 항목 | 처분 |
|---|---------|------|------|
| I1 | Cross-Spec / Convention | 신규 컴포넌트 경로 frontmatter `code:` 미등록 | 라우트-로컬 `new/_components/*.tsx` 배치 — evidence 가드는 "등록 경로 존재" 검증이라 미등록이 빌드 미파괴(page.tsx 가 anchor·import 로 연결). developer spec read-only → frontmatter 편집 회피. 세분 등록은 planner 후속 노트. `lib/integrations/*.ts` glob 은 `use-oauth-popup-return.ts` 자동 커버. |
| I2 | Cross-Spec | `openOAuthPopup` `[id]`↔new 중복(다른 반환형) 통합 기회 | scope 밖 — 별도 PR 후속(W1 Option B). |
| I3 | Naming Collision | `useOauthPopupReturn` 충돌 없음 | 없음. kebab-case `use-oauth-popup-return.ts`. |
| I4 | Convention | 파일명 kebab-case | 준수(`use-oauth-popup-return.ts`, `use-unsaved-changes-warning.ts`). |
| I5 | Plan Coherence | hook 이름 불일치 | plan-update 단계 정정(W2). |
| I6 | Plan Coherence | C-2 W7 백로그 직교 | m-3 무관. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·상태 전이·RBAC 충돌 없음. INFO 2건. |
| Rationale Continuity | N/A (파일 미생성, transient) | behavior-preserving frontend 분할·spec/결정 변경 0 → NONE 예상(cross-confirm). |
| Convention Compliance | LOW | WARNING 2건(hook 이름·컴포넌트 목록 plan-code 불일치). |
| Plan Coherence | NONE | 미해결 결정 우회·선행 미해소 없음. |
| Naming Collision | MEDIUM | WARNING 2건(openOAuthPopup 시그니처·useUnsavedChangesWarning plan 불일치) → 위 처분. |

## 권장 조치사항 요약

1. **[W1]** openOAuthPopup → use-oauth-popup-return.ts module-private(Option B), 공유 파일 미생성. `[id]` 통합 후속.
2. **[W2·W3]** plan §m-3 갱신: `useDraftRestore`→`useUnsavedChangesWarning`, `SaveStep`→`Cafe24PrivatePendingStep`·`MakeshopPendingStep`.
3. **[I1]** 라우트-로컬 배치로 frontmatter 편집 회피(빌드 안전). 세분 traceability planner 후속.

**최종: BLOCK: NO — 구현 착수 가능.**

# Rationale 연속성 검토 결과

검토 대상: `spec/2-navigation/6-config.md` 구현 변경 (diff-base=47119617)
검토 모드: --impl-done (구현 완료 후 검토)

---

## 발견사항

### [INFO] isAdmin 가드 확장 — 기존 spec·Rationale 와 정합, Rationale 업데이트 미필요
- **target 위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — 행 액션 div 전체를 `{isAdmin && ...}` 로 wrap, Add Config 버튼도 동일 처리. 테스트 파일에서 `MUTATION_BUTTON_NAMES` 6종 전체 가드 확인.
- **과거 결정 출처**: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 — "Auth Config: Owner=CRUD, Admin=CRUD, Editor=R, Viewer=R", "Auth Config Reveal(평문 노출): Owner=✅, Admin=✅". `spec/2-navigation/6-config.md §A.4` — "Admin+ 만 노출(Reveal 버튼)".
- **상세**: 이번 구현은 이전 코드에서 Toggle(isActive) 버튼과 Regenerate·Delete 버튼이 `isAdmin` 가드 없이 노출되던 버그를 수정한다. spec §3.2 의 "Auth Config CRUD = Admin+" 는 이미 명확히 기록되어 있었으며, 기존 Rationale 가 "backend @Roles('admin') 으로 강제하나 UI 에서도 가려 403 혼란을 막는다"는 원칙을 암묵적으로 포함한다. 이번 변경은 Rationale 에서 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 요소가 없다.
- **제안**: 현재 `spec/2-navigation/6-config.md §A.4` 가 Reveal 버튼에 대해서만 "Admin+ 만 노출"을 명시하고, Add Config·Toggle·Edit·Regenerate·Delete 버튼의 UI 레벨 Admin 가드 여부를 명시하지 않는다. 이번 구현으로 확인된 사실을 spec §A.2 또는 §A.4 에 한 줄 명시하면 미래 구현자가 동일 가드 누락 버그를 피할 수 있다. 필수 수정은 아니나, "모든 변경 액션 버튼(Add·Toggle·Reveal·Edit·Regenerate·Delete)은 Admin+ 에만 노출" 한 줄 추가 권장.

---

## 요약

이번 구현 변경은 `spec/5-system/1-auth.md §3.2` 의 "Auth Config CRUD = Admin+" 매트릭스와 완전히 일치하며, 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 사항이 없다. 오히려 이전 코드에서 spec 과 어긋나 있던 Toggle·Regenerate·Delete 버튼의 Admin 가드 누락을 spec 원칙에 맞게 수정한 것이다. Rationale 에 기록된 "백엔드 @Roles('admin') 강제 + UI 레벨 동일 가드로 403 혼란 방지" 원칙을 구현이 따르고 있다. 다만 spec 본문에 UI 레벨 Admin 가드 범위(전 액션 버튼)가 명시되지 않아 동일 버그가 재발할 여지가 있으므로, spec §A.2 또는 §A.4 에 한 줄 보완을 권장한다.

---

## 위험도

NONE

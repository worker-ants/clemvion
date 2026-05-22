# Rationale 연속성 검토 결과

**검토 대상**: `spec/conventions/cafe24-api-metadata.md`
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 시각**: 2026-05-22

---

## 발견사항

발견된 CRITICAL / WARNING 항목 없음.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 의 2026-05-22 변경분 (`constraints?: Cafe24FieldConstraint[]` 신설) 은 제공된 모든 관련 spec Rationale — `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/4-integration.md` — 과 Rationale 연속성 관점에서 충돌이 없다. 기각된 대안(A–C)은 target 문서 자체의 Rationale 에 명시적으로 기록되어 있고, 채택 결정(D)은 새 Rationale 와 함께 작성되었다. 합의된 설계 원칙들(DB Enum 비확장, 영속화 상태와 화면 술어 분리, 단일 진실 원칙, 오류 코드 통일로 UI 분기 최소화)은 모두 준수되었다. 과거 `restrictedApproval.approvalGroup` 의 "catalog 컬럼 미노출, backend metadata 단일 SoT" 선례를 명시적으로 인용해 `constraints` 도 동일 패턴을 따른다고 기록한 점도 Rationale 연속성이 유지된 근거다. `oneOf` 이름 충돌(JSON Schema `oneOf` vs `UiHint.visibleWhen.oneOf` vs 본 컨벤션의 at-least-one-of 의미) 은 "이름 주의" 박스로 문서 내 명시 처리되어 있다.

---

## 위험도

NONE

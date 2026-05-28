# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-fix-isactive-drawer-toggle.md`  
**제안 변경 파일**: `spec/2-navigation/2-trigger-list.md` §2.3.1  
**검토 일시**: 2026-05-29

---

## 발견사항

### [INFO] R-16 요구사항 ID 가 `spec/6-brand.md` 에 이미 사용됨

- **target 위치**: target 문서 "적용 변경 §2" — `spec/2-navigation/2-trigger-list.md` 에 Rationale **R-16** 신설 예고
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/6-brand.md` §8 Rationale 섹션 전체 (R-16 은 "로고 컨테이너 fill → transparent" 결정 근거로 광범위하게 사용됨), 그리고 `spec/2-navigation/10-auth-flow.md` §1 ("`spec/6-brand.md` R-16 transparent + R-17 dark backdrop 폐기" 참조)
- **상세**: Rationale 번호는 파일 단위 독립 번호 공간이므로 다른 파일의 R-16 과 충돌하지 않는다. target 문서가 신설하는 R-16 은 `2-trigger-list.md` 로컬 번호이고, `6-brand.md` 의 R-16 은 동 파일 로컬 번호다. 그러나 `10-auth-flow.md` 는 "`spec/6-brand.md` R-16" 을 명시적으로 파일명과 함께 인용하므로, 독자가 링크 없이 "R-16" 만 읽을 때 brand 결정과 혼동할 가능성이 낮다. 직접 모순은 아니며 명명 충돌 우려 수준이다.
- **제안**: target 적용 시 R-16 신설은 안전하다. 단, `2-trigger-list.md` Rationale 섹션의 타 파일 인용 관행(`R-4`, `R-14`, `R-15` 등)이 파일명 없이 번호만 쓰는 로컬 참조임을 독자가 인지할 수 있도록, 신설 R-16 제목에 파일 컨텍스트를 포함(예: "drawer read-only 표시 + ⋮ 액션 단일 편집 경로 결정 근거")해 `6-brand.md` R-16 과 구별 가능하게 작성하면 혼동 방지에 도움이 된다.

---

### [INFO] §2.3.1 `isActive` 행 변경과 R-4 Rationale 의 정합성 동기화 권장

- **target 위치**: target 문서 "적용 변경 §1" — `| Overview | isActive | edit (토글 버튼) | ... (Rationale R-4) |` 을 `| Overview | isActive | read-only (배지) | ... (Rationale R-4 / R-16) |` 로 변경
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` Rationale **R-4** (§"R-4. `isActive` 편집 경로를 PATCH body 와 `/toggle` 양쪽 모두 유지") — 현재 R-4 본문은 "§2.3.1 의 `isActive` 행은 PATCH body 도 받고, §3 의 `PATCH /api/triggers/:id/toggle` 도 살아 있다" 고 기술하며 **drawer 안에서도 편집 가능함을 전제**로 두 API 경로의 분리 근거를 설명한다
- **상세**: target 변경이 `isActive` 를 drawer 안에서 read-only 로 바꾸면 R-4 의 "§2.3.1 의 `isActive` 행은 … PATCH body 도 받고" 라는 전제가 drawer 맥락에서는 더 이상 UI 진입점이 없게 된다. R-4 자체가 API 경로를 다루는 것이지 UI 진입점을 다루지 않으므로 API 계약 자체는 모순이 아니다. 그러나 R-4 본문이 "§2.3.1 의 `isActive` 행" 을 명시적으로 가리키고 있어, §2.3.1 의 모드 설명이 변경된 후에도 R-4 가 수정되지 않으면 Rationale 과 매트릭스 간 불일치가 발생한다. 작동 불가를 유발하지는 않지만 spec 내부 정합성 훼손이다.
- **제안**: target 적용 시 R-4 본문에 보충 문구 추가 권장. 예: "drawer 안의 `isActive` 는 R-16 에 따라 read-only 배지로 표시하며, 편집은 §2.1 ⋮ 행 액션만 제공한다. 본 R-4 의 두 API 경로 분리 결정은 UI 진입점과 무관하게 유지된다."

---

## 요약

target 문서(`spec-fix-isactive-drawer-toggle.md`)가 제안하는 변경은 `spec/2-navigation/2-trigger-list.md` §2.3.1 의 `isActive` 행을 `edit (토글 버튼)` → `read-only (배지)` 로 수정하고 Rationale R-16 을 신설하는 것이다. 다른 spec 영역의 데이터 모델, API 계약, 상태 전이, RBAC 규칙과 직접 모순되는 사항은 없다. 식별된 두 사항은 모두 INFO 수준이다: (1) R-16 번호는 `spec/6-brand.md` 에서도 사용되나 Rationale 번호가 파일 단위 독립 공간이어서 실질 충돌은 아니다. (2) 기존 R-4 Rationale 본문이 변경된 §2.3.1 row 를 명시 참조하므로 적용 후 R-4 를 소폭 보완하면 spec 내부 문서 정합성이 유지된다. 두 조치 모두 target 의 핵심 결정(drawer read-only + ⋮ 행 액션 단일 편집 경로)을 변경하지 않으며 선택적 개선 사항이다.

---

## 위험도

LOW

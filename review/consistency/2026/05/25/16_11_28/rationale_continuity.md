# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-fix-presentation-common-frontmatter.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

- **[WARNING]** `spec-only` → `implemented` 직접 전이 — 합의된 전이 규칙 우회, 새 Rationale 부재
  - target 위치: plan W6 절 "→ `status: implemented` 승격" + "spec-impl-evidence §3.1 '최초 코드 머지 → partial, 모든 약속 구현 → implemented' 전이 규칙"
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙` — "spec-only → partial: 최초 코드 머지 시점에 승격" / "partial → implemented: 마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격"
  - 상세: spec-impl-evidence §3.1 은 `spec-only → partial → implemented` 순차 전이를 명시하며 `spec-only → implemented` 단계 건너뜀(skip)을 허용하는 조항이 없다. 현재 frontmatter 가 `status: spec-only` 이므로, 전이 규칙대로라면 `partial` 중간 상태를 거쳐야 한다. target 문서는 "광범위한 구현이 이미 머지 완료"를 이유로 `implemented` 직접 승격을 제안하면서도, (a) `partial` 단계를 건너뛰는 예외를 정당화하는 새 Rationale을 spec-impl-evidence 에 추가하지 않고, (b) "구현 완료 시점이 이미 과거"인 경우의 소급(retroactive) 전이에 대한 합의된 정책도 없다. target 스스로 "spec-impl-evidence §3.1 전이 규칙"을 인용하면서도 그 규칙과 배치되는 결정을 내리고 있어 Rationale 연속성이 깨진다.
  - 제안: 두 가지 해결 경로 중 하나를 선택하고 명시적으로 처리해야 한다. (A) `status: partial` 로 먼저 승격 + `pending_plans: []` (없음) 기재 후 `spec-status-lifecycle.test.ts` 가드가 통과하면 동일 PR 안에서 `implemented` 로 재승격. 가드 규칙 상 `partial` 의 모든 `pending_plans` 가 비어있으면 승격 의무가 발동하므로 단일 커밋 안에서 두 상태를 거쳐도 무방하다. (B) spec-impl-evidence §3.1 에 소급 전이 예외 항목(예: "구현이 이미 머지 완료된 경우 `spec-only → implemented` 직접 전이 허용 — 단, plan 내 사유 명시")을 신설하는 Rationale 을 추가하고 본 plan 이 그 사례임을 명기한다. 어느 경로를 택하든 새 Rationale 없는 단독 번복은 지양.

- **[INFO]** `id: common` → `id: presentation-common` — "basename 기반 권장" 과의 거리
  - target 위치: plan W6 절 "`id: common` → `id: presentation-common` 변경" + 제안 frontmatter yaml
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §2.1` — "id: 파일 basename(확장자 제외) 기반 권장"
  - 상세: `spec/4-nodes/6-presentation/0-common.md` 의 basename(확장자 제외)은 `0-common` 이지만, target 은 `presentation-common` 으로 카테고리 prefix 를 추가한다. spec-impl-evidence 는 "권장(recommended)"이지 의무(required)가 아니므로 CRITICAL 수준은 아니다. 그러나 동일 파일명(`0-common.md`)을 가진 6개 카테고리 spec(`4-nodes/1-logic/`, `2-flow/`, `3-ai/`, `4-integration/`, `5-data/`, `7-trigger/`) 이 모두 `id: common` 을 유지하고 있다. 본 변경이 단일 파일만 예외로 카테고리 prefix 를 채택하면, basename-기반 "권장" 관례 아래에서 6개 `id: common` 중복이 여전히 남아 일관성 문제가 부분 해소에 그친다. 새 네이밍 패턴을 spec-impl-evidence Rationale 에 추가하지 않으면 향후 동일 패턴 적용 여부가 모호해진다.
  - 제안: (a) 본 변경이 naming collision 해소를 위해 basename-기반 "권장"을 의도적으로 벗어나는 것임을 target plan 또는 spec-impl-evidence Rationale 에 한 줄 명시. (b) 다른 5개 `id: common` 에 대한 동일 패턴 적용 방침(향후 일괄 적용, 또는 collision 발생 시에만 개별 적용)을 plan 또는 spec-impl-evidence Rationale 에 기재하면 선례가 명확해진다.

---

## 요약

Rationale 연속성 관점에서 주요 위험은 `spec-only → implemented` 직접 전이이다. `spec/conventions/spec-impl-evidence.md §3.1` 은 `partial` 을 경유하는 순차 전이를 합의된 규칙으로 명시하고 있으나, target 은 스스로 이 규칙을 인용하면서도 중간 단계를 건너뛰는 결정을 내리며 이를 정당화하는 새 Rationale 을 spec-impl-evidence 에 추가하지 않는다. 이는 결정 번복이 의도된 것으로 보이나 새 Rationale 부재 상태로, WARNING 등급에 해당한다. `id: presentation-common` 변경은 "권장" 수준 관례와의 거리이며 INFO 수준이다. 본문 변경이 없고 메타 레이어만 수정하는 경량 PR 이라는 점에서 전체 위험도는 낮으나, `partial` 단계 경유 또는 소급 전이 예외 Rationale 신설을 통해 전이 규칙과의 정합을 명시적으로 확보하는 것을 권장한다.

---

## 위험도

MEDIUM

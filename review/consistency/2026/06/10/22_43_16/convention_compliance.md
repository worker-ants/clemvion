# 정식 규약 준수 검토 — `plan/in-progress/spec-update-deadcode-cleanup.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] frontmatter `spec_impact` 필드 부재 — in-progress 단계이므로 위반은 아님
- target 위치: frontmatter (lines 1–9)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` (Gate C), `.claude/docs/plan-lifecycle.md §4`
- 상세: `spec_impact` 필드가 frontmatter 에 없다. Gate C 규약상 `spec_impact` 는 `plan/complete/` 이동 시점에만 의무이며, `in-progress` 단계에서는 의무가 없다 (plan-lifecycle §4: "in-progress 단계엔 의무 아님"). 현재 파일은 `plan/in-progress/` 이므로 위반이 아니다. 다만 이 draft 는 체크리스트 완료 후 `complete/` 이동을 예정하고 있으므로, 이동 전 frontmatter 에 `spec_impact:` 를 추가해야 한다 (이동 전 누락 방지 안내용 INFO).
- 제안: `complete/` 이동 commit 전 frontmatter 에 아래를 추가할 것:
  ```yaml
  spec_impact:
    - spec/5-system/16-system-status-api.md
    - spec/4-nodes/1-logic/10-parallel.md
    - spec/conventions/execution-context.md
  ```
  (이미 `spec_impact:` 에 나열된 경로가 frontmatter 에 별도 필드로 올라와 있지 않음 — 현재는 plan body 본문의 섹션 제목으로만 언급됨. Gate C 는 frontmatter 키를 요구한다.)

---

### [INFO] 섹션 번호 비연속성 (`1`, `1b`, `2`) — 규약 위반 아님, 일관성 제안
- target 위치: 섹션 제목 `## 1.`, `## 1b.`, `## 2.`
- 위반 규약: 없음 (CLAUDE.md·plan-lifecycle 에 plan 본문 섹션 번호 규칙 없음)
- 상세: `## 1b` 는 비표준 번호 표기이나 규약에 명시된 금지 패턴은 아니다. plan 문서는 overview/본문/Rationale 3섹션이 권장되는 spec 문서가 아니라 작업 지시서이므로 구조 자유도가 높다.
- 제안: 단순 메모이므로 현행 유지 가능. 향후 `## 1`, `## 2`, `## 3` 연속 번호 정리를 권장하지만 강제하지 않음.

---

### [INFO] 체크리스트 항목이 `[ ]` 미체크 상태 — 이동 전 확인 필요
- target 위치: `## 체크리스트` (lines 46–50)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` (미체크 체크박스 있으면 `in-progress/` 잔류 의무), `§5 이동 commit 자가 점검`
- 상세: 세 체크박스 모두 `[ ]` 미완료 상태이므로, 현재 plan 은 `in-progress/` 에 머무는 것이 규약에 부합한다. 이는 위반이 아니라 정상 상태이다. `complete/` 이동 시에는 세 항목이 모두 `[x]` 여야 한다.
- 제안: 작업 완료 후 체크박스 갱신 + frontmatter `spec_impact` 추가 + `git mv` 이동 순으로 진행.

---

## 요약

`plan/in-progress/spec-update-deadcode-cleanup.md` 는 `plan-lifecycle.md` 의 필수 frontmatter 3필드(`worktree`, `started`, `owner`)를 모두 보유하고 있고, 체크리스트 미완 상태로 `in-progress/` 에 위치하는 것이 정상이다. 정식 규약(`spec/conventions/**`)과의 직접 충돌은 없다. 유일한 주의사항은 `plan/complete/` 이동 시 Gate C(`spec_impact` frontmatter 필드)를 반드시 채워야 한다는 점으로, 현재 `spec_impact:` 로 나열해야 할 경로들이 plan body 섹션 제목 안에만 산재해 있어 이동 직전 frontmatter 로 옮겨 선언해야 한다.

## 위험도

LOW

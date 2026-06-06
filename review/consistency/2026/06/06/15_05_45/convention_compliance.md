# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-06

---

## 발견사항

- **[INFO]** `spec_impact` 필드 부재 — in-progress 단계에서는 의무 아님, 그러나 선제 기재 권장
  - target 위치: 파일 frontmatter (lines 1–5)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` + `.claude/docs/plan-lifecycle.md §4 (Gate C)` — "in-progress 단계에선 의무 아님(완료 시점에만 강제)". 따라서 현재 누락은 가드 위반이 아니나, 본 plan 이 `complete/` 로 이동될 때 반드시 `spec_impact: [spec/5-system/4-execution-engine.md]` 또는 동등 선언이 추가돼야 Gate C 를 통과한다.
  - 상세: 현재 frontmatter 에 `worktree`/`started`/`owner` 세 필드만 있고 `spec_impact` 는 없다. `started: 2026-06-06` 은 Gate C cutoff(`2026-06-04`) 이후이므로 완료 시점에 `spec_impact` 선언이 강제된다. 본 plan 의 목적("SPEC-DRIFT — spec 에 반영") 자체가 spec 파일을 변경하므로 완료 시 `spec_impact: none` 은 허용되지 않는다.
  - 제안: 지금 당장 추가할 의무는 없으나 완료 체크리스트에 "frontmatter 에 `spec_impact: [spec/5-system/4-execution-engine.md]` 추가" 를 명시해두면 이동 시 누락을 방지할 수 있다.

- **[INFO]** 문서 완료 후 체크리스트(완료 조건) 부재
  - target 위치: 문서 전체
  - 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), 'TODO', '남은 작업', '결정 필요' 항목이 하나라도 있으면 `in-progress/`". 반대로 `complete/` 로 이동하려면 모든 체크박스가 `[x]` 이어야 한다.
  - 상세: 본 문서는 "처리 결정 (2026-06-06)" 섹션에서 "project-planner 가 `/consistency-check --spec` 후 별도로 반영한다" 고 위임만 기술하고, 실제로 spec 반영 완료 여부를 추적할 체크박스가 없다. 이 상태로는 plan 이 완료됐는지 판단하는 마커가 없어 라이프사이클 §2 기준이 적용 불가하다.
  - 제안: `## 작업 항목` 섹션을 추가하고 최소한 다음을 체크박스로 추가할 것:
    - `[ ] project-planner 가 /consistency-check --spec 수행`
    - `[ ] spec/5-system/4-execution-engine.md §1.1 에 제안 blockquote 삽입 완료`
    - `[ ] spec frontmatter code: 가드 통과 확인`

- **[INFO]** 문서 구조 — Overview / 본문 / Rationale 3섹션 중 `## Rationale` 표제 불일치
  - target 위치: 문서 하단 "### 변경 이유 (Rationale)" 섹션
  - 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". plan 문서에 정식 적용되는 규약은 아니지만, spec draft 를 포함하는 plan 문서에서 Rationale 섹션을 `###` (h3) 로 작성한 것은 관례적 표제(`## Rationale`) 와 어긋남.
  - 상세: "변경 이유 (Rationale)" 는 내용상 Rationale 역할을 하나 `###` 레벨이고 제목도 "변경 이유 (Rationale)" 다. spec 에 직접 삽입될 내용 초안을 담은 구조이므로 plan 본문 내부 소제목으로 `###` 을 쓰는 것은 이해 가능하다. 단 실제 spec 파일(`spec/5-system/4-execution-engine.md`)에 반영 시 `## Rationale` 표제로 승격해야 한다 — 이 점이 draft 에 명시되지 않음.
  - 제안: "제안 변경" 섹션 내에 "실제 반영 시 `## Rationale` 로 승격할 것" 주석을 추가하거나, spec 파일에 삽입할 Rationale 항목을 별도 subsection 으로 분리.

---

## 요약

대상 plan 문서(`plan/in-progress/spec-update-execution-engine-pre-park-window.md`)는 정식 규약의 핵심 요건(frontmatter 3필드 `worktree`/`started`/`owner` 필수)을 충족하며, 파일 위치(`plan/in-progress/`)·파일명(kebab-case)·내용 구성도 규약 패턴에 부합한다. CRITICAL 또는 WARNING 수준의 위반은 없다. 다만 완료 시점의 Gate C(`spec_impact` 선언) 충족을 위한 예비 준비가 부족하고, 완료 여부를 판단할 체크박스가 없어 라이프사이클 이동 기준을 적용하기 어렵다는 INFO 수준 개선 포인트 3건이 확인됐다.

---

## 위험도

LOW

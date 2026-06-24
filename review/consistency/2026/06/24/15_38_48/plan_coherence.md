# Plan 정합성 검토 결과

검토 대상: M-4 park-진입 dispatch 추출 (impl-prep)
검토 일시: 2026-06-24

---

### 발견사항

- **[WARNING]** M-4 plan 의 "spec 갱신 선행 조건" 을 scope 설명이 "구현 후 후속 planner PR" 로 역전
  - target 위치: scope 설명 마지막 문장 — "spec 노트(interaction-type-registry.md §1.2 park-entry)는 후속 planner spec-sync PR"
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` § M-4, 권장 항 — "단 spec 갱신(§1.2 emit 위치 열)이 선행 조건이므로 planner 의 `spec-sync-resume-dispatch-registry.md` 합류 후 착수한다." 및 "spec 갱신: 필요 — `interaction-type-registry.md §1.2` emit 위치 열 + 진행 중 `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner)"
  - 상세: M-4 plan 은 `interaction-type-registry.md §1.2` 의 park-entry 측 emit 위치 열 추가를 **planner 선행** 조건으로 명시한다. 그런데 scope 설명은 이 spec 갱신을 구현 완료 후의 "후속 planner spec-sync PR" 로 처리하겠다고 밝혀, 선행·후행 순서가 역전됐다.
  - 제안: 두 가지 선택지 중 하나를 선택해야 한다. (a) plan 의 원칙대로 planner 가 먼저 `interaction-type-registry.md §1.2` 에 park-entry 레이어 노트와 emit 위치 열을 추가한 뒤 developer 가 착수한다. (b) M-4 plan 의 "spec 선행 조건" 서술을 "구현 후 spec-sync" 로 완화하도록 planner 가 plan 을 갱신한다. 어느 쪽이든 plan 과 실행 순서가 일치해야 한다. 단, `spec-sync-resume-dispatch-registry.md` 는 이미 `plan/complete/` 로 이동됐고 park-entry 측 내용은 포함하지 않았으므로, 해당 spec 변경은 별도 planner 작업이 필요한 상태다.

- **[INFO]** `spec-sync-resume-dispatch-registry.md` 완료 이후 park-entry spec 추적 plan 부재
  - target 위치: scope 설명 전반
  - 관련 plan: `plan/complete/spec-sync-resume-dispatch-registry.md` — W1/W2/I3/I4 전부 체크, park-entry 측 내용 없음
  - 상세: M-4 plan 의 원래 선행 조건은 "`spec-sync-resume-dispatch-registry.md` 합류 후" 였으나 해당 plan 은 resume 측만 다뤘고 park-entry spec 노트는 포함하지 않은 채 complete 처리됐다. 이 gap 에 대한 별도 in-progress plan 이 현재 없다.
  - 제안: park-entry spec 갱신을 별도 in-progress plan 항목으로 등재하거나, M-4 plan 의 전제 조건 서술을 사용자가 결정한 실제 순서(구현 선행, spec 후속)에 맞게 갱신한다.

---

### 요약

M-4 park-진입 dispatch 추출의 impl-prep scope 설명은 구현이 끝난 뒤 spec 을 갱신("후속 planner spec-sync PR")하겠다고 명시하는데, 이는 `plan/in-progress/refactor/02-architecture.md` M-4 항목이 `interaction-type-registry.md §1.2` park-entry 열 추가를 **planner 선행 조건**으로 못박은 것과 순서가 역전된다. 이 역전이 plan 의 명시 결정을 우회하는 것인지(CRITICAL 수준), 아니면 사용자가 승인한 선행 조건 완화인지가 명확하지 않다. 단 plan 문서에 해당 결정 변경이 반영되지 않았으므로 WARNING 으로 처리한다. 나머지 전제 조건(`spec-sync-resume-dispatch-registry.md` resume 측 완료)은 충족된 상태이고, 다른 in-progress plan 과의 기능적 충돌은 없다.

---

### 위험도

LOW

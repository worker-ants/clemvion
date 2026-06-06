# Rationale 연속성 검토 결과

검토 모드: --impl-done  
scope: spec/5-system/4-execution-engine.md  
diff-base: origin/main

---

### 발견사항

- **[INFO]** Pre-park read-window 정규화 전략이 spec Rationale 에 미기재
  - target 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 JSDoc + `findById` 호출 위치; `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` 함수 JSDoc
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.1` "원자성 보장" blockquote (L66)
  - 상세: spec §1.1 의 "원자성 보장"은 Execution ↔ NodeExecution 의 cross-entity 단일 트랜잭션만 기술한다. 구현이 새로 도입한 "pre-park read-window intra-row inconsistency(status 컬럼 vs outputData.status 봉투)" 개념과, 이를 처리하는 두 레이어 방어(backend read-side normalization `reconcilePreParkWaitingStatus` + frontend defense-in-depth `isNodeWaitingForInput`)는 spec Rationale 에 전혀 서술되지 않는다. 과거 결정이 "번복"된 것은 아니지만, 기존 원자성 원칙이 명시적으로 커버하지 않는 새 창(window)을 처리하는 설계 결정이 spec 에 근거 없이 코드에만 존재한다. plan/in-progress/spec-update-execution-engine-pre-park-window.md 에 spec 갱신 draft 가 준비되어 있으나 아직 spec 에 반영되지 않은 상태다.
  - 제안: `spec/5-system/4-execution-engine.md §1.1` "원자성 보장" blockquote 뒤에 "Pre-park read-window 정규화" blockquote를 추가한다. plan/in-progress/spec-update-execution-engine-pre-park-window.md §제안 변경의 after 블록이 그대로 반영될 수 있다. 이 spec 갱신 전까지는 기각된 대안 재도입도 합의 원칙 위반도 없으나, 양측 방어 함수의 설계 의도와 연동 조건(terminal 제외 기준, running/pending 한정 이유)이 spec에 없으면 향후 유지보수자가 조건을 오수정할 위험이 있다.

- **[INFO]** 두 방어 레이어의 "의도적 중복 방어" 관계가 spec Invariant 로 선언되지 않음
  - target 위치: `isNodeWaitingForInput` JSDoc 끝의 "Backend 동기 변경 필요" 주석 (apply-execution-snapshot.ts L759-764)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §1.1` 원자성 원칙 — 단일 트랜잭션 commit이 유일한 불변식으로 선언됨
  - 상세: 구현 코드는 "이 함수의 판정 조건을 변경할 때는 backend `reconcilePreParkWaitingStatus` 도 동일 조건으로 함께 변경해야 한다"는 동기화 의무를 JSDoc 주석으로만 선언한다. 이 의무가 spec Invariant 로 등재되지 않으면, spec 레벨에서 한쪽만 수정해도 drift 탐지가 불가하다.
  - 제안: spec §1.1 갱신 draft(plan/in-progress/spec-update-execution-engine-pre-park-window.md)의 "두 레이어는 의도적 중복 방어이며 변경 시 양측을 동기화할 것" 문구를 spec 본문에 포함시켜 invariant 로 공식화한다.

---

### 요약

이번 구현 변경(carousel waiting stuck 회귀 fix)은 기존 spec/5-system/4-execution-engine.md 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. 도입된 `reconcilePreParkWaitingStatus`(backend) 와 `isNodeWaitingForInput`(frontend)는 spec §1.1의 "단일 트랜잭션 원자성" 원칙을 변경하지 않고, 그 원자성이 커버하지 않는 새 창(pre-park intra-row read window)을 read-side normalization으로 보정한다. 단, 이 설계 결정과 두 레이어 간 동기화 의무가 spec Rationale 에 기재되지 않은 상태이며, plan/in-progress/spec-update-execution-engine-pre-park-window.md 에 이미 갱신 draft가 준비된 만큼 해당 spec 갱신을 완료하면 연속성이 완전히 회복된다.

### 위험도

LOW

# Rationale 연속성 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 범위 확인

- `git diff origin/main...HEAD` 전체 stat 상, `spec/data-flow/**` 는 **변경 없음** (spec 문서 자체는 이번 diff 에 포함되지 않음).
- `code_areas` 로 번들된 diff 는 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 단 1개 파일, 단 1개 hunk 뿐이며 **`updateExecutionStatus` 메서드 위 JSDoc 주석**만 바뀐다 (동작 코드 변경 없음, 실제 `git diff` 로 재확인 완료).
- 해당 커밋은 `7d6854cb9`("...self-deadlock 확인의 호출 스택 축") — `#1243`(`92008b21f`, else 분기 트랜잭션 원자화, 이미 `origin/main` 에 merge 됨)의 **문서 후속**이다. 즉 실제 트랜잭션 원자화 동작 변경은 이번 diff 의 대상이 아니고, 이번 diff 는 그 변경과 무관한 별도의 정적 감사(call-site vs `.transaction(` 블록 전수 대조) 결과를 주석에 반영한 것이다.

## 발견사항

검토 관점 1~4(기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 기준으로 CRITICAL·WARNING 급 발견 없음.

- **[INFO] JSDoc 이 가리키는 plan 경로가 향후 stale 해질 수 있음**
  - target 위치: `codebase/backend/.../execution-engine.service.ts` `updateExecutionStatus` 위 JSDoc, "이 수치가 세 판에 걸쳐 어떻게 틀렸다 고쳐졌는지... `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 해당 항목에 있다" 문장
  - 과거 결정 출처: 해당 plan 문서 자체(`plan/in-progress/backend-lint-gate-broken-on-main.md` 289~312행)에 "세 판에 걸친 수치 정정 이력"이 상세 기록되어 있고, 코드 JSDoc 은 그 요약만 담고 그 문서로 위임하는 구조.
  - 상세: `plan/in-progress/` 는 라이프사이클상 완료 시 `plan/complete/`(필요 시 `archive/from-*/`)로 이동한다(`.claude/docs/plan-lifecycle.md`). 이 plan 이 이동되면 코드 주석의 상대 경로 참조가 깨진다. Rationale 연속성 관점에서 "번복 이력"의 1차 근거가 코드 안에 남지 않고 이동 가능한 plan 문서에만 있다는 점이 잠재 리스크다 — 다만 이는 이번 PR 의 결함이라기보다 일반적인 코드→plan 참조 패턴의 한계다.
  - 제안: plan 이동 시 이 JSDoc 참조 경로도 함께 갱신하거나(예: 이동 완료 PR 의 체크리스트에 "코드 주석 참조 경로 동반 갱신" 항목 추가), 장기적으로는 이 이력 요약을 `spec/5-system/4-execution-engine.md` 의 `## Rationale`(코드와 달리 `spec/` 은 이동하지 않는 안정 SoT)로 옮기는 것도 고려할 수 있음. 차단 사유는 아님.

## 요약

이번 diff 의 실질 변경분(`spec/data-flow/**` 는 무변경, code_areas 는 `execution-engine.service.ts` 의 JSDoc 주석 1개 hunk 뿐)은 기존 spec Rationale 이 기각한 대안을 재도입하거나, 합의된 설계 원칙(예: `updateExecutionStatus` = 상태 전이 단일 choke point, self-deadlock 회피)을 위반하지 않는다. 오히려 과거 자신이 명시했던 한계("어휘적 범위만 확인함, 호출 스택 축은 미확인")를 스스로 인용하며 그 축을 메우는 정직한 후속 정정이고, 세 판에 걸친 수치 오류(11→20, "20곳/어휘적"→"36개 블록/호출 스택")를 주석과 plan 트래커 양쪽에 투명하게 남겼다. `spec/5-system/4-execution-engine.md` 의 기존 Rationale(`updateExecutionStatus` else 분기 원자화, 2026-08-30)과도 목적이 다르며 서로 모순되지 않는다. Rationale 연속성 관점에서 지적할 CRITICAL/WARNING 은 없고, plan 경로 참조의 장기 안정성에 대한 INFO 1건만 남긴다.

## 위험도

NONE

# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** spec 파일(`spec/4-nodes/1-logic/3-loop.md`) 변경이 코드 변경 PR에 포함됨
  - 위치: 파일 16 (`spec/4-nodes/1-logic/3-loop.md`) — L13 count 행 단문 추가, L170 에러 코드 행 제거, §8 Rationale 섹션 신설
  - 상세: 이 변경은 plan에 명시된 작업 항목(`spec/4-nodes/1-logic/3-loop.md` 수정 3건)을 수행한 것으로, 변경 의도("dead warningRule 제거 + 정책 명문화")와 직결된다. spec 수정 권한은 `project-planner` 에 있으나, 본 PR은 `developer` 역할이 구현과 spec 동기화를 단일 commit 으로 묶어야 한다는 plan의 명시적 방침(plan 머리말 "모든 변경은 단일 commit에 묶는다")을 따른 것이다. CLAUDE.md 엄격 해석 시 `developer` 의 `spec/` 쓰기는 금지이나, 구현 변경과 직접 결부된 dead-rule 정리가 이미 사용자 결정(2026-05-19)을 받은 상태이고 plan 머리말에 명시적으로 기록되어 있으므로 범위 이탈 위험은 낮다.
  - 제안: 향후 spec 수정이 필요한 경우 `project-planner` 위임 또는 사용자 명시 승인을 plan에 남기는 현행 패턴을 유지한다.

- **[INFO]** consistency-check 산출물 파일 9건이 코드 변경 PR에 포함됨
  - 위치: 파일 8~15 (`review/consistency/2026/05/19/07_35_34/` 디렉토리 전체 — `SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`)
  - 상세: consistency-check 결과물은 단일 commit에 묶는다는 plan 방침에 따라 코드 변경과 함께 커밋된 것으로 보인다. 코드 변경과 리뷰 산출물의 혼재이지만, plan이 "모든 변경은 단일 commit" 을 명시했고 리뷰 산출물은 `review/**` 쓰기 허용 범위 내다. 기능적 변경과는 무관한 산출물이지만 PR 범위를 넓히는 것이어서 이력 추적 시 혼선이 생길 수 있다.
  - 제안: 향후에는 consistency-check 산출물을 별도 commit 으로 분리하거나, 코드 변경 commit 과 review 산출물 commit 을 동일 PR 안에서 구분하는 것이 이력 추적에 유리하다. 현 PR에서는 허용 범위 내이므로 문제 없음.

- **[INFO]** plan 파일 2건(`loop-count-policy.md`, `node-config-required-defaults-sweep.md`)이 코드 변경 PR에 포함됨
  - 위치: 파일 6 (`plan/in-progress/loop-count-policy.md` 신규), 파일 7 (`plan/in-progress/node-config-required-defaults-sweep.md` 수정)
  - 상세: plan 파일 변경은 `developer` 의 쓰기 허용 범위(`plan/**`)에 해당한다. `loop-count-policy.md` 는 이 PR의 작업 추적 plan이고, `node-config-required-defaults-sweep.md` 수정은 부모 sweep plan의 follow-up 마킹으로 plan 에서 명시한 작업 항목이다. 두 변경 모두 의도된 범위 내다.
  - 제안: 없음.

- **[INFO]** `loop.schema.ts` 주석 수정 (단순 주석 갱신)
  - 위치: 파일 4 (`loop.schema.ts`) — `// warningRule 'loop:no-count' 와 정렬.` → 3줄 주석으로 교체, `warningRules` 블록 주석 갱신
  - 상세: 제거된 `loop:no-count` warningRule 과 연결된 주석이 새 정책 설명으로 교체됐다. 순수 주석 변경이지만 실질 변경(warningRule 삭제)과 직접 연관된 설명 갱신이다. 관련 없는 포맷팅 변경이나 무관한 코드 영역 수정은 없다.
  - 제안: 없음.

- **[INFO]** `loop.schema.spec.ts` 에 `still blocks explicit zero count` 테스트 추가
  - 위치: 파일 3 (`loop.schema.spec.ts`) diff 마지막 hunk — 신규 `it('still blocks explicit zero count', ...)` 추가
  - 상세: 삭제된 `loop:no-count` 경계 케이스와 대조되는 방어 테스트로, 0 값은 여전히 차단됨을 명시한다. 이 테스트는 warningRule 제거 후 "아무것도 안 잡힌다" 오해를 방지하는 목적이어서 변경 의도와 직결된다. 불필요한 기능 확장이 아닌 회귀 방지 테스트다.
  - 제안: 없음.

## 요약

이번 변경 세트는 `loop:no-count` dead warningRule 제거와 "최소 반복 1회" 정책 명문화라는 단일 의도에 집중되어 있다. 코드 변경(파일 1~5), spec 갱신(파일 16), plan 관리(파일 6~7), review 산출물(파일 8~15) 모두 plan이 명시한 작업 항목과 1:1로 대응하며, 의도와 무관한 수정(불필요한 리팩토링, 기능 확장, 무관 파일 수정, 포맷팅 혼재)은 발견되지 않았다. spec 파일 직접 수정이 `developer` 역할의 엄격한 쓰기 권한 경계를 넘는다는 형식적 지적이 가능하나, 사용자 명시 결정과 plan 머리말 방침이 이를 커버한다. consistency-check 산출물이 동일 PR에 포함된 것은 추적 혼선 소지가 있으나 허용 범위 내이고, 기능적 문제는 없다.

## 위험도

NONE

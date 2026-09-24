# Plan 정합성 검토 — target: `spec/conventions` (--impl-prep)

## 검토 범위와 제약

- Target 은 `spec/conventions/**` 전체(약 300여 개 파일)를 담은 번들이며, **본 변경(현재 HEAD
  `c288c7aaf`)은 `spec/conventions/**` 파일을 전혀 건드리지 않는다** — 실제 코드 변경은
  `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`(+`.test.ts`) 와
  `spec-pending-plan-existence.test.ts` 뿐이고, `spec/conventions/spec-impl-evidence.md` 는
  "구현이 SoT 보다 좁았던" 상태를 코드 쪽에서 SoT 에 맞추는 작업이다(plan
  `pending-plan-is-plan.md` §A "규약은 바꾸지 않는다").
- 번들 25,000자 예산 초과로 `spec-impl-evidence.md`·`audit-actions.md`·
  `cafe24-api-catalog/_overview.md`(+`category.md`/`store.md`/`translation.md`) 를 제외한
  나머지 전 파일이 "본문 생략됨" 플레이스홀더다(기존에 알려진 `--spec`/`--impl-prep` 번들 예산
  한계와 같은 현상). 생략된 파일은 실제 저장소 원본을 직접 읽어 교차검증했다.

## 발견사항

이번 라운드에서 **CRITICAL/WARNING 은 발견하지 못했다.** 아래는 확인 과정에서 나온 관찰이다.

- **[INFO]** `pending-plan-is-plan.md` 의 처방이 SoT 와 정확히 일치함을 재확인
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행 · §4
    `spec-pending-plan-existence.test.ts` 행
  - 관련 plan: `plan/in-progress/pending-plan-is-plan.md` §B "처방"
  - 상세: SoT 는 `pending_plans` 를 "`plan/in-progress/` 또는 `plan/complete/`(치환)에 실존하는
    plan 경로" 로 정의한다. plan 의 `isPendingPlanPath` 처방(①`plan/in-progress/**.md`·
    `plan/complete/**.md` 만 참 ②`plan/research/` 는 의도적 거짓 ③접두 검사 전 정규화)은 이
    정의와 CLAUDE.md 정보 저장 위치 표(`plan/research/` = 완료 종착점 없는 참조 자료)를 그대로
    따른다 — SoT 를 바꾸지 않고 구현만 좁히는 방향이 일관된다. 실제 코드도 이미 이 처방대로
    커밋됐다(`c288c7aaf`, plan 파일 자체와 같은 커밋에 포함).
  - 제안: 없음(정합 확인용 기록).

- **[INFO]** 회귀 위험 실측 근거가 plan 안에 남아 있어 다른 spec 파일에 대한 부수 피해 없음을
  확인 가능
  - target 위치: 없음(횡단)
  - 관련 plan: `pending-plan-is-plan.md` §C "조이기 전 — main 이 깨지지 않는가"
  - 상세: 새 `isPendingPlanPath` 검사를 실제 `pending_plans` 27개 항목 전수에 돌려 위반 0건을
    확인했다고 기록돼 있다(가드 자신으로 측정, 프록시 파서 아님). `plan/research/` 를 가리키는
    현존 `pending_plans` 항목도 없어, 이번 조임이 다른 spec 문서의 CI 를 새로 깨뜨리지 않는다.
  - 제안: 없음.

- **[INFO]** 인접 트래커 항목(같은 §4 가드 계열, 다른 결함)은 범위 밖으로 올바르게 분리돼 있음
  - target 위치: 없음
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (~line 5080)
    "docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다" (frontend-checks.yml pathspec 이
    `plan/**`·`spec/**` 를 안 봄)
  - 상세: 이 항목은 `pending-plan-is-plan.md` 가 고치는 "존재 검사 ≠ 정합 검사" 결함과는 다른
    축(가드가 CI 에서 아예 안 돌 수 있다는 트리거 갭)이라 `pending-plan-is-plan.md` 범위에
    포함되지 않는 것이 맞다. 두 항목이 트래커에 나란히 등재돼 있고 서로 혼동 없이 분리돼 있다.
  - 제안: 없음(현재 분리가 적절함을 확인).

- **[INFO]** `spec-conventions-engine-error-code-surface.md` / `spec-update-node-cancellation-
  shutdown-classification.md` 등 `spec/conventions/error-codes.md`·`node-cancellation.md` 를
  공유하는 여러 in-progress plan 간의 "같은 파일 동시 편집" 위험은 각 plan 문서 안에
  "나란히 가는 plan"·"결정 위임" 각주로 이미 명시돼 있고(예: 6차 `plan_coherence` INFO#7), 이번
  target(spec/conventions 전체 스냅샷)과 새로 충돌하는 지점은 확인되지 않았다. 다만 이 pending-
  plan-is-plan 작업과는 무관한 영역이라 이번 라운드의 신규 발견으로 등재하지 않는다.

## 요약

이번 target(`spec/conventions` 전체)은 사실상 변경되지 않은 상태이고, 실제로 진행 중인 작업
(`pending-plan-is-plan.md`)은 코드(`spec-frontmatter-parse.ts`)만 SoT(`spec-impl-evidence.md`)에
맞추는 결함 수정으로, plan 이 "결정 필요" 로 남긴 항목(완료 plan 하나만 걸친 pending_plans 거부
여부)은 명시적으로 planner 몫으로 미뤄 두었고 이번 구현은 그 결정을 우회하지 않는다. 선행 조건
(SoT 문서 자체)은 이미 확정돼 있고, 후속 항목(트래커 체크·`/ai-review`·`complete/` 이동)은 plan
자신의 체크리스트에 남아 있어 별도로 새로 만들 항목이 없다. plan/in-progress 전반과 이 target
사이에서 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 중 어느 것도 발견하지 못했다.

## 위험도

LOW

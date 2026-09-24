# Plan 정합성 검토 — pending-plan-is-plan

## 발견사항

이번 검토에서 CRITICAL/WARNING 급 정합성 문제는 발견되지 않았다.

- **[INFO]** 트래커 항목 종결 미체크 — 진행 중 (설계상 정상)
  - target 위치: `plan/in-progress/pending-plan-is-plan.md` 체크리스트 마지막 두 항목 (`/ai-review` 수렴, 트래커 항목 체크 + `complete/` 이동)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5063` — "`spec-pending-plan-existence` 가드가 «그게 plan 인가» 를 묻지 않는다" (developer, 중간, 2026-09-24 등재)
  - 상세: target 구현(diff)이 이 트래커 항목의 처방("`pending_plans:` 의 각 항목이 `plan/` 하위의 `.md`인지까지 검사")을 정확히 구현했다(`isPendingPlanPath`). 다만 트래커의 `[ ]` 체크와 `pending-plan-is-plan.md`의 `complete/` 이동이 아직 수행되지 않았는데, 이는 target plan 스스로 체크리스트 마지막 두 항목으로 명시해 둔 잔여 작업(`/ai-review` 수렴 뒤 처리)이라 정상적인 미완 상태다.
  - 제안: 조치 불요. `/ai-review` 수렴 후 트래커 항목 체크 + plan 이동을 잊지 않도록 확인만 하면 된다.

## 검증 상세

1. **미해결 결정과의 충돌 없음** — 트래커의 별건 미해결 결정("완료된 plan만 가리키는
   `pending_plans` 항목을 거부할지", 2026-09-10 등재, `plan/in-progress/spec-draft-nullable-notation-followups.md:3963-3970`)을
   target 은 §F 에서 명시적으로 구분해 planner 판단으로 남겨두었다 — 우회하지 않았다.
2. **선행 plan 미해소 없음** — `spec/**` frontmatter 전수(17개 파일, 27개 `pending_plans` 항목)를
   직접 확인한 결과 모두 `plan/in-progress/**.md` 또는 `plan/complete/**.md` 형태라 새 가드
   (`isPendingPlanPath`)로 인해 깨지는 기존 spec 항목은 없다(plan 스스로 주장한 "0건/27개"와 일치).
3. **후속 항목 누락 없음** —
   - `--impl-prep`(`review/consistency/2026/09/24/19_35_41`)의 Warning 2건은 이미
     트래커에 등재돼 있음을 실측으로 재확인했다: W1 `spec/4-nodes/*/0-common.md` id 중복
     (`spec-draft-nullable-notation-followups.md:5142`), W2 cafe24 `__` 표기 미문서화
     (`spec-draft-nullable-notation-followups.md:4112`).
   - `spec-pending-plan-existence.test.ts` 를 "단방향 가드"로 서술하는 다른 in-progress plan
     (`spec-update-node-cancellation-shutdown-classification.md:708`)의 서술도 이번 변경 후에도
     여전히 참이라 모순이 없다.
   - `webchat-auth-session-status-reconcile.md` 가 다루는 유사 가드 결함(plan 이 가리키는
     작업이 이미 끝났는데 가드가 못 잡는 문제)은 이미 전부 닫힌(`[x]`) 별개 사례로, target 의
     처방(경로 shape 검사)과 겹치지 않는다.

## 요약

target(스펙 `spec-impl-evidence.md` §2.1/§4 를 근거로 `isPendingPlanPath`를 신설해
`spec-pending-plan-existence.test.ts` 가드를 강화한 diff, 및 이를 기록한
`plan/in-progress/pending-plan-is-plan.md`)은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
(트래커, 2026-09-24 등재 항목)가 남겨 둔 처방을 정확히 좁혀서 구현했고, 그 처방 범위를 벗어나는
별건 미해결 결정("완료된 plan만 가리키는 `pending_plans` 항목을 거부할지" — 트래커 2026-09-10
등재)은 target 스스로 §F에서 명시적으로 구분해 planner 판단으로 넘겨 두어 우회하지 않았다.
`spec/**` frontmatter 전수(17개 파일, 27개 `pending_plans` 항목)를 직접 확인한 결과 모두
`plan/in-progress/**.md` 또는 `plan/complete/**.md` 형태라 새 가드로 인해 깨지는 기존 spec은
없다. `--impl-prep`에서 나온 Warning 2건(`0-common.md` id 중복, cafe24 `__` 표기 미문서화)도
이미 트래커에 등재돼 있음을 실측으로 재확인했다. `spec-pending-plan-existence.test.ts`를
"단방향 가드"로 서술하는 다른 in-progress plan(`spec-update-node-cancellation-shutdown-classification.md`)의
서술도 이번 변경 후에도 여전히 참이라 모순이 없다. 후속 항목 누락·미해결 결정 우회·선행 조건
미해소 중 어느 것도 발견되지 않았다.

## 위험도
NONE

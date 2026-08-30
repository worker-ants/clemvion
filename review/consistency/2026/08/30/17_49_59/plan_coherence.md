# Plan 정합성 검토 — `plan/in-progress/spec-draft-else-branch-transaction.md`

## 발견사항

- **[WARNING]** `backend-lint-gate-broken-on-main.md` 의 `spec_impact: none` 이 자신이 기록한 코드 변경(else 분기 트랜잭션화)의 spec 영향을 반영하지 못한다
  - target 위치: `plan/in-progress/spec-draft-else-branch-transaction.md` 전체(§(1) `spec/5-system/4-execution-engine.md §1.1` 갱신 근거)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter `spec_impact: none`(line 8) + 본문 `## .query() 반환 shape 하드닝 — 남은 후속` 절의 `- [x] **updateExecutionStatus else 분기 트랜잭션화** (18_19_33 concurrency INFO 9)` 항목(line 1308-1319)
  - 상세: target 은 "else 분기가 `dataSource.transaction` 안으로 옮겨졌으니 §1.1 원자성 보장에 문장을 추가해야 한다"를 전제로 삼는다. 그런데 그 코드 변경 자체를 완료로 기록한 `backend-lint-gate-broken-on-main.md` 는 frontmatter `spec_impact: none` 을 그대로 두고 있다. 이는 **정확히 같은 저장소가 이미 세운 관례를 어긴다** — 자매 plan `update-returning-tuple-shape.md` 는 frontmatter 상단에 "본문이 project-planner 위임으로 spec 각주를 스스로 명시하는데 frontmatter 가 `none` 이면, `complete/` 이동 시 Gate C(`spec-plan-completion.test.ts`)가 그 값을 그대로 신뢰해 'спec 영향 없음' 이 잘못 확정된다"고 명시적으로 정정해 두었다. `backend-lint-gate-broken-on-main.md` 는 같은 상황(spec 영향이 있는 코드 변경을 본문에 기록)인데도 이 정정이 반영되지 않았다. 이 plan 이 남은 미해결 항목(§`CONSUMING_QUERY` 사각지대 등 5건) 없이 먼저 `complete/` 로 이동하면 Gate C 가 "spec 영향 없음"을 잘못 확정한다.
  - 제안: `backend-lint-gate-broken-on-main.md` 의 frontmatter `spec_impact` 를 `none` → `[spec/5-system/4-execution-engine.md]` (필요시 `spec/5-system/4-execution-engine.md` 의 `pending_plans:` 에도 역등재)로 정정. target 의 plan 체크리스트 또는 Rationale 에 이 정정을 후속 항목으로 명시하거나, planner 턴 안에서 함께 처리할 것.

- **[WARNING]** target 이 정정하려는 소급 각주가, 이미 "완료" 로 닫힌 다른 plan 의 위임 항목(#12) 산출물이다 — 그 plan 에 후속 정정이 반영되지 않았다
  - target 위치: `plan/in-progress/spec-draft-else-branch-transaction.md` §(2) "2026-08-30 소급 각주 — 후속 각주 추가"
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` `## 추가 위임 (2026-08-14 #12) — UPDATE … RETURNING 튜플 shape 수정의 소급 각주 5건`(line 611-693), 특히 `spec/5-system/4-execution-engine.md §1.1` 대상 각주를 "✅ 완료 (2026-08-30, planner 턴)"으로 닫은 문구(line 681-686)
  - 상세: target 이 "`#1242` 에서 내가 쓴 각주가 불완전하다"고 지목하는 그 각주는, `spec-update-node-cancellation-shutdown-classification.md` 의 위임 항목 #12 가 오늘(2026-08-30) planner 턴에서 완료 처리한 산출물과 위치·문구가 일치한다(spec 본문 §1.1 상단 "소급 각주 (2026-08-30) — 종결 이벤트의 선점 감지가 4개월간 도달 불가였다" 블록, `8332d9a20` 이 고쳤다 + "DB 는 안 깨졌다"로 마무리). 그런데 #12 항목은 이미 "✅ 완료"로 표시돼 있고, target 의 후속 각주 추가 계획은 이 tracker 를 갱신/역참조하지 않는다. `update-returning-tuple-shape.md` 자신이 같은 세션에서 "완료 선언이 사실보다 앞섬"을 **네 번째** 반복했다고 적어 둔 바로 그 실패 형태이며, 이 저장소는 완료로 닫힌 각주가 나중에 틀린 것으로 드러나면 **그 항목 자체에 철회/정정을 남기는 관례**를 이미 세워 두었다(`secret-store.md §2.1` "알려진 검증 공백" 문단 철회 사례, 같은 `backend-lint-gate-broken-on-main.md` 계열). target 이 이 선례를 따르지 않으면, `spec-update-node-cancellation-shutdown-classification.md` 를 나중에 읽는 사람은 #12 가 "완료"라고만 보고 그 각주가 이미 불완전함이 밝혀졌다는 사실을 놓친다.
  - 제안: target 의 "(2) 후속 각주 추가" 작업에 `spec-update-node-cancellation-shutdown-classification.md` #12 항목의 완료 블록에 짧은 역참조("이 각주는 이후 `spec-draft-else-branch-transaction` 이 보강했다" 등)를 추가하는 단계를 포함시킬 것. planner 턴이 어차피 §1.1 을 편집하므로 비용은 낮다.

## 요약

target 자체의 판단(§1.1 에 else 분기 트랜잭션 문장 추가, 소급 각주의 불완전성 정정, developer 자기-반증 예외 미적용 근거)은 실측·근거 모두 견고하며 `plan/in-progress/**` 의 어떤 미해결 결정과도 충돌하지 않는다(`spec-update-node-cancellation-shutdown-classification.md` 상단의 유일한 미해결 택일 결정 (a)/(b) 는 SIGTERM/timeout 분류 문제로 target 과 무관). 다만 target 이 다루는 else 분기 트랜잭션화는 이미 두 개의 다른 in-progress plan(`backend-lint-gate-broken-on-main.md`, `spec-update-node-cancellation-shutdown-classification.md`)이 "완료"로 기록해 둔 항목과 정확히 겹치는데, target 은 그 두 plan 의 상태(각각 stale `spec_impact: none`, 그리고 이미 닫힌 위임 항목 #12)를 갱신하지 않는다. 둘 다 이 plan 계열이 같은 세션에서 이미 여러 번 반복했다고 스스로 기록한 "완료 선언이 실제보다 앞선다" 클래스이므로, target 의 작업 범위에 짧은 역참조/frontmatter 정정을 더해 반영하는 편이 안전하다.

## 위험도
MEDIUM

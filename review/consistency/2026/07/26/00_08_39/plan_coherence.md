# Plan 정합성 검토 — spec/conventions/ (--impl-done)

## 조사 방법 메모

`target_path=spec/conventions/` 이나 `git diff origin/main...HEAD --stat -- spec/conventions/` 실측 결과
이번 PR 은 `spec/conventions/` 를 **전혀 변경하지 않았다** (developer 는 `spec/` 쓰기 권한이 없고, 관련
spec 갱신 제안은 전부 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 로
위임돼 있음을 실측 확인). 따라서 본 검토는 "target(=spec/conventions/ 현재 상태, 무변경)" 과
`plan/in-progress/**` 사이의 정합성을 확인하는 것으로 범위를 좁혔다. 이 PR 이 실제로 구현한 것은
`plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 MakeShop/Cafe24 signal 전파 +
chat-channel won't-do 종결이다 (commit `e83da5052`, `60542ee77`).

## 발견사항

- **[INFO]** `node-cancellation.md` §6 표 두 행(MakeShop/Cafe24)이 이미 구현된 상태를 반영하지 못함 — 단, 이미 추적·위임됨
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 (line 138-139), §1 대상 나열(line 24)의 `chat-channel`
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임(2026-07-25) — §6 표 두 행 갱신" · "추가 위임 #5 — §6 표의 chat-channel 노드 행은 범주 오류"
  - 상세: §6 표는 MakeShop/Cafe24 signal 전파를 여전히 `— 미구현 (Planned)` 으로 서술하지만, 실제로는 이번 PR(`e83da5052`)에서 §4 cascade + §5.1 재throw 가드까지 구현 완료됐다(코드 실측: `MakeshopCallOptions.signal`/`Cafe24CallOptions.signal`, handler `context.abortSignal` 전달). chat-channel 행도 "미구현(Planned)"으로 남아 있으나 실측 결과 chat-channel 은 노드 자체가 아니라 outbound 방향 트리거 어댑터라 애초에 cascade 대상이 아니다(범주 오류). 이 drift 는 developer 가 이미 인지했고 `spec/` 쓰기 권한이 없어 두 항목 모두 project-planner 소유 plan(`spec-update-node-cancellation-shutdown-classification.md`)에 구체적 갱신 제안(문구까지)으로 정확히 위임돼 있다 — "후속 항목 누락"에 해당하지 않는다.
  - 제안: 새 조치 불필요. project-planner 턴에서 위 위임 plan 을 처리할 때 §6 두 행 + §1 chat-channel 나열을 함께 갱신할 것. (참고: 승격 전 handler 의 실제 propagate 여부까지 확인하라는 조건이 위임 plan 에 이미 명시돼 있음 — 그대로 따르면 됨.)

- **[INFO]** BLOCKED 항목의 결정 위임 체인은 정합적 — 상호 충돌 없음
  - target 위치: `spec/conventions/node-cancellation.md` §6 마지막 행("Workflow 단위 timeout / graceful shutdown 의 노드 abort — 미구현(Planned)")
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` 4번째 잔여 항목(BLOCKED) ↔ `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(cancelled vs failed 분류 미결정) ↔ `plan/in-progress/execution-engine-residual-gaps.md` G2(defer 확정, 같은 `shutdown-state.service.ts` 다룸)
  - 상세: `shutdown-state.service.ts` 는 실측상 `abortSignal`/`AbortController` 참조 0건이라 두 경로(§5.1 `cancelled` 규칙 vs SIGTERM bulk `failed` UPDATE)가 아직 충돌하지 않는다. target 문서(§6)도 이 노드 abort 통합을 여전히 "미구현"으로 명시해 실제 상태와 어긋나지 않는다. 잔여 plan 은 이 항목만 명시적으로 BLOCKED 처리하고 결정 plan 을 정확히 링크하며, 나머지(MakeShop/Cafe24/IE) 는 이 결정과 무관함을 근거와 함께 밝혀 뒀다. G2(같은 파일을 다루는 별도 BLOCKED plan)와의 관계도 "착수 시 G2 상태 먼저 확인" 으로 상호 참조돼 있다. 미해결 결정을 일방적으로 우회하는 지점 없음.
  - 제안: 없음(현행 유지). 결정 시점에 `spec-update-node-cancellation-shutdown-classification.md` 가 G2 상태를 실제로 재확인하는지만 착수 시점에 확인.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md:1374` 의 stale plan 포인터 — 이미 낮은 우선순위로 위임됨, 미조치 상태 지속
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md:1374` (target_path 범위인 `spec/conventions/` 밖이지만 같은 결함 클래스라 함께 기록)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 #4 (3)"
  - 상세: 이 줄은 완료·`plan/complete/`로 이동한 `node-cancellation-infrastructure` 를 여전히 가리킨다(실측: 파일에 grep 으로 확인, 현재도 그대로). 실제 추적처는 `node-cancellation-residual-signal-propagation.md`. 위임 plan 이 "낮은 우선순위"로 이미 인지·기재했으므로 새로 발견된 누락은 아니다.
  - 제안: planner 턴에서 위 위임 plan 처리 시 함께 정정.

- **[INFO]** 이 리뷰 라운드도 이전에 지적된 "consistency-summary 임의 하향" 패턴을 다시 마주칠 수 있음 (harness 자체 논의, 참고용)
  - target 위치: 해당 없음 (target 문서 아님 — harness 프로세스 메타 이슈)
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
  - 상세: 이 plan 은 이전 라운드(`--impl-done 22_28_51`)에서 `cross_spec` 이 §6 표 drift 를 CRITICAL 로 냈는데 `consistency-summary` 가 규약 근거 없이 WARNING 으로 하향했음을 지적하고, 하향 재량의 명문화 여부(a/b/c)를 미결정 상태로 남겨 뒀다. 이번 라운드(`00_08_39`)에서 다른 checker(`cross_spec` 등)가 같은 §6 drift 를 다시 CRITICAL 로 낼 경우, 통합 단계에서 동일한 비공식 하향이 반복될 수 있다 — 이는 plan_coherence 판정 대상은 아니나 이 PR 의 최종 BLOCK 판정 신뢰도에 영향을 줄 수 있어 참고로 남긴다.
  - 제안: plan_coherence 관점에서는 조치 불요(이미 별도 plan 으로 추적됨). 통합자(consistency-summary/사용자)가 이 plan 의 결정을 별도로 확인할 것.

## 요약

이번 PR(`node-cancel-chat-9f3e`)이 실제로 건드린 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 는 spec 이 "결정 필요"로 남긴 항목(Workflow-timeout/graceful-shutdown 의 노드 abort 통합 — cancelled vs failed 분류 충돌)을 정확히 식별해 별도 planner 소유 plan(`spec-update-node-cancellation-shutdown-classification.md`)으로 위임했고, 그 결정과 무관한 나머지 항목(MakeShop/Cafe24 signal 전파, chat-channel won't-do)만 이번 PR 범위에서 완료했다 — 미해결 결정을 우회하거나 선점하는 지점은 없다. `execution-engine-residual-gaps.md` G2 와의 상호 참조도 위임 plan 안에 명시돼 있어 선행 plan 누락도 없다. 유일한 잔여는 `node-cancellation.md` §6 표/§1 나열이 이번 구현을 아직 반영하지 못하는 문서 drift 인데, 이 역시 developer 의 spec 권한 밖이라 위임 plan 에 구체적 문구까지 이미 기재돼 있어 "후속 항목 누락"에 해당하지 않는다. 전반적으로 plan 구조와 target 상태 사이의 정합성은 양호하다.

## 위험도

LOW

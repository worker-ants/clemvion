# Plan 정합성 검토 — spec-update-chat-channel-adapter-status.md

## 발견사항

- **[WARNING]** 같은 worktree 의 구현 plan(`impl-setup-error-code.md`) 이 target 의 "구현
  완료" 전제를 그대로 반영하지 못한 채 방치된다
  - target 위치: `plan/in-progress/spec-update-chat-channel-adapter-status.md` §영향
    ("코드 변경 없음 … `--spec` 재검증 필요") — `impl-setup-error-code.md` 자체는 언급 안 함
  - 관련 plan: `plan/in-progress/impl-setup-error-code.md` (frontmatter `status: in-progress`,
    `owner: developer`, `worktree: impl-setup-error-code-ddd078` — target 과 **동일 worktree**),
    특히 `## 체크리스트` 전체 11항목
  - 상세: target 은 "adapter 3종(telegram/slack/discord) 전부 `code` 부착 완료" 를 실측
    근거로 spec frontmatter 를 "미구현"→"구현 완료" 로 정정하자고 제안한다. 이 실측은
    맞다(`git blame`·grep 으로 재확인: `a4f943f4b`·`455d1526f` 커밋 + `TELEGRAM_/SLACK_/
    DISCORD_CREDENTIAL_REJECTED_*` 상수 3개 전부 코드에 존재, 이후 `/ai-review` SUMMARY#1~#7
    resolution 커밋까지 이번 세션에 전부 반영됨). 그런데 이 완료 사실을 추적하는 **1차
    출처**는 `impl-setup-error-code.md` 자신인데, 그 파일의 체크리스트 11개 항목이
    **하나도 체크되지 않은 채** 남아 있다 (`/consistency-check --impl-prep` 부터
    `plan/complete/ 이동` 까지 전부 `- [ ]`). target 은 §3 에서 **다른** 트래커
    (`spec-draft-nullable-notation-followups.md:2818`)의 체크박스 완료 처리는 "이 draft
    범위 밖 — planner 턴에서 판단" 이라고 명시적으로 위임했지만, 정작 이 worktree 의
    **주 구현 plan** 인 `impl-setup-error-code.md` 자체의 체크리스트·`plan/complete/` 이동
    필요성은 어디에도 언급하지 않는다. 사용자 lesson(`체크와 complete/ 이동은 한 동작` ·
    `plan 체크박스 = 실제 상태`)이 지적하는 정확히 그 패턴 — 실제로는 끝난 작업의 plan
    문서가 "진행 중" 상태로 방치되면 다음 세션이 중복 착수하거나 판단을 그르칠 수 있다.
  - 제안: target(또는 이어지는 planner 턴)이 `spec/` 갱신과 함께 `impl-setup-error-code.md`
    의 체크리스트를 실측 상태로 갱신하고 `plan/complete/` 이동 여부를 판단하도록 §영향에
    명시적으로 추가한다. (§3 에서 이미 다른 트래커에 대해 같은 조치를 권고했으므로, 이
    plan 에 대해서도 동일한 취급을 빠뜨리지 않아야 일관적이다.)

## 요약

target 의 실측 근거(adapter 3종 `code` 부착 완료, 관련 상수·커밋 존재)는 grep·git blame 로
재확인해도 정확하고, "삭제 판정은 아직 하지 않았다" 며 `spec-draft-nullable-notation-followups.md`
의 "CCA §1.1.2 401/403 fallback 제거 판정" 미해결 결정을 침범하지 않고 올바르게 그 항목으로
위임한 점도 확인된다 — 미해결 결정 우회나 선행 plan 미해소는 발견되지 않았다. 유일한 갭은
같은 worktree 의 1차 구현 plan(`impl-setup-error-code.md`) 체크리스트가 실제 완료 상태를
반영하지 못한 채 남아 있는데 target 이 이를 다루지 않는다는 점으로, planner 턴에서 함께
정리하면 해소되는 경미한 후속 항목 누락이다. 다른 worktree 가 소유한 `chat-channel-adapter.md`
관련 plan(`eia-terminal-payload.md` 등, §1.1.2 와 무관한 §1.2/§1.3/durationMs 구간)은 병렬
작업 충돌 범주라 검토 대상에서 제외했다.

## 위험도
LOW

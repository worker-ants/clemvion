# Plan 정합성 검토 — spec/conventions/ (--impl-done)

## 검토 방법 메모

`_prompts/plan_coherence.md` 는 4,529줄로, target 영역(`spec/conventions/**`, cafe24-api-catalog 포함)과
plan 덤프가 컨텍스트 예산을 모두 소진해 **정작 이번 PR 의 실제 diff 대상인
`spec/conventions/node-cancellation.md` 본문 자체가 프롬프트에서 생략**되어 있었다(§⚠️ 컨텍스트 예산
초과 목록에 명시). 규약대로 워킹트리(`node-cancel-signal-b4d1`)를 절대경로로 직접 Read/`git diff`
하여 재확인했다 — 아래 발견은 그 결과다.

- `git diff origin/main --stat`: 이번 PR 은 `spec/conventions/**` 를 **전혀 건드리지 않았다**
  (변경분은 `codebase/backend/src/nodes/integration/{cafe24,makeshop}/*`, 관련 plan 2건, 리뷰
  RESOLUTION 2건뿐). 즉 target 영역 자체는 diff-base 와 동일한 상태다.
- 실제 코드 변경은 MakeShop/Cafe24 노드에 `context.abortSignal` cascade(§4)를 배선한 것이며,
  이를 추적하는 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 가 이번 PR 범위에
  포함돼 갱신됐다.

## 발견사항

- **[INFO]** target(`node-cancellation.md`) §6 표가 실제 구현 완료 상태를 아직 반영하지 않음 — 단, 이미 명시적으로 위임·추적됨(위반 아님)
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 137~139행 — "MakeShop 노드 signal 전파 | — | 미구현 (Planned)", "Cafe24 노드 signal 전파 | — | 미구현 (Planned)" (diff 0 — 이번 PR 로 갱신되지 않음, 워킹트리에서 직접 확인)
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "잔여 항목" — "MakeShop 노드 signal 전파 (2026-07-25) ✅" · "Cafe24 노드 signal 전파 (2026-07-25) ✅" (실제 코드: `makeshop-api.client.ts`/`cafe24-api.client.ts` 의 `signal` cascade, 커밋 `f4b2f9434`+후속 fix 3건). 그리고 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25) — §6 표 두 행 갱신 (SPEC-DRIFT)" 절이 정확히 이 갭을 이미 `project-planner` 에 위임해 두었다(§6 두 행을 `✓` 로 바꾸고 "§2.2 사전 체크" 오기술도 제거하자는 구체 제안 포함).
  - 상세: 라벨(spec)과 본문(실제 구현)의 불일치는 이 저장소에서 이미 3명의 리뷰어가 반복 지적한 패턴(`node-cancellation-residual-signal-propagation.md` Overview 인용)인데, 이번 PR 로 또 하나(§6 두 행)가 새로 생겼다. 다만 이번엔 developer 가 `spec/` 쓰기 권한이 없어 **의도적으로 코드만 두고 spec 위임 메모를 남긴 것**이라 프로세스상 정상 처리다 — CRITICAL/WARNING 대상인 "미해결 결정 우회"나 "후속 항목 누락"이 아니라, 다음 project-planner 턴에서 반영이 필요한 대기 상태.
  - 제안: project-planner 가 다음 spec 갱신 턴에 `spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-25)" 절(§6 두 행 + §4 예시 코드 누수 수정 제안 두 가지 모두)을 처리해 §6 표와 실제 구현을 재동기화할 것. 지연이 길어지면 재차 라벨/본문 불일치로 리뷰어에게 지적될 위험이 있다(선례).

- **[INFO]** 추적 plan 의 `worktree:` frontmatter 가 sentinel(`(unstarted)`) 상태로 남아 실제 작업 worktree 를 가리키지 않음
  - target 위치: 해당 없음 (plan 자체 metadata 문제)
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter `worktree: (unstarted)`
  - 상세: 본 plan 은 이번 PR 에서 실제로 다수 커밋(`f4b2f9434`, `e22950713`, `85d6680a8`, `ad207cb0a`, `cb2ef099b`, `4e1176591`, `8336894c1`, `fa05dba86`)과 함께 워킹트리 `node-cancel-signal-b4d1` 에서 진행됐음에도 frontmatter 는 여전히 미착수 sentinel 이다. `.claude/docs/plan-lifecycle.md` §4는 "착수 시 실제 `<task>-<slug>` 로 교체" 를 규정한다 — placeholder/sentinel 오래 방치는 `plan-frontmatter.test.ts`/`plan-stale-audit.sh` 판정을 오염시킬 수 있다.
  - 제안: 다음 커밋에서 `worktree: node-cancel-signal-b4d1` 로 갱신. (참고: 다른 worktree 와의 동시 작업 경합 여부는 본 검토 범위 밖 — 여기서 지적하는 것은 자기 자신의 metadata 정확성 문제일 뿐이다.)

## 이전 라운드(19_13_33, --impl-prep) 대비 확인된 해소 사항 (참고, 신규 발견 아님)

- 이전 CRITICAL("Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합" 항목이 §5.1 `cancelled` 규칙과 §11 기존 `failed`+`SERVER_INTERRUPTED` 계약을 충돌시킨 채 미해결)은 해당 항목을 "⛔ BLOCKED — project-planner 결정 대기" 로 분리하고 `spec-update-node-cancellation-shutdown-classification.md` 를 신설해 (a)/(b) 택일을 명시적으로 위임하는 것으로 해소됨 — 코드 diff 에도 `execution-engine.md`/`1-data-model.md`/`data-flow/3-execution.md` 변경이 전혀 없어(0 diff) 결정을 우회한 흔적 없음.
- 이전 WARNING(같은 `shutdown-state.service.ts` 를 겨냥한 BLOCKED plan `execution-engine-residual-gaps.md` G2 와 교차 참조 없음)은 `spec-update-node-cancellation-shutdown-classification.md` "## 관련" 절에 G2 를 명시적으로 인용하며 "착수 시 G2 상태를 먼저 확인할 것" 으로 해소됨.

## 요약

이번 PR(MakeShop/Cafe24 노드 signal cascade 배선)은 `spec/conventions/` 자체를 변경하지 않았고, 그 변경을 추적하는 `plan/in-progress/node-cancellation-residual-signal-propagation.md`·`spec-update-node-cancellation-shutdown-classification.md` 는 서로 정합하며 이전 라운드의 CRITICAL/WARNING(§5.1 vs §11 상태 분류 충돌, G2 교차참조 누락)을 적절히 해소했다. 유일한 잔여 갭은 target 문서 §6 표 두 행이 아직 구현 완료 상태를 반영하지 못한다는 점인데, 이는 developer 의 spec 쓰기 권한 부재로 인한 **의도적·명시적 위임**이라 CRITICAL/WARNING 이 아니라 project-planner 의 다음 턴 반영을 확인하는 INFO 로 처리했다. plan frontmatter `worktree:` sentinel 방치도 경미한 위생 이슈로 함께 기록한다.

## 위험도
LOW

# Plan 정합성 검토 — spec/conventions/ (--impl-done)

## 검토 방법 메모

`_prompts/plan_coherence.md` (4,540줄)는 target 덤프(`spec/conventions/**`, cafe24-api-catalog 포함)와
plan 덤프가 컨텍스트 예산을 모두 소진해, 이번 PR 의 실제 diff 대상인 `spec/conventions/node-cancellation.md`
본문과 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 가 모두 "⚠️ 컨텍스트
예산 초과로 생략된 파일" 목록에 있었다. 규약대로 워킹트리(`node-cancel-signal-b4d1`)를 절대경로로
직접 `Read`/`git diff`/`git log` 하여 재확인했다.

- `git diff origin/main --stat -- spec/conventions/`: 빈 출력 — 이번 PR 은 `spec/conventions/**` 를
  **전혀 건드리지 않았다**.
- 실 diff: `codebase/backend/src/nodes/integration/{cafe24,makeshop}/{*-api.client.ts,*.handler.ts}`
  (기존 파일 수정) + `plan/in-progress/node-cancellation-residual-signal-propagation.md`(갱신) +
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(신규) + review 산출물.
- 본 검토는 **이전 라운드(`review/consistency/2026/07/25/21_58_52`, plan_coherence LOW)** 이후 커밋
  (`0cfd547a8` handler AbortError 흡수 결함 수정, `f575671fc` §6 승격 조건 명시, `3b075dd5c` RESOLUTION)
  까지 반영된 상태를 재확인한 것이다.

## 발견사항

- **[INFO]** target(`node-cancellation.md`) §6 표가 실제 구현 완료 상태를 아직 반영하지 않음 — 이미 명시적으로 위임·추적됨(위반 아님, 이전 라운드에서도 동일 결론)
  - target 위치: `spec/conventions/node-cancellation.md` §6 표 137~139행 — "MakeShop 노드 signal 전파 | — | 미구현 (Planned)", "Cafe24 노드 signal 전파 | — | 미구현 (Planned)" (diff 0, 워킹트리에서 직접 확인)
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` "잔여 항목" — 두 항목 모두 `[x]` 로 완료 표시(2026-07-25). `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-25) — §6 표 두 행 갱신 (SPEC-DRIFT)" 절이 이 갭을 이미 `project-planner` 에 위임해 두었고, "⚠ 승격 전 확인" 문구로 handler propagate 검증이 완료된 뒤에만 `✓` 로 올리라는 조건까지 명시했다.
  - 상세: 이전 라운드(21_58_52)는 이 위임에 **아직 handler AbortError 흡수 CRITICAL 이 열려 있어 §6 승격이 시기상조**라고 지적했다. 그 CRITICAL 은 이후 커밋(`0cfd547a8`)에서 수정되고 `spec-update-node-cancellation-shutdown-classification.md` 에 "⚠ 승격 전 확인" 검증 조건이 추가돼(`f575671fc`) 해소됐다. 라벨(spec)과 본문(실제 구현)의 불일치 자체는 여전히 남아 있으나, 이는 developer 가 `spec/` 쓰기 권한이 없어 의도적으로 코드만 두고 위임 메모를 남긴 정상 처리이지 "미해결 결정 우회"나 "후속 항목 누락"이 아니다.
  - 제안: project-planner 가 다음 spec 갱신 턴에 위 위임(§6 두 행 + §4 예시 리스너 누수 정정 + `frontmatter.code:` 추가 여부)을 함께 처리할 것. 지연이 길어질수록 "라벨/본문 불일치" 로 재차 리뷰어에게 지적될 선례(3명 중복 지적 이력)가 있다.

- **[INFO]** 이전 라운드(21_58_52) CRITICAL/WARNING 이 모두 해소됐음을 확인
  - target 위치: 해당 없음 (경과 확인)
  - 관련 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  - 상세:
    1. (구 CRITICAL) handler 의 inner/outer catch 가 client 의 재throw `AbortError` 를 다시 흡수해 §5.1 `cancelled` 분류가 엔진까지 도달하지 못하던 결함 — `cafe24.handler.ts`/`makeshop.handler.ts` 양쪽에 `database-query.handler.ts` 와 동형인 재throw 가드가 추가됐음을 diff 로 직접 확인 (`if (err instanceof Error && err.name === 'AbortError') { throw err; }`, 두 catch 모두).
    2. (구 WARNING) `node-cancellation-residual-signal-propagation.md` frontmatter `worktree:` 가 sentinel `(unstarted)` 로 남아 있던 문제 — 현재 `worktree: node-cancel-signal-b4d1` 로 갱신 확인.
    3. (19_13_33 라운드 구 CRITICAL) "Workflow 단위 timeout/graceful shutdown 의 노드 abort 통합" 항목이 §5.1 `cancelled` 규칙과 `ShutdownStateService` 의 기존 `failed`+`SERVER_INTERRUPTED` 계약을 충돌시킨 채 미해결이던 문제 — 해당 항목은 "⛔ BLOCKED — project-planner 결정 대기" 로 분리되고, `spec-update-node-cancellation-shutdown-classification.md` 가 (a)/(b) 택일을 명시적으로 위임한다. `execution-engine.md`/`1-data-model.md`/`data-flow/3-execution.md` 코드/spec 어디에도 diff 가 없어(0줄) 이 결정을 우회한 흔적이 없다. `plan/in-progress/execution-engine-residual-gaps.md` G2(같은 `shutdown-state.service.ts` 를 다루는 BLOCKED/defer-확정 plan)도 "## 관련" 절에서 명시적으로 교차 참조된다.
  - 제안: 없음 (조치 완료 확인).

## 요약

이번 PR(MakeShop/Cafe24 노드 signal cascade 배선 + 후속 리뷰 라운드 수정)은 `spec/conventions/` 자체를 변경하지 않았고, 그 변경을 추적하는 두 plan(`node-cancellation-residual-signal-propagation.md`, `spec-update-node-cancellation-shutdown-classification.md`)은 서로 정합하며, 이전 두 라운드(19_13_33 impl-prep, 21_58_52 impl-done)가 지적한 CRITICAL(§5.1 vs §11 상태 분류 충돌 미해소, handler 의 AbortError 흡수)과 WARNING(G2 교차참조 누락, worktree frontmatter sentinel)을 모두 확인 가능한 커밋으로 해소했다. Workflow-timeout/graceful-shutdown 노드 abort 통합이라는, target 이 명시한 미해결 결정은 developer 가 일방적으로 내리지 않고 별도 plan 으로 명시적 위임한 채 유지되고 있다. 유일한 잔여 갭은 §6 표 두 행이 아직 구현 완료 상태를 반영하지 못한다는 것인데, 이는 developer 의 spec 쓰기 권한 부재로 인한 의도적·명시적 위임(승격 조건까지 명문화)이라 CRITICAL/WARNING 이 아니라 project-planner 의 다음 턴 반영을 기다리는 INFO 다.

## 위험도
LOW

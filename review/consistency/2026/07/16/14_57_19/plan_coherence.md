# Plan 정합성 검토 — spec/4-nodes/3-ai/ (--impl-done)

## 검증 대상 (orchestrator 요청)

이전 2회 실행(13_55_11, 14_46_28)에서 지적한 "`ai-agent-tool-payload-budget-followups.md` 를
`plan/complete/` 로 이동하면 pre-existing spec Critical 2건(out 포트 서술 모순 · `AI_AGENT_TOOL_COUNT_MAX`
vs Cafe24/MakeShop 카탈로그)의 durable 앵커가 소실된다"는 WARNING 의 해소 여부를 확인한다.

### 확인된 사실

1. **`plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 신설 확인** — Critical 1(Multi Turn `out`
   포트 유무 모순, `1-ai-agent.md:216`/`:231-232` vs `_product-overview.md` ND-AG-24)과 Critical 2
   (`AI_AGENT_TOOL_COUNT_MAX=128` vs Cafe24 실측 383 vs `4-cafe24.md` "~180")가 정확한 위치·처분 방향과 함께
   기술돼 있다. `task_3ac39ebd`(ephemeral, session-scoped) 를 "본 문서가 durable SoT" 로 명시적으로 대체.
2. **`spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` 등록 확인** — on-disk 실제 파일에
   `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 가 `ai-agent-tool-connection-rewrite.md` 와
   함께 등재돼 있음 (prompt 스냅샷과 on-disk 상태 일치, 재확인 완료).
3. **`ai-agent-tool-payload-budget-followups.md` L45/L55 자기모순 해소 확인** — `git show fe404a889` 로 대조.
   구 버전 L54 는 "backlog 잔여 task_3ac39ebd·task_07c120ce 는 별 task 라 이관 불필요" 라고 적어, 바로 위 L45
   가 지적한 "durable 앵커 소실" 우려를 (ephemeral task 로 충분하다는 취지로) 정면 부정하는 모순이었다. 현재는
   L45 가 신설 파일을 명시하고 L56 이 "pre-existing spec drift 2건은 `spec-drift-ai-agent-outport-countmax.md`
   (in-progress 유지) 로 durable 이관됨" 으로 동일 사실을 일관되게 재확인 — 모순 해소 확인.
4. **`spec-pending-plan-existence.test.ts` / `spec-status-lifecycle.test.ts` / `spec-frontmatter.test.ts` /
   `spec-code-paths.test.ts` 4종 실행 — 944/944 pass.** spec 쪽 frontmatter-evidence 가드는 이상 없음.

이 4가지 관점에서는 orchestrator 가 요청한 "해소 확인" 이 유효하다 — 3회 연속 WARNING 을 유발했던 근본 문제
(archiving 시 durable 텍스트 소실)는 실제로 해결됐다.

## 발견사항

- **[WARNING] 신설 durable 앵커 plan 이 `worktree:` frontmatter 필수 필드 누락 — build guard 실패**
  - target 위치: (간접) `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans` 가 가리키는 신규 plan
  - 관련 plan: `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` (frontmatter 전체 — `started`/`owner`
    만 있고 `worktree:` 키 자체가 없음)
  - 상세: `.claude/docs/plan-lifecycle.md §4` 는 top-level `plan/in-progress/*.md` 에 `worktree`/`started`/
    `owner` 3필드를 **필수**로 규정하고 `plan-frontmatter.test.ts` 가 build guard 로 강제한다. 신설 파일은
    `started`/`owner` 만 채우고 `worktree` 를 아예 누락했다. 실제로
    `cd codebase/frontend && npx vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts` 를 실행해 확인한
    결과:
    ```
    FAIL plan-frontmatter guard > plan/in-progress/spec-drift-ai-agent-outport-countmax.md
      > `worktree` is set and not a legacy placeholder
    AssertionError: worktree missing: expected false to be true
    Test Files  1 failed (1)
         Tests  1 failed | 120 passed (121)
    ```
    전체 스위트에서 이 파일 1건만 실패 — repo 의 다른 in-progress plan 은 전부 통과하므로 이번에 새로 만든
    파일에서만 발생한 회귀다. 이 상태로는 frontend 빌드가 깨져 CI 가 막히므로, `followups.md` 를
    `plan/complete/` 로 옮기는 커밋이든 이 파일 자체를 남겨두는 커밋이든 **머지가 차단된다** — 즉 이번에
    "해소됐다"고 주장하는 정합성 자체가 build-time 에서 재차단된다.
  - 제안: `spec-drift-ai-agent-outport-countmax.md` frontmatter 에 `worktree:` 를 추가한다. 이 문서는 아직
    전용 worktree 에서 "착수"된 것이 아니라 이번 세션(`funny-mahavira-50d003`)의 부산물로 생성된 추적 전용
    문서이므로, 실제 값으로는 (a) 현재 세션 worktree 이름 `funny-mahavira-50d003`, 또는 (b) plan-lifecycle
    이 규정한 명시 sentinel `(unstarted)`(project-planner 가 아직 두 Critical 의 spec 정정 작업을 시작하지
    않았다는 의미) 중 하나를 선택해 채운다. 어느 쪽이든 guard 통과 여부로 즉시 검증 가능.

- **[INFO] `ai-agent-tool-payload-budget-followups.md` 는 아직 "완전 종결" 상태 아님 — 설계상 정상**
  - target 위치: — (target spec 과 직접 충돌 아님, 추적 메모)
  - 관련 plan: `plan/in-progress/ai-agent-tool-payload-budget-followups.md` L54~56 (`9.4 impl-done` 재검증 ·
    WARNING 조치 · PR/plan-complete 이동 — 3항목 모두 `[ ]` 미체크)
  - 상세: orchestrator 는 "all W4/W2/A/B checkboxes done" 을 전제로 물었으나, 실제로는 후속 PR #3 트랙의
    마지막 3개 체크박스가 아직 미완이다. 이는 결함이 아니라 **본 consistency-check(--impl-done, 14_57_19)
    자체가 L54 의 "재검증" 스텝**이기 때문 — 그 결과(BLOCK 여부)를 받아야 L55(WARNING 조치 확인)·L56(PR·
    plan/complete 이동)을 체크할 수 있는 순환 구조다. A·B 두 항목(§실행 체크리스트 — 항목 A/B)은 이미 전부
    `[x]`. 다만 위 WARNING(worktree 필드 누락)이 먼저 해소돼야 이 재검증이 실질적으로 "BLOCK: NO" 로 종결될
    수 있다.
  - 제안: 위 WARNING 픽스 후 이번 실행 결과를 L54/L55 에 반영하고 L56 체크 후 `git mv` 로 `plan/complete/`
    이동을 진행한다.

## 요약

Orchestrator 가 요청한 핵심 검증 — "`spec-drift-ai-agent-outport-countmax.md` 신설로 pre-existing spec
Critical 2건의 durable 앵커가 보존되고, `1-ai-agent.md` pending_plans 등록과 `followups.md` L45/L55 자기모순
해소가 실제로 이뤄졌는가" — 는 **내용상 유효하다**: 신설 문서가 두 Critical 을 정확한 위치·처분 방향과 함께
담고 있고, `1-ai-agent.md` frontmatter 가 이를 올바르게 참조하며, `followups.md` 의 과거 자기모순 문구는
현재 버전에서 제거·정정됐다. 다만 신설 문서 자체가 `plan-lifecycle.md §4` 가 강제하는 필수 frontmatter
필드(`worktree`) 를 빠뜨려 `plan-frontmatter.test.ts` build guard 를 실제로 깨뜨리는 것을 실행 확인했다 —
이 결함이 남아 있는 한 "정합성 회복" 자체가 CI 에서 다시 막히므로, `worktree:` 필드를 채우기 전까지는
`ai-agent-tool-payload-budget-followups.md` 를 `plan/complete/` 로 옮기기에 아직 안전하지 않다(빌드 실패로
막힘). 그 외 미해결 결정과의 충돌·선행 plan 미해소는 발견되지 않았고, `ai-agent-tool-connection-rewrite.md`
의 TBD 항목들은 이번 diff 와 무관하게 그대로 유지돼 target 이 그 결정을 선점하지 않는다.

## 위험도

MEDIUM — 내용적 정합성 회복은 확인됐으나, 신설 durable 앵커 문서의 frontmatter 누락이 build guard 를
실제로 깨뜨려 (실행 재현 완료) 머지를 차단한다. 한 줄(`worktree:`) 추가로 해소 가능한 낮은 리스크이지만,
수정 전에는 이번 정합성 회복이 "완결"이라 볼 수 없다.

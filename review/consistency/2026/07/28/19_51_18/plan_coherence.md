# Plan 정합성 검토 — spec/5-system/ (--impl-prep, 2회차)

> 1회차: `review/consistency/2026/07/28/17_21_27`(BLOCK: YES, Critical 3). 본 라운드는 그 이후
> 커밋(`1493b5ae9`·`548eb3c07`·`71ce6c12b`)이 반영된 상태를 재검토한다.

### 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 의 `worktree:` frontmatter 가 이미 정리된 최초
  worktree 를 그대로 가리켜, 이번 P1 작업을 실제로 수행하는 현재 worktree 와 plan 이 연결되지
  않는다 — push 가드가 이번 작업에서 plan 갱신을 강제하지 못한다
  - **target 위치**: 이번에 착수하는 코드 변경 — `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(`applyRetryLastTurn` 원자 claim 전환) · `continuation-execution.processor.ts`(claim 제외 목록 정정). 둘 다 `codebase/**` 라 push 가드(`.claude/hooks/_lib/plan_guard.py`)의 대상이다.
  - **관련 plan**: `plan/in-progress/retry-turn-terminal-guard.md:3` — `worktree: retry-turn-cancel-guard-ba75a2`(#1022 클래스 fix 를 시작한 **최초** worktree, PR #1024 로 이미 머지·정리됨). 같은 plan 의 "5차 라운드 이후 위생 정리" 통합 목록 **#1**(P1, `applyRetryLastTurn` 원자 claim — 지금 이 worktree 가 하려는 바로 그 작업, :316-334)과 "spec — project-planner 위임"(:335-339, `spec-update-node-cancellation-shutdown-classification.md` **#10** 을 "코드와 동반 필수"로 지목)이 이 문서에 계속 걸려 있다.
  - **상세**: `plan_guard.py` 의 push 하드블록 조건은 "브랜치가 `codebase/**` 를 바꿨고, **frontmatter `worktree:` 가 현재 worktree 로 resolve 되는** in-progress plan 이 diff 에서 건드려지지 않았다" 는 경우로 한정된다(docstring L17-30). 매칭은 `worktree:` 값을 정규화해 현재 worktree 디렉터리 basename(`retry-atomic-claim-4d9e77`, `claude/` 를 뗀 브랜치명과 동일)과 비교하는데(L32-38, `_linked_in_progress_plans` L218-244), `retry-turn-terminal-guard.md:3` 은 여전히 `retry-turn-cancel-guard-ba75a2` 다. 그 사이 이 plan 을 이어받은 후속 worktree 가 최소 3개(`retry-turn-followup-hygiene-c3f81a` — #1026 위생 정리 커밋, `retry-turn-terminal-guard-review-7b7629`, 그리고 지금 `retry-atomic-claim-4d9e77`) 있었으나, 실제로 diff 를 확인한 3개 커밋(`1493b5ae9`·`548eb3c07`·`71ce6c12b`, 전부 이 plan 파일을 수정) 어느 것도 이 frontmatter 필드는 갱신하지 않았다. 결과적으로 지금 상태에서 이 worktree 가 P1 코드를 커밋·push 하면, 가드는 "연결된 plan 없음 → ad-hoc/hotfix, 차단하지 않음"(docstring L25-30, "natural escape hatch") 으로 판정한다 — 즉 `retry-turn-terminal-guard.md` 의 우선순위표 #1 체크·`#10` spec 항목 반영 여부를 push 시점에 **아무도 기계적으로 확인하지 않는다.** 이번 라운드가 감시하는 실패 유형("코드는 고쳐지는데 plan/spec 갱신이 조용히 누락")을 막는 바로 그 안전망이, 정확히 이 작업에서는 무장되지 않은 상태다.
  - **제안**: 착수 커밋에서 `retry-turn-terminal-guard.md` frontmatter `worktree:` 를 `retry-atomic-claim-4d9e77` 로 갱신하거나(가장 간단), 이 P1 항목만 `plan/in-progress/retry-atomic-claim.md` 로 분리해 `worktree: retry-atomic-claim-4d9e77` 로 새로 등록하고 원 plan 은 포인터만 남긴다(이 저장소가 `exec-intake-followups.md` 등에서 이미 쓰는 분리 패턴). 어느 쪽이든 지금 고쳐야 push 가드가 이 작업을 실제로 감시한다.

- **[WARNING]** `spec-update-node-cancellation-shutdown-classification.md` **#10** 의 "같은
  커밋으로 반영" 지시가 이 문서 자신이 세운 8개 선례(별도 후속 project-planner 커밋)와 어긋나고,
  `developer`/`project-planner` 권한 분리 하에서 실제로 한 커밋으로 합치는 절차가 명시돼 있지 않다
  - **target 위치**: 위와 동일한 코드 변경 지점. 이번 worktree 는 `developer` 권한(`codebase/**`·`plan/**` 쓰기, `spec/` read-only)으로 동작한다.
  - **관련 plan**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:534-550`(`## 추가 위임 (2026-07-28 #10)`), 특히 :542 "⚠️ 이 항목은 별 planner PR 로 처리하지 말 것 … P1 원자 claim 구현 PR 에서 **같은 커밋**으로 반영한다."
  - **상세**: 같은 문서 안에서 구조적으로 동일한("코드가 spec 을 앞선" SPEC-DRIFT) 이전 항목들 — #1(§6 표 2행 정정)·#2(§4 예시 리스너 누수 정정)·#4(AbortError 명명 예외)·#5(chat-channel 범주오류)·#6(§2.3/§5.1/§6 신규 가드)·#7(§2.1 IE 서술)·#8(park 무효과 서술 철회) — 은 전부 "developer 는 `spec/` 쓰기 권한이 없어 제안만 남긴다" 로 마감되고, 실제 반영은 코드가 머지된 **뒤** project-planner 가 별도 커밋으로 처리했다(예: #8 → `548eb3c07`, 코드 PR `771801e3e` 머지 다음 날 별도 세션·별도 `--spec` 검토 2라운드를 거쳐 반영). `.claude/hooks/` 전수 확인 결과 `spec/` 쓰기를 role 별로 기술적으로 막는 훅은 없다 — read-only 는 순수 관행(skill 경계)이다. 따라서 "같은 커밋" 을 문자 그대로 지키려면 (a) 이번 developer 세션이 관행을 깨고 `spec/` 을 직접 쓰거나, (b) 같은 브랜치 안에서 project-planner 턴으로 전환해 커밋을 이어붙여야 하는데, 이 전환 지점·주체가 plan 어디에도 명시돼 있지 않다. "같은 커밋" 이 리터럴 git commit 1개를 뜻하는지, 아니면 "머지 전 같은 PR(후속 커밋 허용)" 을 뜻하는지 모호하다 — 전자로 읽으면 8개 선례와 정면으로 어긋나고, 후자로 읽으면 문구 자체가 부정확하다.
  - **제안**: #10 에 "같은 커밋" 의 의미(리터럴 단일 commit vs 같은 PR 내 developer 커밋 + 후속 project-planner 커밋 허용)와, 후자라면 hand-off 시점(예: "코드 커밋 직후, push 전에 project-planner 턴으로 전환해 위 4개 spec 항목을 반영하는 커밋을 추가한다")을 한 줄 명시할 것. 최소한 "별도 후속 **PR** 로 미루지 않는다" 는 의도만 지키면 되므로, 실행상으로는 병합 전 같은 브랜치에 spec 커밋을 추가하는 방식으로 처리하면 이 우려는 해소된다.

- **[INFO]** 인접 미해결 결정 — 재확인 결과 이번 작업과 여전히 무충돌
  - **target 위치**: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 최상단 (a)/(b) 택일 결정(SIGTERM/timeout 유발 abort 의 `cancelled` vs `failed` 분류). 여전히 `worktree: (unstarted)`, 미체크.
  - **관련 plan**: 동일 문서.
  - **상세**: 이 결정은 `ShutdownStateService` 의 bulk `UPDATE ... WHERE status='RUNNING'` 경로를 다루고, 이번 worktree 가 건드리는 `applyRetryLastTurn` 의 조건부 `UPDATE ... WHERE status='running'` claim 과는 다른 코드 경로다. 1회차 검토가 이미 "무충돌" 로 판정했고, 이번 재검토에서도 두 경로가 겹치지 않음을 재확인했다 — 이 결정이 (a)/(b) 어느 쪽으로 나든 이번 P1 작업에는 영향이 없다.
  - **제안**: 없음(참고용, 별도 백로그로 계속 추적).

### 요약

target(`spec/5-system/`)의 실질 초점인 `4-execution-engine.md`·`node-cancellation.md` 관련해서는,
1회차 검토(`review/consistency/2026/07/28/17_21_27`)가 지목한 Critical 3건 중 2건(auth RBAC 표
Admin 삭제권한 누락, graph-rag 엔티티 명명충돌)이 커밋 `71ce6c12b` 로 정정됐고, 나머지 1건
(`retry_last_turn` 원자성 불변식이 spec 자기서술과 실제 코드 사이에서 깨져 있던 건)은
`spec-update-node-cancellation-shutdown-classification.md` **#10** 으로 4개 세부 항목 +
"별 PR 금지" 명시와 함께 단일 진실로 등재됐다 — 스펙 텍스트 자체는 아직 고치지 않았지만, 이는
결정을 우회한 게 아니라 이번 P1 작업이 코드와 함께 직접 닫을 항목으로 정확히 이연(defer)된
것이라 충돌로 보지 않는다. 다만 재검토 결과 새로운 절차적 정합성 갭 2건을 확인했다: (1) 이
작업이 이어받는 `retry-turn-terminal-guard.md` 의 `worktree:` frontmatter 가 이미 정리된 최초
worktree 를 그대로 가리켜 현재 worktree 와 연결되지 않으며, 그 사이 3개 후속 worktree/커밋
어디서도 갱신되지 않아 push 가드가 이번 작업에서 plan 갱신을 강제하지 못하는 상태다 — 이
시리즈가 반복 경계해 온 "코드는 고쳐지는데 plan/spec 이 조용히 안 갱신되는" 실패 유형의 자동
안전망이 정확히 이번 건에서 꺼져 있다. (2) `#10` 이 요구하는 "코드와 같은 커밋" spec 반영이,
같은 문서의 구조적으로 동일한 7개 선행 항목이 전부 따른 "코드 PR 머지 후 별도 project-planner
커밋" 관행과 어긋나 hand-off 메커니즘이 불명확하다. 둘 다 결정 자체를 뒤집는 문제가 아니며,
착수 커밋에서의 plan 갱신·문구 명확화로 실행 전 해소 가능하다.

### 위험도

MEDIUM

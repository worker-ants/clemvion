# Plan 정합성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md` (--impl-done 모드)
실제 분석 대상: `exec-park-followup-272c4f` 브랜치의 구현 변경 diff
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] exec-park-polish 완료 → plan/complete 미이동
- target 위치: `exec-park-followup-272c4f` 브랜치 커밋 `399a6dfa` (origin/main PR #504 로 머지됨)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/exec-park-polish.md` (worktree `exec-park-polish-080a4d`)
- 상세: PR #504 (`refactor(exec-park): A~C 폴리시`) 가 MERGED 상태이며, exec-park-polish 계획의 모든 항목(A1~C2)이 완료됨. 그러나 `plan/in-progress/exec-park-polish.md` 는 아직 `plan/complete/` 로 이동되지 않았다. plan 의 마지막 줄은 "비차단 후속: exec-park-durable-resume.md plan→complete 이동" 을 out-of-scope 로 남겼고, exec-park-polish 자신도 complete 이동이 누락됨.
- 제안: `plan/in-progress/exec-park-polish.md` → `plan/complete/` 이동 필요 (plan-lifecycle 규약). 동반하여 `exec-park-durable-resume.md` 도 complete 이동 검토.

### [INFO] exec-park-durable-resume umbrella 잔여 — W11 추출과 target 관계 명시 부재
- target 위치: `execution-engine.service.ts` 상단 `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 인라인 정의 제거 + `process-turn-result.ts` 로 이관; 신규 `resume-turn-dispatch.ts` 인터페이스 파일 도입
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/exec-park-durable-resume.md` §"umbrella 잔여": "W11/W12 아키텍처 추출(ProcessTurnResult 타입·updateExecutionStatus 멱등 가드)"
- 상세: exec-park-durable-resume 의 umbrella 잔여 항목 W11 이 `ProcessTurnResult` 타입 추출을 명시하고 있다. target 변경이 이 W11 을 이행하는 방향이나, exec-park-durable-resume plan 에 "→ exec-park-followup-272c4f 에서 처리" 표기가 없고, exec-park-followup-272c4f 에 대응하는 plan 문서도 없다. 또한 `dispatchResumeTurn`/`resumeTurnRegistry` 의 신규 도입은 기존 plan 어디에도 사전 정의된 항목이 아니다 — ai-review W11 RESOLUTION 에 "deferred(저위험)" 로만 기록됐고 별 worktree/plan 으로 승격된 기록이 없다.
- 제안: exec-park-durable-resume.md 의 umbrella 잔여 W11 항목에 "→ exec-park-followup-272c4f 에서 완료" 표기 추가, 또는 해당 plan 이 complete 로 이동될 때 W11 완료로 체크. exec-park-followup-272c4f worktree 에 대응하는 plan 문서가 없다면 신설 또는 umbrella 잔여 항목을 인라인 추적으로 흡수.

### [INFO] exec-park-polish C1 과 target 의 ProcessTurnResult 위치 중복 — 충돌 아님(계층적 확장)
- target 위치: `shared/execution-resume/process-turn-result.ts` 신규 파일 (PARK_RELEASED 심볼 + ParkSignal 타입 + ProcessTurnResult 타입 이관)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/exec-park-polish.md` §C1 — "ProcessTurnResult = void | ParkSignal alias 신설 + waitForX 3종·processAiResumeTurn·executeInline 지역변수 적용" (PR #504 MERGED)
- 상세: polish C1 은 인라인 타입 alias 신설 단계였고, target 은 그 정의를 공유 파일로 추출하는 후속 단계다. 의미·동작 충돌 없음. 단 exec-park-polish 가 complete 로 이동되기 전에 target 이 C1 결과물을 수정(공유 파일로 이전)하므로 plan 연속성 추적이 명확하지 않다는 점은 남는다. 실 코드 충돌/회귀 위험은 없음.
- 제안: INFO 기록만. 별도 조치 불요.

### [INFO] impl-concurrency-cap-pr2b worktree — stale 판정(Step 2, PR #505 MERGED)
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/exec-intake-queue-impl.md` §PR2b (worktree `impl-exec-concurrency-cap`)
- stale 판정: Step 1 ancestor 검사 ACTIVE → Step 2 PR 상태 조회 결과 PR #505 MERGED → stale 확정.
- 상세: 해당 worktree 는 `/Volumes/project/private/clemvion/.claude/worktrees/impl-exec-concurrency-cap` 으로 git worktree list 에 남아있으나 PR 이 머지됐다. 대응 plan `exec-intake-queue-impl.md` 의 PR2b 항목은 완료 체크 없이 in-progress 유지 중 — plan 이 complete 로 이동되지 않았음.
- 제안: worktree 정리(`./cleanup-worktree-all.sh --yes --force` 또는 수동) 권장. `exec-intake-queue-impl.md` PR2b 항목 완료 체크 및 plan 을 complete 로 이동 검토.

---

## Stale 으로 skip 한 worktree (의무 — 충돌 후보 검토 결과)

worktree 충돌 후보 확인: active worktree 목록 = `exec-park-followup-272c4f` (target), `impl-exec-concurrency-cap`, `migration-tooling-eval-1de449`, `rag-followup-efsearch-b6c8e8`. 이 중 `execution-engine.service.ts` 또는 `shared/execution-resume/` 영역 동시 접근 후보 = `impl-exec-concurrency-cap` (exec-intake-queue-impl.md PR2b).

- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 1: ACTIVE (ancestor 아님). Step 2: PR #505 MERGED → **stale**. 실제 active 충돌 해당 없음.
- 나머지 `migration-tooling-eval-1de449`, `rag-followup-efsearch-b6c8e8` — `execution-engine.service.ts` 영역과 무관하므로 충돌 후보 제외.

stale skip 된 worktree 1건 (`impl-exec-concurrency-cap`). `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 변경(`dispatchResumeTurn` registry + `process-turn-result.ts` 공유 추출, spec `spec/5-system/4-execution-engine.md §7.5`)은 진행 중 plan 의 미해결 결정과 충돌하거나 active worktree 와 경합하는 CRITICAL 문제가 없다. worktree 충돌 후보 1건(impl-exec-concurrency-cap)은 PR #505 MERGED 로 stale 확정 — skip. 발견된 사항은 모두 INFO 수준: exec-park-polish 및 exec-park-durable-resume plan 의 complete 이동 미완, W11 umbrella 잔여와 target 간 추적 연결 부재. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

## 위험도

NONE

STATUS: OK

# Plan 정합성 검토 — impl-done: PR2b 동시성 cap + queue-wait cancel enforcement

> 검토 대상: HEAD 워킹트리 `impl-concurrency-cap-enforce-54f29a` (diff-base `origin/main`, 5개 커밋:
> admission gate 구현 → workspace settings write API → e2e 실증 → ai-review CRITICAL/Warning 조치 → 재검증 문서).
> 재결정 컨텍스트: 2026-07-04 spec 분리 완료(#800) + 본 PR = cap+cancel enforcement, priority 3-tier는 별도 후속으로 defer.

> **주의 (payload 불일치)**: 전달받은 `_prompts/plan_coherence.md` 페이로드는 요청된 대상(`exec-intake-queue-impl.md` PR2b)과 무관한 `spec/5-system/1-auth.md`·`10-graph-rag.md`·기타 in-progress plan(ai-agent 도구 재설계 등) 내용으로 채워져 있었다. 페이로드를 신뢰하지 않고 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-concurrency-cap-enforce-54f29a`)의 실제 `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/spec-draft-concurrency-cap-pr2b.md`, `spec/5-system/4-execution-engine.md` diff, 관련 plan 전수(grep)를 직접 근거로 검토했다.

## 발견사항

- **[WARNING] `exec-intake-queue-impl.md` PR2b 체크박스·스코프 서술이 stale**
  - target 위치: `spec/5-system/4-execution-engine.md` §4/§8 구현상태 배너 (본 PR 이 "PR2b 구현 완료"로 갱신함)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` L46 — `- [ ] **PR2b — 동시성 cap**` 및 그 서술 `"Q-scope=**전체 한 PR**(cap + queue-wait 5분 cancel + TOCTOU + **priority 3-tier** + INFO 4건)"`
  - 상세: L46 은 2026-06-05 시점의 **구 결정**(전체를 한 PR 로, priority 3-tier 포함)을 그대로 담고 있다. L48 에 2026-07-04 재결정("Q-scope 축소... **enforcement 구현은 후속 developer PR** — 이 항목은 그 developer PR 에서 `[x]`")이 이미 기록돼 있어 재결정 자체는 plan 에 존재하지만, 정작 "이 developer PR 에서 `[x]`" 로 예고된 체크박스(L46)가 본 PR 에 의해 실제로 `[x]` 처리되지 않았다(`git diff origin/main -- plan/` 결과 0건 — plan 파일 무변경). spec 은 "PR2b 구현 완료"로 flip 됐는데 이를 지시한 추적 plan 은 미체크 상태로 남아 spec↔plan 정합이 깨졌다.
  - 제안: `exec-intake-queue-impl.md` L46 체크박스를 `[x]`로, 서술을 "cap+cancel 만 본 PR 로 구현 완료, priority 3-tier 는 별도 후속 PR 로 분리"로 갱신. 동시에 L58 "(곁들임 PR2b) INFO 묶음"(ARCH#4/5/6, MAINT#9)은 본 PR 에서 다뤄지지 않았으므로 미체크 유지가 맞다(§아래 INFO 참고).

- **[INFO] priority 3-tier 후속 항목이 전용 plan 파일 없이 inline 텍스트로만 추적됨**
  - target 위치: `spec/5-system/4-execution-engine.md` §8 "priority 3-tier(`ExecuteOptions.triggerType` threading)는 본 PR 스코프 아님"
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (전용 하위 plan 부재), `spec-draft-concurrency-cap-pr2b.md` §배경·스코프 "제외(후속)"
  - 상세: priority 3-tier 는 spec Rationale·exec-intake plan 양쪽에 "후속"으로만 언급되고 별도 작업 단위(체크리스트)가 없다. 당장 코드 결함은 아니나, `exec-intake-queue-impl.md` 자체가 완료에 가까워지는 시점이라 이 항목만 남아 추적이 흐려질 위험이 있다.
  - 제안: `exec-intake-queue-impl.md` 에 "PR2c — priority 3-tier(triggerType threading)" 같은 명시적 후속 항목을 신설(체크박스 1줄이라도)하거나, `execution-engine-residual-gaps.md` 로 이관.

- **[INFO] `execution-limits.ts` ARCH#4 통합 미반영이 plan 체크박스와 일치함 (정합, 문제 아님)**
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts` (본 PR 에서 `resolveConcurrencyCap`/`resolveQueueWaitTimeoutMs`/cap 상수만 추가, `resolveExecutionRunWorkerConcurrency` 통합은 손대지 않음)
  - 관련 plan: `exec-intake-queue-impl.md` L58 "(곁들임 PR2b) INFO 묶음: `resolveExecutionRunWorkerConcurrency`→`execution-limits.ts` 통합(ARCH#4)..." — 미체크 유지
  - 상세: 코드와 plan 체크박스 상태가 일치(둘 다 미완료) — 충돌 없음. 확인 목적으로만 기록.

- **[INFO] `exec-park-durable-resume.md` 의 과거 cross-branch 우려(W4)는 이번 PR 로 해소됨**
  - target 위치: 해당 없음 (과거 우려 사항 해소 확인)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` L279 "W4 (cross-branch 운영 리스크, 미해결)" — `impl-concurrency-cap-pr2b` 가 Phase B 이전 모델로 spec 을 덮어쓸 위험, "PR-B1 머지 후 rebase 선행을 착수조건에 명기" 요구
  - 상세: 본 브랜치는 `git merge-base HEAD origin/main == origin/main HEAD`(5eabbfc0d, PR2b spec-draft #800 포함)로 최신 main 위에서 작업했고, Phase B3(in-memory 머신 완전 제거, PR #501)도 이미 main 에 흡수된 상태에서 시작했다. `execution-engine.service.ts` 에 `pendingContinuations`/`firstSegmentBarrier` 옛 fast-path 가 남아있지 않음을 코드로 확인 — W4 가 우려한 "역행"은 발생하지 않았다. plan 의 W4 항목 자체는 발신 plan(`exec-park-durable-resume.md`)이 별도로 정리할 사안이나, 본 target 과의 충돌은 없다(참고용 INFO).

## 요약

본 PR 은 2026-07-04 재결정(spec 분리 #800 완료 → cap+cancel 만 이번 PR, priority 3-tier 는 별도 후속)과 코드·spec 레벨에서 정확히 일치하게 구현됐다 — priority 관련 코드는 손대지 않았고(`triggerType` 여전히 manual/webhook 2-tier), admission gate·5분 cancel·settings 스키마·migration(V104/V105, 충돌 없음 확인)이 spec-draft PR2b(`spec-draft-concurrency-cap-pr2b.md`)가 정의한 범위와 부합한다. 유일한 정합성 갭은 **추적 plan 파일(`exec-intake-queue-impl.md`) 자체가 이번 구현 완료를 반영하도록 갱신되지 않은 점**이다 — L46 체크박스가 미체크 상태로 남아 있고, 그 서술은 이미 superseded 된 구 스코프("전체 한 PR" 포함 priority 3-tier)를 그대로 담고 있어 spec(§4/§8, "PR2b 구현 완료"로 flip)과 plan 문서 간 표면적 불일치가 생겼다. 결정 자체의 충돌·선행조건 미해소·후속 항목 무효화는 없으며, 이는 문서 갱신 누락 수준(WARNING)이다. (참고: 이번 검토에 전달된 orchestrator 페이로드는 대상과 무관한 내용이었고, 워킹트리 실물 파일 직접 조회로 대체 검증했다.)

## 위험도
LOW

BLOCK: NO

Critical: 0
Warning: 1 (plan 체크박스·서술 stale — `exec-intake-queue-impl.md` L46 갱신 필요, 코드 병합 자체를 막을 사유는 아님)

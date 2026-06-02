# Plan 정합성 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-backend-msg-i18n.md` (target 문서 — 디스크에 미존재, prompt payload 에서 직접 검토)
> 검토 모드: spec draft 검토 (--spec)
> 검토일: 2026-06-02

---

## 발견사항

### [INFO] target 문서가 `plan/in-progress/` 에 아직 존재하지 않음
- target 위치: 문서 자체
- 관련 plan: 해당 없음
- 상세: `plan/in-progress/spec-draft-backend-msg-i18n.md` 파일이 실제 디스크(main 브랜치)에 없다. 검토는 prompt payload 에 첨부된 초안 내용을 기준으로 수행했다. 파일이 신규 생성 예정이라면 이 항목은 정상.
- 제안: plan 파일 생성 전 본 검토 결과를 적용해 초안을 확정한다.

---

### [INFO] `cross-node-warning-rules.md` spec 의 `GraphWarningRule.evaluate` 반환 타입 변경 — 타입 계약 호환성 확인 필요
- target 위치: §2 결정 C, §3-2
- 관련 plan: `plan/in-progress/parallel-p2-followups.md` §6 (선행 spec으로 참조됨); `plan/complete/cross-node-warning-rules.md` (완료, spec §3 타입 정의 소유)
- 상세: 현재 `spec/conventions/cross-node-warning-rules.md §3` 의 `GraphWarningRule.evaluate` 반환 타입은 `{ message: string } | null` 이다. target 초안(결정 C)은 이를 `{ message: string; params?: Record<string, string | number> }` 로 확장하겠다고 선언한다. `params` 가 optional 이므로 기존 rule 은 하위호환이다. 그러나 shared package `@workflow/graph-warning-rules` 의 `GraphWarningRuleResult` 에도 `params?: Record<string, string | number>` 를 추가해야 하며, 이는 codebase 변경(구현 plan 소관)이다. spec 본문이 타입을 정의하고 있으므로 spec 변경 시 구현 plan(`backend-msg-i18n-impl.md`)에서 패키지 타입도 갱신해야 한다는 후속 의무가 누락 없이 명시될 필요가 있다.
- 제안: target 초안 §5(구현 follow-up) 항목 1에 "shared package `GraphWarningRule.evaluate` 반환·`GraphWarningRuleResult` 타입 갱신(하위호환)" 을 명시적으로 기재한다.

---

### [WARNING] `i18n-userguide.md §errorCode` 의 "후속 plan: `ERROR_KO` 신설 + `translateBackendError` 도입 검토" 가 미결 상태 — target 이 이를 확정
- target 위치: §1 문제 정의, §2 결정 A, §3-1
- 관련 plan: `spec/conventions/i18n-userguide.md §errorCode` (현재 갭 — "검토" 수준 pending)
- 상세: i18n-userguide spec 의 `§errorCode` 섹션은 `ERROR_KO` 신설과 `translateBackendError` 도입을 **"검토"** 수준의 후속 plan 으로 미뤄 둔 상태다. target 초안은 이 항목을 결정 A 로 확정("채택")하고 Rationale 까지 제시한다. 이는 "미결 결정을 일방적으로 확정"에 해당하지만, target 자체가 그 결정을 내리기 위한 spec draft plan (project-planner 역할)이므로 절차상 위반은 아니다. 단, target 이 main 에 merge 되면 i18n-userguide spec 의 `§errorCode` 갱신(문구 "검토" → 정식 Principle 3-C 승격)도 동일 PR 에 포함되어야 하는데, 이 의무가 target §3-1 에 서술되어 있어 명시는 있다. 그러나 i18n-userguide spec frontmatter 의 `status: implemented` 유지 여부(또는 `partial` 전이 후 재승격)가 target §3-1 에 언급되지 않았다.
- 제안: target §3-1 에 "i18n-userguide spec frontmatter `status` 변경 불필요(이미 implemented, §errorCode 갭 제거 후 완전 satisfied)" 또는 필요 시 전이 절차를 한 줄 명시한다.

---

### [WARNING] `parallel-p2-followups.md §6` 첫 번째 항목이 "신설 시" 조건부 표현 — target 이 확정하는 결정과 정합하지 않는 표현 잔존
- target 위치: §1 문제 정의(선행 spec for §6), §2 결정 A/D
- 관련 plan: `plan/in-progress/parallel-p2-followups.md §6`
- 상세: `parallel-p2-followups.md §6` 항목 1은 "`backend-labels.ts` `ERROR_KO` 매핑 테이블 **신설 시** `GRAPH_VALIDATION_FAILED` 한국어 매핑 추가" 라고 조건부로 서술되어 있다. target 초안이 `ERROR_KO` 신설을 **의무(결정 D)** 로 확정하면, §6 항목 1의 조건절 "신설 시"는 필연이 되므로 확정 후 plan 갱신이 필요하다. 또한 target 이 `GRAPH_VALIDATION_FAILED` 의 `ERROR_KO` 매핑을 "의무" 로 명시하므로, §6 항목 1은 이미 확정된 의무를 체크박스로 추적하는 방식으로 갱신해야 한다.
- 제안: target spec draft 가 확정되어 main 에 merge 된 시점에 `parallel-p2-followups.md §6` 항목 1의 "신설 시" 조건절을 제거하거나 "의무" 로 갱신한다. 이 갱신을 target 의 `§5 구현 follow-up`(항목 3 — frontend `ERROR_KO` 테이블) 과 동일 PR 에 포함하거나, spec merge 직후 plan 파일을 별도로 갱신하는 절차를 target §5 에 명시한다.

---

### [INFO] `plan/in-progress/spec-draft-backend-msg-i18n.md` frontmatter 에 `worktree` 필드 없음
- target 위치: 문서 frontmatter (없음)
- 관련 plan: 해당 없음
- 상세: target 초안은 worktree frontmatter 가 없어(spec draft plan 으로 project-planner 역할) 특정 worktree 에 배정되지 않은 상태다. plan-lifecycle 규약에 따르면 `in-progress` plan 은 `worktree` 필드를 명시해야 한다. spec draft 는 실제 구현 worktree 가 없어도 생성 worktree(consistency-check 가 실행 중인 `parallel-p2-w1w2`) 를 임시 명시하거나, "spec-only, worktree 미할당" 을 frontmatter 에 기재하는 것이 권장된다.
- 제안: target 파일 생성 시 frontmatter 에 `worktree: (spec-draft, no impl worktree)` 또는 현재 작업 worktree 를 기재한다.

---

### [INFO] `plan/in-progress/backend-msg-i18n-impl.md` 가 아직 존재하지 않음 — target §5 이관 예정 명시
- target 위치: §5 구현 follow-up
- 관련 plan: 해당 없음
- 상세: target §5 는 구현 plan 을 "별 plan `plan/in-progress/backend-msg-i18n-impl.md` 로 이관 예정" 이라고만 서술하고 있다. 이 plan 이 아직 없으므로 target spec draft 가 확정되면 구현 plan 파일 생성이 후속 의무가 된다. target 자체에 이 후속 의무가 명시되어 있으나, 구현 plan 이 없는 상태에서 spec만 merge 되면 추적이 끊길 위험이 있다.
- 제안: target spec draft 를 merge 하는 PR 에서 구현 plan(`backend-msg-i18n-impl.md`) 파일을 `plan/in-progress/` 에 함께 생성하거나, "spec PR 완료 직후 구현 plan 생성" 을 체크박스로 target §5 에 추가한다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

target plan 의 worktree 필드가 없으므로 §5 worktree 충돌 검토는 "target 이 손대는 spec 파일을 다른 active worktree 가 동시에 수정 중인가" 를 기준으로 수행했다.

target 이 수정하는 spec 파일:
- `spec/conventions/i18n-userguide.md`
- `spec/conventions/cross-node-warning-rules.md`

조사 결과:

- `close-cross-node-warning-c4c4d9` (branch `close-cross-node-warning-c4c4d9`) 가 `spec/conventions/cross-node-warning-rules.md` 의 frontmatter(`status: partial → implemented`, `pending_plans` 제거)를 수정 중. **단, 이 변경은 target 이 의도하는 §3 타입 정의 수정과 다른 섹션(frontmatter만)**이며, 해당 worktree 의 변경 범위(frontmatter 2줄 변경)는 target 의 §3 타입 확장과 실질 충돌하지 않는다. 충돌 구간이 다른 줄이라 merge 시 자동 해소 가능. 단, 동일 파일을 두 worktree 가 손대는 사실 자체를 기록.
  - Step 1 ancestor 검사: `git merge-base --is-ancestor close-cross-node-warning-c4c4d9 origin/main` → ACTIVE (exit 1)
  - Step 2 PR state: `gh pr list --state all --head close-cross-node-warning-c4c4d9` → empty (PR 없음)
  - Step 3 fallback: active 로 처리. "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장"
  - 결론: ACTIVE 로 판정. 단, 충돌 구간이 다른 줄이므로 CRITICAL 제외, INFO 수준.

기타 active worktree(`cafe24-error-codes-convention-523e2d`, `cafe24-followups-decisions-a38f26`, `cafe24-install-ratelimit-2891d1`, `channel-web-chat-followups-1feff2`, `continuation-worker-concurrency-env`, `eia-distributed-seq-1319a0`, `mermaid-lint-f4943c`, `parallel-p2-w1w2`) 는 `i18n-userguide.md` 또는 `cross-node-warning-rules.md` 를 수정하지 않음.

stale 으로 skip 된 worktree: **0건**

---

## 요약

`spec-draft-backend-msg-i18n.md` 는 `i18n-userguide.md §errorCode` 의 "검토" 수준 미결 사항을 정식 결정으로 확정하는 spec draft 이며, 이 역할 자체는 절차(project-planner 권한)에 부합한다. 미해결 결정 우회나 active worktree 와의 실질 충돌은 없다. 다만 (1) `GraphWarningRuleResult` 타입 갱신 의무가 구현 follow-up 에 미명시, (2) `parallel-p2-followups.md §6` 의 조건부 표현 갱신 의무 미반영, (3) frontmatter 미작성, (4) 구현 plan 생성 타이밍 추적 누락의 WARNING/INFO 4건이 있다. worktree 충돌 후보 7건 중 stale 0건 skip, active 7건 분석. `close-cross-node-warning-c4c4d9` 가 동일 spec 파일을 손대나 충돌 구간 상이하여 INFO 수준.

---

## 위험도

LOW

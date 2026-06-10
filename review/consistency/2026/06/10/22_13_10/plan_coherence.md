# Plan 정합성 검토 결과

검토 대상 (target): `refactor-approved-batch` 브랜치
구현 범위: `spec/5-system/4-execution-engine.md spec/data-flow/14-chat-channel.md spec/5-system/16-system-status-api.md spec/4-nodes/1-logic/10-parallel.md` (dead code 제거 03 M-6·m-2 + parallel branch dev/test deep freeze 06 M-5)
변경 파일: `codebase/backend/` 7개 소스/테스트 파일, `plan/in-progress/refactor/03-maintainability.md`, `plan/in-progress/refactor/06-concurrency.md`, `plan/in-progress/spec-update-deadcode-cleanup.md`

---

## 발견사항

- **[INFO]** `spec-update-deadcode-cleanup.md` — spec 반영 draft 가 project-planner 대기 상태
  - target 위치: `plan/in-progress/spec-update-deadcode-cleanup.md` 전체 (worktree: plan-complete-turn-timing-aa533b)
  - 관련 plan: 해당 파일 자체 — developer 가 `spec/` read-only 이므로 별도 planner 트랙으로 분리
  - 상세: `spec/5-system/16-system-status-api.md §3` lines 90·94 에 deprecated 상수명(`FAILED_DEGRADED_THRESHOLD`/`DELAYED_DEGRADED_THRESHOLD`)이 잔류한다. 코드에서 해당 상수 2개가 이번 PR 에서 삭제됐으나 spec 본문은 아직 구 상수명 그대로다. `spec-update-deadcode-cleanup.md` 가 이를 "결정 필요" 가 아닌 "project-planner 처리 대기" 로 올바르게 추적 중이고 plan 체크리스트도 미완료 상태다. 충돌이 아니라 후속 작업 추적이므로 INFO 등급.
  - 제안: project-planner 가 `/consistency-check --spec` 후 `spec/5-system/16-system-status-api.md §3:90,94` 를 getter 표현으로 갱신하고 draft plan 을 `plan/complete/` 로 이동.

- **[INFO]** `spec/5-system/4-execution-engine.md §7.4` — in-memory continuation 머신 제거 완료 날짜 갱신 미완료
  - target 위치: `spec-update-deadcode-cleanup.md §2` ("선택")
  - 관련 plan: `spec-update-deadcode-cleanup.md`
  - 상세: 03 M-6 구현으로 `registerContinuationHandlers` no-op stub 및 `ContinuationBusService.on()` deprecated 메서드가 제거(full B3 완성)됐다. `spec/5-system/4-execution-engine.md §7.4` 에 날짜 업데이트가 "선택"으로 남아 있고 spec 서사는 이미 worker 단일 경로라 실질 충돌은 없다. 비차단 INFO.
  - 제안: planner 가 §7.4 구현 메모 날짜를 2026-06-10 으로 갱신하면 서사 일관성이 향상됨.

- **[INFO]** `06-concurrency.md M-5` — `structuredClone` 전환 결정 대기 항목이 이번 PR 에 반영되지 않음 (의도된 제외 확인)
  - target 위치: `plan/in-progress/refactor/06-concurrency.md §M-5`
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` M-5 (완료로 표시)
  - 상세: M-5 는 `spec/4-nodes/1-logic/10-parallel.md:14` 가 명시 결정("deep clone 비용 회피 — shallow copy 유지")한 상황에서 structuredClone 전환을 **단독 구현 금지**로 명기한다. 이번 PR 은 spec 결정을 준수해 dev/test 환경 freeze 만 추가했고, structuredClone 전환은 포함하지 않는다. plan 에서 M-5 가 ✅ 완료로 업데이트된 것도 확인됨. 정합.

- **[WARNING]** `03-maintainability.md m-2 (toEiaEvent alias)` — spec-sync 워크트리가 머지 완료됐으나 `spec/data-flow/14-chat-channel.md` 에 `toChatChannelEvent` 참조를 이미 사용 중 — spec 선행 반영
  - target 위치: git diff `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `toEiaEvent` alias 제거
  - 관련 plan: `plan/in-progress/spec-update-deadcode-cleanup.md`; `plan/in-progress/refactor/03-maintainability.md §m-2`
  - 상세: `spec/data-flow/14-chat-channel.md:116` 은 이미 `toChatChannelEvent` 를 참조하고 있다(PR #516 내 spec-sync-audit-998544 에서 새 파일로 추가). 이번 PR 에서 `toEiaEvent` alias 를 코드에서 삭제하고 테스트 전체를 `toChatChannelEvent` 로 전환했으므로 spec-code 정합은 올바르다. 단, `spec-update-deadcode-cleanup.md` 에 m-2 의 `chat-channel.dispatcher.ts:632-636 toEiaEvent alias` 제거가 완료 처리되었음을 명시적으로 기록하는 체크박스·항목이 없다 — plan 이 M-6·m-2 를 "단일 PR" 로 묶어 추적하지만 draft plan 이 §1 spec 갱신(상수 → getter)에만 초점을 맞추고 m-2 완료를 별도 기술하지 않아 추적 누락 가능성이 있다. WARNING 등급 (plan 정합성, 차단 아님).
  - 제안: `spec-update-deadcode-cleanup.md` 또는 `refactor/03-maintainability.md §m-2` 에 `toEiaEvent` alias 제거 완료를 ✅ 로 표시.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석:

target 브랜치(`refactor-approved-batch`)가 변경한 코드 파일(`codebase/backend/src/modules/…`)에 대해 다른 활성 worktree 와의 경합을 점검했다. spec 파일(`spec/5-system/16-system-status-api.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/14-chat-channel.md`)은 직접 수정하지 않았으나 `spec-update-deadcode-cleanup.md` draft 를 통해 planner 트랙에서 간접 변경이 예고됐다.

spec 파일 충돌 후보로 식별된 worktree:

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1: exit 1 (squash-merge 케이스). Step 2: PR #516 **MERGED** → **stale**.

해당 worktree(`spec-sync-audit-998544`)가 `spec/5-system/16-system-status-api.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/14-chat-channel.md` 를 모두 수정했으나 PR #516 이 이미 main 에 머지됐으므로 실질 경합 없음.

기타 활성 worktree(`security-fixes-0f9165`, `unified-model-mgmt-5af7ee`)는 Step 1 미통과, Step 3 fallback으로 active 처리했으나 이들이 변경한 파일 목록에는 위 spec/코드 파일 교집합이 없어 §5 worktree 충돌 해당 없음.

stale skip 목록:
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1 ancestor 음성 (squash-merge), Step 2 PR #516 **MERGED** → stale skip.
- `health-probe-status-d9a184` (branch `claude/health-probe-status-d9a184`) — Step 1 ancestor 양성 → stale skip.
- `kb-lifecycle-groom-57cc46` — Step 2 PR MERGED → stale skip.
- `kb-unsearchable-warning-b47e20` — Step 2 PR MERGED → stale skip.
- `plan-complete-ai-review-backlog-85f80a` — Step 2 PR MERGED → stale skip.
- `trigger-schedule-sync-f88604` — Step 2 PR MERGED → stale skip.

이 worktree 들은 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

이번 `refactor-approved-batch` 브랜치의 변경(dead code 제거 03 M-6·m-2, parallel branch dev/test deep freeze 06 M-5)은 `plan/in-progress/refactor/03-maintainability.md` 및 `plan/in-progress/refactor/06-concurrency.md` 의 해당 항목이 이미 "사용자 승인 — 진행 확정" 또는 완료로 업데이트된 상태와 정합한다. 미해결 결정 우회 또는 active worktree 와의 spec 파일 경합은 없다. 주요 후속 사항은 `spec-update-deadcode-cleanup.md` draft 의 project-planner 반영(spec/5-system/16-system-status-api.md §3 상수명 → getter 표현) 1건이며 이는 차단 사항이 아닌 "planner 대기" 상태로 올바르게 추적 중이다. 또한 `03-maintainability.md §m-2` 에 `toEiaEvent` alias 완료 체크가 명시적으로 기록되지 않은 추적 누락이 WARNING 으로 발견됐으나 차단 사유는 아니다. worktree 충돌 후보 7건 중 stale 6건 skip, active 1건(`unified-model-mgmt-5af7ee`, `security-fixes-0f9165` 은 변경 파일 교집합 없음) 분석.

---

## 위험도

LOW

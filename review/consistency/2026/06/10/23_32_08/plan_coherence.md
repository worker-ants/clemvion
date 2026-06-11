# Plan 정합성 검토 결과

**Target**: `plan/in-progress/spec-update-ws-resumed-ack.md`  
**검토 모드**: spec draft (--spec)  
**검토 시각**: 2026-06-10

---

## 발견사항

### [INFO] 대상 spec 변경이 이미 main 에 반영됨 (선행 커밋 #516)

- **target 위치**: `plan/in-progress/spec-update-ws-resumed-ack.md` §변경안 전체
- **관련 plan**: 해당 없음 (이미 머지된 커밋)
- **상세**:
  - 변경안 1 (`spec/5-system/6-websocket-protocol.md` §4.2 `resumed` 정의 정정): 현재 spec line 245 에 `**재개 시작 수락(enqueue) 여부**` 및 always-enqueue 모델 해설 노트(line 234)가 이미 반영돼 있다 — PR #516 (`79f1d849`, "5-system·7-channel-web-chat 동기화") 에서 머지됨.
  - 변경안 2 (`spec/5-system/4-execution-engine.md` §7.5 line 967 정정): 현재 spec line 967 에 "이 셋 모두 worker 측 **비동기**(post-enqueue) 실패이므로 동기 ack 가 아니라 후행 `EXECUTION_CANCELLED` 이벤트…" 가 이미 반영돼 있다 — 동일 PR #516.
  - 즉 target plan 이 제안하는 두 spec 정정 모두 현재 worktree base(`c07b2768`) 에 선적용된 상태다.
- **제안**: target plan 을 실행하면 이미 반영된 내용의 재작성이 되어 diff 가 없거나 매우 경미할 수 있다. 실행 전 현재 spec 내용을 읽고 실제 잔여 갭이 있는지 확인 권장. 잔여 갭이 없으면 plan 을 `plan/complete/` 로 이동 처리.

---

### [INFO] 프론트엔드 가드 확인 항목 — 선행 검증 미보고

- **target 위치**: `plan/in-progress/spec-update-ws-resumed-ack.md` §검증·후속 "프론트 가드 확인(읽기)"
- **관련 plan**: `plan/in-progress/refactor/06-concurrency.md` M-1 (✅ 2026-06-10 사용자 승인)
- **상세**:
  - 대상 plan 이 명시한 "프론트 가드 확인: `use-execution-events.ts`/`apply-execution-snapshot.ts` 등이 ack 의 `resumed:true` 를 상태 전이 근거로 쓰는 곳이 없는지 확인" 은 developer 트랙 검증 항목이다.
  - PR #516 에서 `6-websocket-protocol.md` frontmatter `code:` 글롭에 `use-execution-interaction-commands.ts` 가 추가됐으나, 가드 확인 결과 자체는 어느 plan/review 에도 기록돼 있지 않다.
  - 만약 프론트엔드에서 ack `resumed:true` 를 상태 전이 근거로 사용하는 곳이 있으면 별도 developer 항목이 필요하다 (target plan 본문의 조건부 후속 신설 조건).
- **제안**: target plan 실행 시 프론트엔드 확인을 수행해 결과를 기록. 문제 없으면 present plan 으로 종결, 문제 있으면 developer 항목 신설 필요.

---

### [INFO] `refactor/06-concurrency.md` C-2 결정 대기 — §7.5 동일 파일 잠재 중복

- **target 위치**: `plan/in-progress/spec-update-ws-resumed-ack.md` §변경안 2 (`4-execution-engine.md` §7.5)
- **관련 plan**: `plan/in-progress/refactor/06-concurrency.md` C-2 "결정 대기 (사용자)"
- **상세**:
  - C-2 가 승인될 경우, `4-execution-engine.md §7.5` 의 "재검증 가드" 문구를 "DB-level 원자 claim" 으로 교체하는 spec 갱신이 planner 에게 위임된다. 이는 target plan 이 이미 수정한 동일 섹션(§7.5)의 **인접한 다른 문장**(line 956 의 재검증 가드 설명)이다.
  - target plan 이 먼저 머지되고 이후 C-2 가 승인·실행돼도 수정 대상 문장이 다르므로 직접 충돌은 없다. 단 동일 §7.5 를 연속으로 손대게 되므로 타이밍을 인지해야 한다.
  - C-2 결정 자체는 "결정 대기" 이므로 target plan 실행을 차단하지 않는다.
- **제안**: C-2 승인 시 spec 갱신 담당자가 target plan 이 반영한 line 967 과 중복되지 않음을 확인 후 진행. 현재는 충돌 없음.

---

### [INFO] `spec-sync-websocket-protocol-gaps.md` 및 `spec-sync-execution-engine-gaps.md` — worktree `spec-sync-audit` stale 확인

- **target 위치**: 해당 plan 들의 frontmatter `worktree: spec-sync-audit`
- **관련 plan**: `plan/in-progress/spec-sync-websocket-protocol-gaps.md`, `plan/in-progress/spec-sync-execution-engine-gaps.md`
- **상세**:
  - 두 plan 의 frontmatter 가 `worktree: spec-sync-audit` 를 가리키나 해당 worktree 디렉토리 및 branch 가 모두 존재하지 않는다 (PR #516 으로 머지·정리된 것으로 판단).
  - 이들 plan 의 항목 대부분이 `[x]` 완료 처리됐으나 in-progress 에 잔류 중.
  - target plan 과 동일 spec 파일을 다루는 미완료 항목이 없는지 확인: `spec-sync-websocket-protocol-gaps.md` 의 모든 항목은 "미구현 feature" 추적(in-band 토큰 갱신 등)으로 `resumed` 정의와 별개. `spec-sync-execution-engine-gaps.md` 의 모든 항목은 `[x]` 완료. 충돌 없음.
- **제안**: 두 plan 의 worktree `spec-sync-audit` 는 stale. 본 보고 INFO 로만 처리.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| 후보 | 판정 | 근거 |
|------|------|------|
| `spec-sync-audit` (branch `claude/spec-sync-audit*`) | **stale skip** | Step 1: branch 자체가 존재하지 않음 — git branch -a 에 없음. Step 2: gh pr list 결과 없음. Worktree 디렉토리도 부재. PR #516 으로 squash/merge 후 cleanup 된 것으로 판단. |
| `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) | **stale skip** | Step 1: `git merge-base --is-ancestor` → STALE (branch HEAD 가 origin/main 의 조상). 대상 spec 파일 변경 없음. |

active worktree 중 `spec/5-system/6-websocket-protocol.md` 또는 `spec/5-system/4-execution-engine.md` 를 수정하는 branch 는 없음 — worktree 충돌 해당 없음.

stale worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장 (특히 `integration-expiry-fixes-1d7c7d`).

---

## 요약

`plan/in-progress/spec-update-ws-resumed-ack.md` 는 `refactor/06-concurrency.md` M-1 의 사용자 승인(2026-06-10) 에 근거하여 `spec/5-system/6-websocket-protocol.md` §4.2 와 `spec/5-system/4-execution-engine.md` §7.5 를 정정하는 spec-only 계획이다. 미해결 결정 우회, 병렬 worktree 경합, 선행 plan 미해소 문제는 없다. 단 두 spec 변경 모두 PR #516(`79f1d849`) 으로 이미 반영돼 있어 target plan 을 실행해도 실제 변경 diff 가 없을 가능성이 높으므로, 실행 전 잔여 갭 여부를 확인해 plan 종결 여부를 결정하는 것이 적절하다. 프론트엔드 가드 확인 항목(조건부 후속)은 아직 기록이 없어 확인 필요. worktree 충돌 후보 2건 전부 stale — active 충돌 0건.

---

## 위험도

LOW

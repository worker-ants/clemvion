## 발견사항

- **[INFO]** `spec-sync-chat-channel-gaps.md` CCH-NF-03 항목과 target plan 의 정합 — 이미 연결됨
  - target 위치: target plan §plan 정합 (마지막 절)
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md` 15행, CCH-NF-03 `[ ]` 항목
  - 상세: target plan 이 `spec-sync-chat-channel-gaps.md #3 항목: 메커니즘 확정 반영(문구 갱신), 구현은 여전히 [ ](후속 PR)` 으로 명시하여 연동을 인지하고 있다. spec-sync 측 항목은 "별 PR — rate-limit 인프라, 규모 큼" 으로 열려 있어 target 의 spec-only 확정(구현 분리)과 일치. 충돌 없음.
  - 제안: 조치 불필요. 단 target plan 이 완료·병합된 후 `spec-sync-chat-channel-gaps.md` CCH-NF-03 항목의 주석(`잔여 — 별 PR`)을 "spec 확정 완료, 구현 대기" 로 갱신하면 추적성이 높아진다.

- **[WARNING]** `spec-update-gap-callout-plan-links.md` 의 `spec/data-flow/14-chat-channel.md §1.1 rateLimitPerMinute` callout — plan 링크 갱신 필요
  - target 위치: target plan 전체 (spec-draft-cch-nf-03-rate-limit.md)
  - 관련 plan: `plan/in-progress/spec-update-gap-callout-plan-links.md` 21행 — `spec/data-flow/14-chat-channel.md §1.1` 의 `rateLimitPerMinute` 미구현 callout 에 `plan/in-progress/spec-sync-chat-channel-gaps.md` 를 plan 링크로 추가하는 작업이 예정되어 있다.
  - 상세: target plan(spec-draft-cch-nf-03-rate-limit.md) 이 병합되면 해당 미구현 callout 자체가 구현 계획 확정으로 바뀌거나 제거될 수 있다. `spec-update-gap-callout-plan-links.md` 의 해당 행이 가리키는 plan 도 target plan 쪽으로 변경해야 할 수 있다. 현재 `spec-update-gap-callout-plan-links.md` 는 `spec-sync-chat-channel-gaps.md` 를 링크 대상으로 기재했으나, target plan 병합 후에는 본 spec-draft plan 이 더 직접적인 추적 대상이다.
  - 제안: target plan 병합 후 `spec-update-gap-callout-plan-links.md` 의 해당 행 plan 링크를 `spec-draft-cch-nf-03-rate-limit.md` (또는 구현 plan) 으로 갱신하거나 행 자체를 제거한다. 병합 전에는 조치 불필요.

- **[INFO]** `spec/5-system/15-chat-channel.md` CCH-NF-03 현행 문구 — "큐 적재·재발사" 명시 vs. R9 직교성
  - target 위치: target plan §결정(v1 정책), §"큐 적재→재발사" 미채택 이유
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md` 15행 (CCH-NF-03 미구현 기술)
  - 상세: 현행 spec CCH-NF-03 은 "초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 degraded 표시" 로 기술되어 있다. target plan 은 이 "큐 적재" 문구가 R9 와 WH-NF-01 200ms 시한과 충돌한다는 근거로 "처리 생략(skip) + degraded" 로 교체할 것을 제안한다. target plan 의 Rationale(본 draft 결정 근거)이 R9 의 적용 근거를 명확히 설명하고 있으며 이는 spec 의 기존 결정(R9 내용)과 정합하다. 미해결 결정을 일방적으로 우회하는 것이 아니라 기존 Rationale 를 rate-limit 큐 케이스에 명시적으로 적용하는 것이다. 충돌 없음.
  - 제안: 조치 불필요. spec 변경 시 `R9` 본문에 "본 근거는 rate-limit 큐(CCH-NF-03)에도 동일 적용 — R-CC-19 참조" 단서 1행을 추가하면 cross-reference 추적성이 높아진다.

- **[INFO]** `channel-web-chat-followups.md` §1 `PublicWebhookQuotaService` 재사용 전제
  - target 위치: target plan §결정(v1 정책) "기존 `PublicWebhookQuotaService.incrWithWindow` 패턴 재사용"
  - 관련 plan: `plan/in-progress/channel-web-chat-followups.md` §1 — `PublicWebhookQuotaService` 는 이미 구현 완료(2026-06-02), 현재 `channel-web-chat-followups.md` 는 "종결(parked, 2026-06-03)" 상태이며 해당 서비스는 production 코드에 존재.
  - 상세: target plan 이 `PublicWebhookQuotaService` 의 `incrWithWindow` 패턴을 재사용한다고 기술하는 것은 이미 병합된 코드를 참조하는 것이므로 선행 plan 미해소 이슈 없음. 단순 추적 메모.
  - 제안: 조치 불필요.

- **[INFO]** 현행 `spec/5-system/15-chat-channel.md` 에 R-CC-19 미존재 — 신설 충돌 없음
  - target 위치: target plan §변경 surface §4 "Rationale R-CC-19 신설"
  - 관련 plan: 없음
  - 상세: 현행 spec 의 Rationale 는 R-CC-10 ~ R-CC-18 까지 존재하고 R-CC-19 는 없다. target plan 이 R-CC-19 를 신설하는 것은 기존 항목과 충돌 없음.
  - 제안: 조치 불필요.

---

### Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토:

1. `spec-sync-chat-channel-gaps.md` 의 `worktree: chat-channel-gaps` — `git worktree list` 에 없음. `claude/chat-channel-gaps` branch 도 존재하지 않음 (원격·로컬 모두 부재). branch 자체가 없으므로 활성 checkout 없는 sentinel (`(unstarted)` 등가). **stale 판정 대상 아님 — worktree 미생성.** 동일 spec 파일(`15-chat-channel.md`) 을 편집할 예정이나 별도 checkout 없으므로 물리적 worktree 경합 없음.

2. `spec-update-gap-callout-plan-links.md` 의 `worktree: trigger-schedule-sync-f88604` — `git worktree list` 에 없음. `claude/trigger-schedule-sync-*` 원격 branch 없음. 활성 checkout 없음 — worktree 경합 없음.

3. `refactor-04-security-286de9` worktree — `git worktree list` 에 존재, 대상 spec 은 `1-auth.md`, `6-websocket-protocol.md`, `4-nodes/1-logic/8-filter.md` 등. `15-chat-channel.md` 를 편집하지 않으므로 target plan 과 파일 경합 없음.

4. `refactor-04-followups-7cc7f0` worktree — 동일, `15-chat-channel.md` 비편집.

**stale 판정 cascade 결과**: 위 워크트리 후보 중 stale cascade 대상(branch 존재)은 refactor-04 2건. Step 1 결과 ACTIVE (main 조상 아님). Step 2 결과 empty (PR 없음). Step 3: fallback — active 로 처리. 단 `15-chat-channel.md` 편집 파일 중복이 없으므로 CRITICAL 없음.

**stale 으로 skip 한 worktree: 0건.** (편집 파일 경합이 있는 active worktree 없음 — refactor-04 두 worktree 는 `15-chat-channel.md` 미접촉으로 §5번 검토에서 비해당.)

---

### 요약

target plan(`spec-draft-cch-nf-03-rate-limit.md`)은 `plan/in-progress/spec-sync-chat-channel-gaps.md` 의 CCH-NF-03 미구현 항목과 정합하며 — target 이 spec 확정, 구현은 후속 PR 이라는 분리를 명시하고 있고 spec-sync 측 항목의 "별 PR" 기술과 일치한다. 미해결 결정을 우회하는 충돌은 없으며, active worktree 중 동일 파일(`15-chat-channel.md`)을 편집하는 것은 없다. 유일한 WARNING은 target 병합 후 `spec-update-gap-callout-plan-links.md` 의 plan 링크 갱신 필요(현재는 미착수·비차단)이다. worktree 충돌 후보 중 stale 판정 cascade skip 0건, active 2건(refactor-04) 분석 — 파일 경합 없어 CRITICAL 없음.

### 위험도

LOW

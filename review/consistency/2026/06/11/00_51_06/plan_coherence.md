# Plan 정합성 검토 — spec/2-navigation/ (impl-done, diff-base=origin/main)

검토 대상 worktree: `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`)  
변경 파일: `spec/2-navigation/4-integration.md`, `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/data-flow/8-notifications.md`, `spec/4-nodes/4-integration/4-cafe24.md`, 코드 파일 다수

---

### 발견사항

해당 없음 — CRITICAL·WARNING 발견 없음.

**분석 결과:**

1. **미해결 결정과의 충돌 (관점 1)**: `plan/in-progress/integration-expiry-fixes.md` 에 기록된 모든 결정(`V-07 = §11.2 채택`)은 사용자가 2026-06-10 에 명시 승인한 것으로 plan 에 기록돼 있다. target 변경은 해당 결정을 구현·정합한 것이며, 미해결 결정을 우회하는 일방적 결정이 없다.

2. **중복 작업 (관점 2)**: `spec/2-navigation/4-integration.md` 를 참조하는 활성 plan 으로 `plan/in-progress/cafe24-backlog-residual.md` (worktree `cafe24-backlog-residual-batch`)가 있다. 그러나 해당 plan 이 건드리는 섹션은 §9.2(API), §9.8(buildIntegrationMeta), §5.4(§3.2 에러 코드) 이며, target 이 변경한 §11.1/§11.2(만료 스캐너), §5.5(SMTP 연결 테스트 `unknown_error`), §1.4(mermaid diagram) 와 영역이 겹치지 않는다. 또한 cafe24-backlog-residual-batch 브랜치는 로컬·리모트 모두 존재하지 않아(`fatal: Not a valid object name`) 실제 착수 전 상태다.

3. **선행 plan 미해소 (관점 3)**: target 이 가정하는 사전 조건(`V-07 §11.2 사용자 결정 완료`)은 plan 에 2026-06-10 결정으로 기록돼 있고 `--impl-prep` 게이트도 통과(`[x]`)했다.

4. **후속 항목 누락 (관점 4)**: target 변경(`integration_expired` 발사 대상을 refresh_token-less provider 로 한정)은 `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` 의 미구현 항목(알림 이메일 발송 경로, NotificationsService.notify 단일 표면 등)에 영향을 주지 않는다. notifications gaps plan 의 미구현 항목들은 알림 *발송 인프라* 부재에 관한 것으로, target 이 변경한 발사 *조건* 정합과 직교한다. 후속 항목 생성 필요 없음.

5. **worktree 충돌 (관점 5)**: 현재 active worktree 4개 중 `spec/2-navigation/4-integration.md` 또는 target 이 변경한 다른 파일들을 동시에 건드리는 worktree는 없다. health-probe-status는 health 모듈만, unified-model-mgmt는 LLM/KB 엔티티만, ws-resumed-ack-spec은 exec-engine/websocket spec 만 변경한다.

---

### Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 분석 중 조사한 브랜치 목록:

- `cafe24-backlog-residual-batch` — Step 1: `fatal: Not a valid object name` (브랜치 미존재, exit 128). Step 2: PR 없음(empty). Step 3: Fallback — active 로 처리했으나, 브랜치 자체가 로컬·리모트에 존재하지 않아 실제 worktree 생성 전 상태. `spec/2-navigation/4-integration.md` 의 동일 섹션을 건드리지 않으므로 §5번 분석 대상에서 제외.
- `spec-sync-audit` — Step 1: `fatal: Not a valid object name` (브랜치 미존재). Step 2: PR 없음. 브랜치 미존재로 실제 active worktree 아님. 관련 파일(`spec/data-flow/8-notifications.md`, `spec/2-navigation/1-workflow-list.md` 등)에 대한 변경은 target 과 직교하거나 동일 섹션을 건드리지 않음.

두 케이스 모두 브랜치가 미존재하므로 물리 worktree 충돌 위험 없음. cleanup 대상 아님.

---

### 요약

`integration-expiry-fixes-1d7c7d` worktree 의 `spec/2-navigation/` 변경은 사용자 결정(V-07 §11.2 채택, 2026-06-10)을 근거로 한 정합 작업으로, plan 의 미해결 결정을 우회하거나 일방적으로 결정을 내리지 않는다. `spec/2-navigation/4-integration.md` 를 참조하는 plan `cafe24-backlog-residual.md` 의 브랜치는 미존재(착수 전)이며, 변경 섹션이 겹치지 않아 병렬 경합 위험이 없다. 활성 worktree(health-probe-status, unified-model-mgmt, ws-resumed-ack-spec) 중 동일 파일을 건드리는 것은 없다. worktree 충돌 후보 2건은 브랜치 미존재로 stale 판정 cascade Step 1/2 모두 결정 불가 — active 로 처리했으나 물리 worktree 없음.

---

### 위험도

NONE

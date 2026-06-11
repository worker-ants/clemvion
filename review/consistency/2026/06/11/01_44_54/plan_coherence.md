# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target: `spec/2-navigation/` (diff-base=origin/main)
실제 변경 파일: `spec/2-navigation/4-integration.md` 단일 파일 (integration-expiry-fixes branch)

---

## 발견사항

- **[INFO]** `spec-sync-integration-common-gaps.md` 의 미구현 항목과 비간섭
  - target 위치: `spec/2-navigation/4-integration.md` 전체 (§11.1 스캐너 잡, §11.2 알림 정책, §10.5 갱신 실패 시, Rationale 섹션)
  - 관련 plan: `plan/in-progress/spec-sync-integration-common-gaps.md`
  - 상세: `spec-sync-integration-common-gaps.md` 는 `spec/4-nodes/4-integration/0-common.md` (노드 공통 규약) 의 미구현 항목을 추적하며, `spec/2-navigation/4-integration.md` (통합 관리 화면·OAuth 정책) 를 다루지 않는다. target 변경은 `4-integration.md` 의 만료 스캐너·알림 정책·`isRefreshCapable` 기술만 갱신하므로 두 문서는 서로 다른 spec 파일을 담당해 충돌 없음.
  - 제안: 조치 불필요.

- **[INFO]** `spec-code-cross-audit-2026-06-10.md` — 후속 미해결 항목 중 V-01 (makeshop expired 오격하) 해소 기록 필요
  - target 위치: `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 잡 + Rationale `isRefreshCapable` 섹션
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — "SUMMARY §1 위반 19건의 코드 수정 vs spec 하향 결정" 후속 항목, 특히 `V-01: makeshop expired 오격하(severe)`
  - 상세: cross-audit plan 의 후속 미해결 항목 중 V-01 (makeshop expired 오격하, severe) 은 본 target 변경(`isRefreshCapable` 에 makeshop 포함, `connected-expiry` 0d 분기에서 makeshop 을 `expired` 격하 제외)으로 spec 측에서 정의가 완성됐다. cross-audit plan 의 V-01 행에 "spec 갱신으로 정책 확정 (integration-expiry-fixes branch), 코드 측 구현은 `integration-expiry-scanner.service.ts` 에서 동일 branch 에서 완료" 라는 해소 메모가 아직 plan 본문에 반영되지 않을 수 있다. plan 본문을 확인해 V-01 미해소로 표시돼 있다면 갱신 필요.
  - 제안: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-01 항목을 integration-expiry-fixes merge 후 해소 처리.

- **[INFO]** `spec-sync-workflow-list-gaps.md` worktree `spec-sync-audit` — 물리 worktree 부재, stale 판정
  - target 위치: 해당 없음 (spec/2-navigation/1-workflow-list.md 은 target 변경 범위 밖)
  - 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` (frontmatter `worktree: spec-sync-audit`)
  - 상세: `spec-sync-audit` 는 물리 worktree 디렉토리가 존재하지 않으며 (4개 active worktree 목록에 없음), branch 도 git remote 에서 확인되지 않아 이미 머지·정리된 것으로 판단. stale worktree sentinel 이다. target 변경과 직접 충돌 없음. 참고 정보로만 기록.
  - 제안: `spec-sync-*-gaps.md` 시리즈의 `worktree: spec-sync-audit` 참조는 정리 대상. 활성 작업 없으므로 차단 불요.

---

## Worktree 충돌 후보 검토

`spec/2-navigation/4-integration.md` 를 동시에 손대는 worktree 후보를 검색한 결과:

- `claude/health-probe-status-d9a184` — `spec/2-navigation/` 파일 변경 없음. 충돌 없음.
- `claude/unified-model-mgmt-5af7ee` (OPEN PR) — `spec/2-navigation/13-user-guide.md`, `5-knowledge-base.md`, `6-config.md`, `_layout.md`, `_product-overview.md` 를 변경하나 `4-integration.md` 는 변경하지 않음. 충돌 없음.
- `claude/ws-resumed-ack-spec` (OPEN PR) — `spec/2-navigation/` 파일 변경 없음. 충돌 없음.
- `claude/integration-expiry-fixes-1d7c7d` (OPEN — target branch) — `spec/2-navigation/4-integration.md` 단독 변경. 타 worktree 와 겹치는 파일 없음.

### Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `spec-sync-audit` (여러 `spec-sync-*-gaps.md` frontmatter 의 `worktree` 값) — Step 1: 물리 디렉토리 미존재 + git branch 미등록 → stale. Step 2 skip (branch 자체 없음). 해당 worktree 가 `in-progress/` plan 들의 frontmatter 에만 잔류하며 실제 checkout 없음. `./cleanup-worktree-all.sh --yes --force` 는 물리 worktree 기준이라 이 경우 불필요. plan frontmatter 의 `worktree: spec-sync-audit` 기재만 정리 권장.

worktree 충돌 후보 4개 중 stale 0건 skip (물리 active worktree 기준), plan-frontmatter stale sentinel 1건 INFO 기록.

---

## 요약

`spec/2-navigation/4-integration.md` 의 변경(integration-expiry-fixes branch)은 진행 중 plan 과의 정합성 관점에서 충돌이 없다. 미해결 결정 우회: 없음. 중복 작업: 없음 (`4-integration.md` 를 동시에 손대는 active worktree 없음). 선행 plan 미해소: 없음 — `cafe24-backlog-residual.md` 가 `spec/2-navigation/4-integration.md` 를 참조하나 본 변경 영역(만료 스캐너·알림 분리)과 직접 겹치는 미해결 항목이 없음. 후속 항목 누락: `spec-code-cross-audit-2026-06-10.md` 의 V-01 해소 기록 갱신 필요 (INFO 수준). worktree 충돌 후보 4건 전원 대상 파일 비충돌 확인, stale skip 0건.

---

## 위험도

NONE

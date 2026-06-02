# Plan 정합성 검토 결과

> 검토 모드: `--impl-prep` (구현 착수 전 spec 정합성)
> Target 영역: `spec/5-system/`
> 실제 Target 변경 파일 (system-status-page-f96d24 worktree):
>   - `spec/5-system/16-system-status-api.md` (신규)
>   - `spec/5-system/_product-overview.md` (NF-OB-06 행 추가)
> 검토 기준일: 2026-06-03

---

## 발견사항

### [INFO] spec-draft-cron-to-bullmq — status:applied, plan은 in-progress에 잔류
- **target 위치**: 무관 (충돌 없음)
- **관련 plan**: `plan/in-progress/spec-draft-cron-to-bullmq.md` (frontmatter `status: applied`)
- **상세**: `refactor-cron-to-bullmq` 브랜치의 PR이 MERGED 됨(`gh pr list` 확인). `spec-draft-cron-to-bullmq.md` 는 `status: applied` 로 표시돼 있고, 해당 plan이 수정한 `spec/5-system/1-auth.md` 변경(BullMQ 표기 동기화)이 이미 `origin/main` 에 반영돼 있음을 직접 확인. `plan-grooming-7a091c` worktree가 이 두 plan을 `plan/complete/` 로 이동하는 PR(OPEN)을 진행 중. target의 `spec/5-system/_product-overview.md` 및 `16-system-status-api.md` 와 파일 겹침 없음.
- **제안**: `plan-grooming-7a091c` PR이 머지되면 자동 정리. 현재 target 구현 착수에 차단 없음.

### [INFO] auth-config-webhook-wiring — spec/5-system/1-auth.md + 12-webhook.md 미착수 변경 예정
- **target 위치**: `spec/5-system/16-system-status-api.md` (신규), `spec/5-system/_product-overview.md`
- **관련 plan**: `plan/in-progress/auth-config-webhook-wiring.md` (Phase 0 — spec 7파일 갱신 전체 미착수 `[ ]`)
- **상세**: `auth-config-webhook-wiring.md` 가 `spec/5-system/1-auth.md` (§3.2 권한 매트릭스, §4.1 audit 카테고리) 와 `spec/5-system/12-webhook.md` 를 수정할 예정이나, target 이 건드리는 파일(`16-system-status-api.md`, `_product-overview.md`)과 완전히 다른 파일이다. 실제 파일 충돌은 없다. `auth-config-webhook-followups.md` §3 의 spec 보완 항목(`spec/5-system/1-auth.md §5` API 표 갱신)도 target 신규 API와 의미상 교차 없다.
- **제안**: 파일 충돌 없어 target 구현 착수에 차단 없음. 추적 메모로 기록.

### [INFO] execution-engine-residual-gaps — G1/G2 BLOCKED, spec/5-system/4-execution-engine.md pending
- **target 위치**: 무관
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` (G1/G2 BLOCKED, G3 완료)
- **상세**: `spec/5-system/4-execution-engine.md §11` 의 G1(WS execution.start gate)·G2(errorPolicy SIGTERM 분기)가 미구현이고 spec 선행 결정 대기로 차단된 상태. target 신규 파일(`16-system-status-api.md`)과 파일 겹침 없음. worktree `spec-frontmatter-status-migration-027c17` 는 Step1(not ancestor)/Step2(PR 없음) — Step3 fallback으로 active 처리.
- **제안**: target 구현에 영향 없음. stale cascade Step 3 fallback으로 active 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석 결과 (spec/5-system/ 파일 접촉 여부 기준):

- `channel-web-chat-spec-3b22b3` (branch `claude/channel-web-chat-spec-3b22b3`) — Step 2 PR MERGED. 해당 worktree의 변경 파일에 `spec/5-system/` 없음. **stale skip**.
- `refactor-cron-to-bullmq` (branch `claude/refactor-cron-to-bullmq`) — Step 2 PR MERGED. 물리 worktree 디렉토리 미존재. **stale skip**.

위 stale 2건 중 `channel-web-chat-spec-3b22b3` 은 물리 worktree가 남아있다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

`spec-frontmatter-status-migration-027c17` (execution-engine-residual-gaps 소유): stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

worktree 충돌 후보 전체 중 stale 2건 skip, active worktree와의 spec/5-system/ 파일 경합 없음.

---

## 요약

`spec/5-system/` 대상의 `--impl-prep` 검토 결과, target(`system-status-page-f96d24` worktree)이 추가하는 `spec/5-system/16-system-status-api.md` (신규) 와 `spec/5-system/_product-overview.md` (NF-OB-06 행 추가)는 현재 in-progress plan 어느 것과도 파일 충돌·미해결 결정 우회·선행 미해소·후속 무효화가 없다. `auth-config-webhook-wiring.md`가 `spec/5-system/1-auth.md`·`12-webhook.md` 변경을 예정하고 있으나 target과 다른 파일이며 Phase 0 미착수 상태다. `execution-engine-residual-gaps.md`는 `spec/5-system/4-execution-engine.md`에 BLOCKED 미구현 항목을 보유하지만 target 신규 파일과 무관하다. worktree 충돌 후보 중 stale 2건 skip, active worktree와 spec 파일 경합 없음.

---

## 위험도

NONE

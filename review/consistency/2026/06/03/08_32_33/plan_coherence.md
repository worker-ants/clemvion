## 발견사항

발견된 CRITICAL/WARNING/INFO 항목 없음.

target plan(`plan/in-progress/spec-draft-system-status-recent-failed.md`, worktree `system-status-recent-failed-86831b`)과 모든 `plan/in-progress/**` 문서를 교차 검토한 결과:

1. **미해결 결정과의 충돌** — 없음. `spec/5-system/16-system-status-api.md` 와 `spec/2-navigation/15-system-status.md` 의 현행 spec 은 모두 `status: implemented` 이며 system-status 영역에 "결정 필요" 항목이 남겨진 plan 이 없다. target plan 이 결정하는 내용(recentFailed 도입, health 판정 기준 전환, 스캔 캡 정책)은 모두 해당 worktree 의 `system-status-recent-failed.md` 에서 사용자 합의를 거쳐 확정된 사항이다.

2. **중복 작업** — 없음. 현재 `plan/in-progress/**` 중 `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`, `spec/2-navigation/_product-overview.md`, `spec/5-system/_product-overview.md` 4개 파일을 건드리는 plan 이 없다. `auth-config-webhook-wiring` / `spec-draft-auth-config-webhook-wiring` 두 plan 은 `spec/5-system/1-auth.md` · `spec/5-system/12-webhook.md` 등을 대상으로 하며, target spec 파일과 겹치지 않는다. `plan-grooming-2ec306` worktree 도 spec 파일을 전혀 건드리지 않는다.

3. **선행 plan 미해소** — 없음. target plan 이 가정하는 전제조건(BullMQ `getFailed()` API 존재, `QueueRegistry` 구현, `SystemStatusModule` 동작)은 모두 PR #427(`af48b5b3`)로 main 에 반영된 상태다.

4. **후속 항목 누락** — 없음. NF-OB-06 동기화(§D)가 체크리스트에 포함돼 있고, `_product-overview.md §3.9` NAV-SS 표 갱신(§C)도 포함돼 있다. 현행 NF-OB-06 설명("큐 적체/실패/포화도를 집계 UI 로 노출")은 spec 변경 후 "최근 윈도우 기준 주 지표 + 누적 보관 부 지표" 추가가 필요하다는 것을 target plan 이 §D INFO 동기화로 인식하고 있다. 다른 plan 이 이 영역의 후속 항목을 가지지 않으므로 무효화 우려 없음.

5. **worktree 충돌** — worktree 충돌 후보 분석 아래 참조.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보: target plan 이 수정하는 spec 파일과 동일 파일을 손대는 다른 active worktree 를 확인한 결과, 충돌 후보 자체가 없었다. 그럼에도 §5 worktree 충돌 검토를 위해 현재 존재하는 모든 worktree 의 stale 여부를 점검했다.

| worktree | branch | Step 1 결과 | Step 2 결과 | 판정 |
|---|---|---|---|---|
| `spec-drift-resolve-efb608` | `claude/spec-drift-resolve-efb608` | ancestor of main (exit 0) | (불필요) | **stale** |
| `spec-sync-audit` | `claude/spec-sync-audit` | ancestor of main (exit 0) | (불필요) | **stale** |
| `system-status-recent-failed-86831b` | `claude/system-status-recent-failed-86831b` | ancestor of main (exit 0) | (불필요) | **stale** (본 target worktree — 아직 작업 진행 중, 정리 불필요) |
| `plan-grooming-2ec306` | `claude/plan-grooming-2ec306` | branch not ancestor of main (exit 1) | PR 없음 (empty `[]`) | Step 3 fallback → **active** (보수적 처리). stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장. |

stale skip 목록 (§5 검토 대상에서 제외):
- `spec-drift-resolve-efb608` (branch `claude/spec-drift-resolve-efb608`) — Step 1 ancestor
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1 ancestor

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`plan/in-progress/spec-draft-system-status-recent-failed.md` 는 이미 사용자 합의가 완료된 결정(`system-status-recent-failed.md`)을 spec 문서로 정제하는 작업이며, 다른 진행 중 plan 과의 미해결 결정 충돌·동일 파일 중복 작업·선행 조건 미해소·후속 항목 누락 어느 쪽도 발견되지 않았다. worktree 충돌 후보 4건 중 stale 2건(spec-drift-resolve, spec-sync-audit)을 skip 하고, active 2건(plan-grooming-2ec306, target worktree 자체) 중 plan-grooming 은 spec 파일을 전혀 수정하지 않아 §5 실질 충돌 없음. 정합성 관점의 차단 사유가 없다.

---

## 위험도

NONE

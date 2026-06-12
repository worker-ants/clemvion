# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`

대상 변경 파일:
- `spec/conventions/cafe24-api-catalog/_generator.py` — 컨테이너 fallback 버그 수정
- `spec/conventions/cafe24-api-catalog/_overview.md` — §7.3 회귀 검증 레시피 추가
- `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — 래퍼 설명 수동 정정
- `spec/conventions/cafe24-api-catalog/order/orders.md` — 래퍼 설명 수동 정정
- `spec/conventions/cafe24-api-catalog/store/orders-setting.md` — 래퍼 설명 수동 정정
- `plan/in-progress/cafe24-backlog-residual.md` — G-4 섹션 추가
- `plan/in-progress/fix-spec-frontmatter-catalog.md` — 삭제 (→ `plan/complete/` 이동)
- `plan/in-progress/spec-sync-chat-channel-gaps.md` — worktree `spec-sync-audit` → `(unstarted)` 변경

---

## 발견사항

- **[INFO]** G-4 잔여 `[ ]` 항목과 G-1-remaining 의 순서 관계 추적 필요
  - target 위치: `plan/in-progress/cafe24-backlog-residual.md` §G-4, `[ ]` 잔여 항목
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` §G-1-remaining
  - 상세: G-4 잔여(전체 재생성 시 `links` 등 충돌명 일괄 정정)와 G-1-remaining(docs↔metadata 갭 보강, field-set 대량 확장)은 모두 동일한 `cafe24-api-catalog/<resource>/<entity>.md` 파일군을 변경한다. 두 트랙이 병렬로 진행될 경우, G-4 재생성이 G-1-remaining 의 수동 편집 내용을 덮어쓰거나(혹은 역방향 충돌)할 수 있다. 현재 G-4 잔여는 "네트워크 필요 — 재생성" 으로 명시돼 분리되어 있어 단기 충돌 위험은 낮으나, 착수 전 순서 명시가 없다.
  - 제안: `cafe24-backlog-residual.md` §G-4 잔여 항목에 "G-1-remaining field-set 보강 완료 후 재생성 권장 (역방향 덮어쓰기 회피)" 주석 추가 권고. plan 파일 갱신만 필요 (구현 차단 아님).

- **[INFO]** `fix-spec-frontmatter-catalog.md` in-progress → complete 이동 정합 확인
  - target 위치: `plan/in-progress/fix-spec-frontmatter-catalog.md` 삭제 + `plan/complete/fix-spec-frontmatter-catalog.md` 신설
  - 관련 plan: `plan/in-progress/fix-spec-frontmatter-catalog.md` (삭제 대상)
  - 상세: 해당 plan 은 모든 워크플로 체크리스트가 `[x]` 이고 `/ai-review --impl-done` 결과 BLOCK: NO 로 종결 상태다. complete 이동은 `plan-lifecycle.md` 규칙에 부합하며 이상 없음. 정보 기록 목적으로 포함.
  - 제안: 없음 — 이미 정상 처리.

- **[INFO]** `spec-sync-chat-channel-gaps.md` worktree sentinel 변경
  - target 위치: `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter `worktree: spec-sync-audit` → `(unstarted)`
  - 관련 plan: `plan/in-progress/spec-sync-chat-channel-gaps.md`
  - 상세: 해당 plan 이 worktree `spec-sync-audit` 를 `(unstarted)` 로 변경한다. `spec-sync-audit` 브랜치는 로컬에 존재하지 않고 원격 PR 도 없음(stale cascade Step 1/2 모두 empty). worktree sentinel 정리는 적절하다. spec/conventions/ 변경과 무관하나 같은 PR 에 포함.
  - 제안: 없음 — 정보 기록.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보: `cafe24-backlog-residual-batch` (`plan/in-progress/cafe24-backlog-residual.md` frontmatter), `fix-spec-frontmatter-catalog` (삭제 대상 plan의 frontmatter), `spec-sync-audit` (`spec-sync-chat-channel-gaps.md` 구 frontmatter).

- `cafe24-backlog-residual-batch` — Step 1: `git merge-base --is-ancestor` → exit 1 (브랜치 로컬 부재). Step 2: `gh pr list --head cafe24-backlog-residual-batch` → empty (PR 없음). Step 3 fallback: active 로 처리. **단, `git worktree list` 에 해당 checkout 없음 — 실제 worktree 파일시스템 충돌 없음**. stale cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 `cleanup-worktree-all.sh` 실행 후 재검토 권장.
- `fix-spec-frontmatter-catalog` — Step 1: 브랜치 로컬 부재. Step 2: PR 없음. Step 3 fallback: active 로 처리. 단, 이 plan 은 본 PR 에서 `complete/` 로 이동 중이므로 worktree 충돌 실질 영향 없음.
- `spec-sync-audit` — Step 1: 브랜치 로컬 부재. Step 2: PR 없음. Step 3 fallback: active 로 처리. 단, `spec-sync-chat-channel-gaps.md` 가 `(unstarted)` 로 변경되어 sentinel 정리 완료.

3건 모두 로컬 worktree checkout 부재로 실제 파일시스템 경합 없음. `git worktree list` 결과 활성 checkout = main + 현 작업 브랜치 2개뿐.

---

## 요약

target 변경 (`spec/conventions/cafe24-api-catalog/` generator 버그 수정 + 3건 수동 정정 + `_overview.md` §7.3 추가, `cafe24-backlog-residual.md` G-4 등재, `fix-spec-frontmatter-catalog` plan 종결 이동)은 진행 중인 plan 들과 충돌하지 않는다. G-4 잔여 재생성과 G-1-remaining 대량 field-set 보강이 동일 파일군에 영향을 주는 잠재 순서 관계는 현재 각각의 진행 시점이 명시돼 있지 않아 INFO 로 기록했으나 작업을 차단할 수준이 아니다. worktree 충돌 후보 3건은 모두 실제 checkout 없이 브랜치 자체가 로컬에 부재하여 파일시스템 경합 위험 없음. stale cascade Step 1/2 양음성으로 active 처리되었으나 실질 충돌 없음 확인. CRITICAL/WARNING 발견 없음.

worktree 충돌 후보 3건 중 stale 판정 0건(Step 1/2 미검출, Step 3 fallback active), active 3건 분석 — 단, 실제 checkout 부재로 경합 없음 확인.

---

## 위험도

NONE

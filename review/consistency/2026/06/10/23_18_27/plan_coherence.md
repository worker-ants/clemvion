# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep, scope=spec/2-navigation/)
Target plan: `plan/in-progress/integration-expiry-fixes.md`
Target spec 영역: `spec/2-navigation/` (연관: `spec/1-data-model.md`, `spec/data-flow/5-integration.md`, `spec/5-system/16-system-status-api.md`)

---

## 발견사항

### [WARNING] spec/5-system/16-system-status-api.md — health-probe-status 워크트리와 동시 수정 후보

- target 위치: `plan/in-progress/integration-expiry-fixes.md` V-15 항목 — "spec §1 표·data-flow §4 카탈로그와 불일치" 해소를 위해 `spec/5-system/16-system-status-api.md` 수정 예정 (MONITORED_QUEUES 에 `MAKESHOP_REFRESH_QUEUE` 추가)
- 관련 plan: `plan/in-progress/spec-draft-health-probe-status.md` (worktree: `health-probe-status-d9a184`) — 동일 파일에 R-4 cross-ref 1줄 추가를 이미 commit ef367de1 (main 에 반영 완료) 로 완료했으나, 이 plan 의 **구현 + `/ai-review` + `--impl-done`** 단계가 아직 open 이며 health-probe-status-d9a184 worktree 가 active 상태
- 상세: spec 변경 자체(R-4 추가)는 main 에 이미 반영되어 충돌 내용이 겹치지는 않는다. V-15 가 수정할 대상 섹션(§1 MONITORED_QUEUES 표)과 health-probe 가 수정한 R-4 Rationale 절은 다른 위치다. 단, health-probe worktree 가 아직 병렬로 열려 있고 동일 파일에 추가 변경을 넣을 가능성(ai-review fix 등)이 잔존한다. merge 시점에 git 충돌 없이 반영되도록 사전 확인 권장.
- 제안: V-15 의 `spec/5-system/16-system-status-api.md` 수정 전, health-probe-status-d9a184 의 현재 HEAD 에서 같은 파일 최신 상태를 확인하고 diff 를 기준으로 진행한다. 구조적으로 다른 절 수정이므로 자동 merge 가 가능할 확률이 높다.

---

### [INFO] spec-code-cross-audit-2026-06-10.md — V-07 결정이 target plan 에 정확히 반영됨 (충돌 없음)

- target 위치: `plan/in-progress/integration-expiry-fixes.md` frontmatter — "사용자 결정(2026-06-10): V-07 = §11.2 채택"
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 후속 미해결 항목 — "V-07 = §11.2 채택 또는 §11.1 유지 중 결정 필요"
- 상세: cross-audit plan 은 V-07 을 open decision 으로 등록했고, target plan 은 frontmatter 에 사용자가 동일 세션(2026-06-10)에 §11.2 채택을 명시했음을 기록하고 있다. 미해결 결정을 일방 우회한 것이 아니라 사용자 결정을 정식 기록한 후 착수하는 흐름이다. cross-audit plan 의 V-07 open 항목은 이 착수로 처리되므로, 구현 완료 후 cross-audit plan 에서 V-07 을 체크 완료 처리하면 된다.
- 제안: target 구현 완료 시 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-07 항목을 `[x]` 로 닫는다.

---

### [INFO] spec/1-data-model.md — `token_expired` 가 이미 main spec 에 선반영 (중복 수정 위험 없음)

- target 위치: `plan/in-progress/integration-expiry-fixes.md` 체크리스트 "spec 정합 (§11.1·data-flow/5·1-data-model token_expired 확정·16-system-status)"
- 관련 plan: `plan/in-progress/unified-model-management.md` (worktree: `unified-model-mgmt-5af7ee`) — `spec/1-data-model.md` §2.11(KnowledgeBase)/§2.16(LLMConfig→ModelConfig) 수정
- 상세: (1) `spec/1-data-model.md` §2.10 Integration 테이블의 `status_reason` 행은 이미 `token_expired` 를 열거하고 있다 (현재 main 기준). target plan 의 "token_expired 확정" 은 코드 측(`INTEGRATION_STATUS_REASONS` union + 실제 formatter)을 구현에 맞게 갱신하는 작업이 핵심이고 spec 본문은 이미 준비된 상태다. (2) unified-model-management 가 손대는 섹션(§2.11/§2.16)과 target plan 이 손댈 섹션(§2.10)은 다른 Integration row 라 내용 경합이 없다.
- 제안: spec/1-data-model.md §2.10 에서 실제로 수정이 필요한 부분만 범위를 확인하고 착수 — 이미 `token_expired` 가 포함되어 있으므로 추가 변경이 없을 수 있다.

---

### [INFO] data-flow/5-integration.md — V-01 관련 구현 갭 진술이 이미 포함되어 있음

- target 위치: `plan/in-progress/integration-expiry-fixes.md` V-01 항목 — `data-flow/5-integration.md` 를 spec 정합 대상으로 포함
- 상세: `spec/data-flow/5-integration.md` §1.4 에는 이미 "⚠ 알려진 구현 갭 — MakeShop 행의 0d 격하" 진술과 §11 의사코드에 "makeshop 은 refresh-capable 로 취급" 방향 진술이 포함되어 있다. target 구현이 이 갭을 해소하면 data-flow 의 "알려진 구현 갭" 경고 문구를 확정 구현 기술로 교체하면 된다. data-flow/5-integration.md 를 동시에 수정하는 다른 active plan 은 없다.
- 제안: 구현 완료 후 data-flow/5-integration.md §1.4 의 ⚠ 경고 블록과 §상태 전이 다이어그램의 `isCafe24RefreshCapable` 표기를 `isRefreshCapable` 방향으로 갱신.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

| worktree | branch | 판정 |
|---|---|---|
| `ws-resumed-ack-spec` | `claude/ws-resumed-ack-spec` | Step 1: `git merge-base --is-ancestor` → STALE (branch HEAD 가 origin/main 의 조상). skip. |

해당 worktree 가 활성으로 남아있을 이유가 없다면 `/Volumes/project/private/clemvion/cleanup-worktree-all.sh --yes --force` 실행 권장.

검토 대상에서 제외된 나머지 active worktree:
- `health-probe-status-d9a184` (`claude/health-probe-status-d9a184`) — Step 1: ACTIVE (not ancestor), Step 2: PR 없음 (empty). active 로 처리 → §5번 검토 수행 → WARNING 으로 기록 (위).
- `unified-model-mgmt-5af7ee` (`claude/unified-model-mgmt-5af7ee`) — Step 1: ACTIVE, Step 2: PR 없음. active 로 처리 → §5번 검토 수행 → 섹션 분리 확인으로 충돌 없음 (INFO 기록).

---

## 요약

target plan (`integration-expiry-fixes.md`) 은 `spec-code-cross-audit-2026-06-10.md` 의 V-07 미해결 결정을 사용자가 이미 명시 확정한 후 기록했으므로 결정 우회가 아니다. `spec/1-data-model.md` 와 `spec/data-flow/5-integration.md` 에 대한 동시 수정 위험은 없다. 유일한 주의 지점은 `spec/5-system/16-system-status-api.md` 로, health-probe-status-d9a184 worktree 가 active 상태에서 동일 파일을 이미 main 에 커밋했고 추가 구현 fix 가 남아 있어 병렬 수정 가능성이 있다 (내용 섹션 분리 확인 필요). worktree 충돌 후보 3건 중 stale 1건 skip, active 2건 분석.

## 위험도

LOW

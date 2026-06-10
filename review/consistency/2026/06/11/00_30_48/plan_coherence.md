# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)
Target: `spec/2-navigation/` (분기 `claude/integration-expiry-fixes-1d7c7d` 변경분)
검토 일시: 2026-06-11

---

## 발견사항

### [WARNING] spec-code-cross-audit 계획의 V-01 항목이 완료로 갱신되지 않음
- **target 위치**: `plan/in-progress/integration-expiry-fixes.md` — V-01 체크박스 `[x]` 완료
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §후속(미해결) 항목
  - `- [ ] SUMMARY §1 위반 19건의 코드 수정 vs spec 하향 결정 — 특히 severe 3: audit-logs Admin+ 가드 부재(V-03), makeshop expired 오격하(V-01), AI 노드 override UI 필드 누락(V-02)`
- **상세**: `integration-expiry-fixes.md` 는 V-01(makeshop expired 오격하)과 V-07을 해소 완료(`[x]`)로 기록했으나, `spec-code-cross-audit-2026-06-10.md` 의 해당 항목은 여전히 미해결(`[ ]`)로 남아있다. V-03(audit-logs Admin+ 가드)은 `plan/complete/security-fixes-audit-guard-secret-rotation.md` 로 별도 해소됐지만 이 계획도 마찬가지로 해당 항목 갱신이 없다.
- **제안**: 이 PR 머지 시 `spec-code-cross-audit-2026-06-10.md` 의 V-01·V-07 항목을 `[x]` 로 갱신하거나, `spec_code-cross-audit` 플랜의 해당 행에 "(→ `integration-expiry-fixes-1d7c7d` 에서 해소)" 노트를 추가한다.

---

### [WARNING] spec-code-cross-audit의 "코드 주석 stale" 항목이 본 worktree 에서 미처리
- **target 위치**: `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts` — 본 브랜치가 수정
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §후속 마지막 항목
  - `- [ ] integration-expiry-scanner 코드 주석 stale (기본 10일 vs 실제 7일) 등 writer 들이 보고한 코드 주석/Swagger 문자열 정정 (developer)`
- **상세**: `integration-expiry-scanner.service.ts` 를 수정하는 이 브랜치에서 "코드 주석 stale (`기본 10일` vs 실제 7일)" 항목을 자연스럽게 같이 처리할 수 있는 자리였으나, `integration-expiry-fixes.md` 체크리스트에 해당 항목이 없고 diff 에도 주석 정정이 포함되지 않은 것으로 보인다. 이후 별도 PR 을 열어야 하는 잔여가 남는다.
- **제안**: 현재 PR scope 에 포함하거나, `integration-expiry-fixes.md` 에 "scope 밖으로 이월" 명시 후 `spec-code-cross-audit` 항목을 별도 추적 plan 에 분리 등록한다.

---

### [INFO] spec/1-data-model.md 동시 수정 — unified-model-mgmt-5af7ee worktree 와 교차, 단 충돌 없음
- **target 위치**: `spec/1-data-model.md` — 현 브랜치가 §2.8(Integration) `status_reason` 컬럼 설명(라인 ~290)을 수정
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`) — 동일 파일의 §2.16(LLMConfig→ModelConfig 통합), §2.4(KnowledgeBase 임베딩 필드), §2.x(ERD 도해) 를 수정
- **상세**: 두 브랜치 모두 `spec/1-data-model.md` 를 수정하지만 hunk 가 겹치지 않는다.
  - 현 브랜치: 라인 ~290 일대(`status_reason` 컬럼 값 열거 갱신 — `unknown` → `unknown_error`, `INTEGRATION_STATUS_REASONS` union 언급 추가, `token_expired` 네임스페이스 clarification)
  - unified-model-mgmt: 라인 33(ERD), 334·350(KnowledgeBase 임베딩 컬럼), 530~570(LLMConfig/RerankConfig → ModelConfig 리네임 영역), 694(AssistantSession)
  - hunk 거리가 충분하고 의미적으로도 다른 entity section. 머지 충돌 위험 낮음.
- **제안**: 이 자체로 BLOCK 사유는 아니나, 두 브랜치 중 먼저 main 에 들어가는 쪽이 없어도 자동 머지가 가능하도록 rebase 기반으로 작업하는 것을 권장. 확인 시점의 hunk 는 비충돌이나 unified-model-mgmt 의 §2.4 KnowledgeBase 섹션 수정이 이후 계속 늘어날 경우 라인 이동으로 충돌 가능성이 생길 수 있음.

---

### [INFO] spec/2-navigation/ 의 미해결 미구현 항목들 — 본 worktree 범위 밖이라 무관
- **target 위치**: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans: [spec-sync-workflow-list-gaps.md]`
- **관련 plan**: `plan/in-progress/spec-sync-workflow-list-gaps.md` (worktree `spec-sync-audit`) — 정렬 UI·태그 필터 등 미구현 항목 추적
- **상세**: `spec-sync-workflow-list-gaps.md` 의 pending 항목(정렬 UI 부재, 태그 필터 UI 부재 등)은 본 브랜치(integration expiry fixes)와 영역 완전 분리. 본 브랜치는 `spec/2-navigation/4-integration.md` 만 수정하며 `1-workflow-list.md` 를 건드리지 않는다. 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보를 아래와 같이 평가했다.

| worktree | branch | Step 1 (ancestor) | Step 2 (PR state) | 판정 |
|---|---|---|---|---|
| `health-probe-status-d9a184` | `claude/health-probe-status-d9a184` | ACTIVE (not ancestor) | PR 없음 (empty list) | Step 3 → active로 간주 |
| `unified-model-mgmt-5af7ee` | `claude/unified-model-mgmt-5af7ee` | ACTIVE (not ancestor) | PR 없음 (empty list) | Step 3 → active로 간주 |
| `ws-resumed-ack-spec` | `claude/ws-resumed-ack-spec` | ACTIVE (not ancestor) | OPEN | active |

- `health-probe-status-d9a184`: Step 1/2 모두 stale 신호 없음. active로 처리 — 실제 stale이면 `./cleanup-worktree-all.sh --yes --force` 실행 후 재검토 권장. 단, spec/2-navigation 또는 spec/1-data-model 를 건드리지 않아 target 범위와 충돌 없음.
- `unified-model-mgmt-5af7ee`: Step 1/2 모두 stale 신호 없음. active로 처리. `spec/1-data-model.md` 동시 수정이 있으나 위 §INFO 에서 분석한 바 hunk 비충돌로 CRITICAL 아님.
- `ws-resumed-ack-spec`: PR OPEN, spec/2-navigation 변경 없음. 무관.

stale skip 건수: 0건 (3개 후보 전부 active로 처리됨).

---

## 요약

현 브랜치(`integration-expiry-fixes-1d7c7d`)가 수정하는 `spec/2-navigation/4-integration.md`·`spec/1-data-model.md`·`spec/data-flow/5-integration.md`·`spec/data-flow/8-notifications.md` 는 plan에서 결정 필요로 남겨진 항목을 일방적으로 우회하거나 선행 plan 을 건너뛰는 구조가 없다. V-01·V-07 결정은 사용자가 2026-06-10 명시 승인한 내용이며 `integration-expiry-fixes.md` 에 정합하게 기록됐다. 주요 우려는 두 개의 WARNING: (1) `spec-code-cross-audit-2026-06-10.md` 의 V-01 항목이 완료로 갱신되지 않아 향후 중복 작업 위험, (2) 동일 파일(`integration-expiry-scanner.service.ts`)을 수정하는 이 PR에서 "코드 주석 stale 10일→7일" 항목이 같이 처리되지 않아 잔여 추적 부담이 남음. `spec/1-data-model.md` 를 동시에 수정 중인 `unified-model-mgmt-5af7ee` worktree가 활성이지만 hunk 비충돌로 CRITICAL 수준이 아님. worktree 충돌 후보 3건 전부 active 판정, stale skip 0건.

## 위험도

LOW

# Plan 정합성 검토 결과

검토 대상: `spec/5-system/16-system-status-api.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] V-15 해소 완료 표기와 target spec 구현 갭 노트 불일치

- **target 위치**: `spec/5-system/16-system-status-api.md §1` 표 하단 구현 갭 경고
  > ⚠ **구현 갭**: 코드의 `MONITORED_QUEUES` (`system-status.constants.ts`) 에 `agent-memory-extraction` 이 아직 미등재 — 본 표(모니터링 대상 선언)와 코드 레지스트리의 동기화가 필요하다 (2026-06-10 감사 보고 V-15 추적).
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-code-cross-audit-2026-06-10.md` §"후속 (미해결)" 29행
  > [x] **V-15** (큐 레지스트리) — `integration-expiry-fixes` 브랜치(본 PR)에서 해소
- **상세**: plan 에서 V-15 가 `[x]` 완료로 표기되어 있으나, target spec 의 구현 갭 노트는 여전히 `agent-memory-extraction` 이 미등재 상태임을 현재 사실로 기술하고 있다. V-15 해소가 `makeshop-token-refresh`·`terminal-revoke-reconcile` 등재에 그쳤고 `agent-memory-extraction` 은 포함되지 않았을 가능성이 있다. spec 갭 노트가 stale 이거나, plan 의 V-15 완료 표기가 과도한 범위를 주장하는 것이다.
- **제안**: `integration-expiry-fixes` PR 이 실제로 `agent-memory-extraction` 을 `MONITORED_QUEUES` 에 등재했는지 코드를 확인한 뒤, (a) 등재됐다면 target spec 의 구현 갭 노트를 제거/갱신, (b) 미등재라면 plan 의 V-15 완료 표기를 수정하고 후속 등재를 별도 체크박스로 추가해야 한다.

### [INFO] m-2 deprecated 상수 삭제 — spec 이 이미 삭제 사실을 기술 중 (코드 미완)

- **target 위치**: `spec/5-system/16-system-status-api.md §3`
  > "2026-06-10 dead code 제거에서 deprecated 상수 export `FAILED_DEGRADED_THRESHOLD`/`DELAYED_DEGRADED_THRESHOLD` 폐기. 의미·env 키 불변."
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/03-maintainability.md §m-2`
  > `- [ ]` system-status.constants.ts:117-119 상수 2건 삭제 (M-6 와 단일 cleanup PR, ✅ 2026-06-10 사용자 승인)
- **상세**: target spec 은 이미 상수 삭제를 완료 사실로 기술하며 getter 표현으로 전환되어 있다 (`/Volumes/project/private/clemvion/plan/complete/spec-update-deadcode-cleanup.md` 에서 확인 — spec 갱신 완료). 그러나 refactor m-2 plan 의 체크박스는 여전히 `[ ]` 로 미착수 상태다. 이는 "spec 이 코드보다 앞선" 상태로, 코드가 실제로 아직 상수를 보유하고 있으면 spec-impl 드리프트 상태다. spec 갱신 자체는 `plan/complete/` 에서 확인된 대로 이미 완료이고, 코드 삭제 단계(m-2 체크박스)만 남은 상태다.
- **제안**: m-2 는 승인된 미착수 항목이므로 차단 사유가 아니나, target spec 이 기술하는 "폐기 완료" 는 코드 실행 전 spec 선행 기술임을 m-2 체크박스 완료 시 재확인하면 된다. 현재 target spec 의 기술 방향(상수 폐기 사실)은 plan 의 결정 방향과 충돌하지 않는다.

---

## 요약

target `spec/5-system/16-system-status-api.md` 가 plan 에서 "결정 필요"로 남긴 항목을 일방적으로 결정하는 경우는 없다. 선행 plan (`system-status-recent-failed.md`, `system-status-recent-failed-capped.md`, `spec-update-deadcode-cleanup.md`)이 모두 `plan/complete/` 에 있고 target 이 전제하는 기능(recentFailed/recentFailedCapped/getter 전환)은 이미 구현·spec 반영이 완료된 상태다. 주요 위험은 V-15(큐 레지스트리) 완료 표기와 spec 의 구현 갭 노트 간의 불일치로, `agent-memory-extraction` 의 실제 등재 여부를 코드에서 확인해 plan 또는 spec 중 하나를 갱신해야 한다.

## 위험도

LOW

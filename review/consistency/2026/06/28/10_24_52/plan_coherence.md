# Plan 정합성 검토 결과

검토 대상: `spec/5-system/16-system-status-api.md`
검토 기준: `plan/in-progress/**` 진행 중 작업·미해결 결정과의 정합성

---

## 발견사항

### [WARNING] 구현 갭 callout 의 V-15 참조가 이미 해소된 건을 가리킴 — 추적 주체 미정
- target 위치: `spec/5-system/16-system-status-api.md` §1 표 하단 `⚠ 구현 갭` 노트 (line 62)
- 관련 plan:
  - `plan/complete/integration-expiry-fixes.md` §V-15 (완료)
  - `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §후속 미해결 항목 (V-15 `[x]` 처리됨)
  - `plan/in-progress/ai-context-memory-followup-v2.md` §"SPEC-DRIFT: 17-agent-memory.md §3 AGM-04" (완료 체크)
- 상세:
  - target 스펙의 노트: `"코드의 MONITORED_QUEUES (system-status.constants.ts) 에 agent-memory-extraction 이 아직 미등재 — 2026-06-10 감사 보고 V-15 추적"`.
  - 실제 V-15 (`plan/complete/integration-expiry-fixes.md`)는 `makeshop-token-refresh` 큐 누락을 대상으로 하며 이미 완료(머지) 상태다. `agent-memory-extraction` 은 V-15 의 원래 범위가 아니었다.
  - 2026-06-10 감사 보고 SUMMARY.md 에서 `agent-memory-extraction` 은 별도 V-# 번호가 부여되지 않았다.
  - 현재 어떤 `plan/in-progress/` 파일도 `agent-memory-extraction` 을 `MONITORED_QUEUES` 에 등재하는 후속 작업을 추적하지 않는다.
  - `spec-code-cross-audit-2026-06-10.md` 의 잔여 미해결 항목(V-04/V-05/V-09/V-10~V-14/V-18)은 모두 system-status 와 무관한 도메인이다.
- 제안:
  - target 스펙의 `⚠ 구현 갭` 노트에서 "V-15 추적" 참조를 제거하거나 정정한다 (V-15 는 해소됨).
  - `agent-memory-extraction` 의 `MONITORED_QUEUES` 등재는 현재 추적 plan 이 없으므로, `ai-context-memory-followup-v2.md` 또는 신규 backlog 항목에 명시하거나, `spec-code-cross-audit-2026-06-10.md` 잔여 항목에 추가해 소유권을 확보해야 한다.

---

### [WARNING] `exec-intake-queue-impl.md` PR2b 의 `system-status.constants.ts` MAINT#9 항목과 target spec 의 getter 패턴 정합 미확인
- target 위치: `spec/5-system/16-system-status-api.md` §3 health 파생 규칙 — getter 패턴 설명 (`getFailedDegradedThreshold()` ← `SYSTEM_STATUS_FAILED_THRESHOLD`, `getDelayedDegradedThreshold()` ← `SYSTEM_STATUS_DELAYED_THRESHOLD`)
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2b 곁들임 INFO 묶음 미완료 항목: `system-status.constants.ts` concurrency 파싱 일원화 (MAINT#9) `[ ]`
- 상세:
  - target 스펙 §3 은 "getter 로 평가" 패턴(`getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()`)과 deprecated 상수 export (`FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD`) 폐기를 명시한다.
  - `exec-intake-queue-impl.md` 의 PR2b MAINT#9 항목이 `system-status.constants.ts` 를 추가로 리팩터하는 계획을 갖고 있다. PR2b 는 아직 미착수(`[ ]`)이므로 이 리팩터가 §3 의 getter 설명과 충돌하거나 중복되는지 확인이 필요하다. 특히 "concurrency 파싱 일원화" 가 기존 getter 구조를 변경하는 범위라면 target 스펙 §3 의 기술과 사전 정합이 필요하다.
- 제안:
  - PR2b 착수 전 `exec-intake-queue-impl.md` MAINT#9 범위가 target 스펙 §3 getter 패턴과 충돌하지 않음을 명시하거나, 충돌 시 target 스펙을 먼저 갱신한다. 낮은 위험이나 사전 기록 권장.

---

### [INFO] `exec-intake-queue-impl.md` PR2b 미착수 상태에서 `e2e EXPECTED_QUEUE_NAMES` 큐 수 불일치 추적 필요
- target 위치: `spec/5-system/16-system-status-api.md` §1 큐 레지스트리 표 (17 큐 선언, `agent-memory-extraction` 포함)
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` — PR2a 에서 `MONITORED_QUEUES` 를 13개로 설정 기록, `integration-expiry-fixes` 완료로 14개, target 스펙은 17 큐 선언 (단, `agent-memory-extraction` 은 코드 미등재 명시)
- 상세: spec 표 선언 큐 수(17)와 코드 등재 큐 수(14) 간 갭이 `agent-memory-extraction` 외에 추가로 있는지 불명확하다. `workspace-invitations-pruner`, `alerts-evaluator`, `integration-expiry-scanner` 가 언제 `MONITORED_QUEUES` 에 등재됐는지 plan 이력에서 추적이 되지 않는다. 단 이는 기존 구현의 이력 문제이며 target 스펙이 새로 도입한 결정은 아니다.
- 제안: 특별한 조치 불요. 단, `agent-memory-extraction` 등재 후속 작업을 plan 에서 추적할 때 전체 MONITORED_QUEUES ↔ spec §1 표 동기를 한 번 검증하면 충분하다.

---

## 요약

target 문서 `spec/5-system/16-system-status-api.md` 는 진행 중 plan 의 미해결 결정을 우회하거나 선행 plan 미해소 전제를 가정하는 구조적 충돌은 없다. `recentFailedCapped`, `recentFailed`, getter 패턴 등 주요 변경은 모두 `plan/complete/system-status-recent-failed.md` 및 `system-status-recent-failed-capped.md` 에서 사용자 합의 후 완료된 내용이며 target 스펙이 충실히 반영하고 있다. 단, §1 표 하단 "구현 갭" callout 의 "V-15 추적" 참조가 이미 완료된 다른 이슈(makeshop-token-refresh)를 가리키는 오기이고, `agent-memory-extraction` MONITORED_QUEUES 등재 후속 작업을 추적하는 in-progress plan 이 없다는 점이 WARNING 수준 문제다. `exec-intake-queue-impl.md` 의 미완료 PR2b MAINT#9 항목이 target 스펙의 getter 패턴과 리팩터 범위 충돌 가능성이 있어 착수 전 확인이 권장된다.

## 위험도
LOW

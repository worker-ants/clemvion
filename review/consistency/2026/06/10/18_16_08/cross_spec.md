## 검토 모드
구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

## 검토 대상 변경 요약

이번 worktree(`trigger-schedule-sync-f88604`)의 spec 변경은 다음 4개 파일에 집중된다:

- `spec/1-data-model.md` §2.9.1 — 역방향 동기화 구현 완료 표기
- `spec/2-navigation/1-workflow-list.md` §2.3 — 상태 필터 불일치 경고 제거 (수정 완료)
- `spec/2-navigation/2-trigger-list.md` §4.4 — Trigger 삭제 시 `removeJob` 명시
- `spec/2-navigation/3-schedule.md` §3.1/§3.2 — 역방향 동기화 상세 명시 + sort/order 지원 현행화
- `spec/data-flow/10-triggers.md` §1.4/§1.5/Rationale — 역방향 동기화 구현 현황 갱신

---

## 발견사항

### [CRITICAL] `spec/data-flow/10-triggers.md` §3.1 내 역방향 동기화 설명이 §1.4 와 모순

- **target 위치**: `spec/data-flow/10-triggers.md` line 203 (§3.1 `trigger.is_active` 섹션)
- **충돌 대상**: 동일 파일 §1.4 (lines 140-143), `spec/1-data-model.md` §2.9.1, `spec/2-navigation/3-schedule.md` §3.1, `spec/2-navigation/2-trigger-list.md` §4.4
- **상세**:
  line 203은 현재 다음과 같이 기술한다:

  > "Schedule 과의 동기화는 **Schedule→Trigger 정방향만** 구현되어 있다 — ... Trigger API 쪽 `PATCH { isActive }` 는 schedule.is_active 와 BullMQ job 을 갱신하지 않는다 ([Spec 데이터 모델 §2.9.1](../1-data-model.md) 의 양방향 계약 대비 구현 갭 — §1.4 참조)."

  이 설명은 이번 커밋에서 갱신된 §1.4 (line 140)의 다음 기술과 직접 모순된다:

  > "구현 현황 — 역방향(Trigger→Schedule) 동기화: ... 양방향 모두 구현되어 있다 (역방향은 2026-06-10 갭 해소)."

  또한 `spec/1-data-model.md` §2.9.1, `spec/2-navigation/3-schedule.md`, `spec/2-navigation/2-trigger-list.md` 모두 양방향 동기화 구현 완료를 선언하고 있어, line 203 만이 "구현 갭" 표기를 그대로 유지하고 있다. 동일 파일의 §3.1 상태 표(`false` 상태 설명, line 201)도 "Schedules API 경유 토글 시 `removeJob`" 이라고만 기술하며 Trigger API 경유 경우를 기술하지 않아 독자가 §3.1 만 보면 구현 갭이 잔존하는 것으로 오인할 수 있다.

- **제안**: `spec/data-flow/10-triggers.md` §3.1 의 line 203 단락 및 §3.1 표의 `false` 상태 설명을 §1.4 와 일관되게 갱신한다. 구체적으로:
  - line 201 표의 `false` 설명에 "Trigger 화면에서 `PATCH { isActive: false }` 시에도 `schedule.is_active + removeJob` 이 동기 갱신됨 (§1.4)" 를 추가.
  - line 203 단락을 "양방향 동기화 모두 구현 완료 (§1.4)" 로 교체하거나 삭제.

---

### [INFO] `spec/2-navigation/3-schedule.md` sort/order 지원 — 다른 목록 API 표기 패턴과 비교

- **target 위치**: `spec/2-navigation/3-schedule.md` §3.2 `GET /api/schedules` 행
- **충돌 대상**: `spec/2-navigation/1-workflow-list.md` §3 `GET /api/workflows` 행 / `spec/2-navigation/14-execution-history.md` §5 `GET /api/executions/workflow/:workflowId` 쿼리 파라미터 표
- **상세**:
  schedule spec 은 sort/order 파라미터를 한 줄에 인라인으로 기술하고 whitelist 기반임을 언급한다. workflows spec 은 동일하게 인라인으로 쿼리 파라미터를 나열한다. 서로 다른 목록 API 간에 sort/order 허용값(whitelist 내용)이 서로 기술되지 않아, 비교 시 어떤 컬럼이 각 API에서 허용되는지 불명확하다. 현재로서는 모순이 아니라 누락이므로 INFO 등급.
- **제안**: 동기화 권장. 각 API 인라인 또는 별도 섹션에 허용 sort 컬럼 목록을 명시하면 future 일관성 보장에 유리. 현재 즉시 필수 작업은 아님.

---

### [INFO] `spec/2-navigation/1-workflow-list.md` `pending_plans` 잔존 여부

- **target 위치**: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans`
- **충돌 대상**: 없음 (내부 위생)
- **상세**:
  workflow-list spec 의 frontmatter `pending_plans: - plan/in-progress/spec-sync-workflow-list-gaps.md` 가 이번 변경 이후에도 그대로 유지되고 있다. 이번 변경에서 상태 필터 불일치 경고(코드 버그)가 "수정 완료" 로 처리되었으므로, 해당 plan 파일의 내용이 이 항목을 포함하고 있다면 plan 내 완료 항목 체크 또는 파일 이동이 필요할 수 있다. 단, pending_plans 의 plan 파일 자체가 다른 미구현 항목(예: 정렬 UI, 태그 필터 UI)을 다루고 있다면 잔존이 올바르다.
- **제안**: `plan/in-progress/spec-sync-workflow-list-gaps.md` 내용을 확인해 상태 필터 항목만 있다면 `plan/complete/` 로 이동; 다른 미구현 항목이 남아있으면 해당 항목 체크 표시 후 잔존.

---

## 요약

이번 spec 변경 세트(trigger-schedule-sync)는 Trigger→Schedule 역방향 동기화 구현 완료를 4개 spec 파일에 일관되게 반영했으나, **동일 파일(`spec/data-flow/10-triggers.md`) 내 §3.1 단락(line 203)이 갱신되지 않아 §1.4 와 직접 모순**된다. 이 CRITICAL 항목을 제외하면 데이터 모델·API 계약·상태 전이·RBAC 관점에서 새 변경과 기존 spec 간 실질적 충돌은 발견되지 않는다. 요구사항 ID(NAV-SC-08 등)는 이미 `_product-overview.md` 에 `✅` 로 표기되어 있어 이번 변경과 일관된다.

## 위험도

MEDIUM

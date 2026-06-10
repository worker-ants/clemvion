# Rationale 연속성 검토 결과

## 발견사항

- **[CRITICAL]** `spec/data-flow/10-triggers.md §3.1` — 갭 해소 선언과 상충하는 구식 설명 잔존
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/data-flow/10-triggers.md` 203번째 줄
  - 과거 결정 출처: 같은 파일 `§1.4` (신규 추가된 "구현 현황" blockquote)
  - 상세: `§1.4` 는 "역방향은 2026-06-10 갭 해소" 라고 선언하고 `syncScheduleActivation()` 구현을 기술하지만, **같은 파일 `§3.1` (라인 203) 은 갱신되지 않은 채** "Schedule→Trigger 정방향만 구현되어 있다", "Trigger API 쪽 `PATCH { isActive }` 는 schedule.is_active 와 BullMQ job 을 갱신하지 않는다" 라는 기각된 갭 설명을 그대로 유지하고 있다. 같은 파일 안에서 §1.4 와 §3.1 이 서로 모순된다.
  - 제안: `§3.1` 의 "Schedule 과의 동기화는 **Schedule→Trigger 정방향만** 구현되어 있다 ..." 단락을 §1.4 와 일관되게 갱신한다. 예: "양방향 동기화가 완료되어 있다 — `PATCH /api/triggers/:id { isActive }` 도 `syncScheduleActivation()` 을 통해 `schedule.is_active` 와 BullMQ job 을 함께 갱신한다 (§1.4 참조)."

---

- **[WARNING]** `spec/2-navigation/3-schedule.md §4` — sort/order 구현 완료를 "미구현/Planned" 폐기 없이 조용히 번복
  - target 위치: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/3-schedule.md` 128번째 줄
  - 과거 결정 출처: origin/main 의 `spec/2-navigation/3-schedule.md §4` — "`findAll` 은 이를 무시하고 `created_at DESC` 로 고정 정렬한다 (schedules.service.ts:33,45). sort/order 반영은 **미구현/Planned**" 라는 명시적 Planned 표기
  - 상세: 기존 spec 은 sort/order 를 Planned 로 표시하고 구체적 파일·라인 참조까지 기록했다. target 은 "whitelist 기반으로 반영" 으로 교체하여 구현 완료임을 암묵적으로 선언했으나, `## Rationale` 섹션이 아예 없고 "언제 어떤 이유로 Planned 에서 구현 완료로 전환했는가" 에 대한 신규 Rationale 가 없다. 코드 확인 결과 `schedules.service.ts` 의 `resolveOrderBy()` 가 실제로 존재해 구현 완료는 사실이지만, spec 의 `## Rationale` 부재 자체가 "결정 번복 + 새 Rationale 없음" 패턴이다.
  - 제안: `spec/2-navigation/3-schedule.md` 에 `## Rationale` 섹션을 추가하고 "sort/order 구현 완료(2026-06-10) — 기존 Planned 표기 해제" 항목을 기록한다. 또는 §4 행 내에 "(2026-06-10 구현 완료, 기존 Planned 표기 해제)" 인라인 주석을 추가한다.

---

- **[INFO]** `spec/data-flow/10-triggers.md §3.1` 의 `false` 상태 설명 — "Schedules API 경유 토글" 단서가 양방향 구현 완료 후에도 편향된 표현으로 남음
  - target 위치: 같은 파일 라인 201 — "`Schedule 은 Schedules API 경유 토글 시 `removeJob` 으로 BullMQ job 해제`"
  - 과거 결정 출처: 해당 없음 (내용이 틀린 것은 아님)
  - 상세: `is_active = false` 의 Schedule 관련 설명이 "Schedules API 경유" 만 언급해 Trigger API 경유도 동일 효과임을 독자가 알 수 없다. 오해를 낳을 소지가 있으나 사실과 모순되지는 않는다.
  - 제안: "`Schedule 은 Schedules API 또는 Trigger API 경유 토글 시 `removeJob` 으로 BullMQ job 해제 (§1.4 양방향 동기화)`" 로 보완한다.

---

## 요약

이번 target 변경(`spec/data-flow/10-triggers.md`, `spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`)은 Trigger↔Schedule 역방향 동기화 갭 해소를 spec 에 반영한 것으로, 신규 Rationale(`역방향 동기화를 TriggersService 안의 private 메서드로 구현한 이유`) 가 `spec/data-flow/10-triggers.md §Rationale` 에 명시되어 있어 결정 번복 근거는 적절히 갖춰졌다. 그러나 `§1.4` 에서 "갭 해소" 를 선언하면서 **같은 파일 내 `§3.1` 을 갱신하지 않아** 문서 내부 모순이 CRITICAL 수준으로 발생했다. 또한 `spec/2-navigation/3-schedule.md` 의 sort/order Planned 표기 폐기는 Rationale 섹션 부재로 인해 결정 근거 추적이 불가능하다.

## 위험도

MEDIUM

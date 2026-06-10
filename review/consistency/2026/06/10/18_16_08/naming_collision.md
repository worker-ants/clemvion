# 신규 식별자 충돌 분석

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

분석 대상 변경 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/data-flow/10-triggers.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/1-data-model.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/3-schedule.md`
- `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/2-navigation/2-trigger-list.md`

---

## 발견사항

### [CRITICAL] §3.1 내 "§1.4 구현 갭" 참조가 §1.4 신규 내용과 의미 충돌
- **target 신규 식별자**: `§1.4` 앵커가 가리키는 섹션 (`### 1.4 Schedule ↔ Trigger 동기화`) 의 의미가 target 변경으로 "구현 갭" → "양방향 구현 완료"로 전환됨
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/data-flow/10-triggers.md` 줄 203 (`§3.1 trigger.is_active` 섹션)
  ```
  Schedule 과의 동기화는 **Schedule→Trigger 정방향만** 구현되어 있다 — ... Trigger API 쪽
  `PATCH { isActive }` 는 schedule.is_active 와 BullMQ job 을 갱신하지 않는다
  ([Spec 데이터 모델 §2.9.1](../1-data-model.md) 의 양방향 계약 대비 구현 갭 — §1.4 참조).
  ```
- **상세**: commit 545be126 (마지막 spec 커밋) 이 `§1.4` 블록쿼트를 "구현 갭" → "구현 현황 (양방향 완료)" 로 뒤집었으나, 동일 파일 내 `§3.1` 줄 203은 갱신되지 않았다. 결과적으로 동일 파일에서 동일 앵커(`§1.4`)를 "구현 갭이 있으니 §1.4 참조하라" 는 의미로 사용하는 구문이 잔존하면서, §1.4 자체는 "갭 해소됨"을 선언한다. 이는 독자가 §1.4를 참조했을 때 의미 역전으로 혼선을 유발하는 직접적 충돌이다.
- **제안**: `§3.1` 줄 203을 다음과 같이 교체한다:
  - 현재: `"Schedule 과의 동기화는 **Schedule→Trigger 정방향만** 구현되어 있다 — ... (구현 갭 — §1.4 참조)."`
  - 교체: `"Schedule 과의 동기화는 양방향 모두 구현되어 있다 — Trigger API PATCH { isActive } 도 schedule.is_active 와 BullMQ job 을 함께 갱신한다 (§1.4 참조)."`

---

### [INFO] `syncScheduleActivation()` 식별자 — spec 외부 언급, 기존 충돌 없음
- **target 신규 식별자**: `syncScheduleActivation()` (private method name, `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/spec/data-flow/10-triggers.md` §1.4 블록쿼트 및 Rationale 섹션에 등장)
- **기존 사용처**: 없음 — spec 에서 이 식별자를 이전에 사용한 기록 없음. 구현 파일 `/Volumes/project/private/clemvion/.claude/worktrees/trigger-schedule-sync-f88604/codebase/backend/src/modules/triggers/triggers.service.ts` 줄 723에 private 메서드로 구현됨.
- **상세**: private method 명을 spec prose 에 직접 노출하는 것은 컨벤션 범위의 논의지만, 충돌 자체는 없다. 다른 도메인에서 동일 이름의 공개 메서드나 서비스가 없다.
- **제안**: 특별한 조치 불요. spec 이 구현 세부(private method)를 참조하는 것은 선택적이나 이 문서(data-flow)의 성격상 허용 범위다.

---

### [INFO] `TriggerStateChangedEvent` — 채택되지 않은 대안 이름, 충돌 없음
- **target 신규 식별자**: `TriggerStateChangedEvent` (새 Rationale 섹션 줄 248 — 거부된 설계 대안으로만 언급)
- **기존 사용처**: spec 또는 codebase 어디에도 존재하지 않음.
- **상세**: "채택하지 않은 도메인 이벤트 이름"으로만 기록되었으며 실제 코드에 도입되지 않았다. 미래에 다른 개발자가 이 이름으로 이벤트를 도입하려 할 때 "이미 검토하고 기각한 이름"임을 알 수 없어 재검토 비용이 생길 수 있다. 충돌은 아니지만, Rationale 에 "채택 안 함 / 이유: 소비자가 SchedulesService 하나뿐이라 과잉" 이라는 현재 기술이 충분한 맥락을 제공한다.
- **제안**: 현재 기술로 충분. 추가 조치 불요.

---

### [INFO] 새 Rationale 섹션 제목 — 동일 파일 내 중복 없음
- **target 신규 식별자**: `### 역방향 동기화를 TriggersService 안의 private 메서드로 구현한 이유 (2026-06-10)` (Rationale 절에 추가)
- **기존 사용처**: 동일 파일 내 기존 Rationale 섹션들: `### Schedule 을 Trigger 의 sub-type 으로 둔 이유`, `### webhook URL 표기`, `### Webhook endpoint_path 의 UNIQUE 범위`. 중복 없음.
- **상세**: 섹션 제목에 날짜 `(2026-06-10)` 를 포함하는 패턴은 기존 Rationale 섹션(`spec/data-flow/10-triggers.md`)에서 사용된 적 없다. 동일 날짜의 다른 Rationale 이 미래에 추가될 경우 앵커 충돌 가능성이 있으나 현재는 없다.
- **제안**: 이미 기존 `### Schedule 을 Trigger 의 sub-type 으로 둔 이유` 패턴과 다르게 날짜가 포함된 점이 불일치. 날짜 없이 `### Trigger→Schedule 역방향 동기화를 TriggersService 내 private 메서드로 구현한 이유` 로 통일하는 것을 고려할 수 있으나, 충돌은 아니므로 선택적.

---

## 요약

target (`spec/2-navigation/` 범위 + `spec/data-flow/10-triggers.md` + `spec/1-data-model.md`) 이 도입하는 핵심 변경은 기존에 "구현 갭"으로 기록되어 있던 Trigger→Schedule 역방향 동기화를 "구현 완료"로 전환하는 spec 갱신이다. 새로 도입한 식별자(`syncScheduleActivation`, 새 Rationale 섹션 제목) 는 기존 spec 영역과 충돌하지 않는다. 단, commit 545be126이 `§1.4`의 내용을 갱신했음에도 동일 파일(`10-triggers.md`) `§3.1` 줄 203이 "정방향만 구현…구현 갭 §1.4 참조"를 그대로 유지해, `§1.4` 앵커가 동일 파일 내에서 "갭 있음(§3.1 에서)"과 "갭 해소(§1.4 본문)"로 상충하는 CRITICAL 충돌이 존재한다.

## 위험도

HIGH

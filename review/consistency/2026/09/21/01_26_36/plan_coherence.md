# Plan 정합성 검토 — spec/2-navigation (impl-done, `schedule-dup-delete`)

## 검토 범위 확인

- target `spec/2-navigation` 의 diff-base(`origin/main`) 대비 delta 는 0 파일. 이 PR 은 코드 전용
  (`codebase/backend/src/modules/schedules/schedules.service.ts` + 테스트 2건 + CHANGELOG)이므로
  spec 델타 0 자체는 정상이며 검토 무효 사유가 아니다.
- 실제로 검토한 것: `plan/in-progress/schedule-dup-delete.md`(이 작업 자신의 plan, 전문 확보) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 관련 구간을 직접 `Read`/`git diff`
  로 확보 — 번들에서는 308KB 로 절단돼 있었음) · `plan/in-progress/update-returning-tuple-shape.md`(전문,
  "RETURNING 튜플 오독" 결함 클래스와의 겹침 여부 확인 목적) · 실제 코드 diff(`git diff origin/main...HEAD --
  codebase/backend/src/modules/schedules/schedules.service.ts`).

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 은 없다. 직전 `--impl-prep` 라운드
(`review/consistency/2026/09/20/23_37_12`)가 낸 plan_coherence WARNING 두 건은 이 세션에서 실제로
해소된 것을 diff 로 확인했다:

- **WARNING 1 (해소 확인)** — "`IntegrationsService.remove()` 트래커 등재가 prose 로만 존재"
  → `git diff origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 에서
  실제로 `IntegrationsService.remove()` 항목이 신설된 것을 확인(라인 4785 부근, "이 계열의 다섯 번째이자
  남은 자리"). `schedule-dup-delete.md` 체크리스트의 "[x] 트래커에 IntegrationsService.remove() 등재"
  주장과 디스크 상태가 일치한다.
- **WARNING 2 (해소 확인)** — "`3-schedule.md` §4 가 «동시 삭제→두 번째 404» 문서화 격차 트래커
  스코프에서 빠짐" → 같은 diff 에서 해당 트래커 항목 제목에 `3-schedule.md § 4` 가 추가되고
  "2026-09-20 스코프 확장" 각주가 실제로 붙은 것을 확인. `schedule-dup-delete.md` 체크리스트의
  "[x] 트래커의 «동시 삭제 404 문서 격차» 스코프에 3-schedule.md §4 추가" 주장과 일치한다.

## 점검 관점별 결과

1. **미해결 결정과의 충돌** — 없음. 이 PR 이 손댄 유일한 미해결 지점은 트래커의
   "`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다" 항목 자신이고, 그 항목이
   열어 둔 질문("스케줄 자신을 위한 새 lock key 가 필요한지부터 확인")을 이 plan 의 §B("`schedule.trigger_id`
   는 엔티티상 NOT NULL — `triggerId` 없는 방어 분기는 현재 도달 불가")가 실측으로 닫았다. 트래커가
   요구한 조사 순서(먼저 실측 → 처방)를 그대로 따랐다.
2. **선행 plan 미해소** — 없음. `plan/in-progress/update-returning-tuple-shape.md` 가 확립한 불변식
   ("raw `UPDATE`/`DELETE … RETURNING` 결과는 `updateReturningRows` 경유")과 겹치는지 확인했으나,
   이 PR 의 `m.delete(Trigger, triggerId)` / `scheduleRepository.delete(...)` 는 raw `.query()` 가 아니라
   TypeORM `EntityManager`/`Repository` 의 typed `delete()`(반환 `DeleteResult{ affected }`)다. 그 plan
   자신이 "QueryBuilder `.execute()` 반환은 이 가드에 구조적으로 안 걸린다" 고 명시적으로 스코프를
   좁혀 뒀으므로 선행 조건 미해소가 아니다.
3. **후속 항목 누락** — 없음(위 해소 확인 참고). 형제 PR(#1369 워크플로·워크스페이스, #1370 트리거)이
   같은 결함 클래스를 닫을 때마다 "마지막" 이라고 적고도 새 자리가 나온 전례가 있어, 이 plan 은 착수 전
   전수 조사로 `IntegrationsService.remove()`(다섯 번째 자리)를 미리 찾아 트래커에 등재하고, 자신은
   손대지 않는다고 명시했다 — 스코프 확장이 문서로도 실행으로도 반영되어 있다. "네 자리 공용 헬퍼 추출"
   설계 항목(트래커 4501행)도 이 PR 의 구현 형태(스케줄: FK CASCADE 판정자가 트리거 쪽 `affected`)를
   전제로 이미 반영해 뒀다.

## 요약

`plan/in-progress/schedule-dup-delete.md` 는 자신이 닫는 트래커 항목(`spec-draft-nullable-notation-followups.md`)
과 정합하며, 직전 `--impl-prep` 라운드가 지적한 두 plan_coherence WARNING(트래커 미등재·문서 격차 스코프
누락)은 이번 세션 중 실제 파일 변경으로 해소됐다. 인접 plan(`update-returning-tuple-shape.md`)의 raw
RETURNING 튜플 불변식과는 판정 메커니즘(ORM typed `delete()` vs raw `.query()`)이 달라 충돌하지 않는다.
새로 열어야 할 미해결 결정·선행 조건 미해소·후속 항목 누락을 찾지 못했다.

## 위험도
NONE

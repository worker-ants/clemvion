# Plan 정합성 검토 — spec/2-navigation/ (schedule-cron-flake)

## 검토 범위 요약

- 실제 diff(origin/main 대비): `codebase/backend/test/schedule-trigger.e2e-spec.ts`(1파일/57줄, 테스트 비교 로직 교체) + `plan/in-progress/schedule-cron-flake.md`(신규) + `plan/in-progress/spec-draft-nullable-notation-followups.md`(항목 2건 추가). `spec/2-navigation/` 본문 자체는 이번 diff 에서 변경 없음(정상 — 서비스 동작 불변, 테스트 판정 방식만 교체).
- `schedule-trigger.e2e-spec.ts` 는 `spec/2-navigation/2-trigger-list.md` 와 `spec/2-navigation/3-schedule.md` 양쪽 frontmatter `code:` 에 이미 등재되어 있어(각각 "e2e 가 고정한다" 註 포함) 이번 변경으로 새로 등재할 것은 없다.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

확인한 것 (근거 남김):

- **미해결 결정과의 충돌**: 없음. `schedule-cron-flake.md` 는 서비스 코드(`schedules.service.ts` 재계산 로직)를 "정상, 비대상"으로 명시하고 테스트 비교 방식만 바꾼다 — spec 이 열어둔 미결정 항목(예: chat channel `inboundSigning` rotation v1 미정의, knowledge-base 자동 재임베드 정책 미정)과 겹치는 결정이 없다.
- **선행 plan 미해소**: 없음. `2-trigger-list.md` frontmatter `pending_plans:` 는 이미 `spec-draft-nullable-notation-followups.md` 를 가리키고 있고, 이번 diff 가 그 트래커에 추가한 두 항목(`NAV-WF-02`/`NAV-WF-06` 카탈로그 stale·`computeNextRuns` happy-path 단위 테스트 부재)은 `grep` 확인 결과 중복 등재가 아니다(각 1건).
- **후속 항목 누락**: 없음. 두 신규 트래커 항목 모두 owner(`planner`/`developer`)·근거(리뷰 세션 경로)·우선순위가 명시되어 있고, `3-schedule.md`(status: implemented, `pending_plans` 불요)·`1-workflow-list.md`(status: partial, 기존 `pending_plans` 유지)의 frontmatter 상태와 충돌하지 않는다. `1-workflow-list.md` 에 신규 tracker 참조를 추가하지 않은 것도 타당해 보인다 — 추가된 `NAV-WF-02/06` 항목은 "미구현 surface" 가 아니라 카탈로그 표 vs 상세 spec 간의 문서 hygiene 불일치이므로 `spec/conventions/spec-impl-evidence.md` R-5/R-11 기준상 `pending_plans:` 의무 대상이 아니다.

## 참고 (비차단, plan 자체 위생)

`plan/in-progress/schedule-cron-flake.md` 의 체크리스트는 `[ ] /ai-review 수렴` · `[ ] --impl-done` · `[ ] 트래커 해소 · complete/ 이동` 이 아직 미체크 상태이지만, 저장소 커밋 이력(`34a9e0140` "4라운드 검증 · 종결", Critical 0 · Warning 1 → 이미 조치)은 `/ai-review` 가 이미 수렴했음을 보여준다. 이는 target(spec/2-navigation/)과의 충돌이 아니라 이 워크플로가 아직 `--impl-done` 게이트를 통과하기 전 스냅샷이기 때문으로 보인다 — 이번 게이트(본 검토)가 끝나는 시점에 체크리스트를 실제 상태로 갱신할 것을 권장한다(마무리 커밋은 리뷰 뒤가 정상).

## 요약

이번 변경은 `spec/2-navigation/` 스코프의 spec 본문을 건드리지 않는 테스트-전용 수정이며, 관련 두 spec 문서(`2-trigger-list.md`/`3-schedule.md`)의 `code:`/`pending_plans:` frontmatter 는 이미 이 변경을 감당할 수 있는 상태였다. 새로 등재된 두 트래커 항목은 기존 `pending_plans` 링크(`spec-draft-nullable-notation-followups.md`)를 통해 추적되며 중복·충돌이 없다. Plan 정합성 관점에서 이 diff 를 막을 이유가 없다.

## 위험도

NONE

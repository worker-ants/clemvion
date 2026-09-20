# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 검토 대상 요약

- diff: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` 1개 파일, 153줄 — 전부 테스트 추가(서비스 로직 변경 없음)
- 대응 plan: `plan/in-progress/sched-recalc-unit.md` (`spec_impact: none`)
- target scope(`spec/2-navigation/`) 델타: 0 파일 (정상 — 테스트 전용 변경)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 트래커 항목은 의도적으로 아직 미해소 상태
  - target 위치: (spec 변경 없음 — 해당 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4933행 `[ ] cron 재계산 happy-path 의 결정적 단위 테스트가 없다` (여전히 미체크) / `plan/in-progress/sched-recalc-unit.md` 체크리스트 (`/ai-review` 수렴 · `--impl-done` · 트래커 해소 · `plan/complete/` 이동 4항목 미체크)
  - 상세: `sched-recalc-unit.md` 는 자신이 이 트래커 항목을 닫는다고 명시하지만, 아직 자체 체크리스트의 "트래커 해소" 단계 전이라 두 문서 다 일관되게 "진행 중"으로 남아 있다. 지금 이 `--impl-done` 검토 자체가 그 다음 단계이므로 이 시점의 미해소는 순서상 정상이며 충돌이 아니다.
  - 제안: 이번 라운드의 `/ai-review` 수렴 확인 후, `sched-recalc-unit.md` 체크리스트를 마저 체크하고 `spec-draft-nullable-notation-followups.md` 4933행을 해소 처리(완료 plan 경로 등재) → `plan/complete/`로 이동하는 마무리 커밋이 필요 (아직 이 diff 에는 없음, 후속 커밋 사항).

## 교차 확인 내역

1. **미해결 결정과의 충돌** — 없음. `spec/2-navigation/2-trigger-list.md` §2.3.1 (`nextRunAt`: "스케줄 생성·수정 시와 각 실행 완료 직후 재계산")이 이미 이 재계산 동작을 문서화하고 있고, 이번 diff 는 그 기존 동작을 단위 테스트로 고정할 뿐 새 결정을 내리지 않는다. 서비스 로직 변경이 없으므로(plan `## 비대상` 명시) target 문서가 결정을 일방적으로 내릴 여지 자체가 없다.
2. **선행 plan 미해소** — 없음. `plan/in-progress/` 전체를 `computeNextRuns`/`nextRunAt`/`재계산` 으로 grep 했을 때 이 작업과 실질적으로 연관된 다른 plan은 없었다(나머지 매치는 무관한 문맥의 동일 한자어 재사용, 예: 인증 가드 캐시 재계산·EIA durationMs 재계산 등). `spec/2-navigation/3-schedule.md` frontmatter 에도 `pending_plans` 가 없다.
3. **후속 항목 누락** — 경미. 위 INFO 항목 외에는 이 diff 로 인해 새로 파생되거나 무효화되는 다른 plan 의 후속 항목이 없다. `spec-draft-nullable-notation-followups.md` 4933행 자체가 이 작업의 소스이므로 "누락"이 아니라 아직 닫는 커밋이 오지 않은 정상적 중간 상태다.

## 요약

이번 diff 는 `SchedulesService.update()` 재계산 경로의 기존 동작(이미 `spec/2-navigation/2-trigger-list.md` §2.3.1 에 문서화됨)을 결정적 단위 테스트로 고정하는 순수 테스트 추가이며, 서비스 로직·API 계약 변경이 없다. `plan/in-progress/sched-recalc-unit.md` 가 `spec_impact: none` 으로 정확히 스코프를 선언했고, target spec 영역(`spec/2-navigation/`)의 미해결 결정·선행 plan·후속 항목 중 이 변경과 충돌하거나 무효화되는 것은 발견되지 않았다. 유일하게 남은 것은 트래커(`spec-draft-nullable-notation-followups.md` 4933행)와 자기 plan 체크리스트의 마무리 처리인데, 이는 이번 impl-done 검토 다음 단계로 예정된 정상 절차이지 정합성 결함이 아니다.

## 위험도

NONE

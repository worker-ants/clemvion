# Rationale 연속성 검토 — trigger-list-cron-nextrun (impl-done, V-10)

## 검토 대상

`plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 의 코드 구현 결과. `spec/2-navigation/2-trigger-list.md §2.1`(목업 `0 9 * * * Next: 09:00`)이 목록 행에 Schedule 트리거의 cron 식·다음 실행 시각 표시를 명시하는데, 이번 PR 은 `TriggersService.findAll()` 에 schedule 타입 행 대상 `scheduleRepository.find({ triggerId: In(...), workspaceId })` 배치 조회를 추가해 목록 응답에 `cronExpression`/`timezone`/`nextRunAt` 을 enrich 했다. 동반해 `TriggerDto` 의 세 필드 Swagger 주석을 "단건 조회 시에만 채워짐" → "목록·단건 조회 모두 채워짐" 으로 정정했다.

본 검토는 같은 worktree 의 직전 pass(`review/consistency/2026/07/05/17_26_42/rationale_continuity.md`, plan-only 단계)를 이어받아 **구현 완료 후 실제 코드**가 그 결론과 일치하는지 재확인한다.

## 발견사항

이번 구현을 spec 전체(`2-trigger-list.md` R-1~R-16, `1-workflow-list.md` Rationale, `1-data-model.md` Rationale, `5-system/2-api-convention.md` Rationale)와 대조한 결과, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것도 발견되지 않았다.

- **기각된 대안의 재도입 여부**: 없음. 직전 pass 가 이미 확인했듯 "schedule enrichment 는 detail-only 로 유지한다" 는 취지의 명시적 `## Rationale` 항목은 spec 어디에도 없다. `TriggerDto` 의 구주석은 ADR 이 아니라 미이행 상태를 기술한 현재 동작 설명이었다. 이번 코드(`triggers.service.ts` diff)는 그 gap 을 스펙이 이미 §2.1 에서 약속한 대로 이행한 것이며, 과거에 검토·거부된 대안을 되살린 것이 아니다.
- **합의된 원칙과의 정합**: 목록 조회에서 연관 엔티티를 배치로 enrich 하는 패턴은 이 코드베이스에 이미 두 선례가 있다 — (a) `1-workflow-list.md §2.4` "마지막 실행순" 정렬의 `execution` correlated subquery, (b) `schedules.service.ts findAll()` 의 `leftJoinAndSelect('s.trigger','t')`. 이번 구현은 `scheduleRepository.find({ triggerId: In(scheduleTriggerIds), workspaceId })` 로 N+1 을 피하는 배치 조회이며, 워크스페이스 스코프(`workspaceId`)도 유지한다 — 데이터 격리 invariant 를 우회하지 않는다.
- **결정 번복 여부**: 번복이 아니라 gap 최초 이행이다. plan 에도 "spec 변경 불요(§2.1 이미 약속)" 로 명시되어 있고, 실제로 spec 본문(§2.1)·Rationale(R-1~R-16) 어디에도 신규 항목이 추가되지 않았다 — 직전 pass 의 INFO 권고("R-17 신설은 선택, 필수 아님")를 그대로 따른 것으로 일관성이 있다.
- **DTO 주석 정합**: 직전 pass 가 지적한 유일한 INFO("`TriggerDto` Swagger 주석이 구현과 함께 갱신되지 않으면 새 3자 불일치 재발")는 이번 diff 에서 실제로 해소됐다(`cronExpression`/`timezone`/`nextRunAt` 세 필드 주석 모두 "목록·단건 조회 모두 채워짐" 으로 갱신 확인, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`).
- **테스트**: `triggers.service.spec.ts` 에 신설된 `TriggersService.findAll — schedule 목록 enrichment (V-10)` describe 블록이 (a) schedule 행만 enrich·webhook 행은 불변, (b) schedule 행이 없으면 `scheduleRepo.find` 자체를 skip(N+1 방지 의도 검증)을 커버한다. `schedule-trigger.e2e-spec.ts` 에도 관련 e2e 32줄 추가.

기각·번복·invariant 우회 어느 카테고리에도 해당하는 항목이 없어 CRITICAL/WARNING 은 없다.

### INFO (참고, 비차단)

- **[INFO]** R-17(가칭) Rationale 신설은 여전히 선택 사항으로 남아있음 — 문제 아님, 기록용
  - target 위치: `spec/2-navigation/2-trigger-list.md` `## Rationale`(R-1~R-16 다음)
  - 과거 결정 출처: 직전 pass(`review/consistency/2026/07/05/17_26_42/rationale_continuity.md`)의 두 번째 INFO 항목
  - 상세: 직전 pass 는 "필수는 아니지만 R-17 로 배치 join 트레이드오프(목록 쿼리 IN join 1회 추가, workflow-list §2.4 선례와의 연결)를 기록해두면 향후 유사 판단(예: webhook `chatChannelHealth` 목록 enrichment)에 참조 가치가 있다"고 제안했다. 이번 구현·plan 양쪽 다 spec 본문/Rationale 변경 없이 마무리됐다 — plan 의 "spec 변경 불요(§2.1 이미 약속)" 결정과 일치하므로 이는 결함이 아니라 직전 pass 가 이미 "선택"으로 명시한 항목이 실제로 선택되지 않은 것뿐이다.
  - 제안: 그대로 두어도 무방. 다만 향후 유사한 목록-enrichment 판단이 반복되면(예: V-11 계열 minor 항목들) 그때 한 번에 모아 R-17 로 기록하는 것을 고려할 수 있다. 강제 사항 아님.

## 요약

이번 PR 은 이전 plan-only rationale_continuity 검토(NONE 등급)가 권장한 방향을 코드로 그대로 이행했다 — schedule 타입 트리거의 cron/timezone/nextRunAt 을 목록 레벨에서 배치(N+1 회피) enrichment 하고, 이에 따라 stale 해질 뻔했던 `TriggerDto` Swagger 주석도 함께 정정했다. 이 변경은 과거에 명시적으로 기각된 대안을 되살린 것이 아니며(그런 ADR 자체가 존재하지 않음), 오히려 `1-workflow-list.md §2.4`(correlated subquery)와 `schedules.service.ts findAll()`(trigger left join) 두 기존 합의 패턴과 정합한다. workspaceId 스코프도 그대로 유지되어 데이터 격리 invariant 위반도 없다. plan 이 명시한 "spec 변경 불요" 결정과 실제 diff(spec 파일 무변경)가 일치해 문서·구현 간 새로운 불일치도 만들지 않았다.

## 위험도

NONE

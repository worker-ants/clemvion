# Consistency SUMMARY — impl-prep spec/2-navigation/ (17_26_42)

모드: `--impl-prep` — V-10(트리거 목록 Cron·다음 실행 시각) 구현 착수 직전. 계획: `triggers.service.ts findAll()` 이 schedule 타입 행을 `scheduleRepository.find({triggerId In(...)})` 배치로 enrich(cron/timezone/nextRunAt) → GET /api/triggers 목록이 `2-trigger-list.md §2.1` 대로 cron·다음 실행 시각 표시. spec 변경 불요(§2.1 이미 약속).

## BLOCK: NO

Critical 0, Warning 0. 전 checker NONE/LOW. 일관된 INFO 1건(DTO 주석 갱신) — 구현에 포함.

## Checker 결과

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | NONE | 충돌 없음. INFO: stale DTO 주석 동반 갱신·§3 API 표 보강(선택) |
| rationale | NONE | "detail-only 설계" Rationale 없음. **배치-join 지지 선례 2건**(workflow-list §2.4 correlated subquery·schedules.service findAll trigger join). INFO: DTO 주석 |
| convention | NONE(추정) | 위배 없음 |
| plan_coherence | LOW | V-10=plan 권장과 일치·인접 plan(schedule/webhook) 충돌 없음. 구현 시 체크박스 갱신 권고 |
| naming | NONE | cron_expression/next_run_at 네이밍 스페이스 이미 정렬, 신규 식별자 불요. INFO: DTO 주석 |

## 구현 방침 (impl-prep 반영)

- `findAll` 에 schedule 행 배치 enrichment(`In` 조회 1회 — N+1 회피, findOneDetail 단건 로직의 목록판). 반환 타입 `PaginatedResponseDto<TriggerDetail>`.
- `TriggerDto` 응답 DTO 의 cron/timezone/nextRunAt JSDoc "단건 조회 시에만" → "목록·단건 모두" 정정(3자 불일치 완전 해소).
- FE(`triggers/page.tsx`)는 이미 목록에서 cron/nextRunAt 렌더(69/215/811) — 변경 불요, 백엔드 수정이 UX 완성.
- plan V-10 체크박스 갱신(구현 커밋에 포함).

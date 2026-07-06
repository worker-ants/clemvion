# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: YES** — naming-collision-checker CRITICAL 2건 (spec 이 코드에서 폐기된 식별자를 "현재 구현"으로 서술). **실질은 SPEC-DRIFT** — 설계 충돌 아님, 코드가 spec 을 앞서간 상태. 딥링크 SoT(`_layout.md §3.1`)는 이미 신규 코드와 일치.

## Critical (SPEC-DRIFT — 코드 되돌리지 않고 spec 동기화로 해소)
1. naming_collision — `NotificationsService.findByResource`→`findByBackgroundRun` 리네임 후에도 spec §2.1(:22,:89)이 옛 메서드명·`resource_type=?/resource_id=?` 조회를 SoT 로 서술.
2. naming_collision — `background_failed` resource_type 코드에서 `'background_run'`→`'workflow'` 통일됐으나 spec §1.1(:67) 비대칭 서술 잔존.

## WARNING
1. `spec/1-data-model.md §2.19` 에 신규 `background_run_id UUID NULL (select:false)` 컬럼 누락.
2. rationale_continuity — V107 분리 결정 근거가 마이그레이션 주석에만, spec `## Rationale` 미이관.
3. naming_collision — `notification.background_run_id` vs V047 인덱스 명칭 유사(실질 충돌 없음).

## INFO
1. `spec/4-nodes/1-logic/12-background.md §8.2` notifications 필드 attribution 메커니즘 미언급 (spec-update flip 5번째 항목에 포함).
2. DTO resourceType 값목록 vs §2.19 "등" granularity 차이 — 실질 충돌 아님.

## 재시도 필요
- convention_compliance / plan_coherence output_file 미생성 (재실행 필요).

## 해소 경로 (SPEC-DRIFT reverse-flow, developer SKILL §REVIEW step3)
`plan/in-progress/spec-update-notifications-background-run-id.md` 의 flip 항목을 spec 에 반영 →
`/consistency-check --spec` BLOCK:NO 검증 → `--impl-done` 재실행 BLOCK:NO 확인. 코드는 되돌리지 않는다.

# Plan 정합성 검토 — target: `spec/2-navigation/` (--impl-prep, 작업: `plan/in-progress/schedule-cron-flake.md`)

## 발견사항

- **[INFO]** `--impl-prep` scope 가 실제 작업 범위보다 넓다 — 이미 `§O` 로 추적됨, 신규 조치 불필요
  - target 위치: `spec/2-navigation/` 전체(디렉터리 scope)
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §O (`--impl-prep`/`--impl-done` 이 `spec/*.md` 파일 단위 scope 를 못 받아 디렉터리 전체를 scope 로 주는 관례), `plan/in-progress/schedule-cron-flake.md` (실제 변경은 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 단언·cron 값 하나뿐, `spec_impact: none`)
  - 상세: `schedule-cron-flake.md` 는 e2e 케이스 D 의 거짓 실패를 고치는 **테스트 전용** 수정이라 스스로는 `spec/2-navigation/` 어느 문서도 건드리지 않는다. 그런데 `--impl-prep` 가 파일 단위 scope 를 받지 못해 대상 문서(`2-trigger-list.md`/`3-schedule.md`)가 속한 디렉터리 전체가 scope 로 들어오고, 그 결과 이 작업과 무관한 기존 WARNING 이 함께 딸려 들어온다: (1) `1-workflow-list.md` §3.1 `GET /api/folders` 응답 형태 미기재, (2) `2-trigger-list.md` §3 `GET /api/triggers/:id/history` 응답 형태·상한(10건) 미기재, (3) `1-workflow-list.md` frontmatter `pending_plans` 가 이미 `plan/complete/`로 이동한 `workflow-duplicate-nodes-edges.md` 를 여전히 가리킴. 세 항목 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 종결 조건 backlog 에 owner: planner, 2026-09-20 등재로 이미 개별 추적 중이며, `schedule-cron-flake.md` 작업과는 인과관계가 없다(그 작업이 만든 것도, 그 작업이 풀어야 할 것도 아니다).
  - 제안: 이번 `schedule-cron-flake.md` 흐름에서는 위 3건을 새로 처리할 필요 없음 — 이미 추적된 별도 planner 항목이므로 이 target 정합성 판단에서 BLOCK 사유로 세지 않는다. `§O` 의 처방(scope 를 `spec/*.md` 파일 단위로 받게 하는 것)이 적용되면 이런 무관 항목 혼입이 근본적으로 줄어든다 — 재확인 불필요, 이미 처방이 plan 에 있음.

- **[INFO]** `3-schedule.md` Rationale 의 plan 경로가 stale — 관련 있으나 이번 작업이 만든 것도, 고칠 의무도 아님
  - target 위치: `spec/2-navigation/3-schedule.md` `## Rationale` → `### sort/order 쿼리 반영 — "미구현/Planned" 표기 해제 (2026-06-10)`
  - 관련 plan: 문서가 인용하는 `plan/in-progress/spec-sync-schedule-gaps.md` 는 이미 `plan/complete/spec-sync-schedule-gaps.md` 로 이동 완료(경로 존재 확인: `plan/in-progress/` 쪽 없음, `plan/complete/` 쪽 있음)
  - 상세: 서술 자체("Planned 해제는 ... 구현 완료에 따른 문서 동기화")는 여전히 참이라 내용 오류는 아니다. 다만 인용 경로가 `in-progress/` 를 가리켜 완료 이관 사실과 어긋난다. `schedule-cron-flake.md` 가 건드리는 코드·문서와 겹치지 않고, 어떤 활성 결정과도 충돌하지 않으므로 이번 impl-prep 를 막을 사유는 아니다.
  - 제안: 별도 planner 사소 정정 대상(경로를 `plan/complete/spec-sync-schedule-gaps.md` 로 갱신) — `schedule-cron-flake.md` 체크리스트에 끼워 넣을 필요 없음.

## 요약

`plan/in-progress/schedule-cron-flake.md` 는 `schedule-trigger.e2e-spec.ts` 「D. PATCH cron → nextRunAt 재계산」 케이스의 시각 겹침 거짓 실패를 고치는 테스트 전용 수정이며(`spec_impact: none`), 서비스 코드·spec 문서를 바꾸지 않는다. 원 트래커(`spec-draft-nullable-notation-followups.md`)에 이미 등재된 항목을 그대로 옮겨온 것이고, 완료 시 트래커 해소까지 체크리스트에 포함돼 있어 이중 추적 위험도 스스로 처리한다. `spec/2-navigation/` 대상 문서(`2-trigger-list.md`, `3-schedule.md`)의 "결정 필요" 항목이나 다른 `plan/in-progress/**` 의 미해소 전제 중 이 변경과 충돌하는 것은 없었다. 이번 `--impl-prep` scope 가 디렉터리 전체라 무관한 기존 WARNING(폴더/이력 API 응답 형태 미기재, stale pending_plans)이 함께 잡히지만 전부 별도 planner 항목으로 이미 추적 중이라 이 작업의 착수를 막을 사유가 아니다.

## 위험도

NONE

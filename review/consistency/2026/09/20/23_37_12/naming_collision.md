# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-prep, `schedule-dup-delete`)

## 검토 범위 확인

target 은 `plan/in-progress/schedule-dup-delete.md` (frontmatter `spec_impact: none`) 가 착수하려는
`SchedulesService.remove()` 동시 DELETE 감사 중복 수정이며, impl-prep 게이트가 문 scope 는
`spec/2-navigation` 이다. 현재 워크트리에는 `git status --short` 상 코드 변경이 전혀 없고
(`plan/in-progress/schedule-dup-delete.md` 신설과 이 리뷰 산출물만 untracked) spec 파일도 수정되지
않았다 — 즉 이번 target 이 spec/2-navigation 에 **새로 도입하는 식별자는 없다**.

plan 본문이 예고하는 구현 방향을 식별자 관점에서 대조했다:

| 식별자 | plan 이 쓰려는 것 | 기존 사용처 | 판정 |
|---|---|---|---|
| `AUDIT_ACTIONS.SCHEDULE_DELETED` | 그대로 재사용(중복 방지만 추가) | `codebase/backend/src/modules/schedules/schedules.service.ts:349` 에 이미 존재. 자매 자리 `WORKFLOW_DELETED`(`workflows.service.ts:309`)·`TRIGGER_DELETED`(`triggers.service.ts:1117`)·`INTEGRATION_DELETED`(`integrations.service.ts:788`)와 명명 패턴 동일 | 신규 아님 — 충돌 없음 |
| advisory lock key `trigger-config:<triggerId>` | 스케줄 삭제 경로에서도 동일 키로 잠금 판정 기준을 세움 | 이미 `SchedulesService`/`TriggersService` 양쪽이 같은 키 포맷을 쓴다 (`schedules.service.spec.ts:752`, `triggers.service.spec.ts:4088/4109/4166`, `trigger-config-lock.spec.ts:73`) — spec 문서상으로도 [`2-trigger-list.md §3 동시 쓰기 직렬화`](../../../../../spec/2-navigation/2-trigger-list.md) 가 `pg_advisory_xact_lock(hashtext('trigger-config:<triggerId>'))` 를 SoT 로 명시 | 신규 아님 — spec 이 이미 문서화한 락 스코프를 그대로 따름 |
| 판정 결과 상태쌍 `[204, 404]` | 재사용 | `2-trigger-list.md §4.4` 의 트리거 삭제, `1-workflow-list.md`/워크플로 삭제 자리와 동일한 기존 관례(#1369/#1370 이 이미 세움) | 신규 아님 |
| 신규 에러 코드·엔드포인트·env var·config key | 없음 | — | 해당 없음 |

## 발견사항

없음 — target 이 spec/2-navigation 영역에 새로 도입하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수/설정키·파일 경로가 존재하지 않는다. plan 이 언급하는 모든 식별자(`SCHEDULE_DELETED` 감사
액션, `trigger-config:<id>` advisory lock 키, `204`/`404` 판정)는 이미 codebase 와 spec 본문
(`2-trigger-list.md §3`·`§4.4`)에 정의돼 있고 의미도 동일하게 재사용된다.

참고로 `plan/in-progress/schedule-dup-delete.md` 자체가 별도로 열어둔 후속 항목
(`IntegrationsService.remove()` 의 같은 결함 클래스, 공용 헬퍼 추출)도 이번 PR 범위 밖으로 명시돼
있어 이번 target 의 식별자 충돌 표면에 포함되지 않는다.

## 요약

이번 target 은 spec 변경이 없는 순수 코드 버그 수정(동시 DELETE 감사 중복 제거)이며, 사용하는 모든
식별자 — 감사 액션명, advisory lock 키, HTTP 상태 판정 — 가 이미 spec/2-navigation 본문과 형제 PR
(#1369 워크플로, #1370 트리거)에서 확립된 기존 정의를 그대로 재사용한다. 새로 부여되는 ID·타입명·
엔드포인트·이벤트명·환경변수·파일 경로가 하나도 없으므로 신규 식별자 충돌 관점에서 문제될 여지가
없다.

## 위험도

NONE

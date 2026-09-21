# 신규 식별자 충돌 검토 — `plan/in-progress/integration-dup-delete.md` × `spec/2-navigation`

## 범위 설명

이번 impl-prep 대상은 `spec/2-navigation` 전 영역이 번들됐으나, 실제로 착수하려는 작업은
`plan/in-progress/integration-dup-delete.md` 한 건 — `IntegrationsService.remove()` 의 동시
DELETE 레이스를 `remove(entity)` → `delete({id, workspaceId})` (affected 판별) 로 바꾸는 backend
전용 수정이며 `spec_impact: none` 이다. 새 식별자 도입 여부를 이 plan 원문 + 대상 서비스 코드
(`codebase/backend/src/modules/integrations/integrations.service.ts`) 기준으로 확인했다.

## 점검 결과 (6개 관점)

1. **요구사항 ID 충돌** — 신규 ID 없음. plan 은 기존 트래커 항목(`spec-draft-nullable-notation-followups.md`)의 후속 처리이며 새 NAV-*/REQ-* 류 ID 를 부여하지 않는다.
2. **엔티티/타입명 충돌** — 신규 타입 없음. `Integration` 엔티티는 그대로이며 `remove(entity)` 를 TypeORM 표준 `delete(criteria)` 로 바꾸는 것은 시그니처 변경일 뿐 새 타입/DTO 도입이 아니다 (plan §B 도 "cascade:true·@OneToMany 없음(실측)" 으로 엔티티 관계 불변을 확인).
3. **API endpoint 충돌** — 신규 endpoint 없음. `DELETE /api/integrations/:id` 는 `spec/2-navigation/4-integration.md:814` 에 이미 정의돼 있고 (`삭제 (사용처 있으면 409)`), 이번 수정은 그 내부 구현(락 없는 레이스 처리)만 바꾼다. 새 세부 에러 코드도 추가되지 않는다 — `409 INTEGRATION_IN_USE` 는 기존(`4-integration.md:865`), 404 는 신규 코드 없이 일반 not-found 로 처리된다.
4. **이벤트/메시지명 충돌** — 신규 이벤트명 없음. `AUDIT_ACTIONS.INTEGRATION_DELETED` 는 이미 코드에 존재하고(`integrations.service.ts:788`) `spec/2-navigation/4-integration.md:1145` 의 `integration.deleted` 와 정확히 일치한다. plan 의 e2e 단언(`audit_log 의 integration.deleted 1건`)도 같은 기존 값을 재사용할 뿐, 형제 엔티티들이 이번 시리즈(#1369~#1371)에서 쓴 `workflow.deleted` / `trigger.deleted` / `schedule.deleted` 명명 패턴과도 접미사(`*_DELETED`/`*.deleted`)가 일치해 충돌·혼동 소지가 없다.
5. **환경변수·설정키 충돌** — 신규 ENV/설정 키 없음. plan 은 서비스 레이어의 쿼리 방식만 바꾸며 설정값을 도입하지 않는다.
6. **파일 경로 충돌** — 신규 spec 파일 없음(`spec_impact: none`). 코드 파일도 기존 `integrations.service.ts` 를 수정하는 것이며 새 파일 경로를 만들지 않는다(신규 e2e 테스트 파일이 추가될 수 있으나 plan 원문에 구체 경로가 아직 명시되지 않았고, 형제 PR 들의 명명 관례 — 예 `trigger-deletion-releases-resources.e2e-spec.ts` — 를 따르면 기존 명명 컨벤션과 자연히 정렬된다).

## 참고 — 충돌은 아니지만 눈에 띄는 기존 비일관성

plan §A 자체가 지적하듯, 삭제성 감사 액션 접미사가 리소스마다 `_DELETED`(workflow/trigger/schedule/integration) 와 `_REMOVED`(`member.removed`, `WorkspacesService.removeMember()`)로 갈려 있다. 이는 **이 PR 이 새로 만드는 충돌이 아니라 기존에 이미 존재하는 명명 비일관성**이며, plan 도 `removeMember()` 를 별도 트래커 항목으로 분리해 이번 범위 밖으로 명시했다. 신규 식별자 충돌 관점에서는 해당 없음(참고용 INFO 성격)이나, 별도 정합성 축(명명 컨벤션 통일)에서 다룰 사안이지 이 PR 의 착수를 막을 사유는 아니다.

## 요약

`plan/in-progress/integration-dup-delete.md` 는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·파일 경로 어느 축에서도 새 식별자를 도입하지 않는다 — 기존 `DELETE /api/integrations/:id`, 기존 `AUDIT_ACTIONS.INTEGRATION_DELETED`/`integration.deleted` 를 그대로 재사용하며 내부 레이스 처리 로직만 원자적 `delete()` 판별로 교체한다. `spec/2-navigation` 전 영역(트리거·스케줄·워크플로우·통합 등)의 기존 식별자와 대조한 결과 신규 식별자 충돌은 발견되지 않았다.

## 위험도

NONE

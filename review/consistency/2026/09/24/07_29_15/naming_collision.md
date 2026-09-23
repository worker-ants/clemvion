# 신규 식별자 충돌 검토 — `member-owner-toctou` (impl-prep, scope=spec/5-system)

## 대상 확인

target 은 `plan/in-progress/member-owner-toctou.md` (신규 plan, `origin/main` 대비 유일한 diff, 120줄 추가) 이며, 이 plan 자체가 `spec_impact: none` 을 선언한다. 실제 코드 변경은 아직 없음(worktree 상 `plan/` 외 diff 0) — 이번 호출은 impl-prep 단계로, plan 이 구현하려는 처방이 기존 `spec/5-system` 식별자 공간과 충돌하는지 사전 점검하는 것이 목적이다.

plan 본문(§B~§F)을 신규 식별자 도입 여부 관점에서 전수 확인한 결과:

| 점검 관점 | plan 이 도입하는 것 | 결과 |
|---|---|---|
| 요구사항 ID | 없음 — plan 은 트래커(`spec-draft-nullable-notation-followups.md`)의 기존 항목을 닫을 뿐, 새 ID 부여 없음 | 대상 없음 |
| 엔티티/타입명 | 없음 — `WorkspaceMember` 등 기존 엔티티의 기존 필드(`role`)만 사용 | 대상 없음 |
| API endpoint | 없음 — 기존 `DELETE /api/workspaces/:id/members/:memberId` 를 그대로 사용(§B 코드가 기존 `memberRepository.delete` 호출부 수정) | 대상 없음 |
| 이벤트/메시지명 | 없음 — webhook/queue/SSE 이벤트 신설 없음 | 대상 없음 |
| 환경변수·설정키 | 없음 | 대상 없음 |
| 파일 경로 | 없음 — 신규 spec 파일 없음(`spec_impact: none`). §E 가 언급하는 e2e 재현 테스트는 파일명 미확정이나 기존 파일(`member-remove-concurrency.e2e-spec.ts`)을 참조 기준으로 삼을 뿐 새 이름을 아직 제시하지 않음 | 대상 없음 |

에러 코드 `CANNOT_REMOVE_OWNER` 는 plan §C·§D 에서 반복 언급되지만 **신규 도입이 아니라 기존 식별자의 재사용**임을 실측으로 확인했다.

- `spec/5-system/1-auth.md:378-379,552-553` 이 이미 이 코드를 "대상이 owner 인 경우 거부(`CANNOT_REMOVE_OWNER`)" 라는 동일한 의미로 정의하고 있다.
- `codebase/backend/src/modules/workspaces/workspaces.service.ts:811` 과 `workspaces.service.spec.ts:1554` 가 이미 동일 문자열·의미로 구현/테스트하고 있다.
- plan 처방(§B)은 이 기존 가드를 "무락 `findOne` 위" 에서 "DELETE `WHERE role != 'owner'`(TypeORM `Not('owner')`) + 0-행 시 재조회" 로 **강화**하는 것이며, 던지는 코드·의미 모두 기존과 동일하게 유지한다(§D 에서 주석·JSDoc 정정도 "보장 범위가 넓어짐"만 반영하고 코드/의미 자체는 그대로).

`role: Not('owner')`, `pessimistic_write`, `EvalPlanQual` 등 plan 이 언급하는 나머지 용어도 모두 기존 TypeORM API·Postgres 개념이거나(신조어 아님) 이미 저장소에 선례가 있는 패턴(§C 표: `delete({expiresAt: LessThan(...)})` 등 3곳, `update({familyId: Not(...)})` 1곳)이다.

## 발견사항

없음. plan 이 새로 부여하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로가 전무하며, 유일하게 반복 언급되는 식별자(`CANNOT_REMOVE_OWNER`)는 `spec/5-system/1-auth.md` 가 이미 정의한 것과 완전히 같은 의미로 재사용될 뿐이다.

## 요약

이번 target(`member-owner-toctou` plan)은 신규 식별자를 하나도 도입하지 않는 순수 concurrency 보강 처방이다 — 기존 endpoint·기존 엔티티 필드·기존 에러 코드(`CANNOT_REMOVE_OWNER`, `spec/5-system/1-auth.md` 정의와 일치)를 그대로 재사용하며, `spec_impact: none` 선언과 실측이 일치한다. 신규 식별자 충돌 관점에서 점검할 대상 자체가 없으므로 문제 없음으로 판정한다.

## 위험도

NONE

# 신규 식별자 충돌 검토 — remove-member-order-coverage

## 대상 확인

번들에는 `spec/data-flow/12-workspace.md`(기존 spec, 참고 문맥)와
`plan/in-progress/remove-member-order-coverage.md`(실제 target plan, `spec_impact: none`)가
함께 포함되어 있다. 이 plan 은 `codebase/backend/src/modules/workspaces/workspaces.service.ts`
의 기존 함수 `removeMember` 가 이미 구현한 판정 순서(멤버십 → 대상 존재 → self 위임 → admin →
owner 여부)에 대해 `workspaces.service.spec.ts` 의 **유닛 테스트 두 건**을 추가하는 작업이다.
새 요구사항, 새 엔티티/DTO, 새 API endpoint, 새 이벤트, 새 ENV var/config key, 새 spec 파일 중
어느 것도 도입하지 않는다.

plan 이 언급하는 식별자를 코드베이스에서 실측 확인했다.

- `MEMBER_NOT_FOUND` — 이미 `workspaces.service.ts:344`(`throwMemberNotFound`)·`:770`
  (`transferOwnership`) 및 `workspaces.service.spec.ts:1118,1568,1652`·
  `workspaces.controller.spec.ts:230` 에 기존 사용 중인 에러 코드. plan 의 테스트 (a)는 이
  기존 경로를 새 조합(대상 부재 + 비-admin)으로 exercise 할 뿐 새 코드를 만들지 않는다.
- `ADMIN_REQUIRED`(`throwAdminRequired`), `throwNotAMember`, `throwCannotRemoveOwner` — 모두
  `removeMember` 본문(`workspaces.service.ts:814` 이하)에 기존 정의된 헬퍼/코드다.
- `getMemberRole` — 기존 메서드. plan 의 테스트 (b)는 이 메서드가 호출하는
  `memberRepo.findOne` 중 요청자 모양(`where.userId === requesterId`) 인 것의 호출 횟수를
  세는 방식으로, 새 함수·새 식별자를 추가하지 않는다.

뮤턴트 M-a/M-b/M-b2(§B)는 검증용 임시 편집이며 커밋 대상 영구 식별자가 아니다.

## 발견사항

(해당 없음 — target 이 도입하는 신규 식별자가 없다)

## 요약

이 plan 은 기존 `removeMember` 판정 순서에 대한 테스트 커버리지 갭을 메우는 순수 테스트 추가
작업으로, 새 요구사항 ID·엔티티/타입·API endpoint·이벤트/메시지명·환경변수/설정키·spec 파일
경로 중 어느 것도 새로 도입하지 않는다. plan 이 참조하는 모든 식별자(`MEMBER_NOT_FOUND`,
`ADMIN_REQUIRED` 등)는 `git grep` 로 기존 코드에 이미 존재함을 확인했다. 신규 식별자 충돌
관점에서 검토할 대상 자체가 없다.

## 위험도

NONE

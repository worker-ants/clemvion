# 요구사항(Requirement) 리뷰 — `WorkspaceInvitationDto.invitedBy` nullable 정정

## 검증 방법

- 소스 열람: `workspace-response.dto.ts`, `workspaces.controller.ts`, `workspace-invitations.service.ts`,
  `workspace-invitation.entity.ts`, `V017__workspace_invitations.sql`, `frontend/src/lib/api/workspaces.ts`,
  `spec/5-system/2-api-convention.md §5.4`, `spec/conventions/swagger.md §1-1`.
- 뮤테이션 재현: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 를
  `/private/tmp/.../scratchpad/workspaces.controller.ts.orig` 로 백업 후 `invitedBy: i.invitedBy` →
  `invitedBy: i.invitedBy ?? ''` 로 직접 편집, `npx jest workspaces.controller.spec.ts` 실행,
  `cp` 로 원복. 원복 후 `git status --short` 로 잔여 diff 없음 확인 (untracked 는 리뷰 산출물 디렉터리뿐).

## 발견사항

- **[INFO]** 새 canary 테스트(`workspaces.controller.spec.ts` `listInvitations`)의 실측치가 plan 서술과
  **정확히 일치**함을 뮤테이션으로 재확인했다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:70`, `:87`
  - 상세: 원본은 14/14 GREEN. `controller.ts:402` 의 `invitedBy: i.invitedBy` 를 `?? ''` 로 코어션하도록
    뮤테이션하면 `1 failed, 13 passed, 14 total` — plan 이 적은 "실측 1 failed / 13 passed" 와 정확히
    일치한다. 대조군(`[대조군] 초대자가 살아 있으면...`)은 예측대로 GREEN 유지.
  - 제안: 없음 — 사실 확인 목적의 기록.

- **[INFO]** DTO 변경이 관련 spec 본문(§5.4)과 line-level 로 정확히 일치한다 (spec fidelity: PASS).
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
    vs `spec/5-system/2-api-convention.md:184`
  - 상세: §5.4 는 "`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`"
    이라고 규정한다. 변경분은 `@ApiPropertyOptional({ format: 'uuid', nullable: true })` +
    `invitedBy?: string | null;` 로 정확히 이 표기를 따른다. DB 근거도 확인됨 —
    `V017__workspace_invitations.sql:15` `invited_by UUID REFERENCES "user"(id) ON DELETE SET NULL`,
    엔티티 `workspace-invitation.entity.ts:31` `invitedBy: string | null`, 핸들러
    `workspaces.controller.ts:402` `invitedBy: i.invitedBy` (코어션 없이 그대로 통과). FE 계약
    (`frontend/src/lib/api/workspaces.ts:154` `invitedBy: string | null`)과도 이미 일치했다 — plan 의
    "FE 가 이미 옳았다" 주장도 확인됨.
  - 제안: 없음.

- **[INFO]** `acceptedBy` 형제 필드가 응답 DTO에 노출되지 않는다는 plan 주장도 grep 전수로 확인됨(일치).
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (전체),
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (전체)
  - 상세: `acceptedBy` 는 엔티티(`entities/workspace-invitation.entity.ts:40`)와 서비스 내부
    (`workspace-invitations.service.ts:453` `.set({ acceptedAt, acceptedBy })`)에만 존재하고 어떤
    response DTO 필드로도 매핑되지 않는다. 즉 이번 diff 의 스코프(§5.4 적용 대상은 "이 diff 가
    nullability 를 바꾸는 필드"만)가 실제로 정확하며 누락된 형제 필드가 없다.
  - 제안: 없음.

- **[INFO]** plan 문서가 "정당한 사례"로 든 3건 중 1건(`BackgroundRunNodeExecutionDto.parentNodeExecutionId`)
  · sibling 비교 사례(`DismissNotificationResponseDto.dismissedAt` vs `NotificationResponseDto.dismissedAt`)
  을 소스에서 직접 대조한 결과 서술과 일치한다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:245`,
    `:292`(`row.parentNodeExecutionId ?? ''`); `codebase/backend/src/modules/notifications/dto/responses/dismiss-notification-response.dto.ts:18`
    vs `notification-response.dto.ts:67`
  - 상세: 쿼리가 `WHERE ne.parentNodeExecutionId = :parentNodeExecutionId` 로 필터하고 매퍼가
    `?? ''` 로 non-null 을 보장하는 것을 확인했고, dismiss 응답 DTO 만 non-null(`dismissedAt: string`)
    이고 일반 조회 DTO 는 `dismissedAt?: string | null` 인 비대칭도 실측과 일치한다.
  - 제안: 없음 — 표본 검증(전수는 아님, 시간 예산상 대표 사례만 확인).

- **[INFO]** `listInvitations` 컨트롤러 테스트에 에러 경로(예: 비-admin 요청자에 대한
  `ForbiddenException` 전파) 테스트가 없다 — 다른 describe 블록(`update`/`remove`/`leave`/
  `transferOwnership`)은 전부 성공 + 실패 경로를 함께 테스트하는 반면 `listInvitations` 는 이번
  diff 로 추가된 2건(null 통과 canary + 대조군) 뿐이다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60-103`
    (`describe('listInvitations', ...)`)
  - 상세: 이 diff 의 목적(§5.4 nullable 정정에 대한 canary)에는 충분하지만, 엔드포인트 자체의 기존
    커버리지 공백(에러 시나리오 미검증)은 이번 diff 로 새로 생긴 것은 아니고 이번 diff 가 메운 것도
    아니다. 요구사항 관점에서 이번 변경의 스코프를 벗어나므로 CRITICAL/WARNING 아님.
  - 제안: 필요 시 별도 후속으로 `assertAdmin` 실패 시 `ForbiddenException` 전파 테스트 추가 고려
    (이번 PR 스코프 아님, 참고용).

- **[INFO]** §5.4 의 `field?:` 표기와 `AuthConfigUsageCallDto.sourceIp`(같은 패턴의 선례,
  `@ApiProperty({ nullable: true })` + non-optional `sourceIp: string | null`) 간 형태 불일치를
  소스에서 재확인했다 — `auth-config-response.dto.ts:87-88`.
  - 상세: plan 문서 자체가 이미 이 불일치를 인지하고 "후속(planner 턴)" 항목으로 미해결 상태로
    남겨 뒀다(`entity-nullable-column-type-mismatch.md` 233번째 체크박스, 미체크). 이번 diff 는
    규약 문면을 그대로 따랐으므로(§5.4 "기본") 신규 결함이 아니다. 중복 flag 방지를 위해 새 항목으로
    올리지 않고 참고로만 기록한다.
  - 제안: 없음 — 이미 planner 턴 위임으로 추적 중.

## 뮤테이션/작업트리 위생

- 뮤테이션 대상: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (저장소 트리 내부
  편집 — 재현에 컴파일된 NestJS 모듈 그래프가 필요해 저장소 밖 사본으로는 재현 불가했음).
- 백업 위치: scratch 디렉터리(`.../scratchpad/workspaces.controller.ts.orig`), 원복은 `cp` 로 수행
  (`git checkout`/`restore` 미사용).
- 원복 확인: 원복 후 `diff` 로 바이트 동일 확인 + `git status --short` 로 잔여 변경 없음(untracked 는
  이 리뷰 산출물 디렉터리뿐) + `npx jest workspaces.controller.spec.ts` 재실행으로 14/14 GREEN 재확인.
  원복 실패나 잔여물 없음.

## 요약

`WorkspaceInvitationDto.invitedBy` 를 `@ApiProperty({ format: 'uuid' })` non-null 에서
`@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `invitedBy?: string | null` 로 바꾼 변경은
DB 스키마(V017 `ON DELETE SET NULL`)·엔티티·핸들러 통과 동작·FE 계약·API 규약 §5.4 표기 전부와
line-level 로 정확히 일치한다. 새로 추가된 두 canary 테스트(null 통과 / 대조군)는 실제 뮤테이션으로
재현해 plan 이 적은 실측치(`1 failed, 13 passed`)와 정확히 일치함을 확인했다. TODO/FIXME 류 미완성
표식 없음, 반환값 누락 없음(빈 배열·null 모두 코어션 없이 그대로 전달), 에러 시나리오는 이 변경의
스코프 밖(선재 공백)이라 이번 diff 의 결함이 아니다. Critical/Warning 급 발견사항 없음 — 전부 INFO.

## 위험도

NONE

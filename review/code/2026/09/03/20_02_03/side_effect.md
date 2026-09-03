# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `WorkspaceInvitationDto.invitedBy` 의 공개 OpenAPI 계약 변경 (required non-null → optional nullable)
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:109-110`
  - 상세: `@ApiProperty({ format: 'uuid' })` / `invitedBy: string` 이 `@ApiPropertyOptional({ format: 'uuid', nullable: true })` / `invitedBy?: string | null` 로 바뀌어 생성되는 OpenAPI 스키마의 `required` 목록에서 `invitedBy` 가 빠지고 `nullable: true` 가 추가된다. 이는 `WorkspacesController.listInvitations`(`workspaces.controller.ts:402`) 한 곳에서만 참조되는 응답 DTO(`grep` 로 전수 확인)이고, 핸들러 자체는 이번 diff 로 바뀌지 않아 **실제 wire 응답 바이트는 변경 없음** — 이전부터 초대자 계정이 삭제되면 `null` 이 실려 나가고 있었고 이번 변경은 그 사실을 스키마에 반영한 것뿐이다. 프런트엔드도 `codebase/frontend/src/lib/api/workspaces.ts:154` 에서 이미 `invitedBy: string | null` 로 손으로 타입을 선언해 두고 있어 이 레포 내 소비자는 영향이 없다. 레포 안에 OpenAPI JSON/코드젠 산출물(`openapi.json` 등)이나 codegen 파이프라인은 검색 결과 존재하지 않아, 이 레포 범위에서는 실질적 파급이 없다.
  - 제안: 조치 불요. 다만 이 엔드포인트를 소비하는 **레포 밖** 클라이언트(수동 작성 SDK 등)가 있다면 `required` 해제·`nullable` 추가가 해당 클라이언트의 정적 타입 가정을 깰 수 있다는 점만 인지해 두면 된다.

- **[INFO]** 리뷰 중 대상 파일에 미커밋 뮤테이션이 일시 관측됨 (원인: 나 아님, 이미 자체 원복됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:402` (handler: `listInvitations`)
  - 상세: 이 리뷰 진행 중 `git status --short` 로 확인한 첫 스냅샷에서 해당 파일이 `M`(modified) 상태였고, `git diff` 결과 `invitedBy: i.invitedBy` → `invitedBy: i.invitedBy ?? ''` 로 바뀌어 있었다 — 이는 plan(`plan/in-progress/entity-nullable-column-type-mismatch.md`)이 캐너리 테스트의 유효성을 검증하려고 기술한 바로 그 뮤테이션(`?? ''` 삽입 → null 테스트만 RED)과 정확히 일치한다. 잠시 후 재확인하니 파일은 원본으로 복원돼 있었고 `git status --short` 도 클린했다 — 즉 동시에 워킹트리를 쓰는 다른 프로세스(개발자 본인의 뮤테이션 검증 또는 병렬 reviewer)가 만들었다가 스스로 되돌린 것으로 보인다. **나는 이 파일을 쓰거나 되돌리지 않았다** — 관찰만 했다.
  - 제안: 조치 불요(이미 해소됨). 다만 프롬프트 규약이 요구하는 "관측한 이상 상태는 보고" 원칙에 따라 투명성 목적으로 기록한다. 최종 push 직전에 `git status --short` 로 재확인해 잔여 뮤테이션이 없는지 한 번 더 보는 것을 권한다.

- **[INFO]** 테스트 파일(`workspaces.controller.spec.ts`)의 변경은 순수 추가(additive)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:16, 57-58, 60-103`
  - 상세: `let invitations` 선언·`module.get(WorkspaceInvitationsService)` 대입·`describe('listInvitations', ...)` 블록 2건(뮤테이션 대상 케이스 + 대조군) 추가뿐이다. `WorkspaceInvitationsService` provider 는 이 diff 이전부터 테스트 모듈에 이미 등록돼 있었고(`useValue` mock, `listPending` 포함), 각 테스트는 `beforeEach` 가 매번 새 `TestingModule` 을 컴파일하므로 테스트 간 mock 상태 누수는 없다. 기존 `describe` 블록(update/remove/leave/transferOwnership)의 동작·시그니처는 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 문서 전용
  - 위치: 파일 전체 (frontmatter 변경 없음, 본문 체크박스·서술만 갱신)
  - 상세: 코드/설정/환경변수/네트워크 호출에 영향을 주는 변경 없음. side effect 관점에서 검토 대상 아님.

## 요약

핵심 변경은 `WorkspaceInvitationDto.invitedBy` 의 Swagger 계약을 실제 런타임 동작(초대자 계정 삭제 시 `null`)에 맞춰 `required uuid` → `optional nullable uuid` 로 정정한 것이다. 핸들러 로직 자체는 이번 diff 로 변하지 않았고, 이 DTO 의 유일한 소비처(`listInvitations`)와 프런트엔드 타입이 이미 nullable 을 전제하고 있어 기능적 side effect 는 없다. 테스트 변경은 순수 추가이며 기존 테스트 스위트에 상태 누수나 시그니처 영향을 주지 않는다. 리뷰 도중 대상 컨트롤러 파일에 plan 이 언급한 뮤테이션 검증과 정확히 일치하는 미커밋 변경이 순간적으로 관측됐으나 내가 만든 것이 아니고 재확인 시점에 이미 원복돼 있었다 — 투명성 목적으로만 기록한다. 전역 상태·환경 변수·파일시스템·네트워크 호출·이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW

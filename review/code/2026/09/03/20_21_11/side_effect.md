# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `WorkspaceInvitationDto.invitedBy` 공개 OpenAPI 계약 변경 (required non-null → optional nullable)
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
    (`@ApiProperty({ format: 'uuid' })` + `invitedBy: string` → `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `invitedBy?: string | null`)
  - 상세: 생성되는 OpenAPI 스키마에서 `invitedBy` 가 `required` 목록에서 빠지고 `nullable: true` 가 붙는다 — 이것이 이 diff 의 유일한 실질 "인터페이스 변경"(점검 관점 5)이다. `codebase/backend/src/modules/workspaces/workspaces.controller.ts:396-404` 의 `listInvitations` 핸들러 자체는 이번 diff 로 바뀌지 않았고(`git log` 로 확인 — 최근 수정 커밋이 이번 변경 이전임), `invitedBy: i.invitedBy` 를 코어션 없이 그대로 통과시키는 동작은 diff 이전부터 동일했다. 즉 **wire 응답 바이트는 변경 없음** — 타입/문서만 실제 런타임과 맞춘 widening 이라 이 레포 내 소비자(단일 호출부 `listInvitations`, FE `codebase/frontend/src/lib/api/workspaces.ts:154` 가 이미 `string | null` 로 선언)에는 영향이 없다. 레포 밖에서 이 OpenAPI 스펙으로 타입을 생성하는 클라이언트(SDK 등)가 있다면 `invitedBy` 타입이 `string` → `string | null | undefined` 로 넓어지는 것을 인지해야 한다.
  - 제안: 조치 불요(widening, 비파괴). 레포 밖 codegen 소비자가 있다면 그쪽에 계약 변경만 인지시킬 것.

- **[INFO]** 컨트롤러 실행 경로 자체는 이 diff 의 변경 범위 밖 — 상태/전역/네트워크/환경변수 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:396-404` (diff 에 포함되지 않음, 참조만)
  - 상세: 이번 review 대상 diff(파일 1~4: CHANGELOG.md·workspace-response.dto.ts·workspaces.controller.spec.ts·plan 문서)는 타입 선언·Swagger 데코레이터·테스트·문서만 건드리고, 런타임에 실행되는 컨트롤러/서비스 로직은 한 줄도 바뀌지 않았다. 전역 변수 도입/수정, 파일시스템 쓰기, 환경 변수 읽기/쓰기, 외부 네트워크 호출, 이벤트/콜백 발생 방식 변경 — 모두 해당 없음.
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일 변경은 순수 추가(additive), 기존 스위트에 부작용 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:16, 57-58, 60-104`
  - 상세: `let invitations: jest.Mocked<WorkspaceInvitationsService>;` 선언과 `module.get(WorkspaceInvitationsService)` 대입, `describe('listInvitations', ...)` 블록(케이스 2건) 추가뿐이다. `WorkspaceInvitationsService` provider(`listPending` 등 mock)는 이 diff 이전부터 테스트 모듈에 이미 등록돼 있었다(diff 의 `+`/`-` 표시 없는 문맥 줄로 확인) — 새로 도입된 mock 이 아니라 기존 provider 를 변수로 캡처한 것뿐이다. `beforeEach` 가 매 테스트마다 새 `TestingModule` 을 컴파일하므로 테스트 간 mock 상태 누수는 없고, 기존 5개 `describe`(update/remove/leave/transferOwnership 등)의 동작·시그니처는 변경되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** CHANGELOG.md·plan 문서 변경은 문서 전용
  - 위치: `CHANGELOG.md`(신규 `## Unreleased` 항목), `plan/in-progress/entity-nullable-column-type-mismatch.md`(체크박스·서술 갱신, frontmatter 의 `spec_impact` 리스트 자체는 이번 diff 로 변경되지 않음)
  - 상세: 코드/설정/환경변수/네트워크 호출에 영향을 주는 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** 이번 커밋이 이전 리뷰 세션(`20_02_03`)의 전체 산출물(RESOLUTION.md·SUMMARY.md·12개 reviewer .md·meta.json·_retry_state.json, 파일 5~17)을 신규 파일로 저장소에 커밋한다
  - 위치: `review/code/2026/09/03/20_02_03/*`
  - 상세: `review/` 는 gitignore 대상이 아니며 리뷰 산출물 보존은 프로젝트 관례(CLAUDE.md)다. "예상치 못한 파일시스템 부작용"(점검 관점 3)에 해당하는 은폐성 변경이 아니라, 정상적인 리뷰 이력 커밋이다. 이 세션(`20_02_03`)의 `side_effect.md`(파일 15)는 이미 컨트롤러 파일에서 캐너리 유효성 검증용 임시 뮤테이션(`?? ''`)이 일시 관측됐다가 자체 원복됐음을 투명하게 기록해 두었고, `RESOLUTION.md` INFO#5 도 같은 사실을 재확인한다. 현재 워킹트리는 `git status --short` 로 clean 함을 재확인했다(이번 세션 산출물 디렉터리만 untracked) — 잔여 뮤테이션 없음.
  - 제안: 조치 불요. 정보 제공 목적으로만 기록.

## 요약

이번 diff 의 실질적 side effect 는 `WorkspaceInvitationDto.invitedBy` 의 OpenAPI 계약을 required/non-null 에서 optional/nullable 로 widening 하는 것 하나뿐이다. 이는 비파괴적 문서/타입 정정이며, 실제 응답을 만드는 `listInvitations` 핸들러 로직은 이번 diff 로 변경되지 않았고 wire 응답 바이트도 그대로다. 나머지 변경(테스트 추가, CHANGELOG, plan 문서, 이전 리뷰 세션 산출물 커밋)은 전부 문서/테스트 전용이며 전역 상태·환경 변수·파일시스템·네트워크 호출·이벤트/콜백에 영향을 주지 않는다. 저장소 워킹트리는 clean 상태로 확인했다(뮤테이션 검증 불필요 — 코드 자체가 변경되지 않아 재현할 대상이 없었음).

## 위험도

LOW

# 보안(Security) 코드 리뷰

## 리뷰 대상

- `CHANGELOG.md` — `WorkspaceInvitationDto.invitedBy` nullable 정정 항목 추가 (문서)
- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceInvitationDto.invitedBy` 를 `@ApiProperty({ format: 'uuid' })`(필수) 에서 `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `string | null` 로 정정
- `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts` — `listInvitations` 캐너리 테스트 2건 추가 (null 통과 케이스 + 대조군)
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 위 변경의 조사·근거 기록 (문서, 실행 코드 아님)
- `review/code/2026/09/03/20_02_03/*` (RESOLUTION.md, SUMMARY.md, _retry_state.json, meta.json, api_contract.md, documentation.md, maintainability.md, requirement.md, scope.md, security.md, side_effect.md, testing.md, user_guide_sync.md) — 직전 리뷰 라운드 산출물이 신규 커밋 파일로 추가된 것. 전부 텍스트 리포트이며 실행 코드 경로 없음

## 발견사항

- **[INFO]** `invitedBy` 엔드포인트(`GET /api/workspaces/:id/invitations`)의 서버측 인가가 실제로 강제되는지 직접 확인함 — 문서 주석뿐 아니라 실측
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `listInvitations` 핸들러(`@Get(':id/invitations')`), 실 인가는 `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` `listPending()` 내부 `await this.assertAdmin(workspaceId, requesterId);`
  - 상세: 컨트롤러의 `@ApiForbiddenResponse({ description: '초대 조회 권한 부족 (Admin+)' })` 는 Swagger 문서 주석일 뿐이라 그 자체로는 인가를 보장하지 않는다. 실제 인가 강제 지점을 서비스 레이어에서 직접 확인했고(`listPending` → `assertAdmin`), 이번 diff 는 이 경로를 전혀 건드리지 않는다(diff 범위 밖). `invitedBy` 필드는 UUID 형태의 사용자 식별자를 노출하지만 이는 이번 변경 이전부터 동일하게 응답에 포함되던 값이며, 이번 diff 는 타입/Swagger 문서를 실제 런타임 nullable 동작에 맞추는 정정일 뿐 새로운 데이터 노출 경로나 인가 우회를 만들지 않는다.
  - 제안: 조치 불요.

- **[INFO]** DTO 변경은 인젝션·시크릿·암호화·에러 노출 관점 전부 해당 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true }) invitedBy?: string | null;` 은 사용자 입력을 새로 받거나 가공하지 않는 순수 응답 스키마/타입 정정이다. SQL/커맨드/경로 인젝션, LDAP 인젝션, XSS 벡터, 하드코딩된 시크릿·자격증명, 안전하지 않은 해시/암호화 알고리즘, 평문 전송, 에러 메시지의 민감정보 노출 어느 것도 해당하지 않는다. 신규 테스트(`workspaces.controller.spec.ts`)도 mock 기반 단위 테스트로 동일하게 해당 없음.
  - 제안: 조치 불요.

- **[INFO]** `plan/*.md` 및 `review/code/2026/09/03/20_02_03/*` 산출물은 조사/리뷰 기록 문서로 실행 경로가 아님 — 하드코딩 시크릿 여부 grep 으로 확인
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md`, `review/code/2026/09/03/20_02_03/*`
  - 상세: 두 문서군 다 SQL(`ON DELETE SET NULL`, `information_schema` 조회 등)이나 코드 인용을 포함하지만 전부 조사 절차·이전 리뷰 결과에 대한 서술이며 실행 가능한 인젝션 벡터나 리터럴 시크릿을 포함하지 않는다. `password|secret|api[_-]?key|token|bearer|private[_-]?key|BEGIN (RSA|PRIVATE)` 패턴으로 diff 전체(코드 파일 4개)를 grep 했고, 매치된 유일한 줄은 plan 문서 안의 `RefreshToken.familyId`(엔티티 필드명 언급)로 실제 시크릿이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 시작 시점 `git status --short` 확인 — 워킹트리 깨끗함, 뮤테이션 잔여물 없음
  - 위치: 저장소 루트
  - 상세: 리뷰 시작 시 유일한 미추적 항목은 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/03/20_21_11/`)뿐이었다. 직전 라운드(`20_02_03`)의 side_effect 리포트가 언급한 일시적 뮤테이션(`workspaces.controller.ts:402` 의 `?? ''`)은 이미 원복되어 있었고 이번 라운드에서는 재관측되지 않았다.
  - 제안: 조치 불요.

## 요약

이번 변경의 핵심은 `WorkspaceInvitationDto.invitedBy` 의 Swagger/TS 타입을 실제 런타임 동작(초대자 계정이 FK `ON DELETE SET NULL`(V017)로 삭제되면 `null`이 응답에 실림)에 맞춰 `required uuid` → `optional nullable uuid` 로 정정한 것이며, 그 통과 동작을 고정하는 컨트롤러 캐너리 테스트 2건과 plan/CHANGELOG 문서 갱신이 동반된다. 새로운 사용자 입력 처리 경로, 인증/인가 로직 변경, 암호화/해시 사용, 하드코딩된 시크릿이 없다. 해당 엔드포인트의 서버측 인가(Admin+, `assertAdmin`)는 서비스 레이어에서 실제로 강제되고 있음을 직접 확인했으며 이번 diff 범위 밖에서 변경되지 않았다. 함께 커밋된 `review/code/2026/09/03/20_02_03/*` 산출물은 직전 라운드의 리뷰 결과 텍스트일 뿐 실행 코드가 아니며 별도의 보안 이슈를 담고 있지 않다. 보안 관점에서 우려할 사항이 없다.

## 위험도

NONE

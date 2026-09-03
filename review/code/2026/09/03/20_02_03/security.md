# 보안(Security) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` — `WorkspaceInvitationDto.invitedBy` 를 `@ApiProperty({ format: 'uuid' })` (필수) 에서 `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `string | null` 로 정정
- `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts` — 위 동작(코어션 없이 `null` 통과)을 고정하는 캐너리 테스트 2건 추가
- `plan/in-progress/entity-nullable-column-type-mismatch.md` — 위 변경의 근거·조사 기록 (문서, 실행 코드 아님)

## 발견사항

- **[INFO]** `invitedBy` 는 초대를 발급한 사용자의 UUID를 노출하며, 대상 엔드포인트(`GET /workspaces/:id/invitations`)는 Admin+ 권한 가드가 걸려 있어(변경 범위 밖, `workspaces.controller.ts:378-388` 확인) 이번 diff 로 신규 정보 노출이 생기지 않는다. nullability 를 정확히 문서화한 것은 오히려 계약 정확성을 높이는 방향이며 별도 조치 불요.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (diff 범위 밖, 컨텍스트 확인용)
  - 상세: 이 변경 자체는 `WorkspaceInvitationDto` 타입/Swagger 문서를 실제 런타임 값(초대자 계정이 `ON DELETE SET NULL`로 삭제되면 `invitedBy`가 `null`)에 맞게 정정한 것으로, 새로운 데이터 흐름이나 권한 경로를 추가하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** 신규 테스트(`workspaces.controller.spec.ts`)는 mock 기반 단위 테스트로 시크릿·자격증명 하드코딩, 인젝션 벡터, 안전하지 않은 암호화 사용이 없다. Swagger DTO 변경은 SQL/커맨드/경로 인젝션, 인증/인가, 해시/암호화, 에러 메시지 노출과 무관한 순수 타입·문서 정정이다.
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `invitedBy?: string | null` 은 응답 스키마를 실제 동작에 맞추는 문서/타입 정정이며 인젝션이나 인증 우회로 이어지는 신규 입력 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/entity-nullable-column-type-mismatch.md`는 조사 기록 문서로, 코드 실행 경로가 아니므로 보안 관점 검토 대상 밖이다. 문서 내 SQL(`ON DELETE SET NULL`, `information_schema` 쿼리 등)은 전부 조사 재현 절차 설명이며 리터럴 시크릿이나 실행 가능한 인젝션 벡터를 포함하지 않는다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md`
  - 상세: 문서 전용 변경.
  - 제안: 조치 불요.

## 요약

이번 변경은 `WorkspaceInvitationDto.invitedBy` 필드의 Swagger 문서/TS 타입을 실제 런타임 nullable 동작(초대자 계정이 `ON DELETE SET NULL`로 삭제되면 `null`)에 맞게 정정한 것과, 그 통과 동작을 고정하는 캐너리 단위 테스트, 그리고 해당 작업의 조사 기록 plan 문서로 구성된다. 새로운 사용자 입력 처리 경로, 인증/인가 로직 변경, 암호화/해시 사용, 하드코딩된 시크릿이 없으며, 노출되는 `invitedBy` UUID는 기존에도 동일하게 응답에 포함되던 값으로 접근 대상 엔드포인트의 Admin+ 권한 가드 역시 이번 diff 범위 밖에서 변경 없이 유지된다. 보안 관점에서 우려할 사항이 없다.

## 위험도

NONE

# API 계약(API Contract) 리뷰

## 개요

이번 변경은 TypeORM 엔티티 8개의 `nullable: true` 컬럼 TS 타입을 `| null` 로 넓히는
작업(`plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3, "잔여 전량")과
`folders.controller.ts` 의 불필요한 `as Partial<Folder>` 캐스트 제거, 관련 테스트/ratchet
baseline 갱신으로 구성된다. 컨트롤러 라우트·DTO 자체의 구조적 변경은 없다.

엔티티가 컨트롤러에서 그대로(별도 DTO 매핑/`ClassSerializerInterceptor` 없이) 반환되는
패턴을 확인했으므로, 엔티티 nullable 타입과 Swagger 응답 DTO(`@ApiProperty`) 선언의
정합 여부를 각 파일별로 대조했다.

## 발견사항

- **[WARNING]** `AuthConfigDto.ipWhitelist` 가 non-nullable(`string[]`, `@ApiProperty({ type: [String] })`)로
  선언돼 있는데, 이번 변경으로 `AuthConfig.ipWhitelist` 엔티티 타입이 `string[] | null` 로
  공식화됐고 서비스 로직(`ac.ipWhitelist?.length`, `verifyWebhookRequest`)도 이미 `null` 을
  실제로 다루고 있다. `AuthConfigsController` 는 `AuthConfigsService.findAll/findById` 가
  반환하는 엔티티를 별도 DTO 매핑 없이 그대로 응답 바디로 내보내므로(`ClassSerializerInterceptor`
  등 변환 계층 부재 확인), `GET /auth-configs`·`GET /auth-configs/:id` 응답의 `ipWhitelist` 필드가
  실제로 `null` 일 수 있다. Swagger 문서를 신뢰해 `ipWhitelist.length`/배열 메서드를 무가드로
  호출하는 클라이언트는 런타임 예외를 만날 수 있다.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` (`ipWhitelist` 필드, `nullable`/`?` 미표기) ↔ `codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts:43`(diff 게이트 기준, `ipWhitelist: string[] | null`)
  - 상세: 이 drift 는 이번 PR 이 새로 만든 것이 아니다 — DB/런타임은 이전부터 `null` 을 낼 수
    있었고 엔티티 타입만 거짓말하고 있었다. 이번 변경은 그 사실을 타입 레벨에서 정직하게
    드러냈을 뿐이며, PR 이 첨부한 `plan/in-progress/entity-nullable-column-type-mismatch.md`
    §"새로 드러난 축 — 응답 DTO 가 nullable 필드를 non-null 로 문서화한다" 항목에서 developer
    스스로 이 정확한 케이스(`AuthConfigDto.ipWhitelist`)를 실측·기재하고 "이 PR 에서 고치지
    않았다"고 명시적으로 스코프 아웃했다(이유: `tsc` 가 강제하지 않는 다른 계층·OpenAPI 는
    외부 계약·"한 자리만 고치는 것은 안티패턴"). 같은 문서가 유사 필드 전반에 대해 개략
    49건(12파일)이 있을 수 있다고 덧붙였다(단, 필드명 매칭이라 정확한 수는 미확정).
  - 제안: 이 PR 범위에서 고치라는 뜻은 아니다(developer 의 스코프 판단은 합리적). 다만
    API 계약 관점에서는 **살아있는 결함**이므로, 이미 plan 에 걸린 후속 트랙(§새로 드러난 축)이
    실제로 별도 작업 항목으로 승격되는지 추적 확인이 필요하다. 최소한 `AuthConfigDto.ipWhitelist`
    한 필드만이라도 `@ApiPropertyOptional({ type: [String], nullable: true })` + `ipWhitelist?: string[] | null`
    로 정정하면(같은 DTO 안의 `lastUsedAt` 과 동일 패턴) 이 특정 클라이언트 위험은 즉시 해소된다.

- **[INFO]** `/api/auth/*` 액션 네임스페이스가 `spec/5-system/2-api-convention.md §2.2` 의
  명명 규칙(명시된 두 예외: RPC-style `{id}` 필수 / `/api/external/*`)에 포섭되지 않는다는
  선재(pre-existing) gap 이 이번 diff 에 포함된 plan 문서에서 재확인됐다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` §"할 일" — "후속(planner 턴, 이 작업과 무관) — `2-api-convention.md §2.2` 에 `/api/auth/*` 액션 네임스페이스 예외 조항"
  - 상세: 이 PR 의 코드 변경과는 무관한 선재 gap 이며, developer 자신도 "developer 권한 밖" 으로
    표시하고 planner 턴 후속으로 이관했다. 새로 도입된 문제는 아니다.
  - 제안: API 계약 관점에서 별도 조치는 불필요 — 이미 추적 중인 항목이므로 후속 planner 턴에서
    `2-api-convention.md §2.2` 예외 조항 반영 여부만 확인하면 된다.

- 대조 확인(문제 없음, 참고용): `FolderDto.parentId`(`?: string | null`, `nullable: true`),
  `EdgeDto.condition`(`?: Record<string, unknown> | null`, `nullable: true`),
  `WorkflowVersionDto/ListItemDto.changeSummary`(`?: string | null`, `nullable: true`),
  `AuditLogDto.ipAddress`(`?: string | null`, `nullable: true`) 는 모두 이번에 넓혀진 엔티티
  타입과 **이미 일치**하고 있었다(응답 DTO 가 entity 보다 먼저 정직했던 케이스). `WorkspaceMemberDto`
  는 `joinedAt` 자체를 노출하지 않아 해당 없음. `folders.controller.ts` 의
  `dto as Partial<Folder>` → `dto` 캐스트 제거는 `Folder.parentId` 가 `string | null` 로
  넓혀지면서 `UpdateFolderDto.parentId?: string | null` 과 구조적으로 일치해 캐스트가
  불필요해진 것으로, `foldersService.update` 의 실제 동작·요청 검증에는 변화가 없다.

## 요약

이번 변경은 TypeORM 엔티티의 nullable 컬럼 TS 타입을 DB 실제 스키마와 일치시키는 타입
정합화 작업으로, 라우트·인증/인가·페이지네이션·에러 응답 형식·버전 관리에는 영향이 없고
클라이언트가 관측하는 실제 런타임 응답 바디도 바뀌지 않는다(엔티티가 컨트롤러에서 그대로
반환되므로 `null` 이 나갈 수 있었던 필드는 이 PR 이전에도 `null` 이 나갈 수 있었다). 다만
이 작업 과정에서 발견된 `AuthConfigDto.ipWhitelist` 의 Swagger 스키마-실데이터 불일치는
API 계약 관점에서 실재하는 결함이며, PR 저자가 스스로 문서화하고 의도적으로 스코프 아웃했다.
새로 도입된 breaking change 는 없다.

## 위험도

LOW

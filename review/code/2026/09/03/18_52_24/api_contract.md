# API 계약(API Contract) 리뷰

## 개요

이번 변경은 `plan/in-progress/entity-nullable-column-type-mismatch.md` 배치 3 — TypeORM
엔티티 7개(`AuditLog.ipAddress`, `AuthConfig.ipWhitelist`/`lastUsedAt`, `Edge.condition`,
`Folder.parentId`/`parent`, `WorkflowVersion.changeSummary`, `WorkspaceMember.joinedAt`)의
TS 타입을 실제 DB nullable 컬럼과 일치시키는 순수 타입 정합화이며, 여기에 딸린
`folders.controller.ts` 의 불필요한 `dto as Partial<Folder>` 캐스트 제거, 두 spec 파일의
낡은 `null as unknown as T` 캐스트 제거, ratchet baseline 갱신으로 구성된다. 라우트·인증
가드·페이지네이션·버전 관리는 이 diff 가 건드리는 표면이 아니다.

핵심은 `AuthConfigDto.ipWhitelist` 하나다 — 엔티티가 컨트롤러에서 별도 매핑 없이 그대로
반환되므로(`AuthConfigsController.findAll/findOne` → `AuthConfigsService` → entity 직결,
`ClassSerializerInterceptor` 등 변환 계층 부재를 직접 확인) 엔티티 nullable 타입 변경이
Swagger 계약에 직결된다. 나머지 6개 엔티티의 대응 응답 DTO(`FolderDto.parentId`,
`EdgeDto.condition`, `WorkflowVersionDto/ListItemDto.changeSummary`, `AuditLogDto.ipAddress`)
는 실제 소스를 열어 대조한 결과 이미 `?: T | null` + `nullable: true` 로 정확히 문서화돼
있어 이번 diff 로 인한 새 drift가 없다.

## 발견사항

- **[INFO]** `AuthConfigDto.ipWhitelist` 의 API 계약(Swagger) 오류가 이번 diff 에서 정정됨 —
  정정 형태가 규약에 부합함을 재확인.
  - 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts:27-28`
  - 상세: 종전엔 `@ApiProperty({ type: [String], example: [] }) ipWhitelist: string[];` (필수·
    non-null)로 문서화돼 있었는데, 실제로는 DB·엔티티·서비스(`ac.ipWhitelist?.length`)가
    이미 `null` 을 다루고 있어 `GET /auth-configs`, `GET /auth-configs/:id` 응답에 스키마와
    다르게 `null` 이 실려 나갈 수 있었다(직전 리뷰 라운드 `review/code/2026/09/03/18_30_53/api_contract.md`
    W1 에서 지적된 항목). 이번 diff 는 이를 `@ApiPropertyOptional({ type: [String], nullable: true,
    example: [] }) ipWhitelist?: string[] | null;` 로 정정했다. `spec/5-system/2-api-convention.md
    §5.4`("`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`")
    형태를 그대로 따르고 있고, 같은 DTO 의 `lastUsedAt?: string | null` 과도 형태가 일치한다.
    엔티티(`AuthConfig.ipWhitelist: string[] | null`, 이 diff 파일 4)·DB(`ip_whitelist TEXT[]`,
    nullable)와도 지금 정합한다.
  - 제안: 없음 — 정정이 정확하다. 다만 OpenAPI 로 타입을 생성하는 외부 클라이언트 입장에서는
    이 필드가 `string[]` → `string[] | null | undefined` 로 스키마가 넓어지므로, CHANGELOG
    항목(이 diff 파일 1)이 이미 그 영향을 명시한 것은 적절하다.

- **[INFO]** 같은 축(엔티티 nullable ↔ 응답 DTO 선언 불일치)의 잔여 사례가 plan 문서에
  이미 실측·추적되고 있으며 이번 PR 범위 밖으로 명시적으로 defer 됨.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` §"새로 드러난 축" (diff
    게이트 251~263행)
  - 상세: 엔티티 nullable 필드명 122종 대비 응답 DTO 가 non-null 로 선언한 자리가 개략
    49건(12파일)이라고 plan 이 스스로 적어 뒀다(필드 *이름* 매칭이라 서로 다른 엔티티의 동명
    필드가 섞여 있어 정확한 수는 미확정이라는 단서도 함께). API 계약 관점에서는 잠재적으로
    같은 클래스의 결함이 더 있을 수 있다는 뜻이지만, 이 PR 이 새로 만든 것이 아니고 후속
    귀속 작업(이름 중복 해소 선행) 없이는 항목화할 수 없다는 판단도 합리적이다.
  - 제안: 이 PR 을 막을 사유 아님. 후속 트랙이 실제 작업 항목으로 승격되는지만 추적.

- **[INFO]** `/api/auth/*` 액션 네임스페이스가 `spec/5-system/2-api-convention.md §2.2` 명명
  규칙(RPC-style `{id}` 필수 / `/api/external/*` 예외)에 포섭되지 않는 선재 gap 이 plan
  문서에서 재확인됨 — 이 diff 코드와 무관, 이미 planner 턴 후속으로 이관돼 있음.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` §"할 일"
  - 제안: 별도 조치 불요.

- 대조 확인(문제 없음): `folders.controller.ts` 의 `dto as Partial<Folder>` → `dto` 캐스트
  제거(+ 유휴 `Folder` import 제거, 게이트 35·114행)는 `Folder.parentId`/`parent` 가
  `| null` 로 넓혀지면서 `UpdateFolderDto.parentId?: string | null` 과 구조적으로 이미 일치해
  캐스트가 불필요해진 것이다. `UpdateFolderDto` 를 직접 열어 확인한 결과 `@IsOptional()` +
  `@IsUUID()` + `null`→변환 `@Transform` 이 그대로 유지돼 있어 요청 검증(§5)에 변화가 없다.
  전역 `ValidationPipe({ whitelist: true })` 도 그대로다. 인증/인가 데코레이터(`@Roles('editor')`,
  `@ApiBearerAuth`)·페이지네이션(`AuthConfigsController.findAll` 의 `ApiOkPaginatedResponse`)·
  URL 경로·HTTP 상태 코드·에러 응답 데코레이터(`@ApiBadRequestResponse` 등) 어느 것도 이
  diff 로 바뀌지 않았다.

## 요약

이번 diff 는 TypeORM 엔티티의 nullable 컬럼 TS 타입을 DB 실제 스키마와 일치시키는 타입
정합화 작업이며, 라우트·인증/인가·페이지네이션·에러 응답 형식·버전 관리에는 영향이 없다.
유일하게 API 계약 표면(Swagger/OpenAPI)에 실질적으로 닿는 지점은 `AuthConfigDto.ipWhitelist`
인데, 이번 diff 는 그 필드를 **직전 리뷰 라운드에서 WARNING 으로 지적된 상태(non-nullable
로 거짓 문서화)에서 규약(§5.4)에 맞는 정확한 상태(nullable+optional)로 정정**했다 —
실제 데이터는 이전부터 `null` 일 수 있었으므로 wire 상 새 breaking change 는 아니고, 스키마를
사실과 맞춘 것이다. 다른 6개 엔티티의 대응 응답 DTO 는 소스를 직접 열어 대조한 결과 이미
정확히 nullable 로 문서화돼 있어 새로 발생한 drift 가 없다. 요청 검증·인증/인가·URL 설계는
불변이며, 남은 유사 drift(약 49건, 12파일)는 plan 문서에 실측·추적되고 있는 별개 축으로
이 PR 을 막을 사유가 아니다.

## 위험도

LOW

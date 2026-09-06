# API 계약(API Contract) 리뷰

## 개요

이번 diff 는 감사 로그 유출(#1288) 이후 `User` 엔티티 컬럼 노출을 막는 검출 인프라(구조 축
`user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`)를 신설하고, 그 과정에서
발견·수정된 실제 유출(`WorkflowVersionsService.findOne` 이 `creator` 관계를 투영 없이 로드해
`GET /api/workflows/:wfId/versions/:versionId` 가 `User` 전 컬럼을 내보내던 것)을 닫은 다음, 그
투영 리터럴을 `CREATOR_PROJECTION` 단일 상수로 통합한 결과다. 나머지 대다수 파일(가드·fixture·
plan 문서·CHANGELOG·`review/code/**`·`review/consistency/**` 산출물)은 테스트 인프라 또는 과거
리뷰 라운드의 기록물이며 wire 표면을 바꾸지 않는다. API 계약 관점에서 실제로 건드리는 표면은
다음 세 가지다.

1. `WorkflowVersionsService.findOne`/`findByWorkflow` 의 `creator` TypeORM 투영을
   `CREATOR_PROJECTION`(`id`/`name`/`email`) 단일 상수로 통합 — `GET
   /api/workflows/:wfId/versions/:versionId` 응답의 `creator` 필드셋 자체는 그대로(3필드)이고,
   이전에 이미 닫힌 유출(전체 `User` 컬럼 노출)이 재발하지 않도록 SoT 를 하나로 좁힌 리팩터.
2. `WorkspaceMemberDto` 에 `joinedAt: string | null` 필드 추가.
3. `GET /api/workflows/:wfId/versions/:versionId` / `GET /api/workspaces/:id/members` 의 응답
   형태를 처음으로 무는 e2e 신설(계약 대조 + 이름 기반 부재 단언).

## 발견사항

- **[INFO]** `CREATOR_PROJECTION` 통합은 응답 계약을 실제로 강화한다 — breaking change 아님
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:35-39`
    (`CREATOR_PROJECTION` 선언), `:85`(`findByWorkflow` 사용), `:112`(`findOne` 사용)
  - 상세: 두 조회 메서드가 손으로 복제하던 `{ id: true, name: true, email: true }` 리터럴을
    단일 상수로 묶었다. 필드셋 자체(`id`/`name`/`email`)는 변경 전과 동일해 기존 정상 클라이언트
    입장에서는 wire 형태 변화가 없다 — 유일한 실질 변화는 과거 `findOne` 이 갖고 있던 버그(투영
    없이 `User` 전 컬럼을 실어 `passwordHash`/`twoFactorSecret`/복구 코드/토큰까지 유출)를 이번
    브랜치의 선행 커밋이 이미 닫았고, 이번 통합은 그 닫힌 상태를 유지하도록 SoT 를 하나로 만든
    것뿐이다. `workflow-versions.service.spec.ts:38-49` 가 `CREATOR_PROJECTION` 의 키 집합을
    `WorkflowVersionCreatorDto` 의 OpenAPI 스키마 프로퍼티와 코드로 대조해, 앞으로 둘 중 하나만
    바뀌면 테스트가 즉시 걸리게 했다 — 선언(DTO)과 구현(TypeORM select)이 갈라지는 것을 막는
    실질적 계약 강제 장치다. API 계약 관점에서 부정적 영향 없음.
  - 제안: 없음(그대로 진행 가능).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 §5.4 를 지킨 사례 — breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:93`
    (`joinedAt: string | null` 선언), `:88-93`(`@ApiProperty({ format: 'date-time', nullable:
    true, type: String })` JSDoc)
  - 상세: `WorkspacesService.listMembers`(`codebase/backend/src/modules/workspaces/
    workspaces.service.ts:223`, 이번 diff 밖의 기존 코드)가 이미 `joinedAt: m.joinedAt` 을
    무조건 싣고 있었음을 직접 확인했다 — 즉 이 필드는 이미 wire 에 실려 있었고, 이번 커밋은
    선언을 실제에 맞춘 것이지 응답 동작을 바꾼 것이 아니다. `WorkspaceMember` 를 만드는 자리
    (`workspaces.service.ts:65,184,262`)를 모두 확인한 결과 현재는 전부 `joinedAt: new Date()`
    로 즉시 채워 `null` 이 실제로 나가는 경로는 없지만, DB 컬럼이 nullable 이므로 `@ApiProperty`
    + `nullable:true`(§5.4 "상시 존재" 기본형, 키 생략형이 아님)로 선언한 것은 규약에 정확히
    부합한다. 기존 클라이언트(프런트엔드는 이미 `joinedAt: string | null` 소비 중)에 영향 없음.
  - 제안: 없음.

- **[INFO]** `GET /api/workflows/:wfId/versions/:versionId` 응답 계약 커버리지가
  이번 diff 로 처음 확보됨 — 기존 갭이었음을 확인
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 신규 `it('H. 버전 단건 조회 —
    ...')` (게이트 513) — `assertMatchesContract(detail.body.data, await
    contractForDto(WorkflowVersionDto))` (게이트 561-564) + `expectNoUserSecrets(detail.body)`
    (게이트 559) + `creator` 3필드 양성 단언(게이트 567-571)
  - 상세: 이 엔드포인트는 종전에 응답 형태를 무는 e2e 가 한 건도 없어서, 계약 대조 축·이름
    기반 부재 축 어느 그물도 실제 유출(위 CREATOR_PROJECTION 항목)을 잡지 못했다. 이번
    신설로 세 축(이름 부재·선언 대조·참조 3필드 양성)이 이 엔드포인트에 배선됐다 — API 계약
    커버리지가 실질적으로 개선된 항목이며 감점 요소 없음.
  - 제안: 없음.

- **[INFO]** `GET /api/workspaces/:id/members` 목록 응답이 여전히 `{ data: [...] }` 형태이고
  페이지네이션 메타데이터가 없음 — 이번 diff 가 만든 것은 아닌 기존 동작, 범위 밖
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. GET /:id/members
    ...')` 의 `res.body.data as Array<Record<string, unknown>>` (게이트 627)
  - 상세: 워크스페이스 멤버는 크기가 작고 자연히 유계인 컬렉션이라 페이지네이션 부재 자체는
    부적절하지 않다. 이 저장소에 "비-페이징 고정 컬렉션은 `{data:{items:[...]}}` 로 감싼다"는
    취지의 선례가 과거 auth 목록 엔드포인트 리뷰에 있었던 것으로 기억되나, 이 엔드포인트가 그
    컨벤션과 다르게(`{data:[...]}`) 나가는지는 이번 PR 이 만든 변화가 아니라 기존 상태이므로
    이번 PR 의 결함으로 잡지 않는다. 새로 손댈 일이 생기면 그때 대조할 것.
  - 제안: 조치 불요(이번 범위 밖). 참고용 기록만.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입이 여전히 `Promise<WorkflowVersion>`
  (엔티티 전체 타입)으로, 런타임에 실리는 필드(select 로 좁혀진 부분집합)보다 넓다 — 안전한
  방향의 불일치이며 API 계약 자체를 깨지 않음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:90-93`
    (`async findOne(...): Promise<WorkflowVersion>`)
  - 상세: 컨트롤러는 이 반환값을 가공 없이 그대로 `@ApiOkWrappedResponse(WorkflowVersionDto)`
    로 감싸 응답한다. `select` 로 지정한 필드(`id`/`workflowId`/`version`/`changeSummary`/
    `snapshot`/`createdBy`/`createdAt`/`creator{id,name,email}`)가 실제로 `WorkflowVersionDto`
    선언과 정확히 일치함을 DTO 파일에서 직접 확인했고, 신규 e2e(`assertMatchesContract`)가
    런타임에도 이를 대조한다 — 즉 지금 이 순간 wire 계약은 정확하다. 다만 TS 타입이 `creator:
    User`(비밀 컬럼 포함) 를 여전히 약속하므로, 향후 이 메서드에 `creator.passwordHash` 등을
    참조하는 새 호출자가 추가되면 컴파일은 통과하되 런타임에 `undefined` 를 받는 잠재적 위험이
    남는다. 이번 diff 의 API 계약 자체에는 영향 없다(타입이 넓고 값이 좁은 방향은 유출이 아니라
    누락 쪽 위험).
  - 제안: 우선순위 낮음. 여유가 있으면 반환 타입을 `Omit<WorkflowVersion, 'creator'> & {
    creator: Pick<User, 'id'|'name'|'email'> | null }` 류로 좁혀 컴파일 타임에도 드러나게 하면
    더 안전하다.

- **[INFO]** 신규 e2e(`workspace-rbac` 케이스 J, `workflow-crud` 케이스 H)가 이름 축
  (`expectNoUserSecrets`)을 선언 축(`assertMatchesContract`)보다 먼저 호출하는 설계가
  실측으로 검증됨 — API 계약 커버리지 설계 관점에서 견고
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:631-638`,
    `codebase/backend/test/workflow-crud.e2e-spec.ts:559-571`
  - 상세: 주석에 "선언 대조가 먼저면 그것이 먼저 던져 이름 축이 실행조차 안 된다(실측)"고
    적혀 있고 실제로 순서를 바꿔 확인했다고 기록돼 있다. 두 검증자는 서로 다른 결함 클래스
    (선언 오류 vs 이름 기반 유출)를 잡으므로 한쪽이 다른 쪽을 가리면 회귀 검출력이 준다 —
    findings 아님, 좋은 패턴으로 기록.

- **[INFO]** 요청 검증(파라미터/바디) 변경 없음 — 점검 관점 5 는 이번 diff 에 해당 사항 없음
  - 위치: 해당 없음(요청 DTO/Pipe/Validator 변경 없음, `ParseUUIDPipe` 등 기존 그대로)
  - 상세: 명시적으로 "해당 없음"을 기록한다.

- **[INFO]** 인증/인가·에러 응답 형식·버전 관리·URL/경로 설계 변경 없음
  - 상세: `@ApiBearerAuth`/`WorkspaceId` 데코레이터, `NotFoundException({code, message})` 형태,
    엔드포인트 경로 모두 이번 diff 로 바뀐 것이 없다. 명시적으로 "해당 없음"을 기록한다.

## 요약

이번 diff 는 API 계약 표면을 넓히거나 깨는 변경이 아니다. 실질적으로는 (1) 이전에 이미 발견·
수정된 `User` 전 컬럼 유출(`WorkflowVersionsService.findOne`)의 재발을 막기 위해 투영 리터럴을
`CREATOR_PROJECTION` 단일 상수로 통합하고 DTO 스키마와의 일치를 테스트로 강제했으며, (2) 이미
wire 에 나가고 있던 `WorkspaceMemberDto.joinedAt` 을 §5.4 규약에 맞게 뒤늦게 선언했고, (3)
종전에 응답 형태 검증이 전혀 없던 두 엔드포인트(`GET /api/workflows/:wfId/versions/:versionId`,
`GET /api/workspaces/:id/members`)에 계약 대조 + 이름 기반 부재 단언 e2e 를 신설해 커버리지
갭을 메웠다. 필드 추가는 순수 문서화이고 투영 통합은 필드셋을 그대로 유지하므로 하위 호환성
문제가 없다. 에러 응답 형식, URL/경로 설계, 버전 관리, 요청 검증, 페이지네이션, 인증/인가
표면에는 변경이 없다. Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE

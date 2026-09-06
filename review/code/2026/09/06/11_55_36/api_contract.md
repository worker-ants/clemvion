# API 계약(API Contract) 리뷰

## 개요

대상 diff(`origin/main...HEAD`, 4개 커밋)는 `User` 엔티티 민감 컬럼 노출을 잡는 검출 인프라
(구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`)를 신설한 feat
커밋과, 그 과정에서 리뷰가 지목한 실제 유출·잔여 결함을 닫은 fix 커밋 3개로 구성된다. API 계약
관점에서 wire 표면을 실제로 건드리는 지점은 다음 두 곳뿐이고, 둘 다 이미 최종 상태에서 안전하게
닫혀 있음을 코드를 직접 열어 확인했다.

1. `WorkflowVersionsService.findOne` / `findByWorkflow` — `creator` 관계 투영
   (`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`)
2. `WorkspaceMemberDto.joinedAt` 필드 추가
   (`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`)

나머지(가드·fixture·plan·CHANGELOG·`review/**` 산출물)는 테스트 인프라 또는 문서이며 wire
표면을 바꾸지 않는다.

## 발견사항

- **[INFO]** `GET /api/workflows/:wfId/versions/:versionId` 의 과거 전 컬럼 유출은 최종 상태에서
  선언·투영·타입 3중으로 닫혀 있음을 직접 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `CREATOR_PROJECTION` 상수 선언(파일 상단), `findOne` 의 `select.creator: CREATOR_PROJECTION`
    사용부, `WorkflowVersionDetail`/`ProjectedCreator` 타입; DTO 는
    `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts`
    의 `WorkflowVersionCreatorDto`(id/name/email 3필드)
  - 상세: (a) 런타임 — `findOne` 이 이제 `select: { ..., creator: CREATOR_PROJECTION }` 으로
    `id`/`name`/`email` 만 로드한다(이전엔 `relations: ['creator']` 만 있어 `User` 전 컬럼이
    로드·반환됐다). (b) 선언 — `WorkflowVersionCreatorDto` 가 광고하는 프로퍼티 집합이
    `CREATOR_PROJECTION` 의 키와 정확히 같고(`id`/`name`/`email`), 이 일치를
    `workflow-versions.service.spec.ts` 가 DTO 의 OpenAPI 스키마를 직접 뽑아 코드로 대조해
    강제한다(손으로 적은 두 목록을 맞대는 방식이 아니라서, 한쪽만 늘어나도 잡는다). (c) 타입 —
    `findOne`/`findByWorkflow` 반환 타입이 `WorkflowVersionDetail`/`WorkflowVersionListItem` 로
    좁혀져 `creator: ProjectedCreator`(`Pick<User,'id'|'name'|'email'>`)를 명시하므로, 이전에
    이 리뷰 계열이 지적했던 "타입은 `User` 전체를 약속하고 값은 3필드뿐" 이라는 간극(타입-런타임
    불일치, 컴파일러가 `creator.passwordHash` 참조를 막지 못하는 위험)도 함께 닫혔다. 세 축이
    갈리지 않게 하는 장치(테스트로 강제된 SoT)까지 있어 재발 방지 구조로도 타당하다.
  - 제안: 없음(그대로 진행 가능) — 검증 결과 기록용.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 추가는 §5.4 규약을 지킨 additive 변경 — breaking
  change 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` —
    `WorkspaceMemberDto` 클래스의 `joinedAt: string | null` 필드, `@ApiProperty({ format:
    'date-time', nullable: true, type: String })`
  - 상세: `WorkspacesService.listMembers`(이 diff 밖의 기존 코드, `workspaces.service.ts:223`)가
    이미 `joinedAt: m.joinedAt` 을 무조건 싣고 있음을 직접 확인했다 — 즉 이 필드는 이번 PR
    이전부터 wire 에 나가고 있었고, 이번 변경은 선언을 실제에 맞춘 것뿐이라 기존 클라이언트에
    영향이 없다. `@ApiPropertyOptional`(키 생략형)이 아니라 `@ApiProperty` + `nullable:true`
    (상시 존재 기본형)를 쓴 것도, `WorkspaceMember` 를 만드는 자리들이 전부 `joinedAt: new
    Date()` 로 즉시 채운다는 실측과 일치한다.
  - 제안: 없음.

- **[INFO]** `GET /api/workflows/:wfId/versions/:versionId` / `GET /api/workspaces/:id/members`
  두 엔드포인트에 이번 diff 로 처음 응답 계약 커버리지(선언 대조 + 이름 기반 부재)가 생김
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 신규 `it('H. 버전 단건 조회 …')`,
    `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. GET /:id/members …')`
  - 상세: 두 엔드포인트 모두 종전엔 응답 형태를 무는 e2e가 없어 계약 위반이 발생해도 어느
    그물도 걸리지 않았다(실제로 전자는 걸렸었다). 이번 신설로 `assertMatchesContract`(선언
    대조) + `expectNoUserSecrets`(이름 기반 부재, 선언과 무관하게 중첩까지 훑음) 두 축이
    배선됐고, 두 축이 서로 다른 결함 클래스를 잡으므로(계약 대조가 앞서면 그것이 먼저 던져
    이름 축이 실행조차 안 된다는 점을 실측으로 확인해 순서까지 의도적으로 고정) 감점 요소 없이
    커버리지 개선으로 본다.
  - 제안: 없음.

- **[INFO]** `GET /api/workspaces/:id/members` 목록이 여전히 `{ data: [...] }` 형태이고
  페이지네이션 메타데이터가 없음 — 이번 diff 가 만든 상태가 아닌 기존 동작, 범위 밖
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` 신규 `it('J. …')` 의
    `res.body.data as Array<...>` 사용부
  - 상세: 워크스페이스 멤버는 크기가 자연히 유계인 컬렉션이라 페이지네이션 부재 자체는
    부적절하지 않다. 이 엔드포인트의 응답 봉투 형태(`{data:[...]}` vs 이 저장소의 다른 곳에서
    쓰이는 `{data:{items:[...]}}`)가 컨벤션과 다르게 나가는지는 이번 PR 이 새로 만든 상태가
    아니라 diff 이전부터의 기존 코드(`WorkspacesService.listMembers`/컨트롤러)이므로 이번
    변경의 결함으로 잡지 않는다.
  - 제안: 조치 불요(범위 밖). 참고용 기록만.

- **[INFO]** 요청 검증(파라미터/바디)·에러 응답 형식·버전 관리·URL·인증/인가 표면 — 이번
  diff 에 해당 사항 없음
  - 상세: 컨트롤러(`workflow-versions.controller.ts`, `workspaces.controller.ts`)는 이번 diff
    에서 변경되지 않았다 — `ParseUUIDPipe`, `@ApiBearerAuth`, `@WorkspaceId()` 데코레이터,
    `NotFoundException({code, message})` 에러 형태, 경로 모두 그대로다. 명시적으로 "해당
    없음"을 기록한다.

## 요약

이 diff 는 API 계약 표면을 새로 넓히거나 깨지 않는다. 이전 라운드에서 발견된 실제 계약 위반
(`WorkflowVersionsService.findOne` 이 `creator` 를 투영 없이 로드해 `User` 전 컬럼을 wire 로
내보내던 문제)은 최종 상태에서 런타임 투영(`CREATOR_PROJECTION`)·DTO 선언
(`WorkflowVersionCreatorDto`)·TS 반환 타입(`WorkflowVersionDetail`/`ProjectedCreator`) 세 층이
서로 일치하도록 닫혔고, 그 일치는 스키마 대조 테스트로 강제된다. `WorkspaceMemberDto.joinedAt`
추가는 이미 wire 에 나가던 값을 뒤늦게 선언한 순수 additive 변경이라 하위 호환성 문제가 없다.
두 엔드포인트에 응답 계약(선언 대조 + 이름 기반 부재) e2e 가 새로 배선돼 커버리지 갭도 메워졌다.
에러 응답 형식, URL/경로 설계, 버전 관리, 요청 검증, 페이지네이션, 인증/인가 표면에는 변경이
없다. Critical/Warning 급 API 계약 위반은 발견되지 않았다.

## 위험도

NONE

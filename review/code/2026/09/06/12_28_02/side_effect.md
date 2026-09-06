# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (`git status --short` 는 세션 자신의
`review/code/2026/09/06/12_28_02/`·`review/consistency/2026/09/06/12_28_03/` 만 untracked 로
남아 있음을 확인 — 내가 만든 부수적 변경 없음):

- `workflow-versions.service.ts`/`.controller.ts`/`workflows.service.ts` 를 직접 열어
  `WorkflowVersionsService.findOne` 의 두 호출부(컨트롤러, `restoreVersion`)가 좁혀진 반환
  타입(`WorkflowVersionDetail`)이 제공하는 필드(`snapshot`·`version`)만 쓰는지 확인.
- `tsconfig.build.json` 을 열어 신규 파일 경로(`src/repo-guards/**`, `src/shared/testing/**`)가
  기존 `exclude` 패턴에 그대로 포함됨을 확인 — 새 파일이 dist 로 새어 나가지 않는다.
- `workspaces.service.ts` 를 grep 해 `joinedAt: m.joinedAt`(`listMembers`)이 이미 런타임에
  실리고 있음을 확인 — DTO 필드 추가가 wire 동작을 바꾸지 않는다.
- `user-entity-exposure-guard.ts`/`user-secret-absence.ts` 전문을 읽어 `fs.readFileSync` 만
  쓰고 쓰기 API(`writeFileSync` 등)가 없음을 확인.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 의 반환 타입이 `Promise<WorkflowVersion>` →
  `Promise<WorkflowVersionDetail>` 로 좁혀졌다 — 공개 메서드 시그니처 변경
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    (`findOne` 함수 시그니처, `export type WorkflowVersionDetail` 정의부)
  - 상세: `WorkflowVersionDetail = Omit<WorkflowVersion, 'creator' | UnloadedRelations> & { creator: ProjectedCreator }` 로,
    `creator` 필드 타입이 전체 `User` 에서 3필드(`id`/`name`/`email`)로, `workflow` 관계
    타입이 완전히 제거됐다. 저장소 전체에서 `findOne` 호출부는 2곳뿐이다 —
    `WorkflowVersionsController.findOne`(가공 없이 그대로 반환)과
    `WorkflowVersionsService` 를 쓰는 `WorkflowsService.restoreVersion`(`target.snapshot`·
    `target.version` 만 사용). 둘 다 좁혀진 타입이 제공하는 필드만 쓰므로 컴파일 타임에
    깨지지 않음을 직접 확인했다(추가로 RESOLUTION.md 가 `build: PASS` 를 기록). 다만 이는
    export 된 공개 타입/함수 시그니처의 실질적 변경이므로, 향후 새 호출부가 추가되면 이
    타입 축소를 인지해야 한다.
  - 제안: 조치 불요 — 기록용. 새 호출부 추가 시 `creator`/`workflow` 접근에 주의.

- **[INFO]** `WorkflowVersionsService.findOne` 의 TypeORM 쿼리 형태가 `relations: ['creator']`
  (투영 없음) → `relations: { creator: true } + select: {...}` 로 바뀌어 실제 SQL 이 달라진다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `findOne` 본문의 `select` 절, `CREATOR_PROJECTION` 상수 정의부
  - 상세: 이 변경은 `GET /api/workflows/:wfId/versions/:versionId` 가 `User` 전 컬럼
    (`passwordHash`·`twoFactorSecret`·복구 코드·토큰 등)을 wire 로 내보내던 살아있는 유출을
    닫는 **의도된** 수정이다(`review/code/2026/09/06/10_13_22` Critical 1). 자매 메서드
    `findByWorkflow` 는 이미 이 형태를 쓰고 있었으므로 신규 패턴이 아니다. 부작용 관점에서는
    응답 payload 가 **좁아지는** 방향(비민감 컬럼도 함께 빠짐 — `id`/`name`/`email` 외 필드가
    있었다면 그것도 사라짐)이므로 정보 노출 축소이지 신규 노출이 아니다. `restoreVersion` 이
    `creator` 필드를 전혀 참조하지 않으므로 하위 소비자에 영향 없음을 확인했다.
  - 제안: 조치 불요 — 기록용.

- **[INFO]** `WorkspaceMemberDto` 에 `joinedAt` 필드 추가 — 공개 OpenAPI 계약 확장이지만
  런타임 wire 는 이미 그 값을 보내고 있었다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto.joinedAt`)
  - 상세: `WorkspacesService.listMembers`(`workspaces.service.ts:223`, 이 diff 밖의 기존
    코드)가 이미 `joinedAt: m.joinedAt` 을 무조건 실어 왔음을 grep 으로 확인했다 — 즉 이
    필드는 문서가 실제를 뒤늦게 따라잡은 것이고 추가적(additive)이라 하위호환을 깨지 않는다.
    `nullable: true` 로 선언했지만 실측(2026-09-06, DTO 주석에 명시)상 `workspace_member`
    행을 만드는 네 자리가 전부 즉시 `joinedAt: new Date()` 로 채워 현재는 `null` 이 도달하지
    않는다 — 타입이 실제보다 넓은 안전한 방향이다.
  - 제안: 조치 불요 — 기록용.

- **[INFO]** 신규 정적 가드/헬퍼 파일 5종은 파일시스템을 읽기 전용(`fs.readFileSync`)으로만
  쓰고, 프로덕션 빌드 제외 목록에 이미 포함돼 dist 오염 위험이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (`forEachUserTypedProperty`/`findUserRelationLoads` 등, `fs.readFileSync` 호출부) ·
    `codebase/backend/src/shared/testing/user-secret-absence.ts` (순수 재귀 함수, I/O 없음) ·
    `codebase/backend/tsconfig.build.json` (`exclude` 배열의 `src/repo-guards/**` ·
    `src/shared/testing/**` 항목)
  - 상세: 두 신규 가드/헬퍼 디렉터리 모두 기존에 등재된 `exclude` glob 의 하위 경로에
    들어갈 뿐이라 별도 조치가 필요 없음을 확인했다. 쓰기 API(`writeFileSync`,
    `fs.promises.writeFile` 등) 호출이 코드 전체에 0건이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e 테스트(3건)는 DB 쓰기(회원가입/워크스페이스 생성/초대 수락/워크플로우
  저장)를 수행하지만 이는 이 파일들의 기존 e2e 관례와 동일한 예상된 부작용이다
  - 위치: `codebase/backend/test/audit-logs.e2e-spec.ts`(`expectNoUserSecrets` 배선) ·
    `codebase/backend/test/workflow-crud.e2e-spec.ts`(신규 `it('H. 버전 단건 조회…')`) ·
    `codebase/backend/test/workspace-rbac.e2e-spec.ts`(신규 `it('J. GET /:id/members…')`)
  - 상세: 세 파일 모두 기존 e2e 스위트의 `registerAndLogin`/`createTeamWorkspace`/
    `inviteAndAccept` 헬퍼를 그대로 재사용해 실제 DB 를 상대로 계정·워크스페이스·워크플로우
    버전을 생성한다. 격리(`uniqueEmail`/`uniqueName`)도 기존 관례를 따른다 — 새로운 종류의
    부작용이나 공유 상태 오염 경로는 발견되지 않았다.
  - 제안: 조치 불요.

## 요약

이번 diff(누적 브랜치 전체)는 `User` 엔티티 컬럼 노출을 잡는 두 축 검출기(구조 AST 가드 +
응답 본문 이름 스캔)와 그 소비 e2e, 그리고 그 과정에서 실측으로 드러난 살아있는 유출
(`WorkflowVersionsService.findOne` 이 `creator` 를 투영 없이 반환)을 닫는 수정으로 구성된다.
부작용 관점에서 실질 위험은 없다 — 신규 정적 가드/헬퍼는 순수 함수(파일 읽기만, 쓰기 없음)이고
기존 `tsconfig.build.json` exclude 패턴에 이미 포함돼 프로덕션 dist 를 오염시키지 않으며,
전역 가변 상태·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출·이벤트/콜백 변경이 전혀 없다.
`WorkflowVersionsService.findOne` 의 반환 타입 축소와 쿼리 형태 변경, `WorkspaceMemberDto.joinedAt`
추가는 모두 공개 인터페이스에 손을 대지만, 전자는 호출부 2곳을 직접 열어 컴파일 안전성을
확인했고 후자는 이미 런타임에 나가고 있던 값을 문서화한 것뿐이라 wire 동작을 바꾸지 않는다.
신규 e2e 3건이 만드는 DB 쓰기도 기존 e2e 관례와 같은 형태의 예상된 부작용이다. 저장소를
뮤테이션하지 않고 읽기 전용으로 검증했으며 잔여 오염은 없다.

## 위험도
NONE

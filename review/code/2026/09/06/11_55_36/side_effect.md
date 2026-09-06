# 부작용(Side Effect) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (`git status --short` 실행 전후 변화 없음, 이번
세션 산출물 디렉터리 2개만 untracked):

- `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts`/`user-relation-load.fixture.ts` 를
  직접 Read (프롬프트 diff 가 크기 제한으로 생략한 3개 파일).
- `grep -rn "workflowVersionsService\.\|WorkflowVersionsService"` 로 `WorkflowVersionsService.findOne`
  의 모든 호출부를 전수 확인 — 컨트롤러(그대로 반환) + `WorkflowsService.restoreVersion` 둘뿐.
  `restoreVersion` 은 `target.snapshot` 만 읽는 코드를 직접 열어 확인.
- `grep -n "joinedAt" workspaces.service.ts` — `WorkspaceMemberDto.joinedAt` 이 이미 4곳에서
  무조건 실리고 있음을 재확인(추가는 문서화일 뿐 wire 변경 아님, 기존 라운드 판정과 일치).
- `codebase/backend/tsconfig.build.json` 의 `exclude` 에 `src/repo-guards/**`·
  `src/shared/testing/**` 가 여전히 있음을 확인 — 신규 가드 파일이 production dist 로 새지 않는다.
- `user-secret-absence.ts` 를 다시 읽어 `expectNoUserSecrets` 가 (이전 라운드 INFO#7 수정대로)
  `expect` 전역 의존 없이 직접 `throw new Error(...)` 하는 최종 상태임을 확인.

## 발견사항

- **[INFO]** `CREATOR_PROJECTION` 이 두 호출부에 **같은 객체 참조**로 공유된다 — `as const` 는
  런타임 동결이 아니다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `export const CREATOR_PROJECTION = { id: true, name: true, email: true } as const;` 선언부,
    그리고 이를 그대로 참조하는 `findByWorkflow`(`creator: CREATOR_PROJECTION`)와
    `findOne`(`select.creator: CREATOR_PROJECTION`) 두 호출부.
  - 상세: `as const` 는 TypeScript **타입 레벨**에서만 프로퍼티를 `readonly` 로 만들 뿐,
    `Object.freeze()` 를 호출하지 않아 런타임에는 평범한 가변 객체다. 이 상수가 서로 다른 두
    메서드의 TypeORM `select` 옵션에 **같은 참조**로 꽂혀 있으므로, 만약 향후 누군가 한쪽
    호출부에서 `(opts.select.creator as any).x = true` 식으로 참조를 통해 프로퍼티를 추가/변경하면
    (타입 단언으로 `readonly` 를 우회) 다른 호출부의 쿼리 투영도 조용히 함께 바뀐다 — 지금 코드는
    그렇게 하지 않지만, "두 자리가 물리적으로 분리된 상수를 각자 갖는" 것과 "같은 객체를 공유하는"
    것은 부작용 격리 관점에서 다르다. 실무적으로 TypeORM 자체가 `select` 옵션 객체를 in-place
    변경한다는 근거는 없어 위험도는 낮다.
  - 제안: 조치 불요에 가깝다 — 다만 강한 격리를 원하면 `Object.freeze(CREATOR_PROJECTION)` 을
    추가해 실수로 공유 참조를 통해 변형하는 경로 자체를 컴파일이 아니라 런타임에서도 막을 수 있다.

- **[INFO]** `WorkflowVersionsService.findOne` 반환 타입 변경(`Promise<WorkflowVersion>` →
  `Promise<WorkflowVersionDetail>`) — 시그니처 변경이지만 유일한 내부 소비자와 호환 확인됨
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` —
    `findOne` 메서드 선언부(반환 타입), `WorkflowVersionListItem`/`WorkflowVersionDetail` 타입 선언.
  - 상세: `grep` 으로 이 메서드의 호출부를 전수 확인한 결과 컨트롤러(가공 없이 그대로 반환)와
    `WorkflowsService.restoreVersion`(`codebase/backend/src/modules/workflows/workflows.service.ts:666`)
    둘뿐이다. `restoreVersion` 은 반환값에서 `target.snapshot` 한 필드만 읽고(`Array.isArray` 로
    형태만 검사), `snapshot` 필드는 이번 타입 좁히기의 대상(`creator`)과 무관하므로 실제 호출부
    영향은 없다. 이 타입 변경은 **런타임이 이미 3필드만 반환하는 것을 타입이 뒤늦게 따라간 것**이라
    타입이 좁아지는 방향이고(넓히는 방향이었다면 컴파일 타임 안전성이 깨질 위험이 있었을 것),
    이 서비스가 `NestJS` `@Injectable()` 로 다른 모듈에 주입되는 공개 provider 라는 점에서
    "인터페이스 변경" 체크리스트 항목에는 해당하므로 기록해 둔다.
  - 제안: 조치 불요 — 영향 범위가 이미 전수 확인됐다.

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가 — OpenAPI 계약(공개 인터페이스) 변경이지만
  wire 동작 변경은 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` —
    `WorkspaceMemberDto` 클래스에 `joinedAt: string | null` 필드 추가.
  - 상세: `WorkspacesService.listMembers`(diff 밖의 기존 코드)가 이미 4개 자리
    (`workspaces.service.ts:65,184,223,262`)에서 `joinedAt` 을 무조건 실어 왔음을 직접 확인했다 —
    DTO 선언 추가는 이미 나가고 있던 값을 문서화(OpenAPI 스키마에 광고)한 것뿐이고, 실제 응답
    바이트는 바뀌지 않는다. 추가적(additive) 필드라 기존 클라이언트와 하위호환도 깨지지 않는다.
    이전 라운드(`10_13_22`, `10_53_48`, `11_27_53` scope/side_effect 리뷰)에서도 동일하게 INFO
    처분되어 재확인 성격이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 가드가 `src/modules` 전체를 매 테스트 실행마다 동기적으로 파일 I/O 로 훑는다 —
  런타임 부작용은 아니고 형제 가드와 같은 기존 패턴
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` —
    `describe()` 블록 최상위(`it()` 밖)에서 즉시 실행되는 `collectTsFiles(...)`/
    `findUserRelationLoads(...)`/`collectUserRelationNames(...)` 호출.
  - 상세: 세 함수 모두 `fs.readFileSync` 로 파일을 **읽기만** 하고(`user-entity-exposure-guard.ts`
    전체에 쓰기 API 호출 없음을 확인), 이 디렉터리는 `tsconfig.build.json` 의 `exclude` 에 여전히
    포함돼 있어 production dist 로 새지 않는다(재확인 완료). 다만 이 스캔이 `it()` 콜백이 아니라
    `describe()` 블록 본문에서 즉시 실행되므로, Jest 가 이 spec 파일을 **수집(collect)만** 해도
    `src/modules` 전체를 순회한다 — 형제 가드(`nullable-type-lie-cast-guard.ts`,
    `swagger-dto-contract-guard.ts`)가 이미 쓰고 있는 확립된 패턴이라 이번 PR 이 새로 도입한
    위험은 아니다.
  - 제안: 조치 불요 — 기록용.

## 요약

이번 diff(`User` 컬럼 노출 검출 2축 + Critical 1 마무리 수정)는 순수 함수 기반 AST 스캔(구조 축
`user-entity-exposure-guard.ts`)과 순수 재귀 워커(값 축 `user-secret-absence.ts`), 그리고 TypeORM
쿼리 `select` 절 좁히기로 구성되며, 상태를 변경하는 코드나 전역 가변 상태, 파일 쓰기, 환경 변수
읽기/쓰기, 의도치 않은 네트워크 호출, 신규 이벤트/콜백은 발견되지 않았다. 유일한 production 동작
변경은 `WorkflowVersionsService.findOne`/`findByWorkflow` 의 `creator` 관계 투영(의도된 보안 수정)과
`WorkspaceMemberDto.joinedAt` 선언 추가(이미 나가던 값의 뒤늦은 문서화)뿐이며, 둘 다 실측으로 호출부
영향이 없음을 확인했다. `findOne` 반환 타입 좁히기는 시그니처 변경에 해당하지만 유일한 내부 소비자
(`WorkflowsService.restoreVersion`)가 영향받지 않는 필드만 사용한다는 것을 직접 코드를 열어
확인했다. `CREATOR_PROJECTION` 을 두 호출부가 같은 객체 참조로 공유하는 점은 이론적 공유-상태
경로이지만 `as const` 로 타입 레벨 방어가 있고 TypeORM 이 그 객체를 in-place 변경한다는 근거가
없어 실질 위험은 낮다. 신규 가드 파일이 `tsconfig.build.json` exclude 에 남아 있어 production
빌드 오염 위험도 없음을 재확인했다. 전반적으로 이 PR 은 "방어가 아니라 검출" 이라는 스스로의 설계
목표대로 런타임 경로에 새로운 부작용을 만들지 않는다.

## 위험도
NONE

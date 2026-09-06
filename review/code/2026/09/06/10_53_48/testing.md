# 테스트(Testing) 리뷰

## 개요

이번 diff 는 `GET /api/audit-logs` 의 `User` 26키 유출을 계기로 세운 검출 2축(구조 축
`user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`)과, 그 그물이 실제로
잡아낸 살아있는 유출(`WorkflowVersionsService.findOne` → `GET
/api/workflows/:wfId/versions/:versionId`)의 수정 및 회귀 테스트로 구성된다. 직전 리뷰
라운드(`review/code/2026/09/06/10_13_22`)가 지적한 Critical 1(이름 매칭이 타입 매칭보다
좁음)·WARNING 4건이 이미 반영된 상태(`4d49aa575`)를 대상으로 검토했다. 소스를 직접 열어
확인한 결과 이전 라운드의 Critical/WARNING 은 실제로 해소돼 있었다(레터 `F.`→`J.` 정정,
`relations` 객체 형태(0.3) 파싱 추가, `collectUserRelationNames` 타입 기반 파생, `line` 필드
제거 등). 이 보고서는 그 이후에도 남아 있는 테스트 관점의 갭에 집중한다.

## 발견사항

- **[WARNING]** 구조 축 가드가 TypeORM 0.3 `relations` **중첩 객체 형태**를 스캔하지도, 테스트하지도 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수
    `userRelationInInitializer` (객체 리터럴 분기, "형태 2 — 객체 리터럴 (TypeORM 0.3)" 주석
    바로 아래 블록) / 대조군 `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` 함수 `violationObjectRelations`
  - 상세: `userRelationInInitializer` 의 객체 리터럴 분기는 `init.properties` 를
    **한 단계만** 순회하며 각 prop 의 **이름**을 바로 `names` 집합과 대조한다(중첩 순회 없음).
    그래서 `relations: { creator: true }` 같은 평평한 형태는 잡지만, TypeORM 0.3 이 실제로
    지원하는 `relations: { workflow: { creator: true } }` 같은 **중첩** 객체 형태는 top-level
    key(`workflow`)가 `names` 에 없어 통과한다 — `ts.forEachChild` 전역 순회도 중첩 객체를
    별도의 `relations:` 프로퍼티로 다시 만나지 않으므로 잡히지 않는다. 배열 형태는
    `violationNestedRelationPath`(경로 문자열 `'member.user'`)로 "중첩 경로도 같다" 라고
    명시적으로 대조군을 뒀는데, 정확히 대응하는 객체 형태 대조군은 없다 — 같은 파일 안에서
    한쪽 형태만 중첩을 커버하는 비대칭이다. 이 가드가 막으려는 결함 클래스(정의를 한 칸 좁게
    잡아 살아있는 유출을 놓침)를 이 가드 자신이 반복할 수 있는 자리다. 이 저장소는 이미
    `relations: { creator: true }`(`workflow-versions.service.ts` 자신) 같은 평평한 0.3
    형태를 쓰고 있으므로, 관계 체인이 한 단계 더 늘어나는 리팩터(예: 다른 엔티티를 거쳐
    `creator` 를 로드)가 오면 이 가드는 조용히 통과시킨다.
  - 제안: `fixtures/user-relation-load.fixture.ts` 에 `relations: { workflow: { creator: true } }` 형태의 위반 대조군을 추가하고, `userRelationInInitializer` 의 객체 분기를 재귀적으로
    (`ObjectLiteralExpression` 값을 다시 확인) 확장한다. 지금 당장 고치지 않더라도 최소한
    가드 docstring 에 "중첩 객체 형태는 대상 밖" 이라는 한계를 명시해, 다음 사람이 이 가드가
    막는 범위를 과신하지 않게 한다.

- **[INFO]** `enclosingName` 의 "메서드가 변수보다 우선" 규칙이 어떤 fixture 로도 관측되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수
    `enclosingName` (JSDoc "메서드를 변수보다 먼저 본다" 문단)
  - 상세: JSDoc 은 "실제 코드는 `const stored = await repo.findOne({…})` 형태라, 가까운 것부터
    집으면 `#stored` 가 나온다" 는 구체적 시나리오를 근거로 우선순위를 정했다고 설명한다.
    그러나 `fixtures/user-relation-load.fixture.ts` 의 모든 위반 함수는
    `return repo.findOne({...})` 형태로 **직접 반환**하며 중간 변수를 두지 않는다 — 즉 이
    함수가 실제로 분기하는 "메서드 안에 변수 선언이 있고 그 변수가 위반 호출을 담는" 경우,
    그리고 "메서드도 변수도 없는 모듈 최상위" 폴백(`'<module>'`)경우 둘 다 어떤 테스트에서도
    실행되지 않는다(production 스캔 대상인 `auth.service.ts#logout`/`#refresh`/
    `workspaces.service.ts#listMembers` 도 전부 직접 반환 형태다). 이 우선순위를 실수로 뒤집는
    뮤턴트를 넣어도 현재 스위트는 초록일 것이다 — 근거로 든 시나리오 자체가 코드로 존재하지
    않는다("설계 근거는 쓰기 전에 뮤턴트로 반증해 보라" 류의 갭).
  - 제안: fixture 에 `const stored = await repo.findOne({ where:..., relations:['user'] }); return stored;` 형태의 위반 함수를 하나 추가해 키가 `#<함수명>`(메서드 우선)으로 나오는지
    직접 단언한다. 저비용으로 이 문서화된 설계 결정을 실제로 지키는지 검증할 수 있다.

- **[INFO]** `hasProjectionFor` 는 배열 형태 `relations` + 동일 옵션 `select` 조합에 대한 대조군이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`
    "준수 2"(`compliantProjectedRelations`, 객체 형태 `relations` + `select` 만 테스트)
  - 상세: `hasProjectionFor` 자체는 `relations` 가 배열이든 객체든 관계없이 형제 `select`
    프로퍼티만 보므로 로직상 배열 형태에도 동작할 것으로 보이지만, 이를 직접 확인하는
    대조군(`relations: ['creator']` + `select: { creator: {...} }`)이 fixture 에 없다.
    현재 프로덕션 코드(`findOne`/`findByWorkflow`)가 전부 객체 형태만 쓰므로 실질 위험은
    낮지만, 배열 형태가 다시 쓰이는 순간(예: 리팩터 되돌림) 이 조합이 정말 "준수" 로
    분류되는지 검증된 적이 없다.
  - 제안: 여유가 있으면 fixture 에 배열 형태 + `select` 조합의 준수 대조군을 하나 추가한다.

- **[INFO]** 테스트 존재·품질은 전반적으로 강하다 — 특히 vacuous 방지 설계
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` (`[전제]`
    로 시작하는 두 테스트: `entityFiles.length > 0`, `loads.length > 0`) /
    `codebase/backend/src/shared/testing/user-secret-absence.spec.ts` (7컬럼 각각을 개별
    루프로 도는 `USER_SECRET_KEYS` 테스트, `expectNoUserSecrets` 의 throw/not-throw 양쪽 단언)
  - 상세: 스캔 대상이 0건이 되면 `toEqual([])` 류 단언이 조용히 통과하는 vacuous 실패 형태를
    별도 "[전제]" 테스트로 명시적으로 막아 둔 점, fixture 를 프로덕션 스캔 경로 밖에 두어
    베이스라인을 오염시키지 않으면서도 술어 자체는 fixture 로 양방향(위반 8형태·준수 4형태)
    검증한 점, `expectNoUserSecrets` 가 전역 `expect` 대신 직접 `throw` 하도록 고쳐
    `injectGlobals:false` 전환에도 안전하게 한 점 모두 이 저장소의 기존 교훈(vacuous
    테스트·전역 의존성 결함류)을 정확히 반영한다. 감점 요소 아님 — 강점으로 기록.

- **[INFO]** e2e 회귀 안전성 확인 — 신규 케이스가 기존 스위트에 결합(coupling)을 만들지 않는다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (`uniqueName('wf-version-leak')`),
    `codebase/backend/test/workspace-rbac.e2e-spec.ts` (`uniqueEmail('rbac-f-own')` /
    `uniqueEmail('rbac-f-mem')`)
  - 상세: 두 신규 e2e 모두 저장소 관례대로 `uniqueName`/`uniqueEmail` 헬퍼로 고유 식별자를
    만들어 다른 테스트와 데이터 충돌 없이 독립 실행 가능하다. `workflow-crud.e2e-spec.ts` 의
    신규 케이스는 버전이 0개면 이후 단언이 vacuous 해진다는 것을 `expect(versions.length).toBeGreaterThanOrEqual(1)` 로 먼저 방어한다 — 좋은 패턴. 회귀 위험 없음.

- **[INFO]** `WorkflowVersionsService.findOne` unit 테스트가 옵션 전체 비교와 부분(창) 비교를 의도적으로 중복 유지
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts`
    (`should query by both id and workflowId` / `creator 를 참조 3필드로 투영한다…`)
  - 상세: 두 테스트가 같은 `mockRepo.findOne` 호출을 서로 다른 세밀도로 검증한다 — 전체
    옵션 객체 비교(형태 변경에 취약하지만 전체 스냅샷)와 `select.creator` 만 targeted 로 보는
    비교(형태가 바뀌어도 "이 3필드는 반드시 있어야 한다" 는 성질만 남김). 주석에 이 중복을
    의도적으로 유지하는 이유를 명시했다 — 좋은 관례. 결함 아님.

## 요약

핵심 회귀(`WorkflowVersionsService.findOne` 의 `User` 전체 컬럼 유출)는 unit(옵션 비교 2종)·
e2e(이름 축·계약 축·참조 3필드 양성 축 3중)로 두텁게 봉인됐고, 신규 검출 가드 2종도 자기
회귀를 막는 fixture 대조군(위반 8형태·준수 4형태)을 갖췄으며 vacuous 실패를 막는 "[전제]"
테스트까지 갖춰 테스트 품질이 전반적으로 높다. 다만 이 가드 자신이 경계하는 결함 클래스
("정의를 한 칸 좁게 잡아 살아있는 유출을 놓침")가 TypeORM 0.3 **중첩** `relations` 객체
형태에 대해 그대로 반복될 여지가 있다 — 배열 형태의 중첩 경로(`'member.user'`)는 대조군이
있지만 객체 형태의 중첩(`{ workflow: { creator: true } }`)은 스캔 로직도 fixture 도 없다.
또한 `enclosingName` 의 "메서드가 변수보다 우선" 이라는 문서화된 설계 근거가 그 근거로 든
구체적 코드 형태(`const stored = ...`)로 실제 테스트되지 않아, 그 우선순위를 뒤집는 회귀를
현재 스위트가 잡지 못한다. 둘 다 지금 당장 살아있는 유출은 아니며 저비용으로 메울 수 있는
커버리지 갭이다.

## 위험도

LOW

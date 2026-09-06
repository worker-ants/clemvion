# 요구사항(Requirement) 리뷰

## 검증 방법

저장소를 뮤테이션하지 않고 다음을 실행/열람으로 직접 확인했다 (`git status --short` 로
사전·사후 clean 확인, 세션 산출물 디렉터리 외 변경 없음):

- `npx jest --config jest.config.ts src/repo-guards/__tests__/user-entity-exposure.spec.ts src/shared/testing/user-secret-absence.spec.ts src/modules/workflow-versions/workflow-versions.service.spec.ts`
  → **3 suites / 27 tests 전부 통과**.
- `npx tsc -p tsconfig.json --noEmit` → 기존에 무관한 파일들(carousel/table 노드 스펙 등)에
  이미 존재하는 타입 오류들은 있으나, 이번 diff 대상 파일(`workflow-versions*`,
  `workspace-response.dto`, `user-entity-exposure*`, `user-secret-absence*`,
  `*.e2e-spec.ts`) 관련 오류는 0건.
- `grep` 로 `src/modules` 전체를 다시 훑어 `creator`/`owner`/`executor`/`user`
  (엔티티에서 파생된 `User` 타입 관계 이름 4종) 가 `relations` 옵션이나
  `leftJoinAndSelect`/`innerJoinAndSelect` 로 투영 없이 로드되는 자리가
  `workflow-versions.service.ts` 의 두 메서드(둘 다 이제 `select` 투영 보유) 외에
  **더 있는지** 재확인 — 없음. `Workspace.owner`, `Execution.executor`,
  `Integration.creator`, `Workflow.creator` 는 현재 어떤 서비스에서도 `relations` 로
  로드되지 않는다(엔티티 선언만 존재).
- `workspace-rbac.e2e-spec.ts` 실제 파일을 열어 `it('[A-Z]\.` 라벨을 전수 재확인 —
  `F.` 중복이 실제로 해소되고(`J.` 로 유일화) 파일 안에 중복 라벨이 없음을 확인.

## 발견사항

- **[INFO]** 직전 라운드(`review/code/2026/09/06/10_13_22`)의 **Critical 1**
  (`WorkflowVersionsService.findOne` 이 `relations: ['creator']` 를 투영 없이 로드해
  `GET /api/workflows/:wfId/versions/:versionId` 가 `User` 전 컬럼을 유출)이 이번 diff 로
  **완전히 닫혔다** — 실측으로 확인.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
    게이트 73(`relations: { creator: true }`), 게이트 81-90(`select: { …, creator: { id, name,
    email } }`).
  - 상세: 컨트롤러(`workflow-versions.controller.ts` `findOne`, diff 밖 기존 코드)가 서비스
    반환값을 가공 없이 그대로 리턴하는 구조는 그대로이므로, 이 메서드의 `select` 투영이
    유일한 방어선이다. `select.creator = { id, name, email }` 이 `WorkflowVersionCreatorDto`
    (`dto/responses/workflow-version-response.dto.ts`)가 광고하는 필드 집합과 정확히
    일치함을 직접 대조했다. 자매 메서드 `findByWorkflow` 가 이미 갖고 있던 투영과도 동일한
    형태다. unit(`workflow-versions.service.spec.ts` 게이트 76·102-113 두 단언 — 옵션 전체
    비교 + "creator 투영" 단독 비교)과 e2e(`workflow-crud.e2e-spec.ts` 게이트 513-571 —
    `expectNoUserSecrets` + `assertMatchesContract` + `creator` 3필드 양성)가 삼중으로
    회귀를 막는다. 직접 실행해 전부 GREEN 을 확인했다(27/27).
  - 가드(`user-entity-exposure-guard.ts`) 쪽 수정도 근본 원인(이름 매칭 → 엔티티에서 파생한
    타입 매칭)을 고쳤음을 `collectUserRelationNames`/`referencesUserType` 로직과
    `user-entity-exposure.spec.ts` 게이트 92-97(파생 결과가 `creator`·`executor`·`owner`·
    `user` 4종과 정확히 일치) 로 직접 확인했다. `Execution.executor: User | null` 처럼 이름이
    또 다른 관계까지 이미 커버 대상에 들어와 있다.
  - 제안: 없음 — 조치 완료, 실측 검증 완료.

- **[INFO]** (회색지대, spec 침묵) `spec/3-workflow-editor/5-version-history.md` §7.2 가
  "응답: `WorkflowVersion` 단건 + `snapshot` 포함" 이라고만 적어, `creator` 하위 필드의
  narrowing(`id`·`name`·`email`)을 §7.1 만큼 명시하지 않는다 — 바로 이 필드-수준 명세
  부재가, 이번에 고친 유출이 그동안 아무 스펙 위반으로도 잡히지 않은 배경 중 하나다.
  - 위치: `spec/3-workflow-editor/5-version-history.md` §7.1(96-101행, `creator` "포함"
    이라고만 표기)·§7.2(103-108행, "`WorkflowVersion` 단건"이라는 표현이 엔티티 그대로를
    연상시킨다 — 실제로는 `WorkflowVersionDto` 이고 `creator` 는 3필드로 narrowing 된다).
  - 상세: spec 이 코드와 모순되는 것은 아니다(§7.1 표의 "creator 포함" 은 §7.2 에도
    적용된다고 명시돼 있고, 코드가 그 상위 요구는 지킨다). 다만 `creator` 의 **하위 필드
    집합**을 spec 이 어디에도 못박지 않아, 다음 사람이 "creator 를 통째로 실어도 spec 위반은
    아니다" 라고 오독할 여지가 여전히 남는다 — 이번 Critical 이 정확히 그 여지에서 생겼다.
    이 gap 은 developer 권한 밖(`spec/` 쓰기)이라 이 PR 이 직접 고칠 수 없다.
  - 제안: `project-planner` 턴에서 §7.2(또는 §7.1 표 옆 각주)에 `creator: { id, name, email }`
    형태를 명시해, 이미 등재된 두 후속 항목(§5.4 검증 층 등재·`User` 노출 금지 규약화, 이번
    diff 의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 364-393)에
    셋째 항목으로 묶거나 그중 하나(`1-data-model.md §2.1`/`secret-store.md §1.1` 등재)를
    처리할 때 함께 반영. 이 자체를 새 CRITICAL/WARNING 으로 보지는 않는다 — spec 위반이
    아니라 spec 정밀도 gap 이기 때문.

- **[INFO]** 신규 검출 가드 2쌍이 spec `code:` frontmatter 에 미등재된 것은 이미 직전
  라운드(`10_13_22`)에서 security/requirement 양쪽이 발견했고, 이번 diff 자체가 그 후속을
  투명하게 등재하고 있어 새로 지적할 사항이 아니다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 364-393(두
    체크박스 — "신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재", "`User` 민감 7컬럼의
    응답 노출 금지를 규약 문장으로").
  - 상세: `spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md`·
    `spec/conventions/secret-store.md` 세 문서의 `code:` glob 에 `user-entity-exposure*`·
    `user-secret-absence*` 가 여전히 0건 매치임을 재확인했지만(직접 grep), 이 PR 은 그 gap 을
    숨기지 않고 plan 에 planner 후속 항목으로 명시적으로 남겨 뒀다 — draft 종결 조건도
    지켰다. 새 결함으로 보지 않는다.
  - 제안: 없음(이미 추적 중).

- **[INFO]** (경미, 요구사항 영향 없음) 신규 e2e `it('버전 단건 조회 — …')`
  (`workflow-crud.e2e-spec.ts` 게이트 513)가 그 파일이 다른 테스트 전체에 쓰는 `A.`~`G.`
  알파벳 라벨 관례를 따르지 않는다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` 게이트 513
    (`it('버전 단건 조회 — \`creator\` 가 참조 3필드로 좁혀지고 \`User\` 비밀이 없다', …)`).
    같은 파일의 다른 모든 케이스는 `it('A. …')` ~ `it('G. …')` 형태다.
  - 상세: 기능·정확성에는 영향 없음(라벨 충돌도 없음 — `workspace-rbac.e2e-spec.ts` 의
    `F.` 중복과는 다른 사안). 다만 이 파일 특유의 관례에서 벗어난 유일한 케이스라 다음
    사람이 "테스트 H" 식으로 인용하지 못한다.
  - 제안: 선택적. `H.` 라벨을 붙이면 관례가 완전히 복원된다.

- **[INFO]** `findUserRelationLoads` 의 `relations` 객체 리터럴(TypeORM 0.3) 파싱은
  **최상위 프로퍼티만** 본다 — 중첩 객체 형태(`relations: { member: { user: true } }`)는
  스캔하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    게이트 146-155(`userRelationInInitializer` 형태 2 분기).
  - 상세: 현재 `src/modules` 전체를 grep 으로 재확인한 결과 이런 중첩 객체 형태의 실사용은
    0건이라 지금 당장의 false negative 는 아니다. 다만 원리적으로 닫히지 않은 형태이므로,
    이 PR 이 고친 것과 같은 클래스(구조 형태 매칭이 열거식)의 다음 판이 여기서 날 수 있다 —
    이번 PR 이 "이름 목록을 늘리지 않고 출처를 바꿨다" 는 것과 같은 교훈이 재귀 깊이에는
    아직 적용되지 않은 상태.
  - 제안: 우선순위 낮음. 재귀적으로 `relations` 객체를 내려가며 각 키를 검사하도록 확장하면
    닫힌다.

## 요약

이번 diff 는 직전 라운드가 지적한 실제 유출(Critical 1 — `GET
/api/workflows/:wfId/versions/:versionId` 가 `User` 전 컬럼을 노출)을 `select` 투영
추가로 완전히 닫았고, 그 근본 원인(가드가 관계 **이름**만 매칭)도 엔티티에서 파생한
**타입** 매칭으로 고쳤다. unit 27개·관련 tsc 검사를 직접 실행해 전부 GREEN 을 확인했고,
`src/modules` 전체를 재-grep 해 같은 클래스의 유출이 더 남아 있지 않음을 직접 확인했다.
직전 라운드의 WARNING(e2e 레터 `F.` 중복, `.toLowerCase()` 관측 불가, `expect` 암묵 의존,
`line` 필드 미사용)도 모두 코드상 반영을 확인했다. 남은 항목은 전부 INFO 급이다 — spec 이
`creator` 하위 필드 형태를 명시하지 않는 회색지대(이번 유출이 생긴 배경의 일부이므로
planner 반영을 권한다), 신규 가드의 spec `code:` 미등재(이미 투명하게 추적 중), 새 e2e
라벨 관례 이탈(경미), 중첩 `relations` 객체 형태 미검출(현재 실사용 없음). 요구사항
충족·spec 정합 관점에서 이 diff 를 막을 이유는 없다.

## 위험도

LOW

# 아키텍처(Architecture) 리뷰

## 개요

이 브랜치(`96d3856a9` feat + `4d49aa575`/`9a186fa31`/`01b078379` fix, 4개 커밋)는 `User` 엔티티
민감 컬럼 노출을 잡는 검출 2축(`user-entity-exposure-guard.ts` 구조 축,
`user-secret-absence.ts` 값 축)을 신설하고, 그 계기로 드러난
`WorkflowVersionsService.findOne` 의 실유출을 닫았다. 이 세션에서 이미 세 차례
코드 리뷰(`10_13_22`/`10_53_48`/`11_27_53`)가 돌았지만 그중 어느 라운드에도
`architecture.md` 산출물이 없었다 — 이번이 이 브랜치에 대한 첫 아키텍처 관점 검토다.
그 세 라운드가 이미 처분한 보안·유지보수성 결함(투영 리터럴 4곳 복제 →
`CREATOR_PROJECTION` 통합, `hasProjectionFor` 의 "겉은 투영, 실은 노출" 통과 등)은
코드를 직접 열어 반영을 확인했고 재론하지 않는다. 아래는 이번 라운드에서 새로 짚는
구조적 관찰이다.

## 발견사항

- **[WARNING]** `User` 데이터 접근에 단일 통로(chokepoint)가 없다 — 같은 불변식을 세 가지
  서로 다른 방식으로 각자 재구현한다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:55-59,93-108,110-134`
    (`CREATOR_PROJECTION` + TypeORM `select` 투영) vs
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:199-224`
    (`listMembers` — `relations: ['user']` 로 통째로 로드한 뒤 `m.user?.email`/`m.user?.name` 를
    손으로 뽑아 새 객체로 재구성) vs `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:66-73`
    (`EXPECTED_USER_RELATION_LOADS` — `auth.service.ts#logout`/`#refresh` 는 `stored.user` 에서
    `id`/`email` 만 읽는 세 번째 방식)
  - 상세: 이 PR 이 `select: false` 를 기각한 이유는 "`UsersService.findById`/`findByEmail` 이라는
    **공유 깔때기**를 19곳이 지나 46개 호출부에 영향이 퍼진다"는 것이었다(`user-entity-exposure.spec.ts`
    헤더 docstring). 그런데 정작 이번에 새로 정리한 `WorkflowVersionsService` 는 TypeORM
    `select` 옵션에 이름 있는 상수를 넣는 방식으로, `WorkspacesService.listMembers` 는 관계를
    통째로 로드한 뒤 애플리케이션 코드에서 필드를 골라내는 방식으로, `AuthService` 는 또 다른
    방식으로 "`User` 를 안전하게 다루는 법"을 **세 번 독립적으로 재발명**한다. 이 불변식을
    구조로 강제하는 공유 프리미티브(예: `toSafePublicUser(user): {id,name,email}` 헬퍼나
    관계-투영 빌더)가 없다 — 유일한 통합 지점은 `user-entity-exposure.spec.ts` 의 화이트리스트
    (`EXPECTED_USER_RELATION_LOADS`)와 AST 래칫뿐이다. 즉 "새 사이트가 안전한가"는 사람이
    코드리뷰에서 판단해 테스트 베이스라인에 수동으로 추가하는 절차로만 검증되고, 타입 시스템이나
    공유 추상화가 그 상태를 구조적으로 강제하지 않는다. 이 PR 자신이 "목록을 손으로 늘리지 말고
    출처를 바꾸라"(`collectUserRelationNames`)는 원칙을 관계 **이름** 수집에는 적용했지만,
    관계를 **안전하게 반환하는 방법** 자체에는 같은 원칙을 적용하지 않았다 — 3~4곳이 각자 다른
    코드로 같은 문제를 풀고 있어, 다섯 번째 자리가 생기면 또 새로운 방식이 추가될 가능성이 높다.
  - 제안: 급한 조치는 아니다(현재 테스트 래칫이 회귀를 막는다). 다만 다음에 `User` 관계를 노출하는
    자리가 하나 더 생기면, 그 자리도 각자 방식을 고르게 두지 말고 `id`/`name`/`email` 세 필드로
    좁히는 공유 헬퍼(예: `pickPublicUserFields`)나 TypeORM `select` 빌더를 도입해 위 세 가지
    구현을 하나로 수렴시키는 리팩토링을 고려할 것.

- **[WARNING]** `WorkflowVersionDetail`/`WorkflowVersionListItem` 이 로드되지 않는 `workflow`
  관계를 여전히 비-옵셔널로 약속한다 — 이 PR 이 `creator` 에 대해 방금 고친 것과 **같은 형태의
  간극**을 옆 필드에 남겨 둔다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:28-36`
    (`WorkflowVersionListItem`/`WorkflowVersionDetail` 정의, 둘 다 `Omit<WorkflowVersion, …>` 를
    베이스로 쓰고 `workflow` 는 생략 목록에 없음) — 엔티티 선언은
    `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:22-24`
    (`@ManyToOne(() => Workflow) workflow: Workflow`, 비-옵셔널)
  - 상세: `findByWorkflow`(:93-108)와 `findOne`(:110-134) 어느 쪽도 `relations`/`select` 에
    `workflow` 를 넣지 않는다 — 즉 반환되는 런타임 객체에는 `workflow` 프로퍼티가 없다. 그런데
    `WorkflowVersionListItem`/`WorkflowVersionDetail` 은 `Omit<WorkflowVersion, 'snapshot'>`(또는
    `'creator'`)만 빼고 나머지 필드는 그대로 상속하므로, 두 타입 모두 `workflow: Workflow` 를
    **비-옵셔널로 계속 약속**한다. 이는 정확히 이 PR 이 `creator` 에서 고친 문제와 같은 형태다 —
    파일 헤더 주석(:13-19)이 "엔티티 타입은 넓은데 런타임 값은 좁다, 그 간극을 두면 컴파일러가
    못 막는다"고 명시적으로 짚었는데, 그 원칙을 `creator` 에는 적용하고 같은 파일의 `workflow`
    필드에는 적용하지 않았다. 현재는 두 소비처(컨트롤러의 raw 반환, `workflows.service.ts:666`
    의 `restoreVersion` — `target.snapshot` 만 읽음) 모두 `.workflow` 를 건드리지 않아 즉시
    터지는 결함은 아니지만, 다음 소비자가 `version.workflow.name` 을 쓰면 컴파일은 통과하고
    런타임에서 `undefined` 접근으로 깨진다 — `tsc --noEmit` 로는 절대 안 잡히는 자리다.
  - 제안: `WorkflowVersionListItem`/`WorkflowVersionDetail` 정의에서 `workflow` 도 함께
    `Omit` 하거나(간단), 두 쿼리가 `workflow` 를 실제로 로드하도록 바꾼다. `creator` 를 좁힌
    같은 커밋에서 `workflow` 도 같이 처리하는 것이 자연스럽다 — 이미 `Omit<…, 'snapshot' |
    'creator'>` 패턴이 있으므로 `'workflow'` 를 리스트에 추가하는 것으로 충분하다.

- **[INFO]** 구조 가드의 스캔 루트(`src/modules`)가 코드로 강제되지 않는 실측 전제다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:76`
    (`collectTsFiles(path.join(SRC_ROOT, 'modules'))`)
  - 상세: 주석은 "서비스가 전부 그 아래에 있고(실측)"이라고 근거를 남겼고, 직접
    `grep -rl "Repository<" --include="*.service.ts"` 로 재확인한 결과 오늘 시점엔 참이다
    (`src/nodes`·`src/shared`·`src/database`·`src/bootstrap`·`src/scripts` 어디에도 리포지토리를
    쓰는 서비스가 없다). 다만 이 전제 자체를 지키는 별도 가드는 없다 — 나중에 `src/shared/`
    아래에 리포지토리를 직접 쓰는 헬퍼나 `src/nodes/` 아래에 `User` 관계를 로드하는 코드가
    생기면, 이 스캔은 조용히 그 자리를 보지 못한다(래칫이 아니라 애초에 스캔 대상 밖).
  - 제안: 우선순위 낮음 — 지금 당장 구조를 바꿀 필요는 없다. 이 스캔 루트를 넓히는 비용이
    낮으므로(`SRC_ROOT` 전체로 확장해도 fixture 는 이미 스캔 범위 밖에 별도 위치), 다음에 이
    가드를 만질 기회가 있으면 `src/modules` 대신 `src` 전체(단, `repo-guards/__tests__`·
    `shared/testing` 등 테스트 전용 디렉터리는 명시적으로 제외)로 스캔 루트를 넓혀 전제 자체를
    없애는 편이 더 튼튼하다.

- **[INFO]** `hasProjectionFor` 의 "불리언이 아니면 통과" 술어는 이름 있는 상수의 **값**을
  검증하지 않는다 — 이번 자리는 별도 테스트가 우연히 그 구멍을 닫았을 뿐, 구조적으로 강제되지
  않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:277-306`
    (`hasProjectionFor`, 특히 :296-302 "값이 불리언이 아니면 좁힌 것으로 본다")
  - 상세: 이 술어는 단일 파일 AST 만 보므로 `select: { creator: SOME_CONST }` 에서 `SOME_CONST`
    가 실제로 `{id,name,email}` 처럼 좁은 객체인지, 아니면 실수로 `User` 전체를 담은 객체인지
    구분하지 못한다(문서화된 의도적 트레이드오프, 코드 주석에도 명시됨). 이번 PR 은
    `WorkflowVersionsService` 에 한해 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto` OpenAPI
    스키마 대조 테스트(`workflow-versions.service.spec.ts`)를 **별도로** 추가해 이 구멍을
    닫았지만, 이 대조 테스트는 AST 가드와 이름으로도 코드로도 연결돼 있지 않다 — 다음 사람이
    `select: { owner: SOME_OTHER_CONST }` 같은 새 자리를 이름 있는 상수로 만들면, AST 가드는
    통과시키고 그 상수의 실제 값이 좁은지 검증하는 짝 테스트를 추가할지는 전적으로 그 사람의
    판단에 달려 있다.
  - 제안: 우선순위 낮음. AST 가드의 원리적 한계(단일 파일, 타입 체커 없음)를 코드 주석이
    이미 정확히 인지하고 있으므로 지금 구조를 바꿀 필요는 없다 — 다만 다음에 이 영역에
    컨벤션 문서(`spec/conventions/` 또는 인접 JSDoc)를 손볼 기회가 있으면 "이름 있는 상수로
    투영할 때는 그 상수와 응답 DTO 스키마를 대조하는 테스트를 짝으로 둔다"는 규칙을 명문화해
    두면, 이번처럼 우연히 닫힌 구멍이 다음 자리에서도 재현되게 만들 수 있다.

## 요약

핵심 설계(구조 축은 AST 로 "관계가 투영 없이 로드되는가"를, 값 축은 응답 바디를 깊이 훑어
"금지된 이름이 실제로 나갔는가"를 서로 독립적으로 검증)는 견고하다 — 순수 스캔 로직과 소비
spec 을 분리하는 이 저장소의 기존 관례(`swagger-dto-contract-guard.ts`,
`nullable-type-lie-cast-guard.ts`)를 그대로 따르고, 결합도가 낮으며, 세 라운드에 걸친
뮤테이션 검증으로 각 술어의 사각지대(중첩 객체·캐스트 우회·불리언 투영·이름 vs 타입)를
좁혀 왔다. `select:false`·전역 `ClassSerializerInterceptor` 를 기각한 판단도 근거(19곳
공유 깔때기·46개 호출부·fail-silent 인증 위험)가 실측에 기반해 타당하다. 다만 아키텍처
관점에서 두 가지가 남는다 — (1) "`User` 를 안전하게 노출하는 법"을 구조로 강제하는 공유
추상화가 없어 세 자리가 각자 다른 방식으로 같은 문제를 풀고 있고, 유일한 통합 지점은 테스트
화이트리스트뿐이다. (2) 이 PR 이 `creator` 필드에 적용한 "타입을 런타임 값에 맞춰 좁힌다"는
원칙이 같은 파일의 `workflow` 필드에는 적용되지 않아, 방금 고친 것과 같은 형태의 간극이
그대로 남아 있다. 둘 다 지금 당장 보안 사고로 이어지지는 않지만(전자는 테스트 래칫이,
후자는 미사용 소비처가 막는다), 다음 확장 시점에 재발할 수 있는 구조적 부채다.

## 위험도

LOW

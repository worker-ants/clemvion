# 요구사항(Requirement) 리뷰

## 개요

이번 diff 의 실질 코드 변경은 12개 파일이다 — ① `WorkflowVersionsService.findOne` 에 `creator` 투영을 추가해 실제 `User` 전 컬럼 유출(`GET /api/workflows/:wfId/versions/:versionId`)을 닫음, ② `CREATOR_PROJECTION` 상수 신설 + `WorkflowVersionCreatorDto` OpenAPI 스키마와의 자동 대조 테스트, ③ `WorkspaceMemberDto.joinedAt` 필드 뒤늦은 선언, ④ 신규 검출 가드 2축 — `user-entity-exposure-guard.ts`(구조/AST, `User` 관계를 투영 없이 통째로 싣는 자리를 세는 래칫)와 `user-secret-absence.ts`(응답 본문을 깊이 훑어 7개 민감 컬럼명의 부재를 단언), ⑤ 이를 배선한 e2e 3건(`audit-logs`, `workflow-crud` H, `workspace-rbac` J).

핵심 fix(1)는 소스를 직접 읽어 확인했다 — `workflow-versions.service.ts#findOne` 에 `select: { …, creator: CREATOR_PROJECTION }` 이 실제로 들어갔고, `WorkflowVersionsController.findOne` 은 여전히 가공 없이 반환한다(pass-through, 재확인 완료). `User` 엔티티의 실제 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)과 `USER_SECRET_KEYS` 상수를 대조해 정확히 7/7 일치함을 확인했다. 관련 unit 3개 스위트(`user-entity-exposure.spec.ts`, `user-secret-absence.spec.ts`, `workflow-versions.service.spec.ts`)를 직접 `npx jest` 로 실행해 **31/31 통과**를 확인했고, `git status --short` 로 트리에 잔여 뮤테이션이 없음을 확인했다(읽기 전용 검증만 수행, 저장소에 쓰기 없음).

e2e 신규 테스트의 시나리오 레터(`workspace-rbac.e2e-spec.ts` 의 `J.`)가 기존 레터와 충돌 없이 유일함(A~J)을 재확인했고 — 직전 라운드(`10_13_22`)에서 지적된 `F.` 중복은 실제로 고쳐져 있다.

## 발견사항

- **[WARNING]** `findOne`/`findByWorkflow` 의 반환 타입이 `creator` 를 여전히 전체 `User` 로 약속한다 — 이 PR 이 경계하는 바로 그 "fail-silent" 패턴을 타입 레벨에서 재생산
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 시그니처 `Promise<WorkflowVersion>` (파일 90행대), `WorkflowVersionListItem = Omit<WorkflowVersion, 'snapshot'>` (16행); 엔티티 `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts:40` `creator: User`.
  - 상세: 이번 fix 는 **런타임 select** 로 `creator` 를 `{id,name,email}` 세 필드로 좁혔지만, TS 타입은 두 메서드 모두 `creator: User`(전체 20+ 컬럼, `passwordHash`·`twoFactorSecret` 포함)를 그대로 약속한다. 즉 앞으로 이 메서드들의 반환값을 쓰는 새 코드가 `version.creator.passwordHash` 를 참조해도 **컴파일러가 막지 못하고**, 런타임엔 `undefined` 가 조용히 나온다 — CHANGELOG·`CREATOR_PROJECTION` JSDoc 이 `select:false` 를 기각한 바로 그 이유("hasComparePassword(x, undefined) 처럼 조용히 실패")와 동형인 위험을 반대편(읽기 타입)에 남겨 뒀다. `findByWorkflow` 는 이 PR 이전부터 같은 상태였으므로 이번 diff 가 **새로 만든** 구멍은 아니지만, 이번에 `findOne` 에도 **똑같은 패턴을 의식적으로 복제**했으므로(같은 `CREATOR_PROJECTION` 상수 재사용) 두 자리 모두를 그대로 남겨 뒀다는 점에서 이번 diff 의 범위 안이다. 컴파일 확인: `npx tsc --noEmit` 실행 결과 두 메서드 관련 타입 오류 0건 — 즉 이 lie 는 정적으로 전혀 걸리지 않는다(직접 실행해 확인).
  - 제안: `findOne`/`findByWorkflow` 의 반환 타입에서 `creator` 를 `Pick<User,'id'|'name'|'email'> | null` 로 좁힌 별도 타입(예: `WorkflowVersionWithCreatorProjection = Omit<WorkflowVersion,'creator'> & { creator: Pick<User, keyof typeof CREATOR_PROJECTION> | null }`)으로 대체해, 새 소비자가 컴파일 타임에 이미 걸리게 한다. `WorkflowVersionListItem` 이 `snapshot` 을 이미 이 방식(`Omit`)으로 좁힌 선례가 있다.

- **[WARNING]** `user-entity-exposure-guard.ts` 의 AST 스캔이 TypeORM `eager: true` 관계를 전혀 보지 않는다 — 이 가드가 막으려는 "구조가 생기는 순간 잡는다" 는 목표에 뚫린 사각지대
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `findUserRelationLoads`(전체 함수, 세 형태만 스캔: `relations` 배열/객체·`leftJoinAndSelect`/`innerJoinAndSelect`).
  - 상세: TypeORM 의 `@ManyToOne(() => User, { eager: true })` 는 **`relations` 옵션도 `leftJoinAndSelect` 호출도 없이** 모든 `find()`/`findOne()` 호출에서 자동으로 `User` 를 통째로 조인해 싣는다. 이 가드는 정확히 이 세 형태(배열/객체 `relations`, join 호출)만 AST 로 순회하므로, 누군가 나중에 어떤 엔티티에 `User` 관계를 `eager:true` 로 선언하면 — **어떤 서비스 코드도 건드리지 않고** — 그 관계를 참조하는 모든 기본 조회가 조용히 `User` 전 컬럼을 싣기 시작하는데, 이 가드도 `EXPECTED_USER_RELATION_LOADS` 래칫도 그 변경을 전혀 보지 못한다(엔티티 파일의 `relations` 옵션이 아니라 데코레이터 인자를 스캔하지 않기 때문). 실측: 현재 `User` 를 가리키는 13개 `@ManyToOne(() => User, …)` 선언 전부 `eager` 옵션 없음(grep 으로 확인, 0건) — 지금 당장 살아있는 유출은 아니다. 다만 CHANGELOG·가드 JSDoc 이 "세 형태" 라고 못 박아 이 가드가 포괄적이라는 인상을 주는데, 정작 "관계 이름을 손으로 늘리지 말고 타입에서 파생하자" 는 이 PR 의 핵심 교훈(첫 판이 이름 기반이라 `creator` 를 놓쳤던 것과 동일 계열)이 이번엔 **로딩 방식 축**에서 반복될 수 있는 자리다.
  - 제안: `collectUserRelationNames` 근처에 `@ManyToOne`/`@OneToOne` 데코레이터의 `eager: true` 옵션을 함께 스캔하는 술어를 추가하거나, 최소한 가드 JSDoc/CHANGELOG 에 "entity-level eager 관계는 이 가드의 스캔 대상이 아니다" 라고 명시해 커버리지 주장을 실제 범위에 맞춘다.

- **[INFO]** `enclosingName` 이 클래스 필드 화살표 메서드(`foo = async (...) => {...}`)를 인식하지 못해 그런 형태의 위반은 위치가 `<module>` 로 뭉뚱그려진다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수 `enclosingName` — `MethodDeclaration`/`FunctionDeclaration`/`GetAccessorDeclaration` 만 "메서드" 로 인식하고, 화살표 함수가 `PropertyDeclaration` 의 이니셜라이저인 경우는 그 상위 `VariableDeclaration` 분기에도 걸리지 않아 최종적으로 `'<module>'` fallback 으로 떨어진다.
  - 상세: 검출 자체(존재 여부)는 잃지 않는다 — `EXPECTED_USER_RELATION_LOADS` 의 정확 일치 단언이 새 키(`file#<module>` 또는 `#2` 접미)를 여전히 실패시키므로 위반은 걸린다. 다만 같은 파일에 이런 화살표 필드 메서드가 둘 이상이면 전부 `<module>`/`<module>#2`/… 로 접혀 "어느 메서드가 문제인가" 를 사람이 diff 로만 알 수 있다. 현재 `src/modules` 안에서 실제 클래스 필드 화살표 메서드로 작성된 서비스(`execution-engine.service.ts` 등)를 확인했으나 `User` 관계를 다루는 자리는 없어 지금 당장 영향은 없다.
  - 제안: 낮은 우선순위 — `enclosingName` 이 `ts.isPropertyDeclaration(cur) && ts.isIdentifier(cur.name)` 도 fallback 후보로 받아들이면 이 형태도 메서드/필드 이름으로 리포트된다.

- **[INFO]** 신규 unit 테스트의 전제(vacuous-guard) 처리가 꼼꼼함 — 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts:46-49`(`expect(declared.length).toBeGreaterThan(0)` 선행), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:100-113`(엔티티 파일 0개·스캔 0건 전제 가드).
  - 상세: `CREATOR_PROJECTION` ↔ DTO 스키마 대조 테스트가 스키마가 빈 객체일 때 두 빈 배열이 조용히 `toEqual` 통과하는 vacuous 케이스를 먼저 배제해 뒀다. 직접 실행해 실제로 `declared`가 `['email','id','name']` 로 채워짐을 확인했다(`npx jest` 결과 통과). 감점 요소 아님, 좋은 패턴으로 기록.

## 요약

핵심 요구사항 — `GET /api/workflows/:wfId/versions/:versionId` 의 실제 `User` 전 컬럼 유출을 `select` 투영으로 닫는 것 — 은 소스 재확인과 `npx jest` 실행(31/31 통과)으로 검증됐고, 자매 메서드와의 리터럴 중복 문제도 `CREATOR_PROJECTION` 상수 + DTO 스키마 대조 테스트로 구조적으로 재발 방지됐다. `USER_SECRET_KEYS` 7컬럼은 `user.entity.ts` 실제 컬럼과 정확히 일치하고, e2e 레터 충돌(이전 라운드 WARNING)도 고쳐져 있다. 다만 신설된 방어 인프라 자체에 두 가지 latent 갭이 남는다 — (1) `creator` 투영 타입이 여전히 전체 `User` 를 약속해 이 PR 이 경계하는 "타입-런타임 불일치로 인한 fail-silent" 패턴을 반대편(읽기 타입)에 재생산하고, (2) 구조 축 가드가 TypeORM `eager: true` 관계 형태를 전혀 스캔하지 않아 "세 형태를 커버한다" 는 주장보다 실제 커버리지가 좁다. 둘 다 현재 살아있는 유출은 아니며(엔티티 실측으로 확인) 이 PR 이 닫은 Critical 을 되살리지 않지만, 이 PR 의 서사 자체가 "정의를 한 칸 좁게 잡으면 다음 유출로 이어진다" 이므로 후속으로 다루는 것이 이 PR 의 취지에 부합한다.

## 위험도

LOW

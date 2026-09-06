# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 이전 라운드가 찾은 실제 유출(`WorkflowVersionsService.findOne` 의 `User` 전 컬럼 노출)은 `CREATOR_PROJECTION` 투영 + 3중 테스트(unit/e2e)로 실제 코드에서 닫혀 있음을 이번 라운드 10개 reviewer 전원이 재확인했다. 이번 라운드는 그 방어 인프라 자체의 사각지대(WARNING 4건, 전부 low-priority 잠재 갭이며 현재 저장소에 실제 위반 0건)를 새로 찾았다. forced 화이트리스트(7명) 전원 결과 확보, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/검출가드 | 신규 AST 가드(`user-entity-exposure-guard.ts`)가 TypeORM `@ManyToOne(() => User, { eager: true })` 같은 **eager 관계 로딩**을 전혀 스캔하지 않는다. `findUserRelationLoads`/`collectUserRelationNames` 는 호출부의 `relations` 옵션·`*JoinAndSelect` 텍스트만 찾는데, eager 관계는 호출부에 그런 텍스트가 아예 없어 자동으로 `User` 전 컬럼을 조인해 싣는다. 현재 저장소엔 `User` 를 가리키는 eager 관계 0건(실측)이라 즉시 위험은 아니지만, 이 가드가 "마지막 방어선"을 자처하는 만큼 다음에 성능 목적으로 `eager:true` 를 붙이면 이 검출망이 영구히 놓친다 — 감사 로그 유출(#1288)이 남긴 "검출망이 한 형태를 놓치면 그 자리가 산다"는 교훈이 재발할 수 있는 새 형태 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`findUserRelationLoads`, `collectUserRelationNames`) | 관계 데코레이터(`@ManyToOne`/`@OneToOne`)의 `eager: true` 옵션을 파싱해 `User` 관계에 붙은 자리를 위반(또는 최소 경고)으로 잡는 fixture 추가. 최소한 가드 JSDoc/CHANGELOG 에 "eager 관계는 스캔 대상 아님" 명시 |
| 2 | 테스트 | `hasProjectionFor` 가 `select.<relation>` 키가 **존재하는지**만 보고, 그 값이 실제로 컬럼을 나열하는 객체(`{id:true,...}`)인지 아니면 관계 전체를 싣는 불리언(`true`)인지는 검사하지 않는다. `select: { creator: true }` 는 컬럼을 좁히지 않고 `relations: { creator: true }` 단독과 사실상 동일한 오버페치를 내는데, 이 가드는 "존재하니 통과"로 판정해 놓친다 — 이 PR 전체가 막으려는 결함 클래스(외형은 투영인데 실은 전체 노출)를 가드 자신이 재현할 수 있는 자리이고, fixture 도 이 분기를 어느 방향으로도 관측하지 않는다(뮤테이션해도 안 걸림) | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` `hasProjectionFor` (198~220행) | `sel.initializer` 가 `ts.isObjectLiteralExpression` 인지 확인하는 조건 추가. fixture 에 `select:{creator:true}`(불리언, 위반)와 `select:{creator:{id:true}}`(객체, 준수) 케이스 각 1개 추가 |
| 3 | 문서화/유지보수 | 가드 spec 테스트 제목이 "위반 10형태"라고 적지만 `fixtures/user-relation-load.fixture.ts` 는 실제로 **11개** 위반 함수(`violationRelationsUser`~`violationSatisfiesRelations`)를 정의하고, 같은 브랜치의 `RESOLUTION.md`(10_53_48) 도 "위반 11형태"라고 스스로 못 박아 뒀다. 단언 자체(`.toEqual([...])` 전체 목록 비교)는 정확해 기능적 결함은 아니지만, 이 저장소가 반복 지적해 온 "실측 수치가 문서마다 따로 노는" 패턴이 테스트 설명 문자열에서 재현됨 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:135` | "위반 10형태"→"위반 11형태"로 정정. 재발 방지로 `found.length` 를 별도 단언하거나 숫자 대신 "fixture 의 위반 함수 전부를 잡는다" 식 문구로 교체 |
| 4 | 요구사항/타입안전성 | `WorkflowVersionsService.findOne`/`findByWorkflow` 의 반환 타입이 여전히 `creator: User`(전체 컬럼, `passwordHash`·2FA 시크릿 포함)를 약속한다 — 런타임은 `CREATOR_PROJECTION` 으로 3필드만 싣지만 TS 타입은 그대로 넓어, 이 PR 이 `select:false` 를 기각한 이유("comparePassword(x, undefined) 처럼 조용히 실패")와 동형인 위험을 반대편(읽기 타입)에 재생산한다. 새 소비자가 `version.creator.passwordHash` 를 참조해도 컴파일러가 못 막는다(`tsc --noEmit` 확인 결과 오류 0건). 다만 값이 좁고 타입이 넓은 방향이라 즉시 유출은 아니며(side_effect/api_contract reviewer 는 이를 INFO·"안전한 방향의 불일치"로 평가) | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`/`findByWorkflow` 시그니처) | 반환 타입을 `Omit<WorkflowVersion,'creator'> & { creator: Pick<User,'id'|'name'|'email'> \| null }` 류로 좁혀 컴파일 타임에도 드러나게 함. `WorkflowVersionListItem` 이 `snapshot` 을 `Omit` 으로 좁힌 선례 있음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(정상 확인) | 핵심 Critical(버전 작성자 `creator` 관계의 `User` 전 컬럼 유출, `GET /api/workflows/:wfId/versions/:versionId`)이 `CREATOR_PROJECTION` 투영 + unit 31/31 통과 + e2e 3축(이름 부재·계약 대조·`creator` 3필드 양성)으로 실제 코드에서 닫혀 있음을 다수 reviewer 가 직접 재확인 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`, `workflow-versions.controller.ts:81` | 없음 — 정상 처분 확인 |
| 2 | 데이터베이스 | `WorkspacesService.listMembers` 는 이번 diff 로 e2e 커버리지가 처음 붙었지만, DB 쿼리 자체는 여전히 `relations:['user']` + select 없이 `User` 전 컬럼을 오버페치하고 애플리케이션 레벨 `.map()` 재투영에만 의존한다 — 이 재투영을 실수로 지우면(예: 스프레드 치환) 유출이 재발할 구조적 여지가 남음. 가드의 화이트리스트가 이 자리를 "늘지 않게" 만 동결 | `codebase/backend/src/modules/workspaces/workspaces.service.ts` `listMembers` | 후속 과제로 `relations`+`select` 또는 `leftJoin`+`addSelect` 투영 적용 |
| 3 | 데이터베이스 | `User` 엔티티에 `select:false` 같은 컬럼 수준 DB 방어가 전혀 없음(실측 0건) — 이번 PR 은 의도적으로 "검출만" 전략을 택함(19곳 공유 로더 재배선 필요·인증 조용한 실패 위험 실측 근거). 근본 해법은 미해결로 남되 CHANGELOG 가 이미 인지 | `codebase/backend/src/modules/users/entities/user.entity.ts` | 조치 불요(범위 밖). plan 후속 조건("19곳 로더 재배선 전제") 등재 여부만 확인 권장 |
| 4 | API 계약 | `WorkspaceMemberDto.joinedAt` 필드 추가는 이미 wire 에 나가고 있던 값의 뒤늦은 §5.4 준수 선언 — breaking change 아님, FE 는 이미 소비 중. user_guide_sync 검토 결과 실제 렌더링하는 UI 요소가 없어(dormant field) user-guide 갱신 의무도 발생 안 함 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:93` | 조치 불요. 이 필드를 실제 UI에 노출하는 후속 PR 에서 `07-workspace-and-team/workspaces-and-members.mdx` 동반 갱신 재점검 |
| 5 | 유지보수성 | `findUserRelationLoads` 내부 "점 구분 경로의 마지막 세그먼트" 추출 로직이 3곳에 인라인 반복 — 이전 라운드에서 이미 지적·저비용 defer 결정된 사안, 재발 아님 | `user-entity-exposure-guard.ts:95,163,296` | 기존 defer 유지, 조치 불요 |
| 6 | 요구사항 | `enclosingName` 이 클래스 필드 화살표 메서드(`foo = async (...) => {}`)를 인식 못해 위반 위치가 `<module>` 로 뭉뚱그려짐 — 검출 자체는 잃지 않음(정확 일치 단언이 새 키를 여전히 실패시킴), 현재 `User` 관계를 다루는 화살표 필드 메서드는 없어 즉시 영향 없음 | `user-entity-exposure-guard.ts` `enclosingName` | 낮은 우선순위 — `PropertyDeclaration` 도 fallback 후보로 인식하도록 보강 |
| 7 | 테스트 | 중첩 관계(`relations:{a:{creator:true}}`)를 같은 깊이로 중첩 투영(`select:{a:{creator:{...}}}`)해도 `hasProjectionFor` 는 최상위 한 겹만 봐서 준수 형태를 위반으로 오판할 수 있음(false-positive 방향, 안전 쪽) | `user-entity-exposure-guard.ts` `hasProjectionFor` | 우선순위 낮음 — 실제 중첩 투영 형태 등장 시 재귀로 확장 |
| 8 | 테스트 | `unwrap()` 의 4가지 캐스트 형태 중 구식 타입 단언(`<T>expr`)은 fixture 로 관측되지 않음(죽은 분기) | `user-entity-exposure-guard.ts` `unwrap` | 선택적, 급하지 않음 |
| 9 | 문서화 | 신규 검출 가드 2쌍이 spec `code:` frontmatter 에 미등재 — 이미 발견·`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재 완료(developer 의 `spec/` 쓰기 권한 밖이므로 정당한 처분) | `plan/in-progress/spec-draft-nullable-notation-followups.md:367-393` | 조치 불요 — 이미 tracked |
| 10 | 스코프 | 마지막 fix 커밋(`9a186fa31`)을 `git show` 로 직접 대조한 결과 RESOLUTION.md 가 선언한 6개 항목과 실제 diff 가 정확히 1:1 일치 — 범위 이탈 없음(104줄 e2e diff 는 순수 블록 이동) | 커밋 `9a186fa31` 전체 | 없음 — 정상 처분 확인 |
| 11 | 부작용/설계 | 신규 가드 2종 모두 순수 함수 + 읽기 전용 `fs` 접근만 사용, 전역 가변 상태·환경 변수·네트워크 호출 없음. 두 신규 테스트 전용 파일 모두 `tsconfig.build.json` 기존 exclude 패턴 하위라 프로덕션 dist 오염 없음 | `user-entity-exposure-guard.ts`, `user-secret-absence.ts` | 없음 |
| 12 | 테스트(설계 우수) | 신규 e2e(`workspace-rbac` J, `workflow-crud` H) 가 이름 기반 부재 단언(`expectNoUserSecrets`)을 계약 대조(`assertMatchesContract`)보다 먼저 호출하도록 순서를 실측(뮤테이션)으로 고정 — 계약 오류가 이름 축을 가리지 않게 설계 | `workspace-rbac.e2e-spec.ts:631-638`, `workflow-crud.e2e-spec.ts:559-571` | 없음 — 우수 패턴으로 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | eager 관계 로딩이 신규 가드 검출망 밖(WARNING); 핵심 Critical 은 실제로 닫혀 있음 재확인 |
| requirement | LOW | `creator` 반환 타입이 여전히 `User` 전체(WARNING); eager 스캔 사각지대(WARNING); 그 외 회귀 없음 |
| scope | NONE | 마지막 fix 커밋이 RESOLUTION 선언과 1:1 일치, 범위 이탈 없음 |
| side_effect | NONE | 실질 side-effect 표면 2곳 모두 안전한 방향(축소/추가적 선언), 새 부작용 없음 |
| maintainability | LOW | 테스트 설명 "위반 10형태" stale count(WARNING) 1건, 나머지 이전 라운드 지적 전부 해소 확인 |
| testing | LOW | `hasProjectionFor` 가 select 값의 실제 좁힘 여부를 검사 안 함(WARNING); 핵심 회귀는 3층 방어로 견고 |
| documentation | LOW | 동일 stale count(WARNING) 1건, 나머지 문서/주석 실측 대조 전부 일치 |
| database | LOW | `listMembers` 오버페치 잔존·`select:false` 부재는 기존 인지된 범위 밖 사안(INFO), 핵심 fix 는 SQL 레벨 실제 검증 |
| api_contract | NONE | wire 계약 변경 없음, breaking change 없음, 커버리지 갭 2건 신설로 개선 |
| user_guide_sync | NONE | 매칭 trigger 1건(`joinedAt`) 실측 결과 dormant field, 유저 가이드 갱신 의무 없음 |

## 발견 없는 에이전트

scope, side_effect, api_contract, user_guide_sync, database — Critical/Warning 없이 INFO(정상 확인·기존 인지 사안) 만 보고.

## 권장 조치사항

1. `hasProjectionFor` 가 `select` 값이 실제 객체(컬럼 나열)인지 검사하도록 보강하고, `select:{relation:true}`(불리언, 미좁힘) 위반 fixture + 준수 fixture 를 추가한다 — 이 PR 이 막으려는 결함 클래스를 가드 자신이 재현할 수 있는 유일한 미관측 지점이므로 우선순위가 가장 높다.
2. `user-entity-exposure-guard.ts` 에 TypeORM `eager: true` 관계 데코레이터 옵션을 스캔하는 술어를 추가하거나, 최소한 JSDoc/CHANGELOG 에 이 가드의 스캔 범위 한계로 명시한다.
3. `user-entity-exposure.spec.ts:135` 의 "위반 10형태"를 "위반 11형태"로 정정한다(저비용, 즉시 처리 가능).
4. 여유가 되면 `WorkflowVersionsService.findOne`/`findByWorkflow` 반환 타입을 `Omit<WorkflowVersion,'creator'> & {creator: Pick<User,...> | null}` 류로 좁혀 타입-런타임 불일치를 컴파일 타임에 드러낸다.
5. (범위 밖, 후속 과제로 tracked) `WorkspacesService.listMembers` 쿼리 자체의 SQL 레벨 투영과 `User` 엔티티 `select:false` 전환은 이미 CHANGELOG/plan 에 인지된 별도 후속 항목이므로 이번 PR 의 머지를 막을 필요는 없다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련 낮음(정적 스캔/투영 변경, 성능 critical path 아님) |
  | architecture | router 판단상 이번 diff 와 관련 낮음(기존 아키텍처 패턴 재사용) |
  | dependency | router 판단상 이번 diff 와 관련 낮음(신규 외부 의존성 없음) |
  | concurrency | router 판단상 이번 diff 와 관련 낮음(동시성 로직 변경 없음) |
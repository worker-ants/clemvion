# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 이번 PR 이 신설한 eager-관계 검출 축(`findEagerUserRelations`/`hasEagerDecorator`)이 뮤테이션 실행으로 실제 검출력 0 임이 확인됐고(testing, MEDIUM), 그 외 아키텍처 구조 부채 2건과 SPEC-DRIFT 2건이 후속 조치 대상으로 남아 있다. 강제(router_safety) 화이트리스트 7개(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인 — 강제 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | eager 관계 검출 축(`findEagerUserRelations`/`hasEagerDecorator`)에 양성 fixture 가 없다 — `hasEagerDecorator` 본문을 `return false`로 완전히 무력화해도 가드 spec 15/15 전부 GREEN(직접 뮤테이션 실행으로 확인). 이 축이 막으려는 위험(호출부에 텍스트를 안 남기는 `eager:true`)이 현재 0건이라는 사실과 함수의 검출 능력 자체는 서로 다른 주장인데, 지금 테스트는 전자만 확인한다 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`findEagerUserRelations` 79행 부근, `hasEagerDecorator` 109행 부근), 소비 테스트 `user-entity-exposure.spec.ts` 106행 부근 | `eager:true` 데코레이터가 붙은 더미 엔티티(양성) + `eager` 없거나 `false`(음성) 최소 fixture 를 추가해 `findEagerUserRelations` 자체의 검출력을 직접 단언 |
| 2 | 아키텍처 | `User` 데이터 접근에 단일 통로(chokepoint)가 없다 — `workflow-versions`/`workspaces`/`auth` 세 서비스가 "안전하게 반환하는 법"을 각자 다른 방식으로 재구현한다. 유일한 통합 지점은 테스트 화이트리스트(`EXPECTED_USER_RELATION_LOADS`)뿐 | `workflow-versions.service.ts:55-59,93-134` (select 투영) / `workspaces.service.ts:199-224` (관계 통째 로드 후 손으로 필드 추출) / `user-entity-exposure.spec.ts:66-73` | 공유 헬퍼(예: `pickPublicUserFields`)나 select 빌더로 수렴 고려 — 급하지 않음, 다섯 번째 자리 생길 때 재검토 |
| 3 | 아키텍처 | `WorkflowVersionListItem`/`WorkflowVersionDetail` 이 로드되지 않는 `workflow` 관계를 여전히 비-옵셔널로 약속한다 — 이번 PR 이 `creator` 에 대해 방금 고친 것과 같은 형태의 타입-런타임 간극이 `workflow` 필드에 남아 있다(현재는 미사용 소비처라 즉시 터지지 않음) | `workflow-versions.service.ts:28-36` (타입 정의), `entities/workflow-version.entity.ts:22-24` | `Omit` 목록에 `'workflow'` 추가하거나 쿼리가 `workflow` 를 실제로 로드하도록 수정 |
| 4 | 유지보수성/문서화 | JSDoc 블록이 `collectUserRelationNames` 를 설명하는 내용인데 `findEagerUserRelations` 위에 얹혀 있고, 정작 `collectUserRelationNames` 선언(132행)은 무주석 상태 — 함수 삽입 과정에서 주석이 밀려남 | `user-entity-exposure-guard.ts` 46~78행(고아 JSDoc 2블록 연속), 132행(`collectUserRelationNames` 선언) | 첫 JSDoc 블록을 `collectUserRelationNames` 선언 바로 위로 이동 |
| 5 | 유지보수성 | 엔티티 파일을 스캔해 `User` 타입 속성을 찾는 AST 순회 골격이 `findEagerUserRelations`/`collectUserRelationNames` 두 함수에 거의 그대로 복제됨 — 이 PR 자신이 강조한 "목록을 손으로 늘리지 말고 출처를 바꿔라" 원칙이 이 순회 로직 자체에는 적용되지 않음 | `user-entity-exposure-guard.ts:79-106, 132-156` | `walkUserTypedProperties(entityFiles, cb)` 같은 공통 헬퍼로 추출, 각 함수는 필터/출력 포맷 차이만 실어 호출 |
| 6 | SPEC-DRIFT | [SPEC-DRIFT] §5.4/`swagger.md §5-1` 의 "두 검증자" 서술이 이번 PR 이 신설한 3·4번째 검출 축(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)을 반영하지 못해 실제 검증자 수(4개)와 불일치 — 코드가 옳고 spec 문구가 낡은 형태 | `spec/5-system/2-api-convention.md` §5.4 "검증 층", `spec/conventions/swagger.md` §5-1 | `project-planner` 턴에서 §5.4 표에 두 축을 나열형으로 등재 + `code:` frontmatter 갱신. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 owner:planner 항목으로 등재·3차 재확인됨 — developer 권한 밖(신규 조치 아님, 재확인) |
| 7 | SPEC-DRIFT | [SPEC-DRIFT] `User` 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`) 응답 노출 금지가 spec 규범 문장으로 존재하지 않는다 — `USER_SECRET_KEYS` 가 유일한 SoT | `spec/conventions/secret-store.md` §1.1, `spec/1-data-model.md` §2.1 User | `secret-store.md §1.1` 또는 `1-data-model.md §2.1` 에 노출 금지 규범 문장 + `## Rationale` 추가. 같은 plan 파일에 이미 등재됨 — developer 권한 밖(재확인) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `hasProjectionFor` 가 `select` 값이 불리언 리터럴인지만 보고 식별자(변수)의 실제 평가값은 보지 않음 — 명명 상수로 우회 가능하나 실사용 유인 낮고 값 축(`user-secret-absence.ts`)이 백업 | `user-entity-exposure-guard.ts:277-306` | JSDoc 에 이 사각지대 한 줄 명시(선택) |
| 2 | 보안/아키텍처 | 이 PR 의 방어 전략 전체가 런타임 차단이 아니라 CI 테스트 시점 검출 — `select:false`/전역 `ClassSerializerInterceptor` 기각 근거(19곳 공유 깔때기·46개 호출지점·fail-silent 위험)는 실측에 기반해 타당한 설계 의도 | `CHANGELOG.md`, `user-entity-exposure.spec.ts` 헤더 | 조치 불요 — 설계 의도대로 |
| 3 | 아키텍처 | 구조 가드 스캔 루트(`src/modules`)가 "서비스는 전부 그 아래" 라는 실측 전제일 뿐 코드로 강제되지 않음 | `user-entity-exposure.spec.ts:76` | 스캔 루트를 `src` 전체(테스트 디렉터리 제외)로 넓혀 전제 자체를 없애는 것 고려 |
| 4 | 요구사항 | `WorkflowVersionDetail`/`ListItem` 의 `creator` 타입이 `optional+nullable`(DTO, 방어적)인데 엔티티는 not-null — 더 보수적인 방향이라 위험 없음(기존 라운드 판정 재확인) | `workflow-versions.service.ts`(`ProjectedCreator`), `workflow-version-response.dto.ts` | 조치 불요 |
| 5 | 범위 | `WorkspaceMemberDto.joinedAt` 추가는 핵심 목표(User 컬럼 방어) 밖 파생 갭 — 최초 feat 커밋에서만 추가, 이후 3개 fix 커밋 무관, 3차례 재확인 | `workspaces/dto/responses/workspace-response.dto.ts` | 조치 불요 |
| 6 | 부작용 | `CREATOR_PROJECTION` 을 두 호출부가 같은 객체 참조로 공유 — `as const` 는 타입레벨만 동결, 런타임 동결 아님(TypeORM 이 in-place 변경한다는 근거 없어 실질 위험 낮음) | `workflow-versions.service.ts` (`CREATOR_PROJECTION`) | `Object.freeze(CREATOR_PROJECTION)` 고려(선택) |
| 7 | 부작용 | `findOne` 반환 타입이 `Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>` 로 좁혀짐(공개 provider 시그니처 변경) — 유일한 내부 소비자(`restoreVersion`)가 영향받지 않는 필드만 사용함을 전수 확인 | `workflow-versions.service.ts` (`findOne`), `workflows.service.ts:666` | 조치 불요 |
| 8 | 부작용 | 신규 가드가 spec 파일 수집(collect) 시점에 `src/modules` 전체를 동기 파일 I/O 로 훑음 — 형제 가드(`nullable-type-lie-cast-guard.ts` 등)와 동일한 기존 패턴, 순수 읽기 전용 | `user-entity-exposure.spec.ts` | 조치 불요 |
| 9 | 유지보수성 | fixture 위반 개수를 kind 별로 나눠 세는 단언에 매직 넘버(2·11)가 남아 fixture 늘 때 손으로 동기해야 함(같은 파일이 "제목에 개수 적지 않기" 교훈은 이미 반영) | `user-entity-exposure.spec.ts` | kind별 method 이름까지 단언하도록 개선(선택) |
| 10 | 테스트 | 신규 스키마 대조 테스트가 저장소 자체 `schemaOf(doc, name)` 헬퍼(정확히 이 실패를 막으려고 만들어짐)를 안 쓰고 `schemasOf(doc)` 를 직접 인덱싱 — DTO 이름 오타/미참조 시 무명 `TypeError` 재도입 가능 | `workflow-versions.service.spec.ts:43` | `schemaOf(doc, 'WorkflowVersionCreatorDto')` 로 교체 |
| 11 | 문서화 | 신규 가드 2종의 spec `code:` 미등재는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재됨(직전 라운드 지적이 올바른 경로로 처리됨, 재확인) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 — 후속 planner 턴에서 진행 |
| 12 | API 계약 | `WorkflowVersionsService.findOne` 의 과거 전 컬럼 유출이 런타임 투영(`CREATOR_PROJECTION`)+DTO 선언(`WorkflowVersionCreatorDto`)+TS 반환 타입(`WorkflowVersionDetail`) 3중으로 닫혔고, 세 축 일치가 스키마 대조 테스트로 강제됨을 확인 | `workflow-versions.service.ts`, `workflow-version-response.dto.ts` | 조치 불요 |
| 13 | API 계약 | `WorkspaceMemberDto.joinedAt` 추가는 이미 wire 에 나가던 값의 뒤늦은 선언 — additive, breaking change 아님 | `workspace-response.dto.ts` | 조치 불요 |
| 14 | API 계약 | `GET /workflows/:wfId/versions/:versionId`, `GET /workspaces/:id/members` 두 엔드포인트에 응답 계약 커버리지(선언 대조 + 이름 기반 부재)가 이번 PR 로 처음 생김 | `workflow-crud.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts` | 조치 불요 — 커버리지 개선 |
| 15 | API 계약 | workspace members 응답이 `{data:[...]}` 형태로 페이지네이션 메타 없음 — 이번 diff 이전부터의 기존 동작, 범위 밖 | `workspace-rbac.e2e-spec.ts` | 조치 불요(범위 밖) |
| 16 | 유저가이드 동기화 | `WorkspaceMemberDto.joinedAt` 은 매트릭스 "백엔드 API 추가·변경" trigger 에 매칭되지만, frontend 에서 타입 선언만 있을 뿐 렌더링하는 컴포넌트가 0건(dormant 필드)이라 user-guide 갱신 의무 없음 | `workspace-response.dto.ts`, `frontend/src/lib/api/workspaces.ts:10` | 조치 불요 — 향후 실제 렌더링 PR 이 나오면 그때 재트리거됨을 인지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `hasProjectionFor` 불리언-리터럴 사각지대(INFO), 방어전략이 CI 검출뿐(INFO). Critical 유출은 이번 diff 로 이미 닫혔음을 재확인 |
| architecture | LOW | `User` 안전 반환 방식이 3곳에서 각자 재발명(WARNING), `workflow` 관계 타입-런타임 간극(WARNING) |
| requirement | LOW | SPEC-DRIFT 2건("두 검증자" 문구 stale, User 노출 금지 규범 문장 부재) — 둘 다 developer 권한 밖, plan 에 이미 등재 |
| scope | NONE | 4개 커밋 13개 파일 전부 단일 목적에 대응, 범위 이탈 없음 |
| side_effect | NONE | 순수 함수/쿼리 select 좁히기뿐, 상태 변경 부작용 없음 |
| maintainability | LOW | JSDoc 오배치(WARNING), AST 순회 로직 복제(WARNING) |
| testing | MEDIUM | eager 관계 검출 축에 양성 fixture 없음 — 뮤테이션 실행으로 검출력 0 확인(WARNING) |
| documentation | LOW | JSDoc 오배치(WARNING, maintainability 와 동일 항목 중복 지적) |
| api_contract | NONE | 계약 위반 없음, 커버리지 신설 확인 |
| user_guide_sync | NONE | 매칭 trigger 1건(joinedAt) 있으나 실질 갱신 의무 없음 |

## 발견 없는 에이전트

해당 없음 — 모든 에이전트가 최소 INFO 이상 발견사항을 보고함.

## 권장 조치사항

1. `findEagerUserRelations`/`hasEagerDecorator` 에 양성/음성 fixture 를 추가해 eager-관계 검출 축의 실제 검출력을 확보한다(현재 뮤테이션 테스트로 검출력 0 확인됨) — testing WARNING #1, 가장 시급.
2. `user-entity-exposure-guard.ts` 의 고아 JSDoc 블록을 `collectUserRelationNames` 위로 옮기고, `findEagerUserRelations`/`collectUserRelationNames` 의 중복된 AST 순회 골격을 공통 헬퍼로 추출한다 — maintainability/documentation WARNING #4,#5.
3. `WorkflowVersionListItem`/`Detail` 의 `workflow` 필드를 `Omit` 하거나 실제 로드하도록 고쳐, `creator` 에 적용한 타입-런타임 일치 원칙을 동일하게 적용한다 — architecture WARNING #3.
4. `project-planner` 턴에서 §5.4/`swagger.md §5-1` 의 "두 검증자" 서술과 `secret-store.md`/`1-data-model.md` 의 `User` 노출 금지 규범 문장을 갱신한다(이미 plan 에 등재된 항목의 집행) — requirement SPEC-DRIFT WARNING #6,#7.
5. (선택, 급하지 않음) `User` 안전 반환 방식을 공유 헬퍼로 수렴시키는 리팩토링을 다음 확장 시점에 고려한다 — architecture WARNING #2.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보 확인, 강제 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(AST 스캔·쿼리 select 축소·DTO 필드 추가)와 관련 낮음 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 스키마/마이그레이션 변경 없음(쿼리 select 절 축소만) |
  | concurrency | 동시성 관련 코드 변경 없음 |
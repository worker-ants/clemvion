# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 신규 `User` 컬럼 노출 검출 가드(`isUserRelationPath`)가 관계 **이름**만 보고 관계의 **타입**을 보지 않아, `creator`/`owner` 처럼 이름이 다른 기존 `User` 관계를 놓친다. 그 결과 이미 살아있는 `WorkflowVersionsService.findOne`(`relations: ['creator']`, 투영 없음)이 `GET /api/workflows/:wfId/versions/:versionId` 를 통해 워크스페이스 멤버 누구에게나(viewer 포함) `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 을 포함한 `User` 전체를 노출하고 있다 — 이 PR 이 막으려는 것과 정확히 같은 결함 클래스가 검출망 밖에 살아있다. **security·requirement 두 reviewer 가 독립적으로 동일 결론에 도달**했다(전문 확보 완료, 재시도 필요 없음). forced 리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement | `isUserRelationPath` 가 관계 **경로 문자열**의 마지막 세그먼트가 `'user'` 인지만 비교해, 실제 타입이 `User` 인 관계 중 이름이 다른 것(`creator`, `owner`)을 전부 놓친다. 게다가 `relations` 판정이 배열 리터럴 형태(`relations: [...]`)만 파싱하고 TypeORM 0.3 객체 형태(`relations: { user: true }`, 같은 저장소의 `workflow-versions.service.ts:54`가 실사용 중)는 순회하지 않는다. 실측 결과 `WorkflowVersion.creator`(`@ManyToOne(() => User)`) 를 `relations: ['creator']`(투영 없음)으로 로드하는 `WorkflowVersionsService.findOne` 이 컨트롤러에서 가공 없이 그대로 반환되어, `GET /api/workflows/:wfId/versions/:versionId` 가 버전 작성자의 `User` 전체(비밀번호 해시·2FA secret·복구 코드·계정 탈취용 토큰 전부 포함)를 그대로 응답한다. 이 엔드포인트에 대한 e2e 는 0건이라 계약 축·이름 축 어느 그물도 닿지 않는다. | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:33-36`(`isUserRelationPath`), `:115-126`(배열 리터럴 전용 파싱) — 근본 실제 유출 지점: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:67-81`(`findOne`, `relations: ['creator']`, `select` 없음) → `workflow-versions.controller.ts:67-81`(pass-through 반환) | (a) 즉시: `findOne` 에 `findByWorkflow` 와 동일한 `select: { creator: { id, name, email } }` 투영 추가, `GET /workflows/:wfId/versions/:versionId` e2e 신설 후 `assertMatchesContract`+`expectNoUserSecrets` 배선. (b) 가드: `findUserRelationLoads` 판정을 이름이 아니라 **관계의 선언된 타입**(`@ManyToOne/@OneToOne(() => User)` 데코레이터) 기준으로 넓히거나, 최소한 저장소 내 `User` 관계 속성명 전체 집합(`user`, `creator`, `owner`, `executor`)을 등재. `relations` 판정에 `ts.isObjectLiteralExpression` 분기 추가해 객체 형태도 스캔. 수정 후 `EXPECTED_USER_RELATION_LOADS` 베이스라인 재실측(신규 위반으로 `workflow-versions.service.ts#findOne` 이 잡혀야 정상). |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | requirement / scope / maintainability / testing / documentation (5개 reviewer 공통) | `workspace-rbac.e2e-spec.ts` 의 신규 e2e(`GET /:id/members`)가 테스트 라벨 `F.` 를 재사용해, 파일 안에 `F.` 로 시작하는 `it()` 가 두 개(신규 멤버-노출 테스트 / 기존 `sole owner leave 불가` 테스트) 존재한다. 이 파일은 `A`~`I` 알파벳 라벨로 테스트를 상호 참조하는 관례를 쓰므로("테스트 A는…" 식 주석 실재) 향후 "테스트 F" 언급이 모호해진다. 삽입 위치도 `D → [신규F] → E → [기존F] → G` 로 기존 순서를 깬다. | `codebase/backend/test/workspace-rbac.e2e-spec.ts` (신규 `it('F. GET /:id/members …')`, D와 E 사이 삽입) vs 기존 `it('F. sole owner …')`(E 뒤) | 신규 테스트 라벨을 다음 미사용 문자(`J.`)로 변경. |
| 3 | requirement / documentation | 신설 검출 가드 2쌍(`user-entity-exposure-guard*`, `user-secret-absence*`)이 어떤 spec 문서의 `code:` frontmatter glob 에도 등재되지 않았다 — 직전 커밋(`21182db02`)이 형제 검증자(`swagger-dto-contract-guard.ts` 등)를 정확히 같은 이유로 `spec/5-system/2-api-convention.md` §5.4 에 등재한 선례가 있는데 이번엔 누락됐다. 등재가 없으면 `--impl-done` SPEC-CONSISTENCY 게이트가 이 가드들의 후속 약화(예: `USER_SECRET_KEYS` 축소)를 잡지 못한다. | `spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`, `spec/conventions/secret-store.md` (전부 신규 파일 미커버) | `spec/` 쓰기는 developer 권한 밖 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "§5.4 검증 층 표 + `code:` 에 두 가드 등재" 후속 bullet 을 추가해 다음 planner 턴에서 처리. |
| 4 | testing (뮤테이션 실측) | `isUserRelationPath` 의 대소문자 무시 분기(`.toLowerCase()`)가 어떤 fixture/테스트로도 관측되지 않는다 — `.toLowerCase()` 제거 뮤테이션을 넣어도 가드 spec 7/7 이 그대로 통과함을 실측 확인. `user-relation-load.fixture.ts` 에 대문자 섞인 관계 이름 케이스가 없다. | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:33`(`isUserRelationPath`) | `user-relation-load.fixture.ts` 에 `relations: ['User']` 형태의 위반 케이스 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 5 | security / scope / side_effect / api_contract | `WorkspaceMemberDto.joinedAt` 추가는 신규 e2e 가 드러낸 기존 wire 동작(서비스가 이미 무조건 `joinedAt` 을 실음, FE 도 이미 소비 중)을 뒤늦게 선언한 것 — §5.4 규약(`@ApiProperty`+`nullable:true`, non-optional) 정확히 준수, breaking change 아님. | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:81-89` | 조치 불요 — 기록용. |
| 6 | security / api_contract | `workspace-rbac.e2e-spec.ts` 신규 테스트가 이름 축(`expectNoUserSecrets`)을 계약 축(`assertMatchesContract`)보다 먼저 실행하도록 의도적으로 순서를 고정(주석에 실측 근거 명시) — 두 축이 서로를 가리지 않게 하는 좋은 설계. | `codebase/backend/test/workspace-rbac.e2e-spec.ts:316-323` | 결함 아님, 우수 사례로 기록. |
| 7 | side_effect | `expectNoUserSecrets` 가 `expect` 를 import 하지 않고 Jest 전역 주입에 암묵적으로 의존 — 자매 헬퍼 `assertMatchesContract` 는 `throw new Error` 로 직접 던져 이 의존이 없다. 현재는 정상 동작(16/16 통과 실측)하나 `injectGlobals:false` 전환 시 호출부에서 조용히 깨질 잠재 결합. | `codebase/backend/src/shared/testing/user-secret-absence.ts` (`expectNoUserSecrets`) | 자매 헬퍼처럼 `throw new Error(...)` 형태로 변경하거나 `import { expect } from '@jest/globals'` 명시. |
| 8 | maintainability | `UserRelationLoad.line` 필드가 계산만 되고 어디서도 소비되지 않음 — 형제 가드(`audit-action-binding-guard.ts` 등)는 동일 필드를 실패 메시지 조립에 실제로 사용. | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:28,108` | 실패 메시지에 `line` 노출하거나, 안 쓸 것이면 필드 제거. |
| 9 | testing | `findUserSecretLeaks` 재귀 walker 에 순환 참조 가드 없음(현재 유일 소비처는 JSON 파싱 결과라 위험 낮음) / snake_case 축은 7키 중 1개(`passwordHash`)만 직접 단언 / 관계 이름이 문자열 리터럴이 아니면(간접 상수 참조) 가드가 놓침 — 자매 가드들과 공유하는 알려진 트레이드오프. | `codebase/backend/src/shared/testing/user-secret-absence.ts`, `user-secret-absence.spec.ts`, `user-entity-exposure-guard.ts` | 선택적 보강 — 재사용 범위 확대 계획이 있을 때만. |
| 10 | documentation | 동일 실측 수치("19곳"·"46곳"·"3곳"·"0건")가 CHANGELOG·plan·가드 docstring 2곳 등 4곳에 중복 기록 — 오늘 시점엔 전부 일치 확인했으나 향후 수치 변경 시 4곳 모두 갱신 필요. | `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`, `user-entity-exposure.spec.ts`, `user-secret-absence.ts` | 가드 docstring 에 "수치 변경 시 CHANGELOG 동일 표도 갱신" 상호 참조만 추가하면 충분. |
| 11 | side_effect | 신규 파일 2종(`repo-guards/__tests__/**`, `shared/testing/**`)은 기존 `tsconfig.build.json` exclude 패턴 하위 경로라 프로덕션 dist 로 새지 않음을 실측 확인. | `codebase/backend/tsconfig.build.json` | 조치 불요. |
| 12 | api_contract | `GET /:id/members` 응답 봉투가 `{data:[...]}` (페이지네이션 메타데이터 없음) — 이번 diff 가 만든 것이 아닌 기존 동작이며 작은 유계 컬렉션이라 부적절하지 않음. | `codebase/backend/test/workspace-rbac.e2e-spec.ts:312` | 이번 PR 범위 아님 — 참고용 기록만. |
| 13 | security | `USER_SECRET_KEYS` 가 `user.entity.ts` 의 자격증명·토큰류 7컬럼과 정확히 일치(직접 대조 완료). `oauthProviderId` 는 자격증명이 아니라 스코프 밖으로 타당. | `codebase/backend/src/shared/testing/user-secret-absence.ts` | 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | CRITICAL | `isUserRelationPath` 이름 기반 매칭 사각지대로 `WorkflowVersion.creator` 를 통한 `User` 전체(비밀번호 해시·2FA·토큰) 유출이 검출망 밖에 생존 |
| requirement | CRITICAL | 동일 근본 원인(이름 vs 타입) — "전수 열거 후 3곳 다 안전" 서술이 부정확함을 실증. 테스트 라벨 중복·spec `code:` 미등재 WARNING |
| scope | LOW | 10개 변경 파일 전부 목적에 정합. `joinedAt` 파생 발견은 투명 disclose. 테스트 라벨 중복만 실질 결함 |
| side_effect | NONE | 순수 정적 가드 + 읽기 전용 재귀 워커, 상태 변경 없음. `expect` 암묵 의존만 INFO |
| maintainability | LOW | 가독성·네이밍 우수. 테스트 라벨 중복(WARNING), `line` 필드 미사용(INFO) |
| testing | LOW | 핵심 로직 재현 검증(3곳/0곳 grep 일치), 뮤테이션으로 대소문자 무시 분기 미검증 발견(WARNING), 라벨 중복(WARNING) |
| documentation | LOW | 실측 수치가 코드와 정확히 일치. 라벨 중복·spec `code:` 미등재 WARNING |
| api_contract | NONE | wire 동작 변경 없음, `joinedAt` 은 §5.4 준수 문서화, 신규 e2e 가 기존 커버리지 갭 개선 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 1건 이상(WARNING 또는 INFO)을 보고했다.

## 권장 조치사항

1. **(최우선)** `WorkflowVersionsService.findOne` 에 `findByWorkflow` 와 동일한 `select: { creator: { id, name, email } }` 투영을 즉시 추가해 `GET /api/workflows/:wfId/versions/:versionId` 의 `User` 전체 유출을 막는다.
2. `GET /workflows/:wfId/versions/:versionId` 를 때리는 e2e 를 신설하고 `assertMatchesContract` + `expectNoUserSecrets` 두 축을 배선한다(`workspace-rbac.e2e-spec.ts` 신규 테스트와 동일 패턴).
3. `isUserRelationPath`/`findUserRelationLoads` 판정을 관계 **이름**이 아니라 관계의 **선언된 타입**(`@ManyToOne/@OneToOne(() => User)`) 기준으로 넓히거나, 최소한 저장소 내 `User` 관계 속성명 전체 집합(`user`, `creator`, `owner`, `executor`)을 등재하고, `relations` 판정에 객체 리터럴(`FindOptionsRelations`) 분기를 추가한다. 수정 후 `EXPECTED_USER_RELATION_LOADS` 베이스라인을 재실측한다.
4. `workspace-rbac.e2e-spec.ts` 신규 테스트의 라벨을 `F.` 에서 `J.`(다음 미사용 문자)로 변경해 기존 `F.` 테스트와의 충돌을 해소한다.
5. `user-relation-load.fixture.ts` 에 대문자 관계 이름(`relations: ['User']`) 위반 케이스를 추가해 `isUserRelationPath` 의 대소문자 무시 분기를 관측 가능하게 만든다.
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "신규 가드 2종을 §5.4 검증 층 표 + spec `code:` 에 등재" 후속 항목을 추가해 다음 planner 턴에서 처리한다.
7. (선택) `expectNoUserSecrets` 를 자매 헬퍼처럼 `throw new Error(...)` 형태로 바꾸거나 `expect` 를 명시적으로 import 한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 는 성능 영향 표면 없음(정적 AST 스캔·순수 재귀 워커·e2e 추가) |
  | architecture | router 판단상 아키텍처 구조 변경 없음(기존 검출/테스트 인프라 패턴 확장) |
  | dependency | router 판단상 신규 외부 의존성 추가 없음 |
  | database | router 판단상 스키마/마이그레이션 변경 없음 |
  | concurrency | router 판단상 동시성 관련 코드 변경 없음 |
  | user_guide_sync | router 판단상 사용자 가이드 문서 동기화 대상 아님 |
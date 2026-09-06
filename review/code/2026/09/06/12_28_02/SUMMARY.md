# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 3건(전부 국소 수정으로 닫힘). 8명 전원(강제 7 + 라우터 선택 1) 결과 확보 완료, 강제 화이트리스트 미이행 없음. `User` 엔티티 민감 컬럼 노출 검출 2축(구조 AST 가드 + 값 재귀 스캐너) 신설과, 그 과정에서 발견한 실제 데이터 유출(`WorkflowVersionsService.findOne` 이 워크플로우 버전 작성자의 `passwordHash`·2FA 비밀·복구 코드·토큰을 투영 없이 반환)을 닫은 결과물이 이번 최종 라운드까지 4차례의 선행 `/ai-review` 라운드를 거치며 대부분의 결함을 이미 처분한 상태다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 가드 자신이 "캐스트 한 겹이 술어를 눈멀게 한다"고 명시한 위협 모델인데, `unwrap()` 이 처리하는 4가지 캐스트 형태(`as`/`satisfies`/괄호/`<T>expr`) 중 `satisfies` 1개만 fixture 로 검증되고 나머지 3개는 지워도 어떤 테스트도 실패하지 않는다 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` `unwrap()`(~217-228행), fixture `user-relation-load.fixture.ts` | fixture 에 `as`/괄호로 감싼 위반 케이스 최소 1개씩 추가. 실사용 가능성 낮은 `<T>expr` 분기는 제거 검토 |
| 2 | Testing | JSDoc → 공개 OpenAPI `description` 유출이 이번이 3번째 발생(`schedule-response.dto.ts` 2건 선례 + 이번 `workspace-response.dto.ts`)인데도 자동 회귀 가드가 없다 — 매번 수작업 `//` 회피로만 처리됨 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` `WorkspaceMemberDto.joinedAt` 주석부 | `swagger-probe.ts` 기반 JSDoc 유출 감지 가드 신설, spec `code:` 등재 |
| 3 | Documentation | `findEagerUserRelations`(eager 관계 검출 4번째 축)가 코드·테스트엔 완결됐는데, 이를 설명해야 할 3개 상위 문서(가드 spec 파일 헤더 JSDoc, `CHANGELOG.md`, plan 완료 노트)가 여전히 "호출부 스캔 세 형태"만 서술하고 eager 데코레이터 축을 빠뜨림 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` 헤더 JSDoc `## 무엇을 세는가` 절, `CHANGELOG.md` "택한 것" 절, `plan/in-progress/spec-draft-nullable-notation-followups.md` 완료 서술 | 세 문서를 한 턴에 갱신 — eager 데코레이터 축(콜사이트 스캔이 원리적으로 못 보는 형태) 언급 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 이 방어선은 런타임 방지가 아니라 테스트 시점 검출이다(의도된 트레이드오프 — `select:false`/전역 인터셉터를 실측 근거로 기각). `src/modules` 밖 표면(스크립트·CLI·향후 리졸버 등)에는 적용되지 않음 | `user-entity-exposure-guard.ts`, `user-secret-absence.ts` 전체 | 결정 유지. CI required check 확인 + 스캔범위 밖 표면이 늘면 재검토 트리거를 plan 에 기록 |
| 2 | Requirement | 프로퍼티 이름 따옴표 벗기기가 일부 지점(`findUserRelationLoads`/`hasProjectionFor` 의 `relations`/`select` 리터럴 비교)에서만 안 벗겨짐 — 방향은 안전(과잉탐지 또는 스캔 누락 쪽) | `user-entity-exposure-guard.ts` `findUserRelationLoads`(~371행), `hasProjectionFor`(~297행) | `.replace(/['"]/g, '')` 로 통일 |
| 3 | Requirement | spec 이 `creator` 응답 필드의 구체 투영 형태(3필드)를 명시하지 않음 — 이미 planner 백로그(11_27_53 RESOLUTION INFO#2)에 등재된 사안 | `spec/3-workflow-editor/5-version-history.md` §7.1/§7.2 | 조치 불요(중복 등재 방지), planner 후속 처리 대기 |
| 4 | Requirement | 신규 검출 가드 2쌍이 spec `code:` frontmatter 에 미등재 — developer 권한 밖(`spec/` 쓰기), 이미 4차례 추적됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md:367-393` | 조치 불요, planner 턴에서 §5.4 표 + `code:` glob 갱신 대기 |
| 5 | Scope | `WorkspaceMemberDto.joinedAt` 추가는 핵심 목표("User 컬럼 방어") 밖 파생 산출물 — 4차례 scope 라운드가 이미 disclose·승인 | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` | 조치 불요, 기존 판정 유지 |
| 6 | Scope | fix 커밋들이 코드 수정과 직전 리뷰/컨시스턴시 산출물을 한 커밋에 묶음 — CLAUDE.md 저장 위치 규약·선례에 부합 | `review/code/2026/09/06/{10_13_22,...}/**`, `review/consistency/2026/09/06/{...}/**` | 조치 불요 |
| 7 | Side Effect | `WorkflowVersionsService.findOne` 반환 타입이 `Promise<WorkflowVersion>`→`Promise<WorkflowVersionDetail>` 로 축소(공개 시그니처 변경) — 호출부 2곳(컨트롤러, `restoreVersion`) 모두 좁혀진 필드만 사용함을 직접 확인 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `findOne`, `WorkflowVersionDetail` 정의부 | 조치 불요, 신규 호출부 추가 시 `creator`/`workflow` 접근 주의 |
| 8 | Side Effect | `findOne` 쿼리 형태 변경으로 실제 SQL 이 달라짐 — 응답 payload 가 좁아지는 방향(정보 노출 축소)이라 신규 노출 아님 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `CREATOR_PROJECTION` | 조치 불요 |
| 9 | API Contract | `creator` 응답 형태가 (버그였던) 전체 `User` 컬럼에서 이미 선언돼 있던 3필드로 좁아짐 — 계약 위반이 아니라 기존 공표 계약을 뒤늦게 충족하는 방향. 과거 유출 응답은 회수 불가(CHANGELOG 명시) | `workflow-versions.service.ts:69-73,124-156` | 조치 불요 |
| 10 | API Contract | `creator` 내부 TS 타입(non-null)이 DTO 선언(`| null`)보다 좁음 — 안전한 방향의 불일치, `created_by` 가 NOT NULL 이라 실질 영향 없음 | `workflow-versions.service.ts:21` vs `workflow-version-response.dto.ts:45-49,82-86` | 조치 불요 |
| 11 | API Contract | 두 엔드포인트(`GET /versions/:versionId`, `GET /workspaces/:id/members`)에 응답-계약 e2e(선언 대조 + 이름 기반 부재)가 처음 배선됨 — 긍정적 발견 | `workflow-crud.e2e-spec.ts` `H.`, `workspace-rbac.e2e-spec.ts` `J.`, `workflow-versions.service.spec.ts:38-52` | 조치 불요(긍정 기록) |
| 12 | Maintainability | 프로퍼티 이름 따옴표 벗기기 표현식이 두 함수에 동일하게 인라인 반복(폴백 차이 없어 통합해도 분기 안 늘어남) | `user-entity-exposure-guard.ts` `userRelationInInitializer`(254행), `hasProjectionFor`(304행) | `propKeyText()` 1줄 헬퍼로 통합 |
| 13 | Maintainability | 관계 이름 대소문자 비교가 일부는 `isUserRelationPath` 헬퍼, 일부(`hasProjectionFor`)는 인라인 `toLowerCase()` 로 섞여 있음 | `user-entity-exposure-guard.ts` `isUserRelationPath`(169-175행) vs `hasProjectionFor`(305행) | 비교 규칙 변경 시 `sameRelationName()` 공용 헬퍼 고려 |
| 14 | Testing | `workspace-rbac.e2e-spec.ts` 신규 `J.` 테스트가 옛 라벨(`F.`)의 `uniqueEmail`/`uniqueName` prefix 문자열을 그대로 남겨, 실패 로그에서 사람이 오인할 수 있음(실 충돌은 없음) | `codebase/backend/test/workspace-rbac.e2e-spec.ts` `it('J. GET /:id/members ...')` 내부 | prefix 를 `rbac-j-*`/`uniqueName('J')` 로 라벨과 일치시킴 |
| 15 | Security | `expectNoUserSecrets` 실패 메시지는 위반 경로만 노출하고 값(예: 실제 해시)은 노출하지 않음 — 확인, 안전 | `user-secret-absence.ts` `expectNoUserSecrets` | 조치 불요 |
| 16 | Security | 신규 정적 가드는 로컬 소스만 `fs.readFileSync` 로 읽어 AST 파싱 — 인젝션·경로 탐색 표면 없음, `tsconfig.build.json` exclude 에 이미 포함돼 dist 오염 없음 | `user-entity-exposure-guard.ts` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 검출은 완비, 다만 런타임 방지가 아닌 테스트 시점 검출(의도된 트레이드오프) |
| requirement | LOW | 핵심 요구사항 충족 확인(34/34 테스트 그린), INFO 3건(따옴표 비대칭, spec 침묵 2건은 기추적) |
| scope | NONE | 14개 파일 전부 단일 목적에 대응, `joinedAt` 곁가지만 기추적 INFO |
| side_effect | NONE | 순수 함수·읽기 전용, 공개 시그니처 축소는 호출부 확인 완료 |
| maintainability | LOW | 4차례 라운드 지적 전부 해소 확인, 신규는 사소한 인라인 중복 2건(INFO) |
| testing | LOW | 핵심 검출 로직 검증 탄탄, `unwrap()` 캐스트 분기 3/4 미검증 + JSDoc 유출 가드 부재(WARNING 2건) |
| documentation | LOW | 이전 결함 재발 없음, eager 축 문서 서술 누락(WARNING 1건) |
| api_contract | LOW | 새 계약 생성/파괴 없음, additive/계약 충족 방향 변경만 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 기록, Critical/실행 가능한 신규 결함은 없음).

## 권장 조치사항

1. `unwrap()` 의 `as`/괄호 캐스트 형태에 대한 fixture 위반 케이스를 `user-relation-load.fixture.ts` 에 추가해 4개 분기 중 3개의 무검증 상태를 해소한다(Testing WARNING 1).
2. JSDoc→OpenAPI `description` 유출을 잡는 자동 가드를 신설하고 spec `code:` 에 등재한다 — 3회째 반복이라 우선순위가 높다(Testing WARNING 2).
3. `user-entity-exposure.spec.ts` 헤더 JSDoc, `CHANGELOG.md`, plan 완료 노트 3곳에 eager 관계 검출 축(4번째 축) 서술을 한 턴에 보강한다(Documentation WARNING).
4. (급하지 않음) `propKeyText`/`sameRelationName` 헬퍼로 사소한 인라인 중복 정리, `workspace-rbac.e2e-spec.ts` `J.` 테스트의 잔존 `F` 라벨 문자열 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이 changeset 과 관련성 낮음(검출 로직·DTO 투영 변경으로 성능 영향 표면 없음) |
  | architecture | 라우터 판단상 이 changeset 과 관련성 낮음(신규 파일이 기존 가드 관례를 따르는 국소 추가) |
  | dependency | 라우터 판단상 이 changeset 과 관련성 낮음(신규 외부 의존성 추가 없음) |
  | database | 라우터 판단상 이 changeset 과 관련성 낮음(쿼리 형태 변경은 있으나 스키마·마이그레이션 변경 없음) |
  | concurrency | 라우터 판단상 이 changeset 과 관련성 낮음(동시성 관련 로직 변경 없음) |
  | user_guide_sync | 라우터 판단상 이 changeset 과 관련성 낮음(사용자 가이드 대상 UI 변경 없음) |
# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 4건(모두 비차단·개선 권고 수준). 4라운드째 `/ai-review` 를 거치는 changeset으로, 이전 라운드(1~3라운드, `35795228c`·`0a2fe85f3`·`a8b5c8b13`)에서 Critical 2건·Warning 다수가 이미 처리됐고 이번 라운드는 14개 reviewer(강제 화이트리스트 7명 포함) 전원이 결과를 냈다. 강제 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 — 미이행 없음.

## Critical 발견사항

없음 — 14개 reviewer 전원 Critical 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스팅 | `WorkspacesService.getMemberRole` 의 신규 `manager` 분기(3라운드 CRITICAL 수정 대상)가 어떤 테스트에서도 실제 객체로 실행되지 않는다 — 유닛 테스트는 `WorkspacesService` 전체를 mock, e2e는 Organization 스코프의 `rotate` 경로를 아예 호출하지 않는다. 이 분기가 조용히 깨져도(예: `manager` 무시하고 항상 `this.memberRepository` 사용) 어떤 테스트도 못 잡는다 | `codebase/backend/src/modules/workspaces/workspaces.service.ts:116-127` (`getMemberRole`), 소비처 `integration-oauth.service.spec.ts`/`integrations.service.spec.ts`(전부 mock), `integration-personal-owner.e2e-spec.ts`(rotate 미포함) | `workspaces.service.spec.ts` 에 `manager` 전달 시 `manager.getRepository` 를 실제로 타는지 검증하는 테스트 추가, 또는 `integration-rotate-concurrency.e2e-spec.ts` 에 Organization 스코프+역할 강등 시나리오 1건 추가 |
| 2 | 성능 | `update`/`reauthorize`/`remove` 세 엔드포인트가 대상 통합의 scope 를 알기 전에 무조건 `getMemberRole` 조회를 추가 — personal 통합(다수 케이스)에는 그 결과가 버려지는데도 매 요청 DB 왕복이 하나 더 생긴다 | `codebase/backend/src/modules/integrations/integrations.controller.ts:489`(update), `:573`(reauthorize), `:662`(remove); 판정은 `integration-visibility.ts:98`(personal이면 role 미사용) | `rotate` 락 구간 패턴("Organization일 때만 `getMemberRole` 호출")을 컨트롤러 레벨에도 적용(role-resolver 지연 호출) — 다만 API 형태 변경이 필요해 이번 PR 스코프를 넘는 리팩터로 판단, 현재 비용(인덱스 조회 1회)은 감내 가능 |
| 3 | 유지보수성 | "judgedRow 조건부 update + affected 판정" 4줄 블록이 `update`/`updateScope`/`reauthorize` 3곳에 그대로 반복(복붙) — 다음 변경 지점이 생기면 같은 패턴이 또 복붙될 가능성 | `codebase/backend/src/modules/integrations/integrations.service.ts` — `update()`(~834-838행), `updateScope()`(~1427-1431행), `reauthorize()`(~1473-1477행) | `private async updateJudgedOrNotFound(row, patch)` 헬퍼로 "judgedRow 계산→update→affected===0 체크"를 한 곳에 모으고, 세 호출부는 그 헬퍼+각자의 reload/audit 로 좁힌다 |
| 4 | 유지보수성/테스팅 | 신규 e2e 가 `beforeAll` 로 만든 `personalId` 를 여러 `it` 블록이 공유하고, 마지막 `it` 만 그 행을 삭제 — "반드시 마지막" 주석 외 강제 장치가 없어 중간에 새 `it` 삽입·테스트 셔플/병렬 실행 도입 시 조용히 깨질 수 있다. 같은 파일의 `it.each` 목록에서 `POST /:id/rotate` 도 빠져 있어(WARNING #1과 연결) 이 PR의 핵심 수정 지점이 e2e로 커버되지 않는다 | `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — 파일 끝 "생성자는 자기 personal 을 읽고·이름을 바꾸고·지운다" 케이스 및 상단 `it.each` 404 목록 | 삭제 대상을 그 `it` 안에서 자체 생성해 자기완결적으로 만들거나 별도 fixture로 분리; 최소 "Organization rotate — Editor 403 / Admin 200" e2e 1건 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/DB | `integrationVisibilityClause(alias)` 가 SQL 조각을 문자열 보간으로 조립 — 현재 모든 호출부가 하드코딩 리터럴 `'i'` 만 넘겨 실제 주입 경로는 없으나, export된 재사용 헬퍼라 향후 동적 alias 사용 시 위험 소지 | `integration-visibility.ts:37-39`, 호출부 `integrations.service.ts:511`, `explore-tools.service.ts:173` | alias 화이트리스트 정규식 검증 또는 리터럴 유니온 타입으로 제한(필수 아님) |
| 2 | 보안 | Cafe24/MakeShop precheck 가 남의 personal 통합의 `status`/`conflict` 는 계속 노출 — 신규 결함 아니라 기존 동작을 완화한 것이며 spec §8·§9.2가 명시적으로 요구하는 설계(매장 식별자 유일성 UX) | `integration-oauth.service.ts` `pickPrecheckConflict()` | 조치 불요 — 위협 모델 재검토용 기록 |
| 3 | 보안 | `getForExecution`(실행 엔진 경로)은 workspace 범위만 검사, personal 소유권 재검증 없음 — JSDoc이 스스로 인정하는 기존 갭이며 이번 diff 대상 아님 | `integrations.service.ts` `getForExecution()`/`requireEntity()` | spec이 명시한 후속 plan 항목 — 이번 라운드 차단 사유 아님 |
| 4 | 아키텍처 | `IntegrationModifyAction` 타입을 원 출처(`integration-visibility.ts`)가 아닌 재수출 경유지(`integrations.service.ts`)에서 import | `integrations.controller.ts` import문, `integrations.service.ts:389` | 컨트롤러가 `integration-visibility.ts` 에서 직접 import하도록 정리(사소, 필수 아님) |
| 5 | 아키텍처 | `oauth/begin` 의 인가 사전판정 매핑(`modifyActionOfBeginMode`)이 서비스가 아닌 컨트롤러에 위치 — `:id/reauthorize` 는 서비스가, `oauth/begin` 경유는 컨트롤러가 판정을 트리거하는 비대칭 | `integrations.controller.ts` `modifyActionOfBeginMode()`/`oauthBegin()` | 장기적으로 `IntegrationOAuthService.begin()` 내부로 이관 고려 — `never` 소진성 검사로 회귀 위험은 낮아 이번 PR 범위 밖 |
| 6 | 아키텍처 | `integration-visibility.ts` 가 판정 로직+SQL 표현+한국어 에러 문구를 한 파일에 결합 | `integration-visibility.ts` 전체 | 다국어(ko/en) API 에러 확장이 실제 스코프에 들어오면 `ADMIN_ACTION_PHRASE` 문구 테이블만 별도 i18n 리소스로 분리 고려 |
| 7 | 범위 | workflow-assistant 하위 10개 파일(candidate-lookup·explore-tools 등) 변경은 `findAll`/`listIntegrations` 시그니처에 `userId` 추가의 필연적 파급이며 스코프 이탈 아님 | `candidate-lookup.service.ts:50`, `explore-tools.service.ts:165` | 조치 불요 |
| 8 | 범위 | 컨트롤러/서비스 신규 private 헬퍼(`roleOf`/`assertCanModify`/`judgedRow`/`reloadOrNotFound`)는 3라운드 TOCTOU 지적의 연장선으로, 이 PR 보안 목적에 종속된 리팩터 | `integrations.controller.ts:134`, `integrations.service.ts` | 조치 불요 |
| 9 | 범위 | 호출자 고지가 "22개 파일"이라 적었으나 실제로는 27~28개(mdx 문서 4개 포함) | 프롬프트 호출자 고지 | 차기 라운드에서 파일 수 서술 정정 |
| 10 | 부작용 | Admin 거부 에러 코드가 `FORBIDDEN` → `ADMIN_REQUIRED` 로 변경(공개 API 계약 변경) — CHANGELOG Unreleased 최상단에 이미 명시적으로 고지됨, 자사 frontend는 이 코드로 분기하지 않음(grep 0건) | `integration-visibility.ts` `adminRequiredError()` | 조치 불요 — 이미 고지됨 |
| 11 | 부작용 | 다수 공개 메서드에 `userId`/`userRole` 파라미터 추가(일부 중간 위치 삽입) — 저장소 전수 grep으로 diff 밖 호출부 0건 확인, `getMemberRole` 신규 인자는 optional이라 기존 8개 호출부 영향 없음 | `integrations.service.ts`, `candidate-lookup.service.ts`, `explore-tools.service.ts`, `workspaces.service.ts` | 조치 불요 — 컴파일 타임 보증 확인됨 |
| 12 | 유지보수성 | `assertCanModify` 가 `assertOrgScopeModifiable` 을 그대로 감싸는 1줄 위임 메서드(현재 6개 호출부) | `integrations.service.ts` `assertCanModify` | JSDoc으로 위임 이유를 남기거나 호출부에서 직접 `assertOrgScopeModifiable` 사용 고려 |
| 13 | 유지보수성 | mode(`request_scopes`, snake_case)와 action(`request-scopes`, kebab-case) 두 표기 규칙이 같은 개념을 가리켜 grep 함정 가능 | `integrations.controller.ts` `modifyActionOfBeginMode()`, `integration-visibility.ts` `IntegrationModifyAction` | "mode는 wire 값, action은 권한 어휘"라는 한 줄 규약 주석 추가 |
| 14 | 유지보수성 | `IntegrationsService` 가 이번 diff로 더 커짐(listing/CRUD, OAuth, connection-test dispatch, 감사 로그, credential masking, catalog 메타를 한 클래스가 담당, ~1869줄) | `integrations.service.ts` 전체 | 인가 관련 private 메서드 묶음을 별도 협력 객체로 옮기는 리팩터를 다음 대규모 변경 후보로 기록 |
| 15 | 문서화 | Swagger `description`에서 "conflict=true 일 때만 채워진다"와 `PRECHECK_IDENTITY_MASKED`의 조건 반복 서술이 겹쳐 다소 헷갈림(문체상 군더더기, 의미는 정확) | `integration-response.dto.ts:370, 375` (`PRECHECK_IDENTITY_MASKED` 정의 344-346) | `PRECHECK_IDENTITY_MASKED` 문구를 "다만 충돌 대상이 다른 멤버의 personal 통합이면 생략" 정도로 다듬어 중복 축소 |
| 16 | 문서화 | 이 PR이 닫는다고 선언한 트래커(`spec-draft-nullable-notation-followups.md`)의 해당 항목 체크박스가 아직 `[ ]` — 코드 자체는 요구사항 충실 구현, 절차만 잔존 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5760`, `plan/in-progress/integration-personal-owner.md` | 최종 마무리 커밋에서 트래커 체크박스 갱신 + `integration-personal-owner.md` 를 `plan/complete/` 로 이동 |
| 17 | 데이터베이스 | 신설 가시성 필터(`scope`/`created_by`) 쿼리에 전용 복합 인덱스 없음 — `workspace_id` 까지는 기존 인덱스로 좁혀지나 그 뒤 필터는 순차 평가. 워크스페이스당 통합 수 규모상 허용 가능한 위험 | `integrations.service.ts:509-513`(findAll), `explore-tools.service.ts:170-175`(listIntegrations) | 당장 조치 불요 — 워크스페이스당 통합 수가 크게 늘면 `(workspace_id, scope, created_by)` 복합 인덱스 검토 |
| 18 | 동시성 | `rotate()` 최종 UPDATE가 `id` 단독 조건 — 같은 트랜잭션에서 이미 `pessimistic_write` 락을 쥐고 있어 안전하지만, 다른 경로(`update`/`remove`/`updateScope`)의 CAS(`judgedRow`) 관례와 처방이 달라 읽는 사람이 이유를 되짚어야 함(주석으로 설명돼 있어 실질 위험 낮음) | `integrations.service.ts` `rotate()` 내부 `repo.update({ id: entity.id }, changes)` | 현행 유지로 충분 — 필요 시 `judgedRow` 헬퍼를 락 보유 경로에도 통일 적용해 불변식을 코드로도 강제 가능(우선순위 낮음) |
| 19 | API 계약 | precheck 응답의 "필드 조건부 생략(conflict=true인데 식별자 없음)"이 OpenAPI 스키마가 아닌 description(prose)에만 표현 — 필드가 원래도 optional이라 breaking change는 아니나, 문서를 안 읽는 codegen 클라이언트는 상시 존재로 오해할 위험 | `integration-response.dto.ts:358-377` | 현재 방식으로 충분 — 강화하려면 `@ApiExtraModels`+`oneOf` 로 두 변형 명시(이번 PR 필수 아님) |
| 20 | API 계약 | `oauth/begin` 의 `reauthorize`/`request_scopes` 모드는 `integrationId` 가 없으면 이번에 추가된 인가 재판정을 거치지 않음 — 기존 DTO(`@IsOptional()`)의 갭이며 이번 diff의 회귀는 아님 | `integrations.controller.ts:258-259`, `integration.dto.ts:224-229` | 후속 plan에 `@ValidateIf` 기반 조건부 필수화를 명시적으로 등록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음, 기존 IDOR/인가 우회 결함을 체계적으로 닫음. SQL 헬퍼 방어 강화 여지 등 INFO만 |
| performance | LOW | update/reauthorize/remove 컨트롤러의 불필요한 getMemberRole 조회(WARNING) |
| architecture | LOW | 판정 로직 순수 함수 분리는 견고, 타입 재수출 경유·OAuth begin 판정 위치 등 사소한 INFO |
| requirement | NONE | spec §8/§9 line-level 대조 결과 갭 없음, 4라운드 누적 뮤턴트 전수 KILLED |
| scope | NONE | 27개 변경 파일 전수가 단일 기능(Personal 소유자 강제)에 직결, 스코프 이탈 없음 |
| side_effect | LOW | 에러코드 FORBIDDEN→ADMIN_REQUIRED 승격(CHANGELOG 고지됨), 시그니처 변경 호출부 전수 확인 |
| maintainability | LOW | judgedRow 3중 반복(WARNING), e2e 순서 의존(WARNING) |
| testing | LOW | getMemberRole manager 분기 실제 미실행(WARNING), rotate e2e 커버리지 갭(INFO) |
| documentation | NONE | Swagger/JSDoc/CHANGELOG/MDX 전부 코드와 정합, 사소한 문체 중복·절차 리마인더만 |
| dependency | NONE | package.json/lockfile 변경 0건, 신규 내부 모듈 결합 2건 모두 안전(순환 없음) |
| database | LOW | 가시성 필터 전용 인덱스 없음(INFO), 트랜잭션/CAS/파라미터화 전부 양호 |
| concurrency | LOW | 3라운드 락-커넥션 재사용 수정이 반영됨을 재확인, rotate UPDATE 조건 관례 차이(INFO) |
| api_contract | LOW | 하위 호환성 유지, 에러 코드 일원화로 오히려 개선. precheck 스키마 표현·oauth begin 갭은 기존 것 |
| user_guide_sync | NONE | auth-session-flow-change·integration-provider-change·backend-api-change 3개 trigger 모두 동반 갱신 확인, 누락 0건 |

## 발견 없는 에이전트

- requirement — "발견사항: 없음", spec 대조 결과 갭 없음
- user_guide_sync — "발견사항: 없음", 매칭된 3개 trigger 전부 동반 갱신 확인

## 권장 조치사항

1. (WARNING #1) `WorkspacesService.getMemberRole` 의 `manager` 분기 — 3라운드 CRITICAL 수정 지점인데도 스위트 전체에서 real-object 로 실행된 적이 없음. `workspaces.service.spec.ts` 유닛 테스트 또는 Organization rotate e2e 1건을 추가해 실제 경로를 태울 것.
2. (WARNING #4) e2e `it.each` 목록에 `POST /:id/rotate` 케이스 추가 — 1번과 함께 처리하면 동일 테스트로 두 갭을 동시에 닫을 수 있음.
3. (WARNING #3) `updateJudgedOrNotFound` 류 헬퍼로 judgedRow 조건부 update 3중 반복 제거 — 다음 변경 지점의 복붙을 예방.
4. (WARNING #2) 급하지 않음 — personal이 다수인 워크스페이스가 실제로 문제가 되면 role-resolver 지연 호출 패턴 검토.
5. (INFO #16, 문서화) 마무리 커밋에서 `spec-draft-nullable-notation-followups.md` 체크박스 갱신 + `integration-personal-owner.md` 를 `plan/complete/` 로 이동(CLAUDE.md 관례).
6. (INFO #20, API 계약) 후속 plan에 `oauth/begin` reauthorize/request_scopes 모드의 `integrationId` 조건부 필수화(`@ValidateIf`)를 명시적으로 등록.
7. 나머지 INFO 항목은 즉시 조치 불요 — 다음 대규모 변경 시 참고용으로 보존.

## 라우터 결정

`routing_status=skipped` — 라우터 미사용, 전체 14명 reviewer 실행됨(`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`). router_safety 강제 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 목록 미이행 없음. 제외(skipped)된 reviewer 없음.

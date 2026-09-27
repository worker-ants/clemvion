# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 0건, Warning 2건(모두 기존 동작 보존 또는 계약 문서화 정정 수준, 런타임 크래시 없음). 이전 라운드(1R)에서 발견된 Critical(`PATCH /workflows/:id { settings: null }` 500 회귀)은 이번 diff(`edd79ca40`)에서 이미 수정·테스트로 고정된 것이 10개 reviewer 전원(특히 requirement·api_contract·testing·side_effect)에 의해 교차 확인됐다. forced(router_safety) 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | 응답 형태(shape)를 강제하는 직렬화 계층(`ClassSerializerInterceptor` 등)이 이 코드베이스에 없어, 서비스가 반환하는 엔티티가 곧 API 응답이 되는 구조다. 이번 PR이 고친 결함(IDOR 검사용으로 eager-load한 `workflow` 관계가 PATCH 응답에 통째로 실림)의 근본 원인이 이 구조이며, 수정 자체는 수동 destructuring(`const { workflow: _workflow, ...response } = saved;`)에만 의존해 다음에 다른 서비스가 검증용 relation을 eager-load하고 그대로 반환하면 같은 결함 클래스가 재발할 수 있는 구조적 여지가 남는다 | `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` (58행 반환타입, 80-83행 구조분해) / `codebase/backend/src/common/interceptors/transform.interceptor.ts:19-31` | 이번 PR 범위에서 구조 변경은 불필요. 향후 유사 relation-eager-load 패턴 재발 방지를 위해 응답 전용 매퍼 또는 `class-transformer` 화이트리스트 직렬화 도입을 별도로 검토 |
| 2 | Requirement / API Contract | `UpdateWorkflowDto.description`(및 동형인 `UpdateNodeDto.description`)이 도메인상 nullable(엔티티·응답 DTO는 `string \| null`)인데 요청 DTO 선언에는 `nullable: true`/`\| null`이 빠져 있다 — §5.4 tri-state 규약(`spec/5-system/2-api-convention.md:278, 289`)과 불일치. 이번 PR의 신규 테스트가 정확히 그 필드에 `description: null`을 보내 "값을 지운다" 동작을 §5.4 근거로 명시적으로 단언·고정했음에도 DTO 선언 자체는 고치지 않았다. git 이력상 직전 커밋은 `null as unknown as string` 캐스트로 타입 오류를 우회했다가, 다음 커밋에서 캐스트만 제거(`Object.assign` 교차 타입으로 우회) — 저장소의 `nullable-type-lie-cast` 가드가 직접 캐스트만 잡고 이 우회는 못 잡는 사각지대도 함께 드러남. OpenAPI 계약이 실제 지원 기능(설명 초기화)을 과소 광고 | `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts:34`, `codebase/backend/src/modules/nodes/dto/update-node.dto.ts:59` | `@ApiPropertyOptional({ nullable: true }) description?: string \| null;` 로 두 DTO 모두 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | §5.4 tri-state "명시적 null → 값 지움" 회귀 캐너리가 `workflows`에만 추가되고 `nodes`(`description`/`containerId`)·`auth-configs`(`ipWhitelist`)에는 대응 캐너리가 없다. `omitUndefined` 헬퍼 자체는 null 보존을 이미 검증하지만, 두 서비스의 배선(`Object.assign(node/config, omitUndefined(...))`)이 향후 방어 코드로 null까지 걸러내는 회귀는 어느 테스트도 잡지 못함 | `codebase/backend/src/modules/nodes/nodes.service.spec.ts`, `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` | workflows와 대칭인 "명시적 null은 로드한 값을 지운다" 캐너리 1개씩 추가 |
| 2 | Documentation | `omit-undefined.ts`의 JSDoc이 1R Critical의 근본 원인("헬퍼가 null 자체 입력에 안전하지 않아, nullable 전체-필드 호출부는 호출 전 `!= null`로 가드해야 한다")을 헬퍼 자신의 문서에는 아직 남기지 않고 plan 문서에만 기록해, 다음에 같은 헬퍼를 새 nullable 필드에 배선할 때 같은 함정을 반복할 여지가 있음 | `codebase/backend/src/common/utils/omit-undefined.ts:1-26` | JSDoc에 "인자가 런타임에 null/undefined 자체이면 `Object.entries`가 던진다 — 필드 전체가 명시적으로 null일 수 있는 호출부는 먼저 `!= null`로 가드하라" 한 문장 추가 |
| 3 | Maintainability | (a) `omitUndefined` 호출부 "왜" 주석이 3개 서비스 파일에 거의 동일한 문장으로 반복 (b) `NotArray<T>` 타입 트릭이 파일 최상단에 배치돼 함수 본문 설명보다 먼저 읽힘 (c) 신규 e2e 케이스 C가 "일반 노드"·"toolOwnerId 노드" 두 시나리오를 한 `it`에 담아 77줄로 다른 케이스보다 김 | `workflows.service.ts:247-248`, `nodes.service.ts:76-77`, `auth-configs.service.ts:245-246` / `omit-undefined.ts:1-23` / `test/patch-partial-body.e2e-spec.ts:137-213` | 모두 결함 아님(경미). 여유 시 (a) 공용 JSDoc 참조로 축약, (b) 본문 JSDoc을 타입 트릭보다 먼저 배치, (c) 두 번째 시나리오를 별도 `it`로 분리 |
| 4 | Architecture / API Contract | `settings` 최상위 필드는 명시적 `null`을 보내도 "무시(no-op, 원본 유지)"로 처리되는 반면, `description`/`folderId` 등 스칼라 nullable 필드는 "명시적 null=값 지움"으로 처리돼 같은 엔드포인트 안에서 필드마다 null의 의미가 다르다. 이번 PR이 만든 것이 아니라 크래시(1R Critical)만 없앤 사전 존재 설계이며, `spec-draft-nullable-notation-followups.md`에 이미 planner 인계 항목으로 등재됨 | `codebase/backend/src/modules/workflows/workflows.service.ts:249-262` | 조치 불요(이미 트래커에 등재). 후속 spec 정정 시 "settings 최상위 null=no-op, 개별 키 null=그 키 초기화"를 한 문장으로 명문화 권장 |
| 5 | Architecture | `omitUndefined` 배선이 5개 호출부(`folders`·`triggers`·`workflows`·`nodes`·`auth-configs`)마다 각자의 관례로 유지되며 단일 강제 지점(가드/헬퍼)이 없다. plan(`patch-omit-undefined.md`)이 "정규식/AST 가드 대신 주석+e2e 값 단언" 트레이드오프를 이미 검토·채택 | 위 5개 서비스 파일 | 조치 불요(이미 검토·결정됨) |
| 6 | Security | `Object.assign(entity, omitUndefined(dto))` 패턴은 여전히 DTO 화이트리스트(`class-validator` whitelist + forbidNonWhitelisted)에 의존하는 mass-assignment 형태 — 이 diff 이전부터 있던 신뢰 경계이며 새 취약점 아님 | `workflows.service.ts`/`nodes.service.ts`/`auth-configs.service.ts` `update()` | 조치 불요. 신규 DTO 필드 추가 시 화이트리스트 유지 여부 재확인 관행 유지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. mass-assignment는 기존 DTO whitelist로 방어됨(참고) |
| architecture | LOW | WARNING: 응답 직렬화 강제 계층 부재로 relation 유출 재발 여지(구조적, 이 PR 범위 밖) |
| requirement | LOW | WARNING: `UpdateWorkflowDto`/`UpdateNodeDto`의 `description` nullable 미선언(§5.4 불일치). 1R Critical 재확인 결과 해소 확인 |
| scope | LOW | 스코프 이탈 없음. 1R Critical/Warning 후속 커밋 모두 각자 문제에 국한 확인 |
| side_effect | NONE | 부작용 없음. `NotArray<T>`는 컴파일 타임 전용, 응답 형태 변경은 CHANGELOG·e2e로 고정, 이전 라운드 워크트리 뮤테이션 원복 재확인 |
| maintainability | LOW | 주석 반복·타입트릭 가독성·e2e 케이스 길이 등 경미 지적만, CRITICAL/WARNING 없음 |
| testing | LOW | 핵심 회귀는 단위·e2e로 고정. nodes/auth-configs에 null-초기화 캐너리 갭 |
| documentation | NONE | 문서화 품질 양호. `omit-undefined.ts` JSDoc 보강 제안(INFO)만 |
| api_contract | LOW | breaking change 없음. `settings` null 의미론 비일관성(기존 설계, 이미 트래커 등재) |
| user_guide_sync | NONE | doc-sync-matrix 20개 trigger 전수 대조, 매칭 0건(백엔드 내부 버그 수정, frontend/spec 변경 없음) |

## 발견 없는 에이전트

security, side_effect, documentation, user_guide_sync — 위험도 NONE, Critical/Warning 없이 확인성 INFO만 존재(문제 없음으로 분류).

## 권장 조치사항

1. `UpdateWorkflowDto.description`·`UpdateNodeDto.description`을 `@ApiPropertyOptional({ nullable: true }) description?: string | null;`로 정정해 §5.4 tri-state 규약과 OpenAPI 계약을 일치시킨다 (requirement/api_contract WARNING).
2. (선택) `nodes.service.spec.ts`·`auth-configs.service.spec.ts`에 workflows와 대칭인 "명시적 null은 로드한 값을 지운다" 캐너리를 추가해 §5.4 tri-state 회귀 방지 커버리지를 세 서비스 모두에서 완성한다 (testing INFO).
3. (선택, 비차단) `omit-undefined.ts` JSDoc에 "null 자체 입력 시 호출부가 `!= null`로 가드해야 한다"는 1R Critical의 근본 원인 문장을 추가해 다음 nullable 필드 배선 시 재발을 예방한다 (documentation INFO).
4. (장기, 이 PR 범위 밖) 응답 직렬화를 강제하는 화이트리스트 계층(`class-transformer` 등) 도입을 별도 과제로 검토 — relation eager-load 유출 결함 클래스의 구조적 재발 가능성을 줄인다 (architecture WARNING).

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff는 PATCH 병합 로직 필드 필터링(O(필드 수) 수준)으로 성능 영향 표면 없음 |
  | dependency | router 판단 — 신규/변경 외부 의존성 없음(내부 헬퍼·서비스 로직만 변경) |
  | database | router 판단 — 스키마 마이그레이션·쿼리 구조 변경 없음(기존 컬럼에 대한 애플리케이션 레벨 병합 로직만 변경) |
  | concurrency | router 판단 — 락·트랜잭션·동시성 제어 로직 변경 없음 |
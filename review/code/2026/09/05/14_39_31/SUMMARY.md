# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이전 라운드(`13_49_54`)의 감사 로그 정보 노출 CRITICAL 은 정확히 수정됐으나, 그 수정을 검증하는 신규 §5.4 대조기(`response-contract.ts`)의 순환 참조 가드 자체에 **같은 클래스의 새 CRITICAL**(자기참조 DTO 를 검사 없이 통과시킴)이 생겼다. forced reviewer 7명(`documentation`/`maintainability`/`requirement`/`scope`/`security`/`side_effect`/`testing`) 전원 결과 확보 완료 — 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `findContractViolations` 가 최상위 호출 시 `seen` 을 `[contract.name]` 으로 초기화 — 자기 자신을 가리키는 첫 번째(유일할 수도 있는) 중첩 참조를 "이미 밟은 것"으로 취급해 그 내부를 전혀 검증하지 않고 통과(`[]`)시킨다. scratch 사본에서 `seen` 초기값을 `[]` 로 바꾸면 정확히 위반 2건(`self.id:missing`, `self.leak:undeclared`)을 잡는 것으로 직접 재현 확인. 오늘 배선된 4개 DTO 는 이 경로를 안 밟지만 `CanvasSaveResultDto.workflow: WorkflowDto` 처럼 이미 자기참조형 자매 DTO 가 존재하고, 계획된 56개 DTO 스윕이 이를 밟는 순간 "검증 통과"가 거짓 신호가 된다. 전용 회귀 테스트("순환 참조에서 무한히 내려가지 않는다")는 완전-유효 payload 만 대조해 이 결함을 못 잡는 vacuous 캐너리다. | `codebase/backend/src/shared/testing/response-contract.ts:256`(`findContractViolations`), 순환 가드 `:141-163`(`descend`)·`:165-219`(`visit`) | `visit(payload, contract.schema, '', walk, [])` 로 초기 `seen` 을 빈 배열로 바꾼다(`descend` 가 실제로 밟을 때만 `[...seen, name]` 추가). 자기참조 첫 단계에 실제 위반을 주입하는 대조군 테스트(`{ id:'a', self:{leak:1} }` → `['self.id:missing','self.leak:undeclared']`)를 추가해 vacuous 갭을 회귀 방지선으로 고정할 것. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `response-contract.ts` 의 중첩 강하 로직이 `$ref`/`allOf` 만 다루고 `oneOf`/`anyOf`(판별자 없는 union)는 다루지 않는다 — 이 도구가 원래 잡으려던 것과 같은 성격의 유출이 union 분기 뒤에 숨으면 통과 판정을 낸다. `ExecutionStatusDto.context`(`oneOf: [ButtonsContextDto, NodeOutputContextDto]`), `IntegrationResponseDto.data` 가 실제로 이 형태이며 §5.4 스윕 모집단(`dto/responses/`)에 포함된다. 유닛 테스트에도 `oneOf` 축 픽스처가 없다. | `codebase/backend/src/shared/testing/response-contract.ts` (`PropertyContract`/`referencedName()`), 대상 예: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` | `PropertyContract` 에 `oneOf`/`anyOf` 를 추가해 `referencedName()` 이 순회하도록 확장(각 후보 스키마 합집합 프로퍼티에 대해 `undeclared` 만 판정, `required` 는 강제하지 않는 규칙을 문서화). 최소한 `ProbeDto` 에 `oneOf` 축 캐너리를 추가해 "지금은 미검사"임을 명시할 것. |
| 2 | architecture + security | 감사 로그 유출 수정이 **이 쿼리 지점 하나**만 좁혔을 뿐, `User` 엔티티 자체에는 여전히 컬럼 수준 방어(TypeORM `select: false`, `@Exclude()`, 전역 `ClassSerializerInterceptor`)가 전혀 없다 — 다음에 `User` 를 조인하는 새 쿼리가 `leftJoinAndSelect`/`relations:['user']` 를 무심코 쓰면 같은 클래스의 유출이 다른 호출부에서 재발할 수 있다(passwordHash·2FA 시크릿·복구 코드·비밀번호 재설정/이메일 변경 토큰 등 7개 민감 컬럼 확인). | `codebase/backend/src/modules/users/entities/user.entity.ts`(전체, `select:false`/`@Exclude` 0건), 수정 지점 `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:47-48` | 위 7개 컬럼에 `select: false` 를 걸어 기본값 자체를 안전 쪽으로 두거나, 전역 `ClassSerializerInterceptor`+`@Exclude()` 로 엔티티 그대로 반환하는 다른 경로에도 마지막 방어선을 둔다. 이번 PR 범위 밖 후속 항목으로 plan 에 명시 등재 권장. |
| 3 | documentation | 감사 로그 응답에서 민감 필드(passwordHash·2FA 복구코드·토큰 등, 26키→3키) 노출을 제거한 **관측 가능한 wire 변경**이 `CHANGELOG.md` 에 기록되지 않았다 — 같은 세션에 있는 두 선례(`AlertRuleDto.threshold`, `GET /api/executions/workflow/:workflowId` breaking change)는 동일 유형("엔티티 그대로 반환→OpenAPI 불일치") 수정을 매번 상세 기록해 왔다. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:40-49`, `CHANGELOG.md`(신규 항목 없음) | `CHANGELOG.md` 에 `## Unreleased` 항목 추가 — 선례 형식(종전/지금 표 + 영향 + 재발 방지)으로 "노출됐던 응답을 저장/로깅한 소비자가 있었다면 그 로그에 민감정보가 이미 남아있을 수 있다"는 영향까지 명시. |
| 4 | documentation | `spec-draft-nullable-notation-followups.md` 가 스스로 정의한 모집단 수치("DTO 60개 = `dto/responses/` 아래 **클래스** 수")를 그 정의대로 재계산하면 실제 **134개**(36개 파일, 24개 파일이 클래스 2개 이상)로 두 배 이상 차이난다 — 다음 착수자가 "56개 남음"을 실제의 절반 이하로 오독해 스윕 규모를 잘못 예상할 위험. | `plan/in-progress/spec-draft-nullable-notation-followups.md:289-292, 564` | "60"이 실제로 뜻하는 대상(예: 컨트롤러가 직접 광고하는 최상위 응답 DTO만, 중첩 서브 DTO 제외)을 한 줄로 명시하거나, export class 전체를 뜻한 것이면 134로 정정. |
| 5 | api_contract (+ requirement INFO 연관) | `response-contract.ts` 규칙 표가 "optional+nullable → null 허용" 예외의 출처를 **§5.4 자체**로 표기하지만, §5.4 본문은 이 조합을 응답 바디에 명시적으로 금지하고 요청 바디(PATCH tri-state) 전용으로 한정한다. 실제 근거는 별도 문서(`spec-draft-nullable-notation-followups.md`)가 추적 중인 "103곳 미교정 drift에 대한 실용적 유예"다. 이 diff 가 배선한 4개 DTO 중 3개(`ExecutionDto`/`WorkflowDto`/`AuditLogDto`)가 정확히 이 미교정 형태의 필드를 가지고 있어 "§5.4 대조 통과"가 실제로는 알려진 미교정 상태를 조용히 수용한 결과일 수 있음을 오해하기 쉽다. | `codebase/backend/src/shared/testing/response-contract.ts:42`(표 출처 열), 구현 `:194-205` | 출처 열을 "§5.4"에서 "실용적 유예 — 103곳 drift, 응답 3형태 정정 전까지"로 정정. 여력이 있으면 이 필드들을 별도 `kind`(`'legacy-optional-nullable'`)로 표시해 향후 remediation 후 예외 자체를 제거할 수 있게 캐너리를 남길 것. |
| 6 | side_effect | `AuditLogsService.findAll` 이 이제 `user` 를 부분 hydration(3필드)하는데, `AuditLog.user` 타입 선언은 여전히 전체 `User` 엔티티다 — 타입과 런타임 형태가 어긋나는 latent 갭. 지금은 유일한 소비처가 컨트롤러 pass-through 뿐이라 위험 없음(grep 확인)이나, 향후 다른 코드가 `findAll()` 을 재사용해 `user.passwordHash` 등 타입상 있다고 믿는 필드에 접근하면 컴파일은 통과하고 런타임엔 조용히 `undefined`. | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:47-48`, 엔티티 `audit-log.entity.ts:28`(`user: User`) | 반환 타입에서 `user` 를 `Pick<User,'id'|'name'|'email'> | null` 등으로 좁히거나, select 축소 지점에 "이 축소는 반환 타입에 반영 안 됨 — 소비처가 늘면 타입이 거짓말한다"는 주석을 남긴다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `leftJoin`+`addSelect` 축소는 보안뿐 아니라 성능(I/O·직렬화 감소)에도 순수 이득 | `audit-logs.service.ts:47-48` | 조치 불요(개선 확인) |
| 2 | performance | `contractForDto` 는 DTO 당 in-process Nest 앱을 부트스트랩 — 지금은 4곳 모두 `beforeAll` 캐싱으로 무해하나, 계획된 56개 DTO 스윕 시 CI 시간에 누적 영향 가능 | `response-contract.ts:299-315`, `swagger-probe.ts:46-57` | 스윕 착수 전 DTO 이름 키 메모이제이션 검토 |
| 3 | performance | `visit()` 이 배열 원소마다 동일 스키마의 `required` `Set` 을 재생성(점근적으로 무해, 회피 가능한 중복) | `response-contract.ts:172-173` | 우선순위 낮음 — `WeakMap` 캐싱 또는 `descend` 상위에서 1회 계산 검토 |
| 4 | maintainability | "find→toBeDefined→assertMatchesContract" 3문장 패턴이 2곳 반복 — 이미 `spec-draft-nullable-notation-followups.md` 에 유예 등재됨(스윕 착수 시 헬퍼로 접기로 결정) | `workflow-crud.e2e-spec.ts:163-165`, `workflow-execution.e2e-spec.ts:153-155` | 조치 불요(재지적 금지 — 이미 근거 있는 유예) |
| 5 | maintainability | `Walk` 인터페이스가 `contract`/`allowUndeclared` 는 `readonly`, 누산기 `out` 도 같이 `readonly` 로 선언돼 있어 "불변" 신호와 실제 `push` 누적 동작이 어긋남(사소) | `response-contract.ts` `interface Walk` 선언부 | 선택사항 — 주석 한 줄 추가 또는 컨텍스트/누산기 분리 |
| 6 | documentation | `ContractViolation`/`ContractCheckOptions` 에 최상위 JSDoc 없음(필드별 주석만 존재, 파일 상단 JSDoc 이 사실상 보완) | `response-contract.ts` 해당 인터페이스 선언부 | 조치 불요(경미) |
| 7 | requirement | "키생략+nullable" 관대함이 §5.4 문언과 어긋나 보이나, spec 의 소급 비적용 조항 + 도구의 명시된 스코프로 방어 가능(별도 트랙에서 이미 추적 중, api_contract WARNING #5 참고) | `response-contract.ts:42, 179, 195` | 조치 불요(다른 트랙에서 추적) |
| 8 | scope | `docs(review)` 커밋이 §5.4 와 무관한 EngineErrorCode plan 문서도 함께 수정 — 같은 턴의 impl-prep consistency-check WARNING 에 대한 직접 대응으로 확인, 직전 라운드도 이미 양해 | `plan/in-progress/spec-conventions-engine-error-code-surface.md` | 조치 불요 |
| 9 | scope | `docs(plan)` 커밋이 §5.4 무관 신규 백로그("`## Overview` 유무 불일치")를 같은 트래커에 유지 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요(치명적이지 않음, 별도 파일 분리 권장) |
| 10 | scope | 프롬프트에 조립된 `13_49_54/RESOLUTION.md` diff 스냅숏이 `HEAD` 최신 커밋(`9d0b876ad`) 하나를 놓침(스코프 판단엔 영향 없음, freshness 관심사) | `review/code/2026/09/05/13_49_54/RESOLUTION.md` | 다음 라운드 diff 조립 시 확인 |
| 11 | testing | `AuditLogsService.findAll` 의 필터 경로(`action`/`resourceType`/`startDate`/`endDate`/`sort` fallback)는 여전히 unit 테스트 없음 — 이번 diff 가 새로 만든 갭 아님 | `audit-logs.service.ts`(`findAll`, `getSortColumn`) | 다음에 이 서비스를 만질 때 필터별 단언 추가 |
| 12 | side_effect | `AuditLogsService.findAll` 의 유일한 호출부는 컨트롤러 pass-through 뿐 — 위 WARNING #6 의 실질 폭발 반경은 현재 0 (확인 완료, 결함 아님) | `audit-logs.controller.ts:40` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 이번 fix 정확성 확인. User 엔티티 컬럼 보호 부재는 INFO(architecture 의 WARNING 과 통합) |
| performance | LOW | 보안 fix 는 성능도 개선. 스윕 규모 확대 시 부트스트랩 누적 비용만 INFO |
| architecture | LOW | 호출부 단위 수정 vs 구조적 방어 부재(WARNING), 나머지는 이전 라운드 지적 해소 확인 |
| requirement | CRITICAL | 순환 참조 가드가 자기참조 DTO 를 미검증 통과 — 재귀 하강 신규 기능 자체의 결함 |
| scope | LOW | 무관 항목 없음, 보안 fix 는 정확히 지적사항에 대응, 리네임 깨끗 |
| side_effect | LOW | `findAll` 반환 타입-런타임 불일치(WARNING), 폭발 반경은 현재 0 |
| maintainability | LOW | 이전 라운드 WARNING 3건 전부 해소 확인, 잔여는 이미 유예된 INFO 뿐 |
| testing | MEDIUM | `oneOf`/`anyOf` 미검증 사각지대(WARNING), 이전 라운드 INFO 4건 전부 해소 확인 |
| documentation | MEDIUM | CHANGELOG 누락(WARNING), plan DTO 모집단 수치 오차(WARNING) |
| api_contract | LOW | §5.4 출처 오표기(WARNING), 핵심 API 표면 변경 없음 |

## 발견 없는 에이전트

없음 — 10개 에이전트 전원이 최소 1건 이상의 발견사항(CRITICAL/WARNING/INFO)을 보고했다.

## 권장 조치사항

1. **[CRITICAL]** `findContractViolations` 최상위 호출의 `seen` 초기값을 `[contract.name]` → `[]` 로 수정하고, 자기참조 첫 단계 위반을 주입하는 대조군 테스트를 추가한다(requirement #1).
2. **[WARNING]** `response-contract.ts` 에 `oneOf`/`anyOf` 하강 지원을 추가하거나 최소한 미검사임을 명시하는 캐너리를 남긴다(testing #1).
3. **[WARNING]** `CHANGELOG.md` 에 감사 로그 민감정보 노출 제거 항목을 기록한다(documentation #3).
4. **[WARNING]** `response-contract.ts` 규칙 표의 "optional+nullable" 예외 출처를 §5.4 에서 실제 근거(103곳 drift 유예)로 정정한다(api_contract #5).
5. **[WARNING]** `spec-draft-nullable-notation-followups.md` 의 "DTO 60개" 정의를 명확히 하거나 134로 정정한다(documentation #4).
6. **[WARNING]** `AuditLog.user` 반환 타입을 실제 부분 hydration 형태로 좁히거나 주석으로 경고한다(side_effect #6).
7. **[WARNING/후속]** `User` 엔티티에 컬럼 수준 `select: false` 등 구조적 방어를 추가하는 별도 plan 항목 등재(architecture+security #2).
8. 위 1~6 은 이번 라운드 내 조치, 7은 별도 후속 plan 항목으로 등재 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 전원 결과 확보 완료 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(diff 에 의존성 변경 없음) |
  | database | router 판단(스키마/마이그레이션 변경 없음) |
  | concurrency | router 판단(동시성 관련 변경 없음) |
  | user_guide_sync | router 판단(사용자 가이드 문서 변경 없음) |
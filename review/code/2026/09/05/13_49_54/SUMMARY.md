# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 신규 §5.4 계약 검증 헬퍼(`response-contract.ts`)는 테스트 인프라 자체는 견고하지만, 최상위 키만 검사하는 얕은(non-recursive) 설계 때문에 `AuditLogDto.user`(중첩 DTO 참조)를 통한 **실제 라이브 보안 결함**(비밀번호 해시·TOTP/WebAuthn 복구 코드 노출)을 놓친다 — requirement-reviewer 가 diff 밖 연쇄 파일(엔티티/서비스/컨트롤러)까지 추적해 발견했으며, security-reviewer 는 diff 파일만 검토해 이 결함을 못 봤다(라우팅 결과 은폐 아님 — 두 reviewer 의 검토 스코프 차이). forced 화이트리스트 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | §5.4 계약 검증기(`findContractViolations`)가 **중첩 객체 필드를 재귀 검증하지 않아**, `AuditLogDto.user` 를 통한 실제 민감정보 노출을 놓친다. `AuditLogsService.findAll` 이 `leftJoinAndSelect('al.user','user')` 로 raw `User` 엔티티를 매핑 없이 그대로 반환하고(`AuditLogUserDto` 는 id/name/email 3필드만 선언), `User` 엔티티에 `@Exclude()` 도 없어 `passwordHash`/`totpRecoveryCodes`/`webauthnRecoveryCodes` 등이 실 HTTP 응답에 그대로 실린다. 이번 diff 가 정확히 이 엔드포인트에 새 e2e 단언(`assertMatchesDtoSchema(rows[0], schemaForDto(AuditLogDto), 'AuditLogDto')`)을 추가했음에도 최상위 키만 봐서 "통과"로 오도한다. | `codebase/backend/src/shared/testing/response-contract.ts:74-141`(특히 92,97행); 연쇄: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26`, `audit-logs/entities/audit-log.entity.ts:24-29`, `audit-logs/audit-logs.service.ts:36`, `audit-logs/audit-logs.controller.ts:36-41`, `users/entities/user.entity.ts` | (1) 별도 시급 보안 fix로 등재: `AuditLogsService` 가 raw entity 대신 `AuditLogDto`/`AuditLogUserDto` 로 명시 매핑(`plainToInstance(..., {excludeExtraneousValues:true})` 또는 서비스단 매퍼). (2) `findContractViolations` 을 `$ref`/`allOf` 로 다른 DTO 를 가리키는 필드에 대해 재귀 검증하도록 확장하거나, 최소한 JSDoc 에 "중첩 객체는 존재/null 여부만 검증하고 내부 스키마는 검증하지 않는다"는 스코프 제한을 명시해 커버리지 과신을 막는다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | architecture, maintainability | DTO 식별자가 "클래스 참조"(`schemaForDto(Dto)`)와 "문자열 리터럴"(`dtoName: string`) 두 형태로 이중 표현되어 4개 호출부 전부가 같은 이름을 두 번 타이핑한다. `schemaForDto` 내부는 이미 `Dto.name` 을 쓰므로 파생 가능한 값이다. DTO 클래스가 리네임돼도 컴파일러가 문자열 불일치를 못 잡아 실패 메시지가 조용히 stale 해질 수 있다 — plan 이 이 패턴을 ~60개 DTO 로 기계적으로 확장할 예정이라 스케일에서 반복될 위험. | `codebase/backend/src/shared/testing/response-contract.ts:162-167,181-183`; 호출부 `test/audit-logs.e2e-spec.ts:79`, `test/session-revocation.e2e-spec.ts:110`, `test/workflow-crud.e2e-spec.ts:164`, `test/workflow-execution.e2e-spec.ts:150` | `assertMatchesDtoSchema` 가 `Dto: Type<unknown>` 을 받아 내부에서 `Dto.name` 파생하거나, `schemaForDto` 가 `{schema, name}` 을 함께 반환해 호출부의 수동 문자열을 제거. |
| 3 | maintainability, architecture | `ContractViolationKind.'missing'` 이 "필드 누락"(required 인데 키 없음)과 "payload 자체가 객체가 아님" 두 서로 다른 의미로 재사용된다 — 타입 주석("required 인데 키가 없다")과 실제 동작이 어긋난다. `property:'(payload)'` 로만 구분되고 `kind` 값만 보는 향후 소비자(예: "missing 개수 집계")가 두 종류를 혼동할 수 있다. | `codebase/backend/src/shared/testing/response-contract.ts:42-45`(타입 주석), `:79-87`(payload 비객체 분기), `:102-110`(진짜 필드 누락 분기) | 전용 kind(예: `'invalid-payload'`) 추가, 또는 최소한 주석에 재사용 사실 명시. |
| 4 | requirement | JSDoc 이 "§5.4 를 그대로 옮긴 것"이라 주장하지만, 규칙 표 4번째 행("스키마에 없는 키 → undeclared")은 spec 본문(`2-api-convention.md` §5.4)에 명시된 규칙이 아니라 검증기가 독자적으로 추가한 확장이다. 3개 핵심 행(required/nullable/키생략형)은 spec 원문과 line-level 로 정확히 일치하지만 표 전체를 "그대로 옮김"으로 단정해 다음 독자가 §5.4 를 봐도 4번째 행 근거를 못 찾는다. | `codebase/backend/src/shared/testing/response-contract.ts:30-40` vs `spec/5-system/2-api-convention.md` §5.4(176-199행) | JSDoc 표 제목을 "§5.4(앞 3행) + 응답 계약 일반 원칙(4번째 행)"으로 스코프 분리. spec 수정 불필요 — 코드가 spec 보다 엄격한 것은 정당, 문서 문구만 정정. |
| 5 | api_contract | JSDoc 규칙 표("키 생략형 필드에 값이 있으면 무조건 null 이 아니어야 한다")와 실제 구현(`!nullable` 가드 — 스키마가 `nullable:true` 도 함께 선언하면 면제)이 "키 생략형+nullable" 조합에서 서로 다른 규칙을 말한다. 이 조합이 실제 배선 대상 DTO 에 광범위(`ExecutionDto` 22필드 중 10개, `WorkflowDto`/`AuditLogDto` 일부)해, `workflow-execution.e2e-spec.ts` 주석의 "22개 필드를 한 번에 문다"는 서술이 실제로는 "required 12개만 엄격 검증, 나머지 10개는 존재 여부만 검증"이라는 실질 커버리지보다 과대하다. | `codebase/backend/src/shared/testing/response-contract.ts:36`(JSDoc) vs `:122`(구현); 호출부 주석 `test/workflow-execution.e2e-spec.ts:147` | JSDoc·구현·호출부 주석 3곳을 일치: (a) 이 조합을 별도 위반 종류로 잡거나 JSDoc 에 예외 명시, (b) 의도적으로 허용한 것이면 JSDoc 문구를 "nullable 도 함께 선언하면 예외"로 정정하고 호출부 주석의 "N개 필드를 한 번에 문다"를 실제 커버리지("required 만 엄격 검증")로 좁힌다. |
| 6 | maintainability | "find → `toBeDefined` 단언 → `assertMatchesDtoSchema`" 3문장 패턴이 이미 2개 e2e 파일에서 반복되고, 동봉된 plan(`spec-draft-nullable-notation-followups.md`)이 이 패턴을 ~56개 DTO 로 기계적으로 확장할 계획을 명시해 중복이 곧 커질 것이 예견된다. | `codebase/backend/test/workflow-crud.e2e-spec.ts:159-165`, `test/workflow-execution.e2e-spec.ts:148-150`; 근거 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§5.4 drift 2단계 스윕 계획) | 스윕 착수 **전에** `assertItemMatchesDto(items, id, Dto)` 같은 헬퍼를 `response-contract.ts` 에 추가해 find/defined/schema-assert 3단계 + `Dto.name` 파생을 한 번에 캡슐화. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | architecture, side_effect, maintainability, testing | `schemaForDto()` 캐싱 방식이 e2e 파일마다 다르다 — 3곳(`audit-logs`, `session-revocation`, `workflow-crud`)은 `it()` 본문에서 매번 재생성(Nest 테스트 모듈 전체 부트스트랩), 1곳(`workflow-execution`)만 `beforeAll` 캐싱. 지금은 파일당 1회 호출이라 영향 없지만 56개 DTO 스윕에서 반복 패턴이 굳어질 수 있다. | `test/audit-logs.e2e-spec.ts:78`, `test/session-revocation.e2e-spec.ts:109`, `test/workflow-crud.e2e-spec.ts:163` vs `test/workflow-execution.e2e-spec.ts:67-68` | 스윕 전에 "스키마는 `beforeAll` 1회, 대조는 `it()`" 규약 명시 또는 헬퍼 내부 메모이제이션. |
| 8 | architecture, documentation | §5.4 시행 코드(`response-contract.ts`)가 아직 어떤 spec 의 `code:` frontmatter glob 에도 걸리지 않아 `--impl-done` SPEC-CONSISTENCY 게이트가 이 파일 변경을 추적 못 함. developer 는 `spec/` 쓰기 권한이 없어 이번 PR 에서 등재만 함. | `plan/in-progress/spec-draft-nullable-notation-followups.md:266-271`(신규 등재); 대상 `codebase/backend/src/shared/testing/response-contract.ts` | 조치 불요(이미 plan 등재) — 다음 planner 턴에서 `2-api-convention.md` frontmatter `code:` 에 등재. |
| 9 | scope | `docs(review)` 커밋이 §5.4 와 무관한 `spec-conventions-engine-error-code-surface.md`(엔진 에러코드 트래커)도 함께 수정 — 근거는 같은 세션 impl-prep consistency-check WARNING #2 대응. | `plan/in-progress/spec-conventions-engine-error-code-surface.md` | 조치 불요. 향후 커밋 본문에 "WARNING #N 대응" 한 줄 남기면 추적이 빨라짐. |
| 10 | scope | `docs(plan)` 커밋이 §5.4 항목이 아닌 신규 백로그("`## Overview` 유무 불일치")를 무관한 트래커 파일(`spec-draft-nullable-notation-followups.md`)에 얹음 — 근거는 같은 세션 convention_compliance.md WARNING #1. | `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 불릿 | 조치 불요. 향후 유사 항목은 별도 신규 plan 파일로 분리 권장. |
| 11 | requirement, testing | 배열(Array) payload 가 "객체 아님" 가드(`typeof payload !== 'object'`)를 통과해버려 의도한 단일 `(payload)` 위반으로 보고되지 않고 `Object.entries`/`Object.keys` 로직으로 흘러 들어간다. 유닛 스펙의 `it.each` 도 배열 케이스를 캐너리로 포함하지 않는다. | `codebase/backend/src/shared/testing/response-contract.ts:79`; `response-contract.spec.ts:144-154` | `it.each` 에 `['배열', []]` 케이스 추가, 가드를 `Array.isArray(payload) || ...` 로 확장. |
| 12 | testing | 중첩 `$ref`+`nullable` 조합(`AuditLogDto.user`)의 null/부재 분기가 유닛·e2e 어느 쪽도 실제로 밟지 않는다. 실측(scratch probe)으로 현재 스키마 형태(`nullable` 이 `allOf`/`$ref` 와 sibling)에서는 정상 동작함을 확인했으나, `@nestjs/swagger` 버전이 바뀌면 이 조합만 조용히 깨지고 어떤 테스트도 못 잡는다. | `test/audit-logs.e2e-spec.ts:75-80`; 대상 `audit-log-response.dto.ts` `user?: AuditLogUserDto | null` | `ProbeDto` 에 중첩 DTO 참조 필드 추가 또는 `audit-logs.e2e-spec.ts` 에 `user=null` 케이스 추가. |
| 13 | testing | `findContractViolations` 반환값의 정렬(`.sort(...)`) 로직이 사실상 미검증 — 유일한 다건-위반 테스트가 결과를 테스트 쪽에서 재정렬 후 비교해, `.sort()` 호출을 통째로 지우는 뮤테이션도 현재 18개 테스트를 전부 통과시킨다. | `response-contract.spec.ts:134-141` vs `response-contract.ts:141` | 정렬 없이 원본 순서로 `toEqual` 하거나, "출력이 항상 property 알파벳순"임을 직접 단언하는 케이스 추가. |
| 14 | documentation | `ContractViolation`/`PropertyContract` 인터페이스 자체에 최상위 JSDoc 없음(필드별 주석은 있음, 파일 상단 대형 JSDoc 이 실질적으로 커버). | `codebase/backend/src/shared/testing/response-contract.ts` 인터페이스 선언부 | 선택사항 — 한 줄 설명 추가. |
| 15 | documentation | `CHANGELOG.md` 항목 없음 — 이번 PR 은 wire 변경·신규 버그 발견이 없어 저장소 관례상 대상 아님. | `CHANGELOG.md`(변경 없음) | 조치 불요. |

## 확인 완료 — 문제 없음 (참고)

- **security**: 인젝션·시크릿·인증/인가·입력검증·OWASP·암호화·에러처리·의존성 8개 관점 전부 위반 없음. DB 접근 전부 파라미터 바인딩. `src/shared/testing/**` 는 `tsconfig.build.json` exclude 로 프로덕션 dist 제외 확인.
- **side_effect**: 전역 변수/env/fs 접근 0건, 새 export 는 전부 신규 함수(기존 시그니처 미변경), Nest 테스트 앱은 `try/finally` 로 확실히 정리(리소스 누수 없음), 프로덕션 빌드 제외 확인.
- **documentation**: JSDoc 이 인용한 모든 수치(엔티티-DTO 불일치 59건·46건·§5.4 미검증 DTO 78곳, 4개 DTO 필드 수 22/10/8/7)가 plan 문서·실제 DTO 선언과 전부 정확히 일치 — 지어낸 근거 없음.
- **requirement**: `ProbeDto` 픽스처가 §5.4 4축을 전부 포함하고 대조군·전제 테스트·mutation 근거(4곳 각각 RED)까지 갖춤. 4개 e2e 배선의 required 필드 수가 실제 DTO 선언과 정확히 일치.
- **api_contract**: 실제 API 표면(엔드포인트·요청/응답 스키마·인증·버전)은 하나도 바뀌지 않음 — 순수 테스트 인프라 추가.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 8개 관점 위반 없음. (단, diff 파일만 검토 — 아래 requirement 의 CRITICAL 은 diff 밖 연쇄 파일 추적으로 발견됨) |
| architecture | LOW | DTO 식별자 이중표현, `schemaForDto` 캐싱 불일치, spec code: glob 미등재 |
| requirement | **CRITICAL** | §5.4 검증기가 중첩 객체 미검증 → `AuditLogDto.user` 통해 실제 라이브 보안결함(비밀번호 해시·복구코드 노출) 은폐 |
| scope | LOW | 커밋 분리 양호(4커밋, 관심사별 분리). 무관 plan 파일 동반수정 2건은 근거 있음(INFO) |
| side_effect | NONE | 전역상태/누수 없음, 격리 설계 양호 |
| maintainability | LOW | `kind:'missing'` 재사용, `dtoName` 문자열 중복, 보일러플레이트 확장 예정(56개 DTO 스윕) |
| testing | LOW | 정렬 로직 미검증, 배열 payload 미검증, 중첩 null 분기 미검증(현재는 실측상 정상) |
| documentation | NONE | 인용 수치 전부 정확, code: glob 갭은 이미 추적중 |
| api_contract | LOW | JSDoc vs 구현이 "키생략+nullable" 조합에서 불일치, 커버리지 과대서술(`ExecutionDto` 10/22 필드) |

## 발견 없는 에이전트

(없음 — 9개 reviewer 전원이 최소 INFO 이상의 관찰 또는 명시적 "확인 완료" 기록을 남김)

## 권장 조치사항

1. **(최우선, 별도 트랙)** `AuditLogsService.findAll` 이 raw `User` 엔티티를 매핑 없이 반환하는 실제 보안 결함을 즉시 별도 fix 로 등재 — `AuditLogDto`/`AuditLogUserDto` 로 명시 매핑(`class-transformer` `excludeExtraneousValues` 등)해 `passwordHash`/TOTP·WebAuthn 복구 코드 노출을 차단한다. developer 트랙, `spec/` 변경 불요.
2. `findContractViolations` 를 중첩 `$ref`/`allOf` 필드에 대해 재귀 검증하도록 확장하거나, 최소한 JSDoc 에 "중첩 객체는 존재 여부만 검증한다"는 스코프 제한을 명시해 이 검증 도구에 대한 커버리지 과신을 막는다(위 CRITICAL 의 재발 방지).
3. §5.4 drift 2단계(56개 DTO 스윕) 착수 **전에** 다음을 정리: (a) `assertMatchesDtoSchema` 가 `Dto.name` 을 파생하도록 바꿔 문자열 이중 표기 제거, (b) "키생략형+nullable" 조합에 대한 JSDoc/구현/호출부 주석 불일치 정정, (c) find/defined/schema-assert 3단계를 캡슐화하는 헬퍼 도입. 지금 고치면 3곳, 스윕 후엔 56곳.
4. `ContractViolationKind.'missing'` 재사용, 배열 payload 미검증, 정렬 로직 미검증, 중첩 null 분기 테스트 부재는 우선순위는 낮으나 스윕 전 보강 시 향후 회귀 탐지 비용을 낮춘다.
5. 이미 plan 에 등재된 항목(spec `code:` glob 미등재, 엔진 에러코드 트래커 정리)은 다음 planner 턴에서 정상 집행하면 충분 — 이번 PR 기준 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(해당 diff 범위에서 성능 영향 낮음으로 제외) |
  | dependency | router 판단(신규 의존성 없음) |
  | database | router 판단(스키마/마이그레이션 변경 없음) |
  | concurrency | router 판단(동시성 로직 변경 없음) |
  | user_guide_sync | router 판단(사용자 가이드 영향 없음) |
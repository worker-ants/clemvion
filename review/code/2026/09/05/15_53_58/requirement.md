# 요구사항(Requirement) 코드 리뷰

## 범위 요약

핵심 변경은 두 갈래다.

1. **보안 결함 수정**: `GET /api/audit-logs` 가 `leftJoinAndSelect('al.user','user')` 로 `User`
   엔티티 전 컬럼(26키)을 로드해 그대로 반환하던 것을, `leftJoin` + `addSelect(['user.id',
   'user.name','user.email'])` 로 좁혀 `AuditLogUserDto` 가 광고하는 3필드만 DB 밖으로
   나가게 했다(`audit-logs.service.ts`). 반환 타입도 `AuditLogListItem`(`Omit<AuditLog,'user'|
   'workspace'> & { user: Pick<User,'id'|'name'|'email'> | null }`)으로 좁혀 타입이 런타임보다
   넓어지는 것을 막았다.
2. **재발 방지 인프라**: 실 HTTP 응답 1건과 DTO 의 생성된 OpenAPI 스키마를 대조하는 일반
   헬퍼(`response-contract.ts`/`.spec.ts`)를 신설하고, `audit-logs`/`session-revocation`/
   `workflow-crud`/`workflow-execution` 4개 e2e 스펙에 배선했다. `ExecutionDto` 스키마 형태
   고정용 단위 테스트(`execution-response.dto.spec.ts`)도 함께 신설됐다.

나머지 파일(11~13번 plan 문서, 14번 이후 `review/**` 산출물)은 이번 PR 을 구성하는 4개 커밋 중
`docs(review)`/`docs(plan)` 커밋에 포함된 이전 라운드 산출물·plan 갱신이며, 코드 동작에는
영향이 없다.

## 검증 방법

- `audit-logs.service.ts`/`.spec.ts`/`.controller.ts`/`entities/audit-log.entity.ts`/
  `dto/responses/audit-log-response.dto.ts` 를 실 파일로 읽어 `leftJoin`+`addSelect` 3필드가
  `AuditLogUserDto`(id/name/email) 와 정확히 일치하는지 대조.
- `record()` catch 블록의 "12개 특권 CRUD producer" 문구(전 라운드 "12개+" → "12개" 정정)를
  `grep -rn "auditLogsService.record("` 로 실측 — `auth.controller.ts`·`triggers.service.ts`·
  `webauthn.controller.ts`·`workflows.service.ts`·`workspace-invitations.service.ts`·
  `schedules.service.ts`·`workspaces.service.ts`·`integrations.service.ts`·
  `model-config.service.ts`·`executions.service.ts`·`auth-configs.service.ts`·
  `users.controller.ts` = **정확히 12개 파일(producer)**. 정정이 정확하다.
- `response-contract.ts` 전문 + `response-contract.spec.ts` 전문을 읽고 JSDoc 판정 규칙 표
  (5행)와 `visit()`/`descend()`/`visitUnion()` 구현을 줄 단위로 대조 — 일치.
- `spec/5-system/2-api-convention.md` §5.4 원문을 읽어 "요청 DTO 한정 tri-state" 서술이
  JSDoc 의 "넷째 행은 §5.4 아님" 설명과 일치함을 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 읽어, `response-contract.ts`
  가 판정 대상에서 제외한 "응답 DTO 의 optional+nullable 선언 자체의 §5.4 준수 여부"가
  이미 별도 트래커 항목(§5.4 drift 배치 2단계, `ExecutionDto` 10개 필드 등)으로 잡혀 있고
  "열어 둠"으로 명시돼 있음을 확인 — 새로 발견한 gap 이 아니라 기존에 스코프 결정과 함께
  추적 중인 항목.
- `execution-response.dto.spec.ts` 의 `REQUIRED_NON_NULLABLE`(11)+`REQUIRED_NULLABLE`(1)+
  `OPTIONAL_NULLABLE_DRIFT`(10) = 22 가 실제 `ExecutionDto` 프로퍼티 22개와 정확히 일치하는지
  `execution-response.dto.ts` 원본과 대조 — 일치.
- `WorkflowDto`(12필드, required 10) · `SessionDto`(7필드, 전부 required) 원본을 읽어 plan
  문서의 required 카운트 표(10/7)와 대조 — 일치. `oneOf`/`$ref`/배열 필드가 `descend()` 로직의
  가정(스칼라 배열은 무시, `additionalProperties` 객체는 `$ref` 없어 하강하지 않음)과 충돌하는
  지점 없음.
- `spec/5-system/1-auth.md §4.2`(Admin+ 한정·기간/사용자/액션 필터)와 컨트롤러의
  `@Roles('admin')`·서비스의 `action`/`resourceType`/`userId`/`startDate`/`endDate` 필터를
  대조 — 일치.
- `spec/1-data-model.md:474` 및 `spec/5-system/3-error-handling.md §1.4` 를 직접 열어,
  `spec-conventions-engine-error-code-surface.md` 가 "이미 해소" 라 적은 두 spec 항목이 실제로
  등재처 삼분법(`EngineErrorCode`/`ErrorCode`/`RehydrationError.code`) 서술과 앵커 열을 담고
  있는지 확인 — 두 문서 모두 그 서술을 실제로 담고 있어 plan 의 "이미 해소" 주장이 사실과
  일치.

## 발견사항

- **[INFO]** `assertMatchesContract` 는 payload 가 plain object 가 아니면(빈 배열의 `[0]`
  즉 `undefined` 포함) `invalid-payload` 위반으로 던진다. 4개 e2e 스펙 모두 호출 직전에
  `rows.length`/`sessions.length`/`items.find(...)` 가 최소 1건 이상임을 먼저 단언해 두어
  현재는 문제가 없으나, 이 헬퍼를 다른 엔드포인트에 재사용할 때 그 사전 단언을 빠뜨리면
  "응답이 비어 있다"는 별개 결함이 "계약 위반"으로 오분류될 수 있다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` `findContractViolations`
    함수(비-객체 payload 분기)
  - 제안: 필수 수정 아님. 향후 재사용 가이드(JSDoc)에 "먼저 배열/존재를 단언한 뒤 호출할 것"을
    한 줄 추가하면 재사용 시 실수를 줄인다.

- **[INFO]** (확인 완료, 결함 아님) `response-contract.ts` JSDoc 규칙 표의 4·5번째 행("키
  생략형 + nullable"·"스키마에 없는 키")은 §5.4 본문과 스스로 "§5.4 아님" 이라 명시하며 경계를
  긋는다. 이 경계 설정 자체는 `spec/5-system/2-api-convention.md` §5.4 도입부("요청 DTO 에서는
  tri-state 가 정당하다")와 대조해도 사실과 일치한다 — 응답 DTO 가 그 조합을 선언하는 것
  자체의 적법성은 이 도구가 아니라 별도 계층(`plan/in-progress/
  spec-draft-nullable-notation-followups.md` §5.4 drift 배치 2단계)이 추적 중이며, 그 문서는
  `ExecutionDto` 10개 필드를 "기존 상태로 추적 중"이라 명시적으로 열어 두고 있다. 새로 지적할
  spec 불일치가 아니라 이미 식별·기록된 스코프 결정이다.

## 요약

핵심 수정(`audit-logs.service.ts` 의 select 축소 + `AuditLogListItem` 타입 좁히기)은
`AuditLogUserDto`(id/name/email)·`spec/5-system/1-auth.md §4.2`(Admin+·필터)와 line-level 로
일치하며, 단위 테스트(`audit-logs.spec.ts`)가 `leftJoinAndSelect` 로의 회귀를 `leftJoin`
존재 여부로 즉시 잡도록 구성돼 있다. 신규 `response-contract.ts`/`.spec.ts` 는 §5.4 의 네
축(required/nullable/키생략/미선언)을 판정 로직과 JSDoc 양쪽에서 일관되게 구현했고, 자기참조
스키마·판별자 없는 `oneOf`·중첩 배열 등 엣지 케이스를 실제 위반 주입 테스트로 커버한다.
`ExecutionDto`/`WorkflowDto`/`SessionDto`/`AuditLogDto` 4개 DTO 의 required/nullable 필드
수를 원본과 직접 대조해 plan 문서의 카운트 주장(12/10/7/8)이 모두 실측과 일치함을 확인했다.
"12개+"→"12개" 감사 producer 카운트 정정도 `grep` 실측(정확히 12개 파일)으로 재확인했다.
TODO/FIXME/HACK 류 미완성 표식은 대상 파일에 없다. 발견된 두 항목은 모두 INFO 수준으로, 하나는
헬퍼 재사용 시 잠재적 실수 지점에 대한 문서화 제안이고 다른 하나는 이미 별도 트래커로 추적
중인 스코프 결정을 재확인한 것이다. CRITICAL/WARNING 급 요구사항 미비는 발견하지 못했다.

## 위험도

NONE

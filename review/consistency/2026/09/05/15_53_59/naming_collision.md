# 신규 식별자 충돌 검토

## 검토 범위 확인

- `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/**` 자체의 파일 델타는 0 — 이번 브랜치는 그 spec 영역을 편집하지 않았다 (정상, 코드 전용 변경).
- 실제 델타는 `codebase/` 9개 파일 / 1299줄(`git diff origin/main...HEAD -- codebase/`, 워킹트리 `plan-in-progress-items-b0c80b` 기준 재실측)이며 전량 **§5.4(API 응답 계약) drift 스윕용 테스트/헬퍼 코드**다. 새 REST endpoint, 새 큐/webhook/SSE 이벤트명, 새 ENV var, 새 spec 파일 경로는 이번 diff 에 없다.
- 신규 식별자 후보는 코드 레벨의 새 타입/함수/파일명 3종으로 좁혀진다. 아래는 그 각각을 저장소 전체(`codebase/`, `spec/`, `plan/in-progress/`)에서 grep 해 기존 사용처와의 의미 충돌 여부를 확인한 결과다.

## 발견사항

- **[WARNING]** `response-contract.ts`/`ContractViolation` 이 기존 `swagger-dto-contract-guard.ts`/`ContractMismatch` 와 이름·개념이 근접해 혼동 소지
  - target 신규 식별자: `codebase/backend/src/shared/testing/response-contract.ts` — `ContractViolation`(type), `ContractViolationKind`, `DtoContract`, `findContractViolations()`, `assertMatchesContract()`, `contractForDto()`, `formatViolations()`
  - 기존 사용처: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:34` `export interface ContractMismatch` / `:157` `export function findSwaggerContractMismatches()` (2026-09-04 신설, `plan/in-progress/spec-draft-nullable-notation-followups.md:169,191,250`)
  - 상세: 두 모듈 모두 "DTO 의 Swagger 선언이 계약을 지키는가" 라는 동일 주제를 다루고, 이름도 `*Contract*`/`find*Contract*` 패턴을 공유한다. 그러나 실제로 검사하는 대상은 서로 다르다 — 기존 것은 **DTO 소스 파일의 `@ApiProperty` 데코레이터 인자 vs 그 필드의 TS 타입**을 AST 로 정적 대조하고(런타임 무관, 파일-내부), 신규 것은 **실제 HTTP 응답 값 1건 vs 생성된 OpenAPI 스키마**를 런타임에 대조한다(엔드포인트 표면 노출 검증). 동일 identifier 가 재사용된 것은 아니라 컴파일 충돌은 없고, `response-contract.ts` 자체 JSDoc(779~793행 부근)에 "선언 자체의 §5.4 준수는 `repo-guards/swagger-dto-contract` 가 본다" 는 경계 설명이 이미 있어 코드를 직접 읽으면 구분된다 — 다만 이름만 보고 검색·참조하는 다음 개발자(또는 `plan/` 트래커 항목 추가 시)는 "Contract" 두 글자로 grep 했을 때 어느 쪽을 말하는지 즉시 판별하기 어렵다.
  - 제안: (a) 두 모듈을 구분하는 접두어를 문서/커밋 메시지에서 상시 명시(예: "선언-정적 계약(`swagger-dto-contract`)" vs "응답-런타임 계약(`response-contract`)"), 또는 (b) 이번 PR 이 이미 등재한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`2-api-convention.md` frontmatter `code:` 에 §5.4 검증자 등재" 후속 항목(TODO, planner 턴)을 진행할 때 두 검증자의 역할 경계를 spec 본문에 한 문장으로 명문화해 이름의 근접성이 만드는 혼동을 원천 차단. 리네임은 이미 배선된 4개 e2e 호출부를 건드리므로 강제하지 않는다.

- **[INFO]** 테스트 전용 stub 컨트롤러 경로 `'stub'` 재사용 — 기존 컨벤션과 일치, 충돌 아님
  - target 신규 식별자: `execution-response.dto.spec.ts:167` `@Controller('stub')`
  - 기존 사용처: `workflows-execute-body.spec.ts:118`, `execution-status-response.dto.spec.ts:28`, `interact-ack-response.dto.spec.ts:22` — 동일 경로 `'stub'` 을 이미 3곳에서 독립적으로 사용 중
  - 상세: 각 파일이 `buildSwaggerDocument({ controllers: [...] })` 로 파일마다 격리된 in-process Nest 테스트 모듈을 만들기 때문에 동일 경로 문자열이 서로 다른 프로세스 인스턴스에 존재해도 라우팅 충돌이 나지 않는다. 실 앱에 등록되는 컨트롤러가 아니므로 API endpoint 충돌 범주에 해당하지 않는다. 기존 관행을 그대로 따른 것이라 새로운 리스크가 아니다.
  - 제안: 없음(현행 유지 권장).

## 검사했으나 충돌 없음으로 확인된 항목

- `AuditLogListItem`(신규 export type, `audit-logs.service.ts:24`) — 저장소 전체(backend+frontend) grep 결과 이 diff 3곳(정의·반환타입·캐스트) 외 사용처 없음. 기존 `AuditLog*` 계열 타입(`AuditLogDto`, `AuditAction` 등)과 이름이 겹치지 않음.
- `swagger-probe.ts` import 대상(`buildSwaggerDocument`, `schemasOf`, `schemaOf`) — 기존 파일 그대로 재사용, 신규 식별자 아님.
- 새 REST endpoint·webhook/queue/SSE 이벤트명·ENV var·config key — 이번 diff 에 도입된 것 없음(정적 grep 으로 `process.env.`, `@Get/@Post/@Put/@Patch/@Delete` 신규 라우트 전수 확인, stub 컨트롤러 제외 신규 라우트 0건).
- spec 파일 경로 — `spec/5-system/**` 델타 0, 신규 spec 파일 없음.

## 요약

이번 diff 는 spec 델타가 없는 코드 전용 변경으로, 신규 식별자는 `AuditLogListItem` 타입 하나와 `response-contract.ts` 가 내보내는 런타임 DTO-응답 대조 헬퍼 API(`ContractViolation`/`DtoContract`/`findContractViolations`/`assertMatchesContract`/`contractForDto` 등) 그리고 이를 사용하는 신규 테스트뿐이다. `AuditLogListItem` 은 저장소 전역에서 완전히 새 이름이라 충돌이 없고, stub 컨트롤러 경로 재사용은 기존 관행과 일치해 위험이 없다. 유일하게 주의할 지점은 신규 `response-contract.ts`/`ContractViolation` 계열이 2026-09-04 에 이미 신설된 `swagger-dto-contract-guard.ts`/`ContractMismatch` 계열과 이름·주제가 근접해 있다는 점인데, 코드가 서로 다른 identifier 를 쓰고 JSDoc 으로 역할 경계를 이미 밝혀 두어 실제 충돌(같은 이름이 다른 의미로 쓰이는 상황)은 아니며 명명 명확화를 권장하는 WARNING 수준에 그친다.

## 위험도

LOW

# API 계약(API Contract) 리뷰

## 범위 요약

이번 diff 의 실질 코드 변경은 두 갈래다.

1. `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `leftJoinAndSelect('al.user','user')` 를 `leftJoin` + `addSelect(['user.id','user.name','user.email'])` 로 좁혀, `GET /api/audit-logs` 응답의 `user` 객체가 `AuditLogUserDto`(id/name/email) 선언과 정확히 일치하도록 만든 **보안 수정**(직전 라운드 `review/code/2026/09/05/13_49_54` 의 CRITICAL #1 조치, `RESOLUTION.md` 로 확인됨). API 표면(엔드포인트·상태 코드·페이지네이션·인증)은 바꾸지 않고, 실제 응답을 문서화된 계약에 맞춘 것이라 하위 호환성 관점에서도 "계약을 어기는 축소" 가 아니라 "계약 위반(과다 노출) 교정" 이다.
2. `codebase/backend/src/shared/testing/response-contract.{ts,spec.ts}` 신설 + `test/{audit-logs,session-revocation,workflow-crud,workflow-execution}.e2e-spec.ts` 4곳에 응답-vs-DTO 전수 대조 배선. 프로덕션 API 는 건드리지 않는 테스트 인프라이지만, 이 인프라가 §5.4(응답의 null/키생략 규약)의 **사실상 유일한 실행 시점 enforcement** 가 되므로 그 판정 로직 자체를 API 계약 관점에서 검토했다.

파일 9~31(`plan/**`, `review/**`)은 직전 라운드 산출물·plan 갱신이라 API 계약과 직접 관련이 없다.

## 발견사항

- **[WARNING]** `response-contract.ts` 의 §5.4 판정 규칙 표가 "optional+nullable → null 허용" 예외의 출처를 **§5.4 자체**로 표기하지만, §5.4 본문은 그 조합을 응답 바디에서 명시적으로 금지하고 요청 바디(PATCH tri-state) 전용으로 한정한다 — 이 예외의 실제 근거는 §5.4 가 아니라 "아직 새 3형태 규칙으로 정리되지 않은 기존 DTO 103곳" 이라는 별도 트래킹 항목이다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:42`(판정 규칙 표 3번째 행, 출처 열 `§5.4`) 및 구현 `codebase/backend/src/shared/testing/response-contract.ts:194-205`(`if (value === null) { if (!nullable) {...} }` — `isRequired` 여부와 무관하게 `nullable: true` 선언만으로 null 을 허용)
  - 상세: `spec/5-system/2-api-convention.md` §5.4 는 응답 바디 DTO 선언 형태를 정확히 두 가지로 못박는다(`spec/5-system/2-api-convention.md:188-190`) — **"키를 생략하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)"** 와 **"`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`"** 뿐이다. 같은 절 도입부(`:178`)는 "optional + nullable" 조합(`@ApiPropertyOptional({ nullable: true })` + `field?: T | null`)을 **요청 DTO(PATCH 부분 업데이트)에 한해 정당**하다고 명시적으로 한정한다 — 응답 바디에 대해서는 그 조합이 legitimate 세 번째 형태로 열거되지 않는다.
    그런데 `response-contract.ts` 의 규칙 표는 이 "금지된" 조합을 응답 검증 규칙 안에 3번째 행으로 넣고 출처를 "§5.4" 라고 적었다(직전 라운드 WARNING #5 조치로 JSDoc·구현·호출부 주석 세 곳을 서로 맞췄지만, "이 예외가 §5.4 자체에서 나온 것인가" 는 그때 확인되지 않았다). 실제 근거는 `plan/in-progress/spec-draft-nullable-notation-followups.md:224-228` 에 있다 — 그 문서는 §5.4 를 (기존의 2형태에서) 3형태로 조인 뒤 **"103곳이 새 문면과 어긋났다... 103곳은 당시 규약을 정확히 지킨 것이라 위반이 아니라 규약 변경에 따른 drift"** 라고 명시하고, 일괄 정정을 **별도 developer plan 으로 분리**해 아직 착수하지 않았다고 적는다. 즉 "optional+nullable 이 응답에서도 허용된다" 는 §5.4 의 규칙이 아니라 **아직 remediate 되지 않은 기존 DTO 를 당장 깨뜨리지 않기 위한 실용적 유예**다.
    이 gap 은 이번 diff 가 실제로 배선한 DTO 들에서 사소하지 않다 — `ExecutionDto` 22필드 중 10개(`triggerId` `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-20`, `finishedAt` `:42-43`, `durationMs` `:46-47` 등), `WorkflowDto.description`/`folderId`(`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:20-21,32-33`), `AuditLogDto.user`/`ipAddress`(`codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:25-26,52-53`)가 모두 이 "known drift" 형태다. 새 계약 검증기는 이 필드들에 대해 `null` 이 와도 위반으로 잡지 않으므로, 이번 PR 이 4개 DTO 를 "§5.4 대조 하에 들어왔다" 고 서술할 때(`plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 표) 독자는 이 DTO 들이 §5.4 를 완전히 준수한다고 오해하기 쉽다 — 실제로는 검증기가 **알려진 미교정 형태를 그 형태 그대로 통과시키도록 설계**된 것이라, "§5.4 준수" 와 "아직 교정되지 않은 형태를 조용히 수용" 이 코드 상 구분되지 않는다.
  - 제안: `response-contract.ts` 규칙 표 3번째 행의 출처 열을 "§5.4" 에서 "실용적 유예 — `spec-draft-nullable-notation-followups.md` 103곳 drift, 응답 3형태 정정 전까지" 등으로 정정한다. 여력이 있다면 `nullable` 이 선언된 optional 필드를 별도 `kind`(예: `'legacy-optional-nullable'`)로 표시해, 향후 103곳 remediation 이 끝난 뒤에는 이 예외 자체를 제거하고 엄격한 2형태 검증으로 좁힐 수 있게 캐너리를 남겨 둔다.

## 검증 결과 (문제 없음으로 확인)

- `audit-logs.service.ts` 의 `leftJoin` + `addSelect(['user.id','user.name','user.email'])` 는 `AuditLogUserDto`(id/name/email, 전부 required+non-nullable)와 정확히 일치하고, `user` 관계 자체가 `@ApiPropertyOptional({ nullable: true })` 로 선언돼 LEFT JOIN 이 매치를 못 찾는 경우(`user: null`)도 계약과 맞는다.
- `findContractViolations` 의 required/nullable/undeclared 판정(§5.4 앞 3행 + undeclared 확장)은 spec 원문과 line-level 로 일치하고, 중첩 `$ref`/`allOf`/배열 하강·순환 참조 방지도 견고하게 구현돼 있다 — 직전 라운드 CRITICAL(중첩 미검증으로 `AuditLogDto.user` 의 실 유출을 놓침)은 이번 diff 에서 서비스 측 select 축소 + 검증기 재귀 하강 양쪽으로 실제로 해소됐다(뮤테이션 검증: payload 유출 상태로 되돌리면 계약 단언이 23키를 경로와 함께 잡음, `RESOLUTION.md` 근거).
- `DtoContract.name` 이 `Dto.name` 에서 파생돼 호출부 문자열 이중 기입 문제(직전 라운드 WARNING)도 해소됐고, `'invalid-payload'` kind 분리로 payload-형태-오류와 필드-누락의 혼동(직전 라운드 WARNING)도 해소됐다.
- 엔드포인트·URL 설계, HTTP 상태 코드, 페이지네이션(`PaginatedResponseDto`), 인증/인가(`@Roles('admin')` 그대로 유지)는 이번 diff 로 변경되지 않았다.
- API 버전 관리 대상 변경 없음 — 응답 wire 형태 자체는 (교정 전 상태가 계약 위반이었을 뿐) 문서화된 형태로 복귀했을 뿐이므로 별도 버저닝이 필요하지 않다.

## 요약

핵심 변경은 실제 프로덕션 API 표면(엔드포인트·인증·페이지네이션·상태 코드)을 바꾸지 않고, (1) `audit-logs` 응답의 `user` 필드를 문서화된 3필드로 좁혀 계약 위반(과다 노출)을 교정했고 (2) §5.4 응답 계약을 실 HTTP 응답과 대조하는 신규 검증 인프라를 4개 엔드포인트에 배선했다. 직전 라운드가 지적한 CRITICAL(중첩 미검증)과 WARNING(이름 중복·kind 재사용·JSDoc-구현 불일치)은 모두 실제로 해소됐다. 다만 새 검증기의 §5.4 규칙 표가 "optional+nullable → null 허용" 예외의 출처를 §5.4 자체로 잘못 표기하고 있다 — 실제로 §5.4 는 그 조합을 응답 바디에 금지하고 요청 바디 전용으로 한정하며, 이 예외의 진짜 근거는 별도 plan 문서가 추적 중인 "103곳 미교정 drift" 다. 이 diff 가 배선한 4개 DTO 중 3개(`ExecutionDto`/`WorkflowDto`/`AuditLogDto`)가 정확히 이 미교정 형태의 필드를 갖고 있어, 검증기의 "§5.4 대조 통과" 라는 서술이 실제로는 알려진 미교정 상태를 조용히 수용한 결과일 수 있다는 점을 문서에 명시하는 편이 다음 사람의 오해를 줄인다. 프로덕션 계약에 대한 실질적 위험은 없다(테스트 인프라 스코프이고, 근본 drift 는 이미 별도 트랙으로 추적 중).

## 위험도

LOW

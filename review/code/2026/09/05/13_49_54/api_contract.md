# API 계약(API Contract) 리뷰

## 범위 요약

본 변경 셋은 **엔드포인트·요청/응답 스키마·인증/버전 자체를 바꾸지 않는다.** 핵심은 §5.4(응답의 `null` vs 키 생략 규약)를 실제 HTTP 응답과 DTO 의 생성된 OpenAPI 스키마를 대조해 검증하는 신규 테스트 헬퍼(`response-contract.ts`/`.spec.ts`)와, 이를 4개 e2e 스펙(`audit-logs`, `session-revocation`, `workflow-crud`, `workflow-execution`)에 배선한 것이다. 나머지 파일(7~16번)은 `plan/`·`review/consistency/` 산출물로 API 계약과 무관하다.

이 헬퍼 자체가 "API 응답 구조의 일관성·스키마 준수"(점검 관점 3번)를 검사하는 도구이므로, 그 판정 로직이 실제 §5.4 규칙과 자기 일관적인지를 집중적으로 대조했다.

## 발견사항

- **[WARNING]** `response-contract.ts` 의 판정 규칙 JSDoc 표와 실제 구현이 "키 생략형 + nullable" 조합에서 서로 다른 규칙을 말한다 — 신규 검증 도구 자신의 커버리지를 과대 주장하게 된다
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:36`(JSDoc 규칙 표) vs `codebase/backend/src/shared/testing/response-contract.ts:122`(구현의 `!nullable` 가드)
  - 상세: JSDoc 규칙 표(36행)는 "`required` 아님(키 생략형) → 키가 없어도 된다. **있으면 `null` 이 아니어야 한다** — §5.4 가 키 생략 필드에 `| null` 을 금지한다"고 **무조건** 서술한다. 그런데 실제 구현(122행)은 `if (present && value === null && !nullable)` 로 **스키마가 `nullable: true` 를 함께 선언하지 않은 경우에만** 위반으로 잡는다. 즉 어떤 응답 DTO 필드가 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` (optional 이면서 nullable) 로 선언돼 있으면, 그 필드가 실제로 `null` 을 실어도 이 도구는 통과시킨다.
    스펙 원문(`spec/5-system/2-api-convention.md` §5.4 도입부)은 이 "optional + nullable" tri-state 조합을 **요청 DTO(PATCH 부분 업데이트)에 한해 정당하다**고 명시하며, §5.4 의 "DTO 선언 형태" 규칙(표)은 응답 바디에 대해 정확히 **세 가지 형태**(required+non-nullable / required+nullable / 키 생략형 non-nullable)만 규정한다 — "optional + nullable" 은 응답 쪽 유효 형태 목록에 아예 없다. 그럼에도 `response-contract.spec.ts` 의 픽스처는 이 4번째 조합(`legacy` 필드, 32~34행)을 "응답에선 드물지만 표현은 가능하다"고 스스로 정당화하고, 116~118행 테스트가 그 통과를 고정(lock-in) 해 버린다 — 즉 §5.4 표가 규정하지 않은 조합을 도구가 조용히 관대하게 허용하는 것이 **의도된 설계**로 굳어 있다.
    이 gap 은 이번 PR 이 실제로 배선한 DTO 들에서 사소하지 않다 — `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 의 `ExecutionDto` 는 22개 필드 중 10개(`triggerId`, `finishedAt`, `durationMs`, `inputData`, `outputData`, `error`, `executedBy`, `parentExecutionId`, `reRunOf`, `chainId`)가 이 "optional+nullable" 형태이고, `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(`WorkflowDto.description`/`folderId`), `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts`(`AuditLogDto.user`/`ipAddress`) 도 같은 패턴이다(이 세 파일은 이번 diff 의 변경 대상이 아니라 참고용으로만 열람했다). `workflow-execution.e2e-spec.ts:147` 의 주석("이 DTO 의 22개 필드를 한 번에 문다")은 실제로는 required 12개만 엄격 검증되고 나머지 10개는 "present 인데 값이 null 이 아니어야 한다"는 핵심 축이 사실상 면제된다는 점에서 커버리지를 과대 서술한다.
  - 제안: 둘 중 하나로 JSDoc·구현·테스트 세 곳을 일치시킨다. (a) §5.4 응답 형태가 실제로 3가지뿐이라면, 구현에서 "optional + nullable" 스키마 선언 자체를 별도 위반 종류(예: `'response-tri-state'`)로 잡거나 최소한 JSDoc 표에 이 예외를 명시한다. (b) 이 조합을 응답에서도 의도적으로 허용하기로 한 것이라면, JSDoc 규칙 표의 36행 문구("있으면 null 이 아니어야 한다")를 "…단, 스키마가 nullable 도 함께 선언했다면 예외"로 정정하고, `workflow-execution.e2e-spec.ts` 등 호출부 주석의 "N개 필드를 한 번에 문다"는 과대 서술을 "required 필드는 엄격 검증, optional+nullable 필드는 존재 여부만 검증"처럼 정확히 좁힌다.

## 요약

이번 변경은 실제 API 표면(엔드포인트·요청/응답 스키마·인증·버전)을 하나도 바꾸지 않는 **테스트 인프라 추가**다 — §5.4(응답의 `null` vs 키 생략) 규약을 실 HTTP 응답과 DTO 의 생성된 OpenAPI 스키마 대조로 검증하는 일반 헬퍼(`response-contract.ts`)를 신설하고 4개 e2e 스펙에 한 줄씩 배선했다. 핵심 로직(required/nullable/undeclared 판정)은 §5.4 문서와 대체로 일치하고, 스키마가 비어 있을 때를 구분하는 전제 테스트(vacuous-check 방지)도 갖춰져 있어 설계 자체는 견고하다. 다만 "키 생략형 + nullable" 조합에서 JSDoc 규칙 표(무조건 null 금지)와 실제 구현(nullable 선언 시 면제)이 서로 다른 말을 하고, 이 조합이 이번 PR 이 배선한 실제 DTO(특히 `ExecutionDto` 22개 필드 중 10개)에 광범위하게 존재해 그 검사 도구가 스스로 주장하는 커버리지("N개 필드를 한 번에 문다")를 과대평가하게 만든다. 프로덕션 API 계약에는 영향이 없으므로 위험도는 낮으나, 이 도구가 앞으로 §5.4 준수의 사실상 SoT 역할을 하게 될 것이므로 문서·구현 불일치는 정정할 가치가 있다.

## 위험도

LOW

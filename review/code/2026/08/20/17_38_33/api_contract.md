STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# API 계약(API Contract) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** `Execution.inputData` 응답 콘텐츠 계약이 반전됐는데(원문 → 마스킹) OpenAPI 스키마상으로는 드러나지 않는다 — 저장소 밖 API 전용 소비자에게는 사전 고지 없는 breaking change
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1010` (`toResponseExecution` — `inputData: redactStoredDataForResponse(execution.inputData)`), `:1075` (rerun-chain 조립 — `inputData: redactStoredDataForResponse(rest.inputData)`), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52-60` (`ExecutionDto.inputData` JSDoc)
  - 상세: `GET /executions`, `GET /executions/:id` 가 반환하는 `inputData` 필드는 이전에는 원문이었는데 이번 변경으로 자격증명 패턴이 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 로 치환된 값이 나간다. DTO 의 `@ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })` 선언은 변경 전후로 동일해 OpenAPI 스펙 diff 로는 이 변경이 전혀 드러나지 않는다 — 타입은 그대로고 **값의 의미만 반전**됐다. 저장소 내부 소비자(Re-run 모달·에디터 히스토리 로드·폼 프리필)는 이번 PR 이 마커 가드로 보호하지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export, 서드파티 통합)는 이 반전을 스키마로 알아챌 방법이 없다 — 계속 `inputData` 를 원문으로 가정하고 소비하면 조용히 마스킹된 값(`***`)을 실제 데이터인 것처럼 처리하게 된다.
  - 참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:329` 에 "`Execution.inputData` 응답 의미 반전의 외부 소비자 확인" 으로 이미 등재돼 있고, 존재 여부 확인 후 릴리스 노트에 breaking 공지하는 것으로 처분이 defer 돼 있다. 이번 PR 범위 밖 판단 자체는 합리적이지만, 등재만 되어 있고 실제 공지·확인은 아직 수행되지 않은 상태라 이 시점 기준으로는 여전히 유효한 API 계약 리스크다.
  - 제안: 트래커 항목을 후속 스프린트에서 실제로 집행 — (1) API 로그/access log 로 이 엔드포인트를 직접 호출하는 저장소 밖 소비자 존재 여부를 확인하고, (2) 있다면 릴리스 노트/API changelog 에 "breaking: `inputData` 값-의미 변경" 으로 명시 공지한다.

- **[WARNING]** `inputOverride` 요청 바디에 마스킹 마커 리터럴을 서버가 거부하지 않는다 — 이번 PR 의 방어가 UI 계층에만 있다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:373-380` (`blockedByMaskedInput` — 클라이언트 전용 제출 차단), `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (이번 diff 에 포함되지 않음 — 타입·필수값만 검증, 마커 리터럴 검사 없음)
  - 상세: 이번 PR 이 도입한 3개 가드(폼 프리필 스킵, Re-run 모달 제출 차단, 에디터 히스토리 로드 Run 차단)는 전부 프런트엔드 컴포넌트 안에서만 동작한다. 실제 재실행을 트리거하는 백엔드 경로(`resolveTriggerParameters` → `inputOverride` 소비)는 이번 diff 에서 전혀 수정되지 않았고, 여전히 타입·필수값만 검증한다 — 마스킹 마커 문자열(`'***'` 등)이 그 필드의 선언 타입과 일치하는 유효한 문자열이면 통과한다. 즉 UI 를 우회하는 클라이언트(직접 API 호출, 서드파티 통합, curl)는 이번 PR 이 막으려던 바로 그 오염(마스킹된 리터럴이 새 실행의 실제 입력이 되는 것)을 API 레벨에서 그대로 재현할 수 있다. 요청 바디 유효성 검증이 "이 필드가 타입에 맞는가" 까지만 미치고 "이 값이 egress 마스킹이 남긴 산물인가" 까지는 미치지 않는 것이 이 계약의 실질적 구멍이다.
  - 참고: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` 에 "`inputOverride` 서버측 마커 리터럴 거부" 로 이미 등재돼 있다. security 리뷰어도 "기밀성 침해 아님 + 기존 defer 결정" 으로 INFO 판정했고, §R17 이 이 가드의 범위를 "UI 정상 흐름 방어" 로 명시했다는 점도 확인했다 — 그래서 이번 PR 을 막을 사안은 아니라는 판단에는 동의한다. 다만 API 계약 관점에서는 요청 검증의 신뢰 경계가 "브라우저의 특정 컴포넌트" 에 있고 "서버 엔드포인트" 에는 없다는 점 자체가 계속 유효한 결함이라 별도로 기록한다.
  - 제안: 트래커가 제안한 대로 defense-in-depth 로 `resolveTriggerParameters` (또는 그 호출 직전)에 얕은 서버측 체크를 추가 — 문자열 필드 값이 `MASKED_MARKERS` 집합과 정확히 일치하면 `coerce_failed` 류와 같은 계열의 `INVALID_INPUT` 으로 거부한다. object/array 필드의 leaf 검사는 `hasMaskedMarkerLeaf` 를 그대로 서버측에 재사용할 수 있다(단, 프런트 전용 패키지 의존 없이 값 자체만 넘기면 순수 함수라 이식 가능).

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 닫아 REST 응답 3개 표면(`toResponseExecution`, 목록 DTO 조립, rerun-chain 조립)에서 이 필드를 나머지 마스킹 대상 컬럼(`outputData`/`error`)과 동일한 규칙으로 편입시켰다. DTO Swagger 설명(`execution-response.dto.ts`, `background-run-response.dto.ts`)은 타입 변경 없이 문서만 정확히 갱신돼 있고, 응답 스키마 자체의 형태(nullable object)는 유지돼 하위 호환성이 구조적으로는 깨지지 않는다. 다만 API 계약 관점에서 실질적인 두 갭이 남아 있다 — (1) 값의 **의미**가 반전됐는데 스키마 diff 로는 드러나지 않아 저장소 밖 소비자에게 소리 없는 breaking change 가 될 수 있고, (2) 새로 추가된 마커 차단 가드가 전부 프런트엔드 컴포넌트 안에만 있어 REST 엔드포인트 자체의 요청 검증은 여전히 마커 리터럴을 걸러내지 않는다. 두 항목 모두 이 PR 이 새로 만든 결함이 아니며 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 등재·근거와 함께 defer 돼 있어 이번 PR 을 막을 사안은 아니지만, 아직 실제로 해소되지 않은 상태라 API 계약 리뷰 관점에서 계속 기록해 둔다. 그 외 요청 검증(타입 체크), 에러 응답, URL/경로, 페이지네이션, 인증/인가는 이번 diff 에서 변경되지 않았다.

## 위험도

MEDIUM

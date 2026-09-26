# 테스트(Testing) 리뷰 — assistant-e2e-contract-gaps

## 리뷰 범위

diff 30개 파일 중 실제 테스트/제품 코드는 `codebase/backend/test/workflow-assistant.e2e-spec.ts` 1개뿐이다. 나머지(파일 2~30)는 `plan/**`, `review/consistency/**`, `spec/**` 문서 산출물로 테스트 관점 리뷰 대상이 아니다(테스트 코드·실행 경로 변경 없음). 아래는 파일 1에 대한 분석이다.

## 발견사항

- **[INFO]** `sessions/latest` 의 "없음(data: null)" 분기에서 새로 만든 `emptyWorkflow` 를 정리하지 않는다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:208-216` (테스트 F)
  - 상세: 같은 테스트가 끝에서 `sessionId` 세션은 `DELETE` 로 정리하지만(`:221-223`), `POST /api/workflows` 로 새로 만든 `emptyWorkflow` 는 삭제하지 않는다. 다른 e2e 파일들(`workflow-crud.e2e-spec.ts`, `trigger-deletion-releases-resources.e2e-spec.ts` 등)은 자신이 만든 workflow 를 정리하는 관례가 있다. e2e DB 가 매 실행마다 초기화되므로 실질적 위험은 낮지만, 같은 workspace 를 재사용하는 스위트라 목록 계열 회귀 테스트가 늘어나면 잔여물이 노이즈가 될 수 있다.
  - 제안: 테스트 끝에서 `emptyWorkflow.body.data.id` 도 `DELETE /api/workflows/:id` 로 정리.

- **[INFO]** 테스트 F "있음" 분기의 "가장 최근 세션" 단언이 동시성 tie-break 을 검증하지 않는다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:193-205`(테스트) / `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:47-61`(`findLatestActive`)
  - 상세: `findLatestActive` 의 정렬은 `order: { lastInteractionAt: 'DESC' }` 하나뿐이고 2차 정렬 키(예: `id`, `createdAt`)가 없다. 테스트는 이 스위트에서 이미 A·B·D 가 만들어 놓은(그리고 지우지 않은) 같은 `workflowId` 세션들이 존재하는 상태에서, 방금 만든 세션이 `lastInteractionAt` 이 가장 크다는 **벽시계 순서**에만 기대어 "최근 세션 = 방금 만든 세션" 을 단언한다. 오늘은 각 요청 사이 실제 네트워크/DB 왕복 지연이 있어 사실상 안전하지만, `lastInteractionAt` 이 동률(tie)일 때 서비스 쪽 정렬이 비결정적이라는 사실 자체를 이 테스트도, 다른 어떤 테스트도 검증하지 않는다. 즉 "가장 최근" 을 고르는 로직의 tie-break 케이스는 여전히 커버리지 갭이다.
  - 제안: (선택) 두 개 이상의 세션을 만든 뒤 `UPDATE workflow_assistant_message ... lastInteractionAt` 또는 세션 테이블을 직접 갱신해 명시적으로 최신 시각을 부여하고, 그 세션이 반환되는지를 보는 케이스를 추가하면 이 회귀(2차 정렬 키 부재로 인한 비결정성)를 실측으로 문서화할 수 있다. 지금 이대로도 diff 자체는 문제없지만, 이 갭을 알고 있다는 코멘트 한 줄을 남겨두는 편이 다음 사람에게 유용하다.

## 긍정적으로 확인한 점 (참고)

- 테스트 F 의 `data: null` 분기는 `toStrictEqual({ data: null })` 로 응답 바디 전체를 정확히 단언해 제3상태(예: 빈 객체·추가 키)가 없는지 확실히 가른다.
- 테스트 H 에 추가된 두 번째 tool call(`call_2`, 선택 키 전부 생략)은 plan 문서(`plan/in-progress/assistant-e2e-contract-gaps.md` 체크리스트)에 기록된 대로 `planStepId` 를 `@ApiProperty()`(필수)로 바꾸는 뮤테이션에 대해 실제로 `missing messages[0].toolCalls[1].planStepId` 위반을 내는 것을 프로브로 확인했다고 되어 있다 — 공허성 검증까지 거친 드문 사례로, 종전 fixture(전부 채운 tool call 하나)로는 이 회귀를 못 잡았다는 것도 함께 기록되어 있다.
- `messages[1].toolCalls`/`plan`/`usage` 를 `toStrictEqual` 로 먼저 값 그대로 단언한 뒤 `assertMatchesContract` 로 DTO 스키마까지 대조하는 이중 구조(구조적 동등성 + 선언 대조)라, `response-contract.ts` 의 "required 아님인데 키가 있고 값이 null" 같은 케이스까지 별도 계층에서 잡힌다.
- LLM 호출을 피하기 위해 메시지를 DB 에 직접 INSERT 하는 전략과 그 이유가 파일 헤더 주석에 명시돼 있어 mock 대신 실제 DB 상태를 쓰는 선택이 적절하고 근거가 분명하다.
- `newSession.status`/`emptyWorkflow.status` 를 `toBe(201)` 로 먼저 확인한 뒤 `.data.id` 를 읽어, 이전 버전에 있었을 수 있는 "실패 응답에서 undefined 를 읽고도 조용히 통과" 유형의 취약성을 막는다.

## 요약

변경은 새 코드 경로를 추가하는 것이 아니라 기존 3개 계약 대조 공백(F 의 상태 코드 범위·데이터 없음 분기, H 의 선택 키 생략 tool call)을 닫는 순수 테스트 보강이며, 스스로 뮤테이션 프로브로 새 fixture 의 비공허성을 검증해 두는 등 이 리포지토리의 테스트 문화 기준에 부합한다. 발견된 항목은 모두 INFO 수준으로, F 테스트의 신규 workflow 정리 누락과, `findLatestActive` 의 2차 정렬 키 부재로 인한 tie-break 비결정성이 이 테스트로도 여전히 커버되지 않는다는 점(사전부터 존재하던 서비스 계층의 구조적 갭이며 이번 diff 가 만든 것은 아님)뿐이다. 회귀 위험이나 격리 붕괴, mock 남용 등 차단 사유는 없다.

## 위험도

LOW

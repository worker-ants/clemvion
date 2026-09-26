# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 신규 생성된 `AssistantSessionDetailDto` 하위 5개 DTO(`AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto`)가 e2e 계약 검증(`assertMatchesContract`)에서 배열이 항상 비어 있어 실제로 한 번도 대조되지 않는 WARNING(testing)이 가장 무거운 발견이며, 이 PR 의 핵심 방어선(엔티티 패스스루 응답의 선언-실제 불일치 검출)이 정작 가장 복잡한 DTO 에는 적용되지 않는 사각지대다. `http-status-advertised-guard.ts` 의 `judgeHandler` 복잡도 증가(WARNING, architecture+maintainability 중복 지적)도 함께 있으나 대조군 fixture 가 이미 분기를 촘촘히 덮고 있어 당장 회귀 위험은 낮다. forced 6개 reviewer(maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `AssistantSessionDetailDto.messages` 하위 `AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto` 5개 DTO가 e2e 계약 검증에서 배열이 항상 비어 있어 실제로 한 번도 대조되지 않음 — `assertMatchesContract`는 배열 원소마다 내려가 대조하므로 빈 배열이면 스키마 검사가 아예 스킵됨. 이 PR 핵심 방어선(엔티티 패스스루 응답의 선언-실제 불일치 검출)이 가장 복잡한 DTO 에는 사각지대로 남음 | `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts:196` (`AssistantMessageDto`), `codebase/backend/test/workflow-assistant.e2e-spec.ts:89-97` | 메시지가 최소 1건 있는 상태(DB 직접 insert 또는 mock LLM 1턴 완료)로 `GET /sessions/:id` 호출 후 `assertMatchesContract(detail.body.data, await contractForDto(AssistantSessionDetailDto))` 검증 케이스 추가 |
| 2 | 아키텍처 / 유지보수성 | `judgeHandler` 가 이번 PR로 네 번째 판정 축(`unadvertised`, `redirectAdvertised`)을 얹으면서 지역변수 6개+반환필드 4개, 78줄, 6갈래 이상 분기를 가진 함수가 됨 — SRP 압박·순환 복잡도 누적 | `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:214-291` (`judgeHandler`) | 데코레이터 순회를 분류 전용 순수 함수(`classifyDecorators`/`classifyAdvertisement`)로 분리하고 `judgeHandler`는 그 결과로 `violation`/`unadvertised`/`checked`만 조립하도록 좁히기. 급하지 않음 — 대조군 fixture가 현재 분기를 충분히 덮음 |
| 3 | 유지보수성 | 상태 코드 → 성공/리다이렉트 분류 로직이 `ApiResponse` 분기와 `statuses.has(callee)` 분기에서 그대로 반복(리다이렉트 판정 추가로 중복 폭이 1갈래→2갈래로 커짐) | `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:248-258` | 지역 헬퍼(`classify(status)`)로 추출해 두 분기에서 재사용 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 평문 1회성 secret 발급 엔드포인트(notification rotate-secret, interaction revoke-token) 응답 스키마가 OpenAPI 문서에 처음 공식 노출됨 — 로직 변경 없음, production Swagger 는 기존에 이미 fail-closed 비활성화되어 실질 위험 증가 미미 | `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts:9-24`, `codebase/backend/src/modules/triggers/triggers.controller.ts:215,246` | 조치 불필요(기존 위험 수용 범위 동일) |
| 2 | 보안 | `AssistantToolCallDto.arguments`/`result` 가 `additionalProperties: true` 로 완전히 열린 스키마(도구별 인자·결과 모양이 제각각이라 의도적 설계) | `assistant-session-response.dto.ts:105,115` | 조치 불필요. 프런트에서 해당 값을 HTML 렌더링하는 경로가 있다면 별도 이스케이프 확인 권장(본 리뷰 범위 밖) |
| 3 | 아키텍처 | 신규 e2e 스펙(`advertised-response-contract.e2e-spec.ts`)이 도메인이 아닌 PR-스코프 기준으로 조직돼 기존 "도메인별 e2e 파일" 관례와 어긋남 | `codebase/backend/test/advertised-response-contract.e2e-spec.ts` | 당장 급하지 않다면 각 도메인 e2e 파일로 이관 후 이 파일 폐기 고려 |
| 4 | 아키텍처 | 응답 DTO 파일이 서로 다른 두 하위 액션(secret 회전/token 재발급)의 DTO를 한 파일에 묶음 — 기존 저장소 관례(`webauthn-response.dto.ts`)와는 일관되나 파일명(단수)과 내용(복수)이 살짝 어긋남 | `trigger-secret-issue-response.dto.ts` | 세 번째 secret 발급 DTO 추가 시 `trigger-secrets/` 하위 분리 고려 |
| 5 | 요구사항 | `AssistantToolCallDto.result?: unknown` 을 `type: 'object'` 로 문서화 — 현재 실제 대입값은 모두 object 라 실측과 일치하지만 타입 자체는 object 아닌 값도 허용 | `assistant-session-response.dto.ts:112` | 향후 도구 결과가 스칼라/배열이 되면 스키마 갱신 필요, 즉시 수정 불요 |
| 6 | 스코프 | `AssistantSessionDetailDto` 를 위해 신규 파일에 7개 클래스(~265줄) 신설 — "라우트 1개 광고" 명목 대비 상세도 높음(세션 상세가 중첩 구조를 그대로 반환하는 데서 오는 불가피한 면 있음, 죽은 코드 아니고 e2e 로 전부 소비됨) | `assistant-session-response.dto.ts` | plan 에 "세션 상세 응답 전체 계약화"가 필요조건이었음을 사후 기록 권장 |
| 7 | 스코프 | 가드 파일 JSDoc 문구 재작성("50개 가까이 내보내고 그중 2xx 만 일곱") — 이번 리다이렉트 판정 로직과 함께 움직인 정정으로 판단(실측 재현 결과 정확함: 49개 중 2xx 7개) | `http-status-advertised-guard.ts` (`swaggerResponseStatuses` 위 JSDoc) | 없음(참고용) |
| 8 | 부작용 | 신규 e2e `afterAll` 이 raw SQL 로 `trigger` row 만 정리하고 workspace/workflow/user 는 정리하지 않음 — 저장소 e2e 전반의 기존 관례 그대로(신규 위험 아님) | `codebase/backend/test/advertised-response-contract.e2e-spec.ts:51-58` | 신규 리스크는 아니므로 차단 사유 아님. 관례를 넘어서는 정리가 필요하면 별도 후속 작업으로 트래킹 |
| 9 | 부작용 | 내부 테스트 전용 `HttpStatusScan` 인터페이스와 `judgeHandler` 반환 타입에 `unadvertised` 필드 추가 — 외부 소비자 없음(`grep` 으로 확인, 같은 파일과 spec 뿐) | `http-status-advertised-guard.ts` (`HttpStatusScan`, `judgeHandler` 반환 타입) | 정보성 기록. 향후 이 유틸을 다른 스크립트가 import 하게 되면 확장 사실 인지 필요 |
| 10 | 유지보수성 | 같은 PR 안에서 추가된 두 SSE `@ApiOkResponse` description 언어가 다름(신규는 한국어, 기존은 영어) | `interaction-stream.controller.ts:64-66` vs `workflow-assistant.controller.ts:189-191`(기존, 미변경) | 다음에 이 영역을 만질 때 한쪽 언어로 통일(리포 전반 관례상 한국어 권장) |
| 11 | 테스트 | `AssistantSessionDto` 의 `title`/`llmConfigId` 등 `required`+`nullable` 필드가 실제 `null` 값으로 온 경우를 대조하는 e2e 케이스 없음(항상 값이 채워진 상태로만 검사) | `assistant-session-response.dto.ts:57-67`, `workflow-assistant.e2e-spec.ts:63-97,99-116,185-205` | 제목 없이 생성한 세션(테스트 C/D/E)에도 `assertMatchesContract` 한 줄 추가하면 저비용으로 `null` 경로 커버 가능 |
| 12 | 테스트 | 신규 `wrapNullableDataSchema` 단위 테스트는 스키마 생성 함수만 검증, `ApiOkWrappedNullableResponse`(데코레이터 조합 함수) 자체는 직접 단위 테스트되지 않음(기존 형제 함수들과 같은 패턴, `sessions/latest` e2e 로 간접 커버) | `api-wrapped.spec.ts:36-45`, `api-wrapped.ts:162-170` | 우선순위 낮음, 기존 컨벤션과 일관되므로 필수 아님 |
| 13 | 문서화 | `scanHttpStatusAdvertised`/`judgeHandler` 함수 최상위 JSDoc 이 이번에 추가된 `unadvertised`(무광고 탐지) 책임을 언급하지 않음(필드 자체 JSDoc·spec·CHANGELOG·테스트 설명은 이미 정확) | `http-status-advertised-guard.ts` (293-303행 `scanHttpStatusAdvertised`, 210-213행 `judgeHandler`) | 두 함수 JSDoc 에 "성공 광고가 하나도 없는 라우트도 `unadvertised` 로 함께 보고한다" 한 문장 추가 |
| 14 | API 계약 | `triggers.controller.ts` 신규 두 핸들러(`rotateNotificationSecret`, `revokePerTriggerToken`)가 같은 파일의 확립된 관례(반환 타입을 DTO 로 선언해 `tsc` 가 drift 를 잡게 함, 바로 아래 `rotateBotToken` 주석이 이 이유를 명시)를 따르지 않고 인라인 리터럴 타입을 유지 — drift 는 e2e 가 결국 잡지만 컴파일 시점이 아니라 e2e 실행 시점 | `triggers.controller.ts:229`(`rotateNotificationSecret`), `:260`(`revokePerTriggerToken`) | 반환 타입을 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁히기. 급하지 않음 — e2e 가 이미 안전망 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가/입력검증/서비스 로직 미변경 확인. 평문 secret 최초 OpenAPI 노출은 INFO(기존 위험 수용 범위 동일) |
| architecture | LOW | `judgeHandler` SRP 압박(WARNING), 신규 e2e 파일 조직 방식·DTO 파일 구성은 INFO |
| requirement | NONE | spec(`swagger.md` §2-4, §5-2)과 line-level 완전 일치, 엔티티/서비스 반환 타입 1:1 대조 확인. `result: unknown` 문서화는 INFO |
| scope | LOW | 커밋 메시지 목표와 diff 15개 파일 전부 정확히 대응, 무관한 리팩토링 없음. DTO 파일 크기·주석 재작성은 INFO |
| side_effect | LOW | 신규 순수 함수 추가 + 데코레이터 부착뿐, 전역상태/네트워크/이벤트 미변경. e2e 정리 관례·내부 인터페이스 필드 추가는 INFO |
| maintainability | LOW | `judgeHandler` 복잡도 증가·분류 로직 중복(WARNING 2건), SSE 언어 불일치는 INFO |
| testing | MEDIUM | `http-status-advertised` 가드·기존 스펙은 견고하나, 신규 메시지 레벨 DTO 5종이 e2e 계약 검증 사각지대(WARNING) |
| documentation | LOW | JSDoc/주석/spec·CHANGELOG 인용 실측 대조 전부 정확. `unadvertised` 책임 미기술은 INFO |
| api_contract | LOW | 하위호환성·응답형식·에러응답·인증 모두 미변경 확인, nullable wrapper 설계 타당성 검증. DTO 반환타입 미적용 2곳은 INFO |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 INFO 이상 발견사항을 보고했다(단, security·requirement 는 위험도 NONE으로 실질 우려는 없음).

## 권장 조치사항

1. (WARNING, 최우선) `workflow-assistant.e2e-spec.ts` 에 메시지가 최소 1건 있는 세션 상세 조회 케이스를 추가해 `AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto` 5개 DTO 를 `assertMatchesContract` 로 실제 검증한다.
2. (WARNING) `http-status-advertised-guard.ts` 의 `judgeHandler` 를 분류 전용 순수 함수로 분리하고, 상태코드→성공/리다이렉트 분류 로직 중복을 헬퍼로 통합한다. 대조군 fixture 가 현재 분기를 충분히 덮고 있어 급하지 않다.
3. (INFO, 선택) `triggers.controller.ts` 신규 두 핸들러 반환 타입을 `NotificationRotateSecretDto`/`InteractionRevokeTokenDto` 로 좁혀 컴파일 시점 drift 탐지를 확보한다.
4. (INFO, 선택) `AssistantSessionDto.title: null` e2e 케이스 추가, SSE description 언어 통일(한국어), 가드 JSDoc 에 `unadvertised` 책임 한 문장 추가 등 저비용 문서/커버리지 개선을 후속 커밋에서 처리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` — forced 6명 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 순수 OpenAPI 데코레이터/DTO 추가로 런타임 성능 영향 없다고 분류 (개별 사유 텍스트는 prompt 에 미제공) |
  | dependency | router 판단 — 신규 외부 의존성 추가 없음으로 분류 |
  | database | router 판단 — 스키마/쿼리 변경 없음으로 분류 |
  | concurrency | router 판단 — 동시성 관련 로직 변경 없음으로 분류 |
  | user_guide_sync | router 판단 — 사용자 대면 가이드 변경 대상 아님으로 분류 |

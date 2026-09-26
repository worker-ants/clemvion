# 성능(Performance) Review — success-advert (11개 엔드포인트 성공 응답 스키마 광고 + 가드 강화)

## 발견사항

- **[INFO]** repo-guard `judgeHandler`/`classifyDecorators` 확장으로 데코레이터 순회당 분기 수가 늘었으나 점근 복잡도는 그대로
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 함수 `classifyDecorators`(약 224행), `judgeHandler`(약 279행), `scanHttpStatusAdvertised`(약 347행)
  - 상세: 이번 PR 이 `redirectAdvertised`·`unadvertised` 판정 축을 기존 데코레이터 순회 루프에 추가했다. 여전히 "컨트롤러 파일 수 × 메서드 수 × 데코레이터 수" 에 선형이고, `ts.createSourceFile` 로 파일당 1회만 파싱하며(파일 재파싱 없음), `files`/`statuses`(swagger 데코레이터 표 + 래퍼 표)는 `http-status-advertised.spec.ts` 의 `describe` 블록 최상위에서 한 번만 계산되어 `it` 블록마다 반복되지 않는다. `wrapperResponseStatuses` 가 `api-wrapped.ts` 를 AST 로 파싱하는 것도 스캔 1회당 1번이다. 이 가드는 CI/테스트 시점에만 실행되는 정적 분석 도구이므로 런타임 요청 경로에 영향이 없고, 컨트롤러 파일 수(현재 223개 핸들러 규모)에서도 문제될 크기가 아니다. 순수 관찰이며 조치 불요.

- **[INFO]** 신규 `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse`, 11개 엔드포인트에 추가된 `@ApiOkWrappedResponse` 계열 데코레이터는 모두 Nest 부트스트랩 시 Swagger 문서 생성 시점(앱 기동 1회)에만 평가되는 메타데이터이고, 요청 처리 경로(런타임 hot path)에는 전혀 개입하지 않는다
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts` (`wrapNullableDataSchema`, `ApiOkWrappedNullableResponse`), 각 컨트롤러의 신규 `@ApiOkWrappedResponse`/`@ApiOkWrappedArrayResponse`/`@ApiOkWrappedNullableResponse`/`@ApiCreatedWrappedResponse`/`@ApiNoContentResponse`/`@ApiOkResponse` 데코레이터 부착 지점 전체
  - 상세: 실제 컨트롤러 핸들러 바디(`webauthnAvailability()`, `WorkflowAssistantController.list/latest/findOne/create/update/remove`, `TriggersController.rotateNotificationSecret/revokePerTriggerToken`, `InteractionStreamController.stream`)는 반환 값·쿼리·상태 코드 어느 것도 바꾸지 않았다. 순수 문서화 diff라 프로덕션 성능에 미치는 영향은 0에 수렴한다. 참고용 확인이며 조치 불요.

- **[INFO]** 신규 e2e(`advertised-response-contract.e2e-spec.ts`, `workflow-assistant.e2e-spec.ts` H, `chat-channel-trigger-create.e2e-spec.ts`)가 `contractForDto(Dto)` 를 호출하는 지점이 늘었지만, 세션 목록 루프에서는 계약 객체를 루프 밖에서 한 번만 구해 재사용한다 — N+1 형태 아님
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` 세션 A 테스트 — `const sessionContract = await contractForDto(AssistantSessionDto); for (const item of items) assertMatchesContract(item, sessionContract);`
  - 상세: `contractForDto` 는 `src/shared/testing/response-contract.ts` 의 `contractCache`(DTO 클래스 → Promise 메모)로 이미 메모이즈되어 있어(이 diff 가 건드리지 않은 기존 구현), 같은 DTO 를 여러 e2e 파일·여러 테스트에서 반복 호출해도 `buildSwaggerDocument` 는 프로세스당 사실상 1회만 수행된다. 루프 안에서 매 반복 `await contractForDto(...)` 를 새로 부르지 않고 밖으로 뺀 것도 좋은 패턴이다. 조치 불요, 확인 차 기록.

## 점검 관점별 확인

1. **알고리즘 복잡도** — repo-guard 확장은 기존 선형 스캔에 상수 배 분기만 추가. 문제 없음.
2. **N+1 쿼리/호출** — 신규 e2e 는 각 테스트당 고정된 수의 HTTP 호출(세션 생성 → 목록 → 상세 등)만 하고, DTO 계약 객체 조회는 캐시된다. 컨트롤러 쪽 서비스 로직(쿼리)은 이 diff 로 변경되지 않았다(순수 데코레이터 추가).
3. **메모리 할당** — 신규 DTO 클래스들은 요청마다 인스턴스화되지 않는다(Swagger 스키마 생성용 메타데이터 홀더). e2e 테스트의 `toolCalls`/`plan`/`usage` 픽스처 객체는 테스트 스코프의 소규모 리터럴이라 무시할 수준.
4. **캐싱** — `contractForDto` 의 기존 캐시가 이 diff 의 추가 호출 지점에도 그대로 적용된다. 신규 캐싱 필요 없음.
5. **블로킹 I/O** — 변경 없음. `wrapperResponseStatuses`/`scanHttpStatusAdvertised` 의 `fs.readFileSync` 는 기존 패턴 그대로이고 테스트/가드 실행 시점 1회성 동기 파일 읽기(파일 수 수백 개 규모)라 문제 되지 않는다.
6. **불필요한 연산 / 문자열 연결** — 신규 코드에 O(n²) 누적이나 반복적 문자열 접합 패턴 없음.
7. **데이터 구조** — `Set`/`Map` 사용(예: `advertised: Set<number>`, `contractCache: Map`)이 용도에 맞다.
8. **지연 로딩** — 해당 없음(문서화 데코레이터는 애초에 즉시 평가할 필요가 있는 메타데이터).

## 요약

이번 변경은 OpenAPI 성공 응답 스키마 광고(데코레이터·DTO 추가)와 그것을 강제하는 repo-guard 확장, 그리고 계약을 실측하는 e2e 테스트 추가로 구성된 순수 문서화·검증 강화 PR이다. 컨트롤러의 실제 런타임 로직(쿼리, 응답 생성, 상태 코드)은 전혀 바뀌지 않아 프로덕션 요청 경로에 미치는 성능 영향은 없다. repo-guard 의 AST 스캔 확장은 여전히 선형이고 파일/상태표 계산이 테스트 스위트당 1회로 유지되며, e2e 의 DTO 계약 조회도 기존 캐시 메커니즘을 그대로 활용해 N+1 형태가 아니다. 성능 관점에서 지적할 실질적 문제는 없다.

## 위험도

NONE

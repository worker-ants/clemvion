# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `judgeHandler` 가 이번 PR 로 책임이 하나 더 늘었다 — "위반 판정" 과 "성공 광고 전무(unadvertised) 판정" 을 한 함수가 함께 계산
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:214`–`291` (함수 `judgeHandler`)
  - 상세: 기존에도 `verb`/`httpCode`/`excluded`/`advertised`/`unresolved` 를 한 루프에서 채우던 함수였는데, 이번 PR 이 `redirectAdvertised` 플래그와 `unadvertised` 계산까지 얹으면서 지역 변수 6개(`verb`, `httpCode`, `excluded`, `advertised`, `redirectAdvertised`, `unresolved`) + 반환 필드 4개(`violation`, `unresolved`, `checked`, `unadvertised`) 를 갖는 78줄짜리 함수가 됐다. 데코레이터 순회 루프 안의 `if/else-if` 체인(라인 240–262)이 이미 6갈래이고, 그중 두 갈래(`ApiResponse`, `statuses.has(callee)`)는 각각 내부에 2단 분기를 더 갖는다. 순환 복잡도가 이번 변경으로 한 단계 더 올라갔다.
  - 제안: "성공 코드가 실제와 맞는지" 판정과 "성공 광고가 아예 없는지" 판정을 별도 헬퍼(예: `classifyAdvertisement()` → `{ advertised, redirectAdvertised, unresolved }` 를 반환)로 분리하고, `judgeHandler` 는 그 결과를 받아 violation/unadvertised 를 조립만 하도록 좁히면 각 조각의 테스트·재사용이 쉬워진다. 급하지 않다면 지금 구조로도 spec 의 대조군 테스트가 분기를 충분히 덮고 있어 즉시 리팩터를 요구할 정도는 아니다.

- **[WARNING]** 상태 코드 → (성공/리다이렉트) 분류 로직이 두 분기에서 그대로 반복
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts:248`–`258`
  - 상세: `else if (callee === 'ApiResponse')` 블록과 `else if (statuses.has(callee))` 블록이 각각 "성공이면 `advertised.add`, 리다이렉트면 `redirectAdvertised = true`" 를 독립적으로 반복한다(코드가 `number | null` 인지 `number` 인지 타입만 다르고 로직은 동일). 이번 PR 이 리다이렉트 분기를 추가하면서 기존 1갈래 반복(성공만 체크)이 2갈래 반복(성공+리다이렉트)으로 늘어나 중복 폭이 커졌다.
  - 제안: `const classify = (status: number | null) => { if (status === null) return; if (isSuccess(status)) advertised.add(status); else if (isRedirect(status)) redirectAdvertised = true; };` 같은 지역 헬퍼로 뽑아 두 분기에서 재사용하면 셋째 호출 데코레이터 종류가 추가될 때도 분류 규칙이 한 곳에만 있다.

- **[INFO]** 같은 PR 안에서 추가된 두 SSE 엔드포인트의 `@ApiOkResponse` description 언어가 다르다(신규 vs 기존)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-stream.controller.ts:64`–`66` (신규, 한국어) vs `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:189`–`191` (기존, 영어 — 이번 diff 로 손대지 않음)
  - 상세: 이번 PR 은 `interaction-stream.controller.ts` 에 `'SSE 스트림 — EventSource 류 클라이언트로 읽는다'` 라는 한국어 설명을 새로 붙였다. 같은 성격(SSE `@ApiOkResponse` placeholder)의 기존 문서인 `workflow-assistant.controller.ts` 는 `'SSE stream. Parse with an EventSource-style client.'` 로 영어다. 이 PR 이 만든 것은 아니지만, 같은 개념의 문서 쌍이 한 커밋 셋 안에서 언어가 갈리는 모양이 새로 두드러졌다.
  - 제안: 필수는 아니지만 다음에 이 영역을 만질 때 한쪽 언어로 통일하면(리포 전반이 한국어 설명 위주이므로 한국어 권장) Swagger 콘솔에서 일관된 인상을 준다.

- **[INFO]** `ApiOkWrappedNullableResponse` 는 기존 5개 `Api*WrappedResponse` 계열과 동일한 3줄 보일러플레이트(`applyDecorators(ApiExtraModels, ApiXResponse({...options, schema: wrapXSchema(dto)}))`)를 그대로 반복
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts:162`–`170` (신규) — 형제 함수들: `146`–`157`(`ApiOkWrappedResponse`), `172`–`190`(`ApiOkWrappedOneOfResponse`), `195`–`244`(나머지)
  - 상세: 이는 이번 PR 이 새로 만든 중복이 아니라 기존 파일이 이미 채택한 패턴을 그대로 따른 것이다(파일 전체가 "래퍼 함수 하나 = 스키마 빌더 하나 호출" 을 명시적으로 반복). 일관성 관점에서는 오히려 옳은 선택이다.
  - 제안: 조치 불필요 — 기존 컨벤션 준수이므로 참고만.

## 요약

이번 변경은 11개 엔드포인트에 성공 응답 스키마를 광고로 추가하고, 이를 강제하는 `http-status-advertised` 가드에 "성공 광고 전무" 판정 축을 신설한 작업이다. 새로 추가된 DTO·컨트롤러 데코레이터 코드는 기존 리포 컨벤션(JSDoc→OpenAPI description, `//`→내부 서사, `as const satisfies` 이넘 패턴, `Api*WrappedResponse` 보일러플레이트)을 정확히 따르고 있고 네이밍·문서화 수준이 높아 가독성 문제는 거의 없다. 유일하게 누적되는 우려는 가드 핵심 로직인 `judgeHandler` 가 이번 변경으로 책임(위반 판정 + 무광고 판정)과 분기 수가 함께 늘어 순환 복잡도가 한 단계 더 올라간 점과, 성공/리다이렉트 상태 분류 로직이 두 곳에서 반복된 점이다. 둘 다 지금 당장 회귀 위험을 만드는 수준은 아니며(대조군 fixture·spec 이 분기를 촘촘히 덮음), 다음에 이 가드를 확장할 때(예: 4xx/5xx 축 추가) 전에 헬퍼 분리를 권한다.

## 위험도

LOW

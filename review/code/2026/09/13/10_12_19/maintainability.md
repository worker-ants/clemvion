# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 함수 시그니처(파라미터 목록과 반환 타입 사이) 안에 6줄짜리 근거 주석을 끼워 넣어 시그니처를 한눈에 읽기 어렵게 한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:312-321` (`LlmService.testConnection`)
  - 상세: `configId`, `workspaceId` 파라미터 다음, 닫는 괄호 `)`와 반환 타입 `Promise<{...}>` 사이에 "왜 `message` 로 바꿨는가"를 설명하는 6줄 주석이 들어가 있다. 함수 위에는 이미 완전한 JSDoc 블록(`@returns` 포함, 299~311행)이 있어 이 근거를 자연스럽게 담을 자리가 있었다. 같은 PR 의 다른 파일(`model-config-response.dto.ts`, `integration-response.dto.ts`)에서는 같은 종류의 "왜 이 필드를 뺐나" 근거를 선언 앞의 통상적인 leading comment 자리에 놓았는데, 이 파일만 시그니처 중간을 끊는 자리를 택해 같은 PR 안에서도 배치 관례가 갈린다(8. 일관성).
  - 제안: 이 근거 문단을 함수 상단 JSDoc 블록으로 옮기고, `@returns` 태그를 실패 shape(`{ success: false, message }`)까지 포함하도록 함께 갱신한다.

- **[WARNING]** `collectBackendTokens` 의 파라미터 이름이 실제로 담기는 값과 반대로 되어 있다 — "파일"이 아니라 "파일 내용 문자열"이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:147`(시그니처) · `:150`(루프)
  - 상세: `export function collectBackendTokens(files: readonly string[]): Set<string>` 로 선언돼 있지만, 실제로 각 원소는 `fs.readFileSync(...)` 로 이미 읽어들인 **파일 내용 문자열**이다. 함수 본문도 `for (const text of files)` 로 그 사실을 스스로 드러내고, 호출부(`guide-error-code-existence.test.ts`)도 `sourceTexts`(파일 경로가 아니라 내용 배열)를 넘긴다. 파라미터 이름 `files` 는 다음 유지보수자가 "파일 경로 배열이니 내부에서 다시 읽어야 하나?" 또는 "File 객체인가?" 로 오해하게 만든다.
  - 제안: 파라미터명을 `fileTexts` 또는 `sourceTexts` 로 바꿔 호출부·본문의 실제 의미(파일 내용)와 맞춘다.

- **[INFO]** 인접한 두 테스트가 동일한 mock 설정(`mockClient.testConnection.mockRejectedValue(new Error('Connection refused'))`)을 그대로 반복한다
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts:459-476` (`실패 응답이 선언 DTO 와 일치한다 (값 vs 선언)`) — 바로 앞의 `should return failure with sanitized error on connection refused` 테스트와 setup 이 동일하다
  - 상세: 새 테스트는 "값이 선언과 일치하는가"(`assertMatchesContract`)를, 앞 테스트는 "값 자체가 기대한 문자열인가"를 검증해 **의도적으로 관심사를 분리**한 것으로 보이며(테스트 파일 서두 주석의 "vacuous 방지" 논리와 일치), 무분별한 중복은 아니다. 다만 동일한 mock 설정 블록이 두 번 나타나므로, 이후 실패 시나리오가 늘어나면 두 테스트 모두 손대야 하는 지점이 생긴다.
  - 제안: 현재로선 문제 삼을 정도는 아니나, 유사 패턴이 더 생기면 `describe.each` 또는 공용 `rejectWith(error)` 헬퍼로 setup 을 추출하는 것을 고려한다.

- **[INFO]** `testConnection` 의 JSDoc `@returns` 태그가 이번 수정 이후에도 실패 케이스(`success:false, message`)를 문서화하지 않는다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:299-311` (diff 에 포함되지 않은 기존 JSDoc — `Read` 로 직접 확인한 실제 파일 줄 번호)
  - 상세: `@returns` 는 `` `{ success, dimension? }` — dimension 은 kind=embedding 이고 probe 성공 시만 포함. `` 만 적고 있어 실패 shape 를 전혀 언급하지 않는다. 이번 PR 이 바로 그 실패 shape(`error`→`message`)를 고치는 작업인데도 이 문서화 갭은 그대로 남았다. CHANGELOG·plan 에는 자세히 기록됐지만, 정작 코드를 처음 읽는 사람이 보는 1차 자리(함수 JSDoc)에는 반영되지 않았다.
  - 제안: 위 WARNING 항목과 함께 처리하며 `@returns` 를 성공/실패 두 shape 모두 포함하도록 갱신한다.

- **[INFO]** `CODE_CONTEXT` 정규식이 한 줄에 12개의 다국어 어휘 alternation 을 담고 있어 향후 어휘 추가 시 실수하기 쉽다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:78-79`
  - 상세: `/error\.code|error code|에러 코드|\bfail(?:s|ed|ure)?\b|실패|\berror\b|오류|timed out|시간 초과|rate limit|요청 한도|returns \d{3}/i` 처럼 실패를 뜻하는 한/영 어휘가 한 줄 정규식으로 밀집돼 있다. 바로 위 JSDoc 이 이 술어의 한계("실패 어휘가 한 단어도 없는 줄은 안 걸린다")를 잘 설명하고 있어 당장 오독 위험은 낮지만, 정규식 자체는 항목을 추가·삭제할 때 이스케이프·순서 실수가 나기 쉬운 형태다.
  - 제안: 급하지 않음. 어휘 목록이 더 늘어나면 `["error.code", "error code", "에러 코드", ...].join("|")` 형태의 명명된 배열로 바꿔 항목 단위로 편집 가능하게 하는 것을 고려한다.

## 요약

전반적으로 이번 변경은 버그(연결 테스트 실패 사유 유실)를 고치는 코드·테스트·가이드·가드가 각자 근거를 촘촘히 남긴 잘 정돈된 PR이다. 새로 추가된 가드(`guide-error-code-scan.ts`/`guide-error-code-existence.test.ts`)는 함수가 짧고 책임이 분명하며, 축(axis)별 대조군 테스트로 회귀를 구조적으로 막고 있어 순환 복잡도·중첩 깊이 문제는 없다. 다만 `llm.service.ts`의 근거 주석이 함수 시그니처 한복판에 끼어들어 같은 PR 안의 다른 파일과 배치 관례가 어긋나는 점, `collectBackendTokens`의 파라미터명이 실제 값(파일 내용)과 반대로 명명된 점은 다음 유지보수자를 헷갈리게 할 소지가 있어 정정을 권한다. 나머지는 의도된 트레이드오프이거나 급하지 않은 개선 여지다.

## 위험도

LOW

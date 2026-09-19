# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** SSRF "URL 리터럴 + DNS 해석" 체크-후-사유문자열화 블록이 두 신규 파일에 동일하게 중복된다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:29-37`(`ssrfBlockReason` 함수 전체) 및 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:48-56`(`followRedirectsSafely` 루프 내부 try/catch)
  - 상세: 두 곳 모두 `assertSafeOutboundUrl(url)` → `assertSafeOutboundHostResolved(new URL(url).hostname)` 를 같은 순서로 호출하고, 실패 시 `err instanceof Error ? err.message : String(err)` 로 변환해 돌려주는 동일한 4~5줄 블록이다. 이 PR 은 정확히 이런 중복(노드 실행 vs 연결 테스터가 SSRF 체크를 각자 구현)을 막으려고 `http-credentials.ts`·`database-connection.ts`·`http-redirect.ts` 를 일부러 공용 모듈로 뽑아냈는데, 리다이렉트 홉의 SSRF 체크는 `http-redirect.ts` 로 공유시켜 놓고 첫 요청 전 preflight 체크(`ssrfBlockReason`)는 별도로 다시 작성했다. `http-request.handler.ts` 의 preflight(라인 351-359)는 usage-log 부수효과가 얽혀 있어 공유가 어렵다는 점은 이해되지만, `ssrfBlockReason` 과 `http-redirect.ts` 루프 안의 블록은 부수효과 없는 순수 체크라 공유 가능하다.
  - 제안: `http-safety.ts` 에 `describeOutboundSafetyViolation(url: string): Promise<string | null>` 같은 순수 헬퍼를 하나 추가해 `ssrfBlockReason()` 과 `followRedirectsSafely()` 양쪽에서 재사용한다. (`http-request.handler.ts` 의 preflight 는 로깅 책임이 달라 그대로 두어도 무방.)

- **[INFO]** 응답 본문 폐기(`body.cancel()`) 1줄짜리 패턴이 헬퍼 함수와 인라인 두 형태로 나뉘어 있다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:92-94`(`discardBody` 함수) vs `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:37`(루프 안 인라인 `await response.body?.cancel().catch(() => {});`)
  - 상세: 정확히 같은 한 줄이 한쪽은 이름 붙은 함수로, 다른 쪽은 인라인으로 존재한다. 아주 사소하지만 위 WARNING 항목과 같은 파일들을 건드리는 김에 통일하면 좋다.
  - 제안: `discardBody` 를 `http-redirect.ts` 에서도 그대로 가져다 쓰거나(순환 없음 확인됨 — 이미 `http-safety.ts` 를 함께 import 하는 형제 모듈), 사소하므로 지금 당장 처리하지 않아도 무방.

- **[INFO]** `testHttpConnection` 이 여러 책임(자격증명 해석 → base_url 유효성 → 헤더 병합 → SSRF preflight → fetch/리다이렉트 → 상태 분류 → 에러 분류)을 한 함수에서 순차 처리해 함수 길이가 60줄 가까이 된다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` 함수 `testHttpConnection` (전체 파일 컨텍스트 기준 라인 110-171)
  - 상세: 각 단계가 early-return 과 JSDoc(§5.3 분기표)으로 잘 구분돼 있어 지금 상태로도 가독성은 무난하지만, 이후 분기가 하나라도 더 늘면(예: OAuth2 지원 추가) 함수가 임계치를 넘을 수 있다.
  - 제안: 지금 당장 분리할 필요는 없음 — 다음 분기 추가 시 "요청 준비"(자격증명+헤더+URL)와 "요청 실행+분류" 두 함수로 쪼개는 것을 고려.

- **[INFO]** `probeMysql` 내 `const opened = connection;` 재바인딩은 TypeScript 클로저 narrowing 우회를 위한 관용구이나 이름 자체가 의도를 설명하지 않는다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts` 함수 `probeMysql` (전체 파일 컨텍스트 기준 라인 98-101, `const opened = connection;` 줄)
  - 상세: `connection` 이 `| undefined` 라 클로저 안에서 재좁힘이 안 되므로 필요한 코드지만, `opened` 라는 이름이 "왜 재바인딩했는지"를 드러내지 않는다.
  - 제안: 우선순위 낮음 — 원한다면 `const nonNullConnection = connection;` 처럼 이름에 이유를 담거나 짧은 주석 한 줄 추가.

## 요약

전반적으로 완성도가 높다. 새 테스터 두 개(`database-connection-tester.ts`, `http-connection-tester.ts`)와 공유 모듈(`clamp-message.ts`, `database-connection.ts`, `http-credentials.ts`, `http-redirect.ts`)로의 추출은 "노드 실행과 연결 테스트가 같은 로직을 타야 한다"는 설계 의도를 정확히 반영하며, 순환 import 회피 이유까지 모듈 상단 JSDoc 에 명시해 다음 사람이 왜 이렇게 쪼갰는지 바로 알 수 있다. 네이밍(타임아웃 상수 `_MS` 접미사, `DB_*`/`HTTP_*` 에러 코드 계열)과 함수 분해(각 헬퍼가 단일 책임, early-return 위주로 중첩 깊이가 얕음)도 기존 컨벤션과 일관적이다. 매직 넘버(`10_000`, `5`, `2`, SQLSTATE `28` 접두)는 전부 이름 붙은 상수 또는 근거 주석으로 설명되어 있다. 유일하게 눈에 띄는 흠은 SSRF preflight 체크-후-사유문자열화 블록이 `http-connection-tester.ts` 와 `http-redirect.ts` 사이에 그대로 중복된 점인데, 이 PR 이 다른 곳에서는 정확히 이런 중복을 막으려고 공용 모듈을 만든 것과 대비되어 WARNING 으로 짚었다. 나머지는 사소한 INFO 수준이라 병합을 막을 이유는 없다.

## 위험도

LOW

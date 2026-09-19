# 유지보수성(Maintainability) 리뷰

## 검토 범위

`codebase/backend/src/modules/integrations/{clamp-message,database-connection-tester,http-connection-tester,integrations.controller,integrations.service}.ts` 및 관련 spec, `codebase/backend/src/nodes/integration/{database-query/database-connection,database-query/database-query.handler,http-request/http-credentials,http-request/http-request.handler,http-request/http-safety}.ts`, e2e spec 2건, DTO 1건, 가이드 문서 2건을 검토했다. `plan/**`·`review/consistency/**`·`spec/2-navigation/4-integration.md` 는 생성된 계획/검토 산출물·spec 문서로, 애플리케이션 코드 유지보수성 관점의 대상이 아니라고 판단해 제외했다(리뷰 게이트 스코프도 `codebase/**`).

## 발견사항

- **[WARNING]** `testHttpConnection` 하나가 URL 검증 · 헤더 병합 · SSRF 1차 검사 · 리다이렉트 추종 루프 · 상태 분류 · 예외 분기까지 6가지 책임을 한 함수에 담아 순환 복잡도가 높다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:110`(함수 시작) ~ `:186`(끝), 특히 `:148`(`while` 루프)~`:168`
  - 상세: early return 3회(`!resolved.ok` · `!resolved.baseUrl` · `!isValidUrl`) + `isSafeTarget` 가드 + `while` 루프(조건 3개 AND, 내부에 홉 상한 분기 · 리다이렉트 대상 SSRF 재검사 분기) + `catch` 의 `TimeoutError`/`AbortError` 분기까지, 분기점이 10개 이상이다. 함수 자체는 이름·주석·JSDoc 이 좋아 당장 읽기 어렵지는 않지만, 리다이렉트를 더 정교하게 다뤄야 할 다음 변경(예: 리뷰 SUMMARY WARNING #1 이 제안한 redirect 관련 spec 보강)이 들어오면 이 함수가 계속 길어질 위험이 크다.
  - 제안: 리다이렉트 추종 루프(`:147`~`:168`)를 `followRedirects(initialRes, initialUrl, init): Promise<Response>` 같은 별도 함수로 추출해 `testHttpConnection` 은 "요청 준비 → 위임 → 결과 분류" 3단으로 남기면 각 조각의 책임이 뚜렷해진다.

- **[INFO]** 같은 `IntegrationsService.transportTesters` 맵 안에서 자격증명을 다루는 방식이 형제 메서드마다 다르다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:83` (`credentials as unknown as DbCredentials` 일괄 캐스트) vs `codebase/backend/src/modules/integrations/integrations.service.ts` 의 `testEmailTransport`/`toMcpConnectParams`(필드별 `credentials.host as string` 식 개별 캐스트, 예: `port: credentials.port as number`)
  - 상세: `database` 테스터만 `Record<string, unknown>` 을 통째로 `DbCredentials` 로 캐스팅한다. `validateCredentials` 가 이미 `service-registry.ts` 의 `database` 스키마로 타입까지 검사하므로 지금은 안전하지만(레지스트리 필드가 `DbCredentials` 와 정확히 일치함을 확인함), 다음 사람이 `database-connection-tester.ts` 만 보면 "이 캐스트가 왜 안전한지"를 알 수 있는 근거가 그 파일 안에는 없다 — 같은 서비스의 다른 테스터들이 쓰는 필드별 캐스트 관례와 눈에 띄게 다르다.
  - 제안: 캐스트 직전에 "필드는 `validateCredentials`(service-registry `database` 스키마)가 이미 보장한다"는 한 줄 주석을 남기거나, 형제 메서드처럼 필드별 캐스트로 맞추면 파일 하나만 보고도 안전성을 판단할 수 있다.

- **[INFO]** 에러를 문자열로 정규화하는 한 줄 관용구가 파일마다 반복된다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:33`, `codebase/backend/src/modules/integrations/database-connection-tester.ts:88`·`:110` (모두 `err instanceof Error ? err.message : String(err)`)
  - 상세: 같은 한 줄이 이 PR 안에서만 3곳, `integrations.service.ts` 기존 코드까지 합치면 6곳에서 반복된다(기존에도 있던 관용구라 이 PR 이 새로 만든 중복은 아니다). 지금 규모(한 줄, 6곳)에서는 심각하지 않지만 늘어나면 추출 대상이다.
  - 제안: 급하지 않음 — 다음에 이 패턴이 한 곳 더 늘면 `errorMessage(err: unknown): string` 공용 헬퍼로 뽑는 것을 고려.

- **[INFO]** `transportTesters` 맵 리터럴의 네 항목이 서로 다른 호출 스타일을 섞어 쓴다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:406`(`this.testMcpTransport.bind(this)`) / `:407`(`this.testEmailTransport.bind(this)`) / `:408`~`:410`(`(_authType, credentials) => testDatabaseConnection(credentials)`) / `:411`(`testHttpConnection` 직접 참조)
  - 상세: 인스턴스 메서드는 `.bind(this)`, 순수 함수는 직접 참조 또는 인자 어댑팅 화살표로 4가지 스타일이 한 리터럴 안에 공존한다. 시그니처 차이(`testDatabaseConnection` 은 `authType` 을 받지 않음)가 실제 원인이라 결함은 아니지만, 한 눈에 훑을 때 왜 항목마다 모양이 다른지 바로 읽히지 않는다.
  - 제안: 선택사항 — `database` 항목 위에 "authType 을 쓰지 않아 어댑터가 필요하다" 정도의 짧은 주석이면 충분하다.

## 잘 된 점 (참고)

- `database-connection.ts`/`http-credentials.ts` 로의 추출은 "핸들러와 테스터가 같은 로직을 쓰게 해 테스트 통과가 실행 성공을 보장한다"는 목적과 "순환 import 방지"라는 제약을 파일 상단 주석에 명시해, 다음 사람이 이 모듈에 의존성을 추가하기 전에 왜 안 되는지 바로 알 수 있게 해 두었다.
- `database-connection-tester.spec.ts`/`http-connection-tester.spec.ts` 는 `describe` 블록과 테스트 이름이 분기표(성공/차단/인증/연결 실패/타임아웃/리다이렉트 등)와 1:1로 대응해 가독성이 높고, 매직 넘버(타임아웃 10초·리다이렉트 5홉) 를 하드코딩하지 않고 익스포트된 상수(`DB_TEST_TIMEOUT_MS`, `HTTP_TEST_MAX_REDIRECTS`)로 검증해 상수-테스트 간 drift 를 방지한다.
- `DB_HOST_BLOCKED_MESSAGE`/`SSRF_BLOCKED_CLIENT_MESSAGE` 상수화는 노드와 연결 테스트가 같은 문구를 쓰도록 강제해, 문자열 리터럴 중복(예전 `database-query.handler.ts` 의 인라인 문자열)을 실제로 제거했다.

## 요약

전반적으로 네이밍이 명확하고(`isAuthFailure`, `isSafeTarget`, `withQuery`, `discardBody` 등 의도가 함수명에서 바로 드러남), 매직 넘버는 대부분 문서화된 상수로 추출돼 있으며, 노드-테스터 공유 로직을 순환 참조 없는 별도 모듈로 뽑아낸 리팩터링(`database-connection.ts`, `http-credentials.ts`)은 중복을 실제로 줄였다. 유일하게 눈에 띄는 항목은 `testHttpConnection` 하나에 요청 준비·리다이렉트 추종·상태 분류·예외 처리가 모두 몰려 있어 다음 확장(리다이렉트 관련 spec 보강 등) 때 더 길어질 위험이 있다는 것과, 자격증명 캐스팅 방식이 형제 메서드 사이에서 갈린다는 것 정도이며, 둘 다 즉시 차단할 사안은 아니다.

## 위험도

LOW

# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `testHttpConnection` 한 함수가 자격증명 해석 · base_url 부재 처리 · URL 형식 검증 · 헤더 병합 · query 부착 · SSRF preflight · redirect 추종 · 상태 분류 · 예외(timeout/일반) 처리까지 8단계를 순차로 담당한다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:87` (`testHttpConnection`, ~63줄)
  - 상세: 중첩은 얕고(early-return 위주) 각 단계에 주석이 붙어 있어 읽기 자체는 어렵지 않지만, 함수 하나가 여러 책임을 순서대로 나열해 향후 분기가 늘어나면(예: 리다이렉트 정책 추가) 함수가 계속 길어질 소지가 있다.
  - 제안: `buildRequestInit(resolved)` · `classifyFetchError(err)` 같은 이름 있는 헬퍼로 fetch 옵션 조립과 catch 분기를 분리하면 각 조각을 독립적으로 테스트·재사용하기 쉬워진다. 지금 상태로도 병합 차단 사유는 아니다.

- **[INFO]** HTTP 상태 코드 임계값(`401`, `403`, `500`, `400`)이 리터럴 숫자로 `classify()`에 하드코딩됨
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:40` (`classify`)
  - 상세: 401/403/500/400은 HTTP 표준 코드라 문맥상 의미가 명확해 전형적인 "매직 넘버" 문제(의미 불명 상수)는 아니지만, 같은 파일에 이미 `DB_TEST_TIMEOUT_MS` 등은 명명 상수로 뽑아 둔 것과 대비된다.
  - 제안: 굳이 상수화하지 않아도 무방하나, 팀 컨벤션상 매직넘버를 엄격히 금지한다면 `HTTP_STATUS.UNAUTHORIZED` 류의 명명 상수 도입을 고려.

- **[INFO]** 동시성 테스트의 "deferred promise + peak 계측" 보일러플레이트가 같은 `describe` 블록 안에서 두 번 그대로 반복됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `동시에 도는 연결 테스트는 ${CONNECTION_TEST_MAX_CONCURRENCY}개까지…` 테스트와 `연결 테스트는 종류를 가리지 않고 한 줄을 공유한다…` 테스트(두 곳 모두 `settle`/`releases`/`inFlight`/`peak` 지역 변수를 동일하게 재정의)
  - 상세: 로직은 정확하고 각 테스트의 의도(같은 서비스 vs 이종 서비스 혼합)가 달라 완전한 중복은 아니지만, deferred-promise 헬퍼 자체는 그대로 복사됐다.
  - 제안: `createDeferredCounter()` 같은 파일-로컬 팩토리로 뽑으면 두 테스트 모두 그 팩토리를 호출하는 형태로 줄어든다. 테스트 코드라 우선순위는 낮음.

- **[INFO]** `database-connection-tester.ts`의 `closeWithin` 내부에서 TypeScript 좁히기를 위해 지역 변수를 재바인딩하는 주석이 있어 약간의 인지 부담이 있음
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:111` (`probeMysql` 내부 "클로저 안에서도 non-undefined 로 좁혀 두려고 const 로 다시 묶는다" 주석)
  - 상세: 결함은 아니고, `finally` 클로저 안에서 `connection`의 옵셔널 타입을 좁히기 위한 관용적 패턴이며 이유가 주석으로 잘 설명돼 있다. 기록 차원의 INFO.

## 긍정적으로 눈에 띈 점

- `database-connection.ts` · `http-credentials.ts` · `http-redirect.ts` · `clamp-message.ts` 네 모듈은 노드 핸들러(`database-query.handler.ts`, `http-request.handler.ts`)와 신규 연결 테스터가 공유하던 로직(SSL 매핑, 자격증명 해석, redirect 추종, 메시지 클램프)을 "의존성 없는 공용 모듈"로 정확히 한 번씩만 추출했다. 각 파일 상단 JSDoc이 "왜 여기 있는지"(순환 import 회피)까지 설명해 다음 사람이 위치를 오해할 여지가 적다. `http-request.handler.ts`의 수동 redirect-follow 루프·query 부착 로직이 이 추출로 완전히 제거된 것도 중복 축소 사례다.
- `CONNECTION_TEST_MAX_CONCURRENCY = 2` 같은 상수는 값 자체보다 그 값을 정한 근거(libuv 스레드풀 크기, `dns.lookup` 스레드 점유 메커니즘)를 긴 주석으로 남겨 매직넘버 문제를 실질적으로 피했다(`integrations.service.ts:114-128`).
- `database-connection-tester.spec.ts` · `http-credentials.spec.ts` 등은 `it.each`로 유사 분기를 압축하고 이름에 검증 대상을 명시해 가독성이 좋다.
- 함수 중첩 깊이는 신규 파일 전반에서 얕게(대부분 2단 이하) 유지됐다.

## 요약

이번 변경은 새 파일 다수(테스터 2개 + 공용 모듈 4개)를 도입했지만 각 파일이 단일 책임에 가깝게 쪼개져 있고, Korean JSDoc이 "왜 이 구조인가"(순환 import, SSRF 재검증, 소켓 파괴 타이밍 등)를 촘촘히 남겨 유지보수 관점에서 우려할 만한 결함은 찾지 못했다. 유일하게 눈에 띄는 것은 `testHttpConnection` 한 함수가 여러 단계를 순차로 처리하는 점과 테스트 파일의 동시성 헬퍼 중복인데, 둘 다 차단 사유가 아닌 INFO 수준이다. 기존 `http-request.handler.ts`의 중복 로직을 공용 모듈로 흡수한 것은 오히려 전체 코드베이스의 중복을 줄이는 방향의 개선이다.

## 위험도
LOW

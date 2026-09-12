# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 에 `ParseUUIDPipe` 추가는 오히려 성능을 개선하는 방향
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 비-UUID `:id` 가 파이프에서 즉시 400 으로 끊기므로, 이전처럼 `findById` 까지 흘러가 Postgres 라운드트립(및 SQLSTATE 22P02 에러 처리 오버헤드) 을 발생시키지 않는다. 요청당 비용 관점에서 fail-fast 로 DB 커넥션 점유 시간을 줄이는 개선.
  - 제안: 없음 (긍정적 변경, 조치 불필요).

- **[INFO]** 신규 `param-uuid-pipe` 가드는 매 테스트 실행마다 `src/modules` 하위 전체 `.controller.ts` 를 AST 로 재파싱
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:192-219` (`scanUuidParams`), 호출부 `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:55` (`collectTsFiles(SCAN_ROOT)`)
  - 상세: `fs.readFileSync` + `ts.createSourceFile` 를 컨트롤러 파일 수(현재 35개)만큼 동기적으로 수행한다. 요청 경로가 아니라 CI/로컬 테스트 실행 시점의 1회성 비용이고, 이 저장소의 다른 형제 가드(`dto-class-name-collision`, `swagger-dto-contract` 등)도 동일 패턴을 이미 쓰고 있어 새로운 회귀는 아니다. 컨트롤러 수가 앞으로 크게 늘어나면(수백 개 이상) 테스트 스위트 실행 시간에 선형으로 누적된다.
  - 제안: 현재 규모에서는 문제 없음. 장기적으로 컨트롤러 수가 급증하면 `collectTsFiles` 결과를 다른 형제 가드와 공유(모듈 스코프 캐시)하는 것을 고려할 수 있으나, 지금 diff 범위에서 조치할 필요는 없다.

- **[INFO]** `apiParamUuidFlags`/`collectMethodViolations` 의 `pipes` 부분일치 검사
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:142-146` (`call.arguments.slice(1).map((a) => a.getText(sf)).join(',')` 후 `.includes('ParseUUIDPipe')`)
  - 상세: 파라미터 데코레이터 인자 수는 보통 0~2개라 `slice`+`map`+`join`+`includes` 비용은 무시할 수준. 알고리즘적으로 문제 없음.

- **[INFO]** HTTP 왕복 테스트(`triggers.controller.spec.ts`)는 `beforeAll` 에서 Nest 앱을 1회 생성해 재사용
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts:245-261`
  - 상세: `Test.createTestingModule(...).compile()` + `app.init()` 을 테스트마다 반복하지 않고 `beforeAll` 로 한 번만 수행하며 `afterAll` 에서 `app.close()`. 테스트 실행 비용 관점에서 적절한 패턴.

## 요약

이번 변경은 컨트롤러 파라미터 파이프 추가(1줄), 신규 정적 AST 가드/테스트/fixture, 문서(MDX·CHANGELOG·i18n 라벨 주석) 수정으로 구성되며 런타임 요청 경로에 영향을 주는 코드는 `@Param('id', ParseUUIDPipe)` 한 줄뿐이다. 이 변경은 비-UUID 입력을 DB 라운드트립 이전에 400 으로 차단하므로 성능상 오히려 개선(fail-fast, 불필요한 Postgres 왕복 제거)이며 회귀 요소가 없다. 신규 가드(`scanUuidParams`)는 테스트 시점에만 동작하는 정적 분석으로 알고리즘 복잡도는 파일 수·AST 노드 수에 선형이고, 현재 컨트롤러 35개 규모에서는 무시할 수준이다. N+1 호출, 블로킹 I/O 병목, 메모리 누수, 캐싱 부재, 비효율적 자료구조 등 CRITICAL/WARNING 급 성능 이슈는 발견되지 않았다.

## 위험도

NONE

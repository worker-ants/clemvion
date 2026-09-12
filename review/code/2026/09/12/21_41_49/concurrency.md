# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음. 이번 변경 세트는 다음으로 구성된다:

- `triggers.controller.ts`의 `rotateBotToken` 핸들러 파라미터에 `ParseUUIDPipe` 데코레이터 1개
  추가 + `@ApiParam`/`@ApiBadRequestResponse` 문서 갱신 (선언적 변경, 실행 흐름·공유 상태 없음)
- `auth.controller.ts`의 `@ApiParam`에 `format: 'uuid'` 키 추가 (문서 전용)
- 신규 정적 분석 가드(`param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts`,
  `sample.controller.ts` fixture) — `ts.createSourceFile` 로 파일을 순차 순회하는 순수 동기
  함수이며, 공유 가변 상태·비동기 I/O·락이 전혀 없다. `scanUuidParams`는 각 파일마다 지역
  변수(`out`, `scanned`)만 누적하고 반환하는 순수 함수로 스레드/워커 분리 없이 단일 호출
  스택에서 끝난다.
- `triggers.controller.spec.ts`에 추가된 HTTP 왕복 테스트: `beforeAll`에서
  `Test.createTestingModule` → `app.init()`을 1회 수행하고 `beforeEach`에서
  `rotateBotToken.mockClear()`로 초기화한 뒤 `it` 블록들이 **순차 실행**된다(Jest 기본 동작,
  `test.concurrent` 미사용). 각 테스트가 매번 `mockClear()`로 상태를 리셋하므로 테스트 간
  상태 누수·경쟁은 없다. `afterAll`에서 `app.close()`로 정리되어 리소스 누수도 없다.
- 나머지는 CHANGELOG·MDX 문서·i18n 라벨 주석·plan 문서 갱신으로 전부 정적 텍스트다.

공유 자원에 대한 동시 접근, 락/뮤텍스, 원자성이 필요한 복합 연산, Promise 체인의 오류 관리,
이벤트 루프 블로킹, 스레드/커넥션 풀 크기 변경 등 동시성 관점에서 검토할 대상이 존재하지 않는다.

## 요약

본 변경은 NestJS 컨트롤러 파라미터에 검증 파이프(`ParseUUIDPipe`)를 추가하는 선언적 수정과,
그 계약을 강제하는 순수 동기 AST 정적 분석 가드, 그리고 문서/주석 정정으로 구성된다. 요청 처리
경로에 공유 가변 상태나 비동기 조합 로직 변경이 없고, 신규 가드와 테스트 모두 동시 실행이나
공유 자원 접근을 유발하지 않는 순차적 구조라 동시성 리스크가 없다.

## 위험도

NONE

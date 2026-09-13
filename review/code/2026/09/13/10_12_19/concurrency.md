# 동시성(Concurrency) 리뷰

## 검토 범위

28개 변경 파일 전수 확인 (unified diff + 전체 파일 컨텍스트, 프롬프트 절단분은 `Read`로 원본 대조):

- 코드: `llm.service.ts`(`testConnection` 반환 필드 `error`→`message` 리네임, 순수 문자열 키 변경) · `integration-response.dto.ts`/`model-config-response.dto.ts`(미발행 `latencyMs?` 필드 제거, 주석만) · `llm-model-config.controller.spec.ts`/`llm.service.spec.ts`(테스트 — supertest HTTP 왕복 + `assertMatchesContract` 계약 검증 추가) · `model-configs.ts`/`model-configs.test.ts`(프런트 API 클라이언트 타입·픽스처) · `guide-error-code-scan.ts`(신규 — MDX 문자열을 정규식으로 스캔하는 순수 함수, 상태 없음) · `guide-error-code-existence.test.ts`(신규 vitest 스위트)
- 비코드: `CHANGELOG.md`, MDX 문서 6종, `plan/**`, `review/consistency/**` 산출물

## 관점별 확인

1. **경쟁 조건**: 변경분은 응답 필드 이름 변경(`error`→`message`)과 미사용 DTO 필드 제거뿐이다. 공유 가변 상태(모듈 스코프 변수, 캐시, 싱글턴 필드)를 신설·수정하는 대상이 없다.
2. **데드락**: 락을 다루는 코드 변경 없음.
3. **동기화**: mutex/semaphore 대상 자원 없음.
4. **스레드 안전성**: `guide-error-code-scan.ts`의 `scanErrorCodeCitations`/`collectBackendTokens`는 인자를 받아 새 배열/Set을 반환하는 순수 함수이고, 모듈 레벨 정규식 리터럴(`FIELD_TABLE_NAME` 등)은 `RegExp.exec` 호출 전 매번 `rx.lastIndex = 0`으로 리셋한다 — Node.js는 싱글스레드이므로 `lastIndex` 공유 자체가 문제는 아니지만, 이 리셋 없이는 동일 정규식 재사용 시 상태가 새는 흔한 함정인데 실제 코드는 이를 정확히 처리했다.
5. **async/await**: 신설 테스트(`llm-model-config.controller.spec.ts`)의 `beforeAll`/`afterAll`/`it`은 모두 `await`로 `app.init()`/`app.close()`/`request(...).post(...)`를 대기하며 누락 없음. `llm.service.ts`의 `testConnection`은 기존 `try/catch` 구조 그대로이고 반환 타입·필드명만 바뀌었다 — await 흐름 변경 없음.
6. **원자성**: DTO에서 발행되지 않던 `latencyMs?` 제거는 단일 필드 선언 삭제이며 복합 연산이 아니다. 서비스의 `return { success: false, message: ... }`도 단일 반환문이라 원자성 이슈가 성립할 여지가 없다.
7. **이벤트 루프**: 블로킹 동기 호출(파일 I/O 등)은 테스트 스위트(`fs.readFileSync`, vitest 실행 컨텍스트)에만 있고, 이는 빌드/테스트 타임 스캐너이지 런타임 요청 경로가 아니다. 프로덕션 코드 경로(`llm.service.ts`)에는 신규 블로킹 호출이 없다.
8. **리소스 풀링**: 신설 테스트가 `Test.createTestingModule(...).compile()` → `moduleRef.createNestApplication()` 한 번을 `beforeAll`에서 만들고 `afterAll`에서 `app.close()`로 정리한다 — 앱 인스턴스 생성/해제 쌍이 맞고 테스트 간 누수 없음. 커넥션 풀 크기 조정 대상 코드 없음.

## 요약

이번 변경은 `POST /api/model-configs/:id/test` 응답의 필드 이름 정정(`error`→`message`)과 미발행 DTO 필드(`latencyMs`) 제거, 그에 따른 계약 검증 테스트·문서 정정이 핵심이며 순수 리네임·필드 삭제·문서 서술 교정 수준이다. 신규 스캐너(`guide-error-code-scan.ts`)도 상태 없는 순수 함수이고 빌드타임 전용이라 런타임 동시성 표면과 무관하다. 공유 자원 접근, 락, 비동기 흐름 변경, 스레드/이벤트 루프 관련 리스크를 유발하는 요소를 찾지 못했다.

## 위험도

NONE

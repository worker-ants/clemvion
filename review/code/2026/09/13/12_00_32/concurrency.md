# 동시성(Concurrency) 리뷰

## 검토 범위

프롬프트에 나열된 138개 항목 중 실질 diff 대상은 파일 1~25 (`CHANGELOG.md`, `PROJECT.md`, backend DTO 2종, backend service 1종 + 그 spec 2종, frontend API client 1종 + 그 test, frontend 컴포넌트 test, MDX 문서 8종, 신규 정적 가드 3종 + 그 test, `impl-anchor-existence.test.ts` 주석 정정, `plan/**` 2종)이며, 나머지(파일 26~138)는 이전 리뷰 라운드(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36,11_33_23}`·`review/consistency/**`)의 산출물 문서 자체라 이번 diff 의 코드 변경이 아니다.

프롬프트에서 diff 가 생략된 항목은 원본을 `Read` 로 직접 열어 확인했다:
`codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`,
`codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`,
`codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`.

## 관점별 확인

1. **경쟁 조건**: 실질 코드 변경은 `LlmService.testConnection` 의 반환 필드명 정정(`error`→`message`)과 두 DTO 의 미발행 필드(`latencyMs`, `meta`) 제거·미선언 필드(`code`) 추가뿐이다. 공유 가변 상태(모듈 스코프 변수, 캐시, 싱글턴 필드)를 신설·수정하는 대상이 없다.
2. **데드락**: 락을 다루는 코드 변경 없음.
3. **동기화**: mutex/semaphore 대상 자원 없음.
4. **스레드 안전성**: 신규 `guide-error-code-scan.ts` 의 `scanErrorCodeCitations`/`collectBackendTokens` 는 인자를 받아 새 배열/Set 을 반환하는 순수 함수다. 모듈 레벨 정규식(`FIELD_TABLE_NAME`·`CODE_FIELD`·`UPPER_SNAKE` 기반 rx)은 `g` 플래그를 쓰지만 매 호출 전 `rx.lastIndex = 0` 으로 명시 리셋한다(직접 확인, 라인 149·177) — Node.js 는 싱글스레드라 애초에 스레드 경합은 성립하지 않지만, 이 리셋이 없으면 같은 정규식 재사용 시 상태가 새는 흔한 함정인데 실제 코드는 정확히 처리했다.
5. **async/await**: `llm-model-config.controller.spec.ts` 신설 `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')` 는 `beforeAll`/`afterAll`/`beforeEach`/`it` 전부 `await` 로 `moduleRef.compile()`·`app.init()`·`app.close()`·`request(...).post(...)` 를 대기하며 await 누락 없음. `app` 은 `beforeAll` 1회 생성·`afterAll` 1회 정리, `clientTestConnection` mock 은 `beforeEach` 마다 `mockReset()` — 테스트 간 상태 누수 없음. `llm.service.ts::testConnection` 은 기존 `try/await/catch` 단일 흐름 그대로이고 반환 타입·필드명만 바뀌었다 — 흐름 변경 없음.
6. **원자성**: DTO 필드 추가/제거는 단일 선언 편집이며 복합 연산이 아니다. `testConnection` 의 `return { success: false, message: ... }` 도 단일 반환문.
7. **이벤트 루프**: 신규 가드(`guide-error-code-existence.test.ts`)는 `beforeAll`/`it` 최상위에서 `walkTree` + `fs.readFileSync` 로 backend/packages 소스를 동기 로드하지만, 이는 빌드/테스트 타임 정적 스캐너이며 런타임 요청 경로(`llm.service.ts`)에는 신규 블로킹 호출이 없다. (성능 관점의 스캔 비용은 이미 전전 라운드 `performance.md` 에서 INFO 로 기록·조치 불요 처리됨 — 동시성 관점에서는 문제 아님.)
8. **리소스 풀링**: 신설 supertest 스위트가 `Test.createTestingModule(...).compile()` → `moduleRef.createNestApplication()` 을 `beforeAll` 에서 1회 생성, `afterAll` 에서 `app.close()` 로 정리 — 생성/해제 쌍이 맞고 누수 없음. 커넥션 풀 크기 조정 대상 코드 없음.

## 요약

이번 diff 의 실질 코드 변경은 `POST /api/model-configs/:id/test`·`/api/integrations/:id/test` 응답 필드명 정정(`error`→`message`)과 미발행/미선언 DTO 필드 정리, 그리고 이를 지키는 신규 계약 검증 테스트(`assertMatchesContract`)·신규 정적 문서 가드(`guide-error-code-existence`, `guide-error-code-scan`, `guide-sanitized-message-parity`)이며 나머지는 MDX 문서·plan·이전 리뷰 산출물이다. 신규 가드는 상태 없는 순수 함수 + 빌드타임 동기 스캔이고, 신설 HTTP 계약 테스트는 Nest 앱 생명주기·mock 리셋을 `beforeAll`/`beforeEach`/`afterAll` 로 정확히 관리한다. 공유 자원 동시 접근, 락, 비동기 흐름 변경(await 누락 등), 스레드/이벤트 루프/커넥션 풀 관련 리스크를 유발하는 요소를 찾지 못했다. 동일 배치를 검토한 선행 4개 라운드(`10_12_19`·`10_40_34`·`11_07_36`·`11_33_23`)의 concurrency 리뷰도 모두 NONE 으로 일치하며, 이번 라운드에서 원본 코드를 직접 열어 재확인한 결과도 같다.

## 위험도

NONE

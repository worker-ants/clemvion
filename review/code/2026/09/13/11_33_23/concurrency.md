# 동시성(Concurrency) 리뷰

## 검토 범위

이번 changeset(`origin/main...HEAD`, 프롬프트 기준 80여개 파일)의 실질 코드 변경 파일을 전수 확인했다. 프롬프트가 절단한 `llm-model-config.controller.spec.ts`는 저장소 원본을 `Read`로 직접 열어 전문을 대조했다.

- 프로덕션 코드: `codebase/backend/src/modules/llm/llm.service.ts`(`testConnection` 반환 필드 `error`→`message` 리네임) · `integration-response.dto.ts`/`model-config-response.dto.ts`(미발행 `latencyMs`/`meta` 필드 제거, `code` 필드 추가 — 선언 주석만)
- 테스트: `llm.service.spec.ts`, `llm-model-config.controller.spec.ts`(신규 HTTP 왕복 `describe` — `beforeAll`/`afterAll`/`beforeEach` 앱·mock 생명주기), `integrations.service.spec.ts`, `model-config-manager.test.tsx`, `model-configs.test.ts`
- 신규 정적 가드(빌드타임, 전부 동기 `fs.readFileSync` 기반 순수 함수): `guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`
- 나머지: `CHANGELOG.md`, MDX 문서, `plan/**`, `review/**` 산출물(이전 리뷰 라운드 3회분 포함) — 전부 비코드

## 관점별 확인

1. **경쟁 조건**: 공유 가변 상태를 신설·수정하는 대상이 없다. `llm.service.ts`의 `testConnection`은 기존 단일 `try/await/catch` 순차 흐름 그대로이며 반환 객체 키 이름(`error`→`message`)만 바뀌었다.
2. **데드락**: 락을 다루는 코드 변경 없음.
3. **동기화**: mutex/semaphore 대상 공유 자원 없음.
4. **스레드 안전성**: 신규 가드(`guide-error-code-scan.ts`)는 인자를 받아 새 배열/Set을 반환하는 순수 함수이고 Node.js 단일 스레드 실행이라 문제 없음.
5. **async/await**: `llm-model-config.controller.spec.ts`의 신설 `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')`를 직접 열어 확인 — `beforeAll`에서 `await moduleRef.compile()` → `app.init()`까지 await 누락 없이 앱을 1회 기동하고, `afterAll`에서 `await app.close()`로 정리하며, `beforeEach`에서 `clientTestConnection.mockReset()`으로 두 `it` 사이 mock 상태를 격리한다. Jest는 파일 내 테스트를 기본 순차 실행하므로 두 테스트가 공유하는 `app`/mock 인스턴스에 경쟁 조건이 생기지 않는다. `llm.service.spec.ts`/`model-config-manager.test.tsx`의 신규 테스트도 각각 `await service.testConnection(...)`, `await act(...)`/`await waitFor(...)`를 빠짐없이 사용한다.
6. **원자성**: DTO 필드 제거/추가는 단일 선언 삭제·추가이며 복합 연산이 아니다. 서비스의 `return { success: false, message: ... }`도 단일 반환문이라 원자성 이슈가 성립할 여지가 없다.
7. **이벤트 루프**: 신규 가드가 `backend/src`+`packages` 전체를 매 테스트 실행 시 동기 `fs.readFileSync`로 로드하지만, 이는 vitest 프로세스의 빌드/테스트 타임 스캐너이지 런타임 요청 경로(Node 서버 이벤트 루프)를 블로킹하는 것이 아니다. 프로덕션 코드 경로(`llm.service.ts`)에는 신규 블로킹 호출이 없다.
8. **리소스 풀링**: 신설 테스트가 `Test.createTestingModule(...).compile()` → `createNestApplication()`을 `beforeAll`에서 1회만 만들고 `afterAll`에서 `app.close()`로 정리한다 — 생성/해제 쌍이 맞고 테스트 간 앱 인스턴스 누수가 없다. 커넥션 풀 크기 조정 대상 코드는 diff에 없다.

## 요약

이번 변경의 핵심은 `POST /api/model-configs/:id/test`·`POST /api/integrations/:id/test` 응답 DTO 필드명 정합화(`error`→`message`, 미발행 `latencyMs`/`meta` 제거, 생산자만 있던 `code` 추가)와 유저 가이드 정정, 그에 따른 계약 검증 테스트·신규 정적 가드 추가이며, 순수 필드 리네임·삭제·추가와 문서 서술 교정 수준이다. 신규 HTTP 왕복 테스트(`llm-model-config.controller.spec.ts`)의 `beforeAll`/`afterAll`/`beforeEach` 생명주기를 직접 열어 확인한 결과 await 누락·mock 상태 누수 없이 정확히 격리돼 있고, 신규 스캐너도 상태 없는 순수 함수이자 빌드타임 전용이라 런타임 동시성 표면과 무관하다. 공유 자원 접근, 락, 비동기 흐름 변경, 스레드/이벤트 루프/리소스 풀 관련 리스크를 유발하는 요소를 찾지 못했다. 동일 changeset에 대한 이전 3회 리뷰 라운드(10:12:19, 10:40:34, 11:07:36)도 모두 동시성 위험도 NONE으로 판정했으며, 이번 재확인도 같은 결론이다.

## 위험도

NONE

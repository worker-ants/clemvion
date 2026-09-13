# 동시성(Concurrency) 리뷰

## 발견사항

해당 없음.

이번 changeset(`codebase/` 21개 파일, `git diff origin/main...HEAD --stat -- codebase/` 확인)은
`POST /api/model-configs/:id/test` · `POST /api/integrations/:id/test` 두 엔드포인트의 응답
필드명 정정(`error`→`message`, 생산자 0건이던 `latencyMs`/`meta` 제거, 생산자만 있고 선언이
없던 `code` 추가)과 그에 따른 DTO 주석·MDX 유저 가이드·신규 계약 가드 테스트
(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`,
`guide-sanitized-message-parity.test.ts`, `assertMatchesContract` 배선)로 구성된다.

- `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection` 은 기존 단일
  `try { await client.testConnection(...) } catch {}` 순차 흐름 그대로이며, 바뀐 것은 반환
  객체의 키 이름(`error`→`message`)뿐이다. 새 `Promise.all`/`Promise.race`/타이머/재시도 로직
  없음, 공유 가변 상태 없음.
- `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` — 신설
  `describe('POST /model-configs/:id/test — 와이어 계약 (HTTP)')` 는 `beforeAll` 에서 Nest
  테스트 앱을 1회 기동하고 `beforeEach` 에서 mock 을 리셋한 뒤 두 `it` 이 순차 실행된다.
  Jest 는 파일 내 테스트를 기본 순차 실행하며, 두 테스트가 공유하는 것은 `app` 인스턴스와
  `clientTestConnection` mock 뿐인데 각 테스트 전 `mockReset()` 으로 격리된다 — 경쟁 조건
  없음. `afterAll` 에서 `await app.close()` 로 정리도 누락 없음.
  `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` 의 신규
  두 테스트도 `await act(...)`/`await waitFor(...)` 패턴을 기존 관례대로 따르며 await 누락 없음.
- DTO 파일(`integration-response.dto.ts`, `model-config-response.dto.ts`)은 필드 선언·주석만
  바뀌었고 동시성과 무관.
- 신규 가드 테스트 파일들(`guide-error-code-existence.test.ts`, `guide-error-code-scan.ts`,
  `guide-sanitized-message-parity.test.ts`, `impl-anchor-existence.test.ts` 수정)은 전부 동기
  `fs.readFileSync` 기반 정적 텍스트 검사이며 비동기·공유 자원 접근이 없다.
- 락/뮤텍스/세마포어, 스레드 풀, 커넥션 풀, 이벤트 루프 블로킹 우려가 있는 신규 코드 없음.
  `package.json`/lockfile 변경도 없어(과거 라운드 실측과 동일) 신규 외부 의존성 유입도 없다.

## 요약

이번 PR 은 응답 DTO 필드명 정합화·유저 가이드 정정·계약 회귀 가드 추가로, 동시성 상태(공유
가변 상태·락·비동기 오케스트레이션·리소스 풀)를 다루는 코드 변경이 전혀 없다. 기존
`testConnection` 의 단일 순차 `try/await/catch` 흐름은 그대로 유지되며, 신규 테스트들도 Jest/RTL
표준 순차·await 패턴을 따른다. 동시성 관점에서 지적할 위험 없음.

## 위험도

NONE

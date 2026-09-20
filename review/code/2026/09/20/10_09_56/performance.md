# 성능(Performance) 리뷰 — SSRF 가드 소비자 넷의 catch 분기 (`instanceof SsrfBlockedError`)

## 발견사항

- **[INFO]** `toLogError(err)` 중복 호출 — 같은 에러에 대해 `sanitizeMessage` regex 패스가 두 번 실행된다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:369` 와 `:379` (같은 `if (!(err instanceof SsrfBlockedError))` 블록 안)
  - 상세: 369번 줄 `error: toLogError(err)` 와 379번 줄 `toLogError(err).message` 가 같은 `err` 에 대해 `toLogError` 를 두 번 호출한다. `toLogError` 내부는 `sanitizeMessage` 로 3개의 정규식(`SECRET_PATTERNS`)을 문자열에 순차 적용하므로, 이 경로를 탈 때마다 같은 문자열에 regex 매칭이 두 벌 돈다. 다만 이 경로는 요청당 1회(SSRF preflight 실패 시)만 타는 에러 처리 분기이고 대상 문자열도 일반적인 에러 메시지 길이라 실질적 비용은 미미하다.
  - 제안: `const logError = toLogError(err);` 로 한 번만 계산해 369·379 양쪽에서 재사용하면 중복 계산이 제거된다. 시급하지 않음.

- **[INFO]** `sanitizeMessage` 가 클램프 이전의 원문 전체에 대해 실행된다
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:152` (`clampMessage(sanitizeMessage(detail))`)
  - 상세: `sanitizeMessage` 의 3개 정규식(공용 헬퍼 `codebase/backend/src/nodes/integration/_base/integration-handler-base.ts:156-163`, 이번 diff 로 새로 도입된 코드는 아님)이 길이 상한 없는 `detail`(가드가 던진 에러의 `.message`) 전체를 훑은 뒤에야 `clampMessage` 로 잘린다. 세 패턴 모두 중첩 정량자가 없어 선형이며, 이 경로의 `detail` 은 실제로는 `TypeError`/드라이버 예외 등 짧은 문자열만 관측되므로(가드 실패는 `hostname` 타입 오류 등 정형화된 메시지) 실질적으로 문제되는 입력 크기는 아니다. 새로 추가된 호출 경로라는 점만 기록.
  - 제안: 현 상태로 충분. 만약 향후 가드가 외부 입력을 그대로 실어 나르는 에러(예: 매우 긴 DNS 응답 문자열)를 던지게 바뀐다면 `clampMessage` 를 `sanitizeMessage` 보다 먼저 적용하는 순서로 바꾸는 것을 고려.

- **[정보 — 결함 아님]** `AbortSignal.timeout` 생성을 preflight 뒤로 이동 — 성능 관점에서 개선
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:120-129`
  - 상세: 이번 diff 는 `outboundBlockReason(url)` preflight 호출을 `try` 블록 안으로 옮기면서, `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 생성도 preflight **뒤**로 이동시켰다. `AbortSignal.timeout` 은 생성 시점부터 카운트다운을 시작하므로, 이전처럼 preflight(DNS 조회 포함) **전**에 신호를 만들면 가드의 DNS 조회 시간만큼 실제 `fetch` 예산이 줄어드는 부작용이 있었다(느린 DNS 환경에서 정상 연결이 타임아웃으로 오분류될 수 있음). 이번 변경은 그 예산 잠식을 없앤다 — 블로킹 I/O(가드의 DNS 조회)가 fetch 타임아웃 워터마크에 섞이지 않게 분리한 것으로, 회귀가 아니라 개선이다.

## 그 외 검토

- 알고리즘 복잡도 / 자료구조: 변경은 기존 `try/catch` 안에 `instanceof SsrfBlockedError` 분기 하나를 추가하는 형태뿐이며, 새로운 반복문·중첩 구조·자료구조 변경은 없다.
- N+1 호출: 가드 함수(`assertSafeOutboundHostResolved`/`assertSafeOutboundUrl`) 호출 횟수는 요청당 그대로(1회)이며, 새로 추가된 `logger.warn`/`logUsage` 호출도 기존에 이미 있던 "차단" 분기와 대칭 구조로, 요청당 1회 이상 반복되지 않는다.
- 캐싱 / 지연 로딩: 해당 없음 — 캐싱 대상이 될 반복 계산이 새로 생기지 않았다.
- 블로킹 I/O: 프로덕션 코드 경로에 새 동기 I/O 는 없다. 테스트 파일(`http-redirect.spec.ts`)에서 `assertSafeOutboundHostResolved` 를 실물 대신 mock 하도록 명시적으로 처리해 실제 `node:dns` 조회로 인한 flaky/hang 을 피한 점도 확인했다(테스트 전용, 프로덕션 영향 없음).
- 문자열 연결: 새로 추가된 템플릿 리터럴(`logger.warn` 메시지 등)은 요청당 1회 평가되는 단발성 연결로 O(n²) 누적 패턴이 아니다.

## 요약

이번 변경은 SSRF 가드 네 소비자(HTTP 노드/테스터, DB 노드/테스터, `outboundBlockReason`)의 `catch` 블록에 `instanceof SsrfBlockedError` 분기를 추가해 "차단 판정"과 "가드 자체의 고장"을 가르는 순수 에러 분류 리팩터링이다. 새로운 루프·반복 호출·캐시 필요 지점·블로킹 I/O 는 도입되지 않았고, 유일하게 성능과 맞닿은 부분(`http-connection-tester.ts` 의 `AbortSignal.timeout` 생성 시점 이동)은 오히려 타임아웃 예산 정확도를 개선하는 방향이다. `toLogError` 중복 호출과 `sanitizeMessage`/`clampMessage` 순서는 이론적으로 지적할 수 있으나 요청당 1회·짧은 문자열에 국한돼 실질적 영향은 없다.

## 위험도

NONE

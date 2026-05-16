# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `wrapInCafe24Envelope` — 매 요청마다 새 객체 3개 생성
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `wrapInCafe24Envelope` 함수 (라인 2089–2096)
  - 상세: `const { shop_no, ...rest } = body` 구문은 `rest` 객체를 매번 새로 heap-allocate 한다. 이후 `envelope` 객체를 한 번 더 생성하므로 호출 당 최소 2개의 추가 객체가 생긴다. 단일 요청 단위에서는 무시할 수 있는 비용이지만, 고빈도 배치 워크플로(예: 상품 대량 수정)에서 GC 압력이 다소 증가할 수 있다. 현 규모에서는 실질적 병목이 아니다.
  - 제안: 수용 가능. 가독성·정확성 대비 최적화 효과가 미미하므로 현 구현 유지 권장. 실제 GC 부담이 측정될 때만 `Object.assign({}, ...)` 방식으로 전환 검토.

- **[INFO]** `safeReadJson` — 오류 경로에서 이중 `try/catch` 중첩
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `safeReadJson` 함수 (라인 2142–2154)
  - 상세: 성능 영향은 없다. 정상 경로(HTTP 응답 정상, JSON 파싱 성공)에서 try/catch 오버헤드는 무시 수준이며 현대 V8 엔진은 예외가 실제로 throw 되지 않는 경로를 최적화한다. 오류 경로에서만 두 번의 catch 가 동작하는데, 이는 드문 케이스이므로 실 운영 성능에 영향을 주지 않는다.
  - 제안: 현 구현 유지. 변경 불필요.

- **[INFO]** `detectInsufficientScope` — 동일 정규식 리터럴이 함수 호출마다 재컴파일 가능성
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `detectInsufficientScope` 메서드 (라인 1829–1861)
  - 상세: 함수 내부에 두 개의 동일한 정규식 리터럴(`/\binsufficient[_ ]?scope\b.../i`)이 별도로 선언되어 있다(라인 1833, 1853). V8은 함수 리터럴 내 정규식을 보통 캐싱하지만, 두 리터럴이 동일함에도 별도로 작성되어 있어 코드 중복이 발생하며 이론적으로 두 번의 RegExp 객체 생성이 일어날 수 있다. 401/403 응답이 발생한 경우에만 이 메서드가 호출되므로 핫패스에는 해당하지 않는다.
  - 제안: 클래스 또는 모듈 수준에서 상수로 추출하면 중복을 제거하고 가독성도 높아진다. 예: `const INSUFFICIENT_SCOPE_RE = /\binsufficient[_ ]?scope\b|\bmissing[_ ]?scope\b|\bINVALID[_ ]?SCOPE\b/i;`

- **[INFO]** `refreshViaQueue` — 성공 경로에서 `integrationRepository.findOne` 2회 호출 가능
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `refreshViaQueue` 메서드 (라인 1572–1659)
  - 상세: `waitUntilFinished`가 reject될 때 catch 블록 내에서 `findOne`을 1회 호출하고(라인 1617), 성공으로 판단되면 이후 try 블록 외부에서 다시 `findOne`을 1회 호출한다(라인 1646). 즉 "이벤트 누락 → worker 실제 성공" 경로에서 동일 DB 조회가 2회 발생한다. 이 경로는 Redis 이벤트 손실이라는 비정상 경로이므로 빈도가 낮아 실질적 성능 영향은 미미하다. 또한 정상 경로(waitUntilFinished 성공)에서는 catch가 실행되지 않아 1회 조회만 발생한다.
  - 제안: 비정상 경로이므로 현 구현 수용 가능. 최적화가 필요하다면 catch 결과를 변수에 저장해 재사용하되, 코드 복잡도 증가를 감안해 판단한다.

- **[INFO]** `executeWithRateLimit` — 재귀 호출 방식의 재시도 (최대 깊이 2)
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` — `executeWithRateLimit` 메서드 (라인 1987–1993)
  - 상세: 429 재시도를 재귀로 구현하고 있다. `MAX_RATE_LIMIT_RETRIES = 2`이므로 최대 콜스택 깊이 증가는 3 프레임으로 스택 오버플로 위험은 없다. 각 재시도 전 `await this.sleepImpl(sleepMs)` (최소 1초)가 선행되므로 이벤트 루프가 블록되지 않는다. 성능 문제로 보기 어렵다.
  - 제안: 현 구현 유지. 명확성과 단순성 면에서 반복문보다 재귀가 더 읽기 쉬운 상황이다.

- **[INFO]** `makeIntegration` — 테스트 픽스처에서 `Date.now()` 중복 호출
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` — `makeIntegration` 함수 (라인 171–193)
  - 상세: `Date.now() + 24 * 60 * 60 * 1000`이 `credentials.expires_at`과 `tokenExpiresAt` 두 곳에서 각각 독립적으로 호출된다. 두 값이 미세하게 다를 수 있지만, 테스트 환경에서 이 차이는 무관하며 성능 문제도 아니다.
  - 제안: 테스트 코드이므로 수용. 일관성이 중요하다면 `const expiresAt = new Date(Date.now() + 24 * 3600 * 1000)`으로 공통 변수 추출.

## 요약

이번 변경의 핵심은 `wrapInCafe24Envelope` 함수 추가와 이를 `executeWithRateLimit` 내 직렬화 직전에 적용한 것이다. 성능 관점에서 이 변경은 매우 경량하다 — 객체 구조 분해(destructuring) 한 번과 새 객체 리터럴 한 번이 추가될 뿐이며, 이는 네트워크 왕복 비용에 비해 완전히 무시 가능하다. 기존 코드의 성능 프로파일(`withIntegrationLock`, `executeWithRateLimit`, `safeReadJson`, `refreshViaQueue` 등)에도 이번 변경으로 새로 도입된 병목이나 회귀는 없다. 정규식 중복 선언(INFO 1건)은 오류 경로 전용이므로 운영 핫패스에 영향이 없으며, DB 이중 조회(INFO 1건)도 Redis 이벤트 손실이라는 드문 비정상 경로에서만 발생한다. 전반적으로 성능 위험도는 낮다.

## 위험도

LOW

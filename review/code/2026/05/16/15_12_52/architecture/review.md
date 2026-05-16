# Architecture Review — cafe24-request-envelope-fix

대상 커밋: `97d02fb4fca4be15f05c37fb96a9697ea47c41e9`
리뷰 파일: `backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` (+ 구현 컨텍스트 `cafe24-api.client.ts`)

---

## 발견사항

- **[INFO]** 프로토콜 관심사의 중앙화 — 올바른 레이어 배치
  - 위치: `cafe24-api.client.ts` L864–871 (`wrapInCafe24Envelope`), `executeWithRateLimit` L709–711
  - 상세: `shop_no` 분리 + `request` 래핑이라는 Cafe24 wire-format 규약이 `Cafe24ApiClient` 내부의 순수 함수 `wrapInCafe24Envelope`에 완전히 캡슐화되었다. 호출자(`cafe24.handler.ts`, MCP tool provider)는 flat body map을 그대로 전달하며 변환 로직에 의존하지 않는다. 레이어 책임(비즈니스/데이터 경계) 관점에서 정석적인 처리다.
  - 제안: 현재 설계를 유지. 다른 Cafe24 write endpoint가 추가될 때 handler 쪽에 개별 래핑 로직을 추가하지 않도록 팀 규약으로 명문화할 것.

- **[INFO]** `wrapInCafe24Envelope` 의 추상화 수준이 적절함
  - 위치: `cafe24-api.client.ts` L864–871
  - 상세: 함수가 `shop_no` 분리 규칙만 처리하고, 다른 "top-level 예외 필드"가 생길 경우(예: Cafe24 v3에서 `language_code`가 top-level이 될 수도 있음) 함수 시그니처를 바꾸지 않고 내부 구현만 확장해야 한다. 현재는 `shop_no` 만 하드코딩으로 특별 처리하는 상태이므로, 외부 필드 목록이 늘어나면 함수 자체에 변경이 필요하다. 이는 OCP(개방-폐쇄 원칙) 경계선이 된다.
  - 제안: 단기적으로 현재 구현으로 충분하다. Cafe24 API의 top-level 예외 필드가 `shop_no` 외에 추가될 가능성이 확인되면 `topLevelKeys: string[]` 파라미터화를 고려.

- **[INFO]** `Cafe24ApiClient` 의 단일 책임 원칙 — 경계선 감시 필요
  - 위치: `cafe24-api.client.ts` 전반 (L207–834)
  - 상세: 이번 변경 자체는 SRP를 지킨다. 다만 `Cafe24ApiClient`는 이미 (1) 자격증명 검증, (2) 토큰 refresh (in-process + BullMQ 두 경로), (3) rate-limit 재시도, (4) wire-format 변환, (5) 상태 전이(`markAuthFailed`, `recordNetworkFailure`) 등 5개 관심사를 한 클래스에 보유하고 있다. 이번 PR이 wire-format 관심사를 순수 함수로 추출해 내부 응집도를 높인 점은 긍정적이나, 클래스 전체의 SRP 위반 여지를 줄이지는 않는다.
  - 제안: 향후 리팩토링 기회에 `Cafe24TokenRefreshService`, `Cafe24RateLimitPolicy` 등으로 관심사 분리를 고려할 수 있다. 이번 PR 범위 밖이므로 즉각 조치 불필요.

- **[INFO]** 테스트 커버리지 — 경계 케이스 완결성
  - 위치: `cafe24-api.client.spec.ts` L88–154 (새로 추가된 4개 테스트)
  - 상세: `shop_no` 있음/없음, `shop_no` 단독(빈 request), POST, GET(래핑 없음) 등 4개 경계 케이스가 모두 커버되었다. 테스트는 화이트박스 방식으로 `init.body`를 직접 검사함으로써 wire 형식을 구체적으로 검증한다. 아키텍처 관점에서 테스트가 "클라이언트 내부 직렬화 로직"에 결합되어 있는 것은 수용 가능한 수준이다(구현 변경이 wire 계약 변경을 의미하기 때문).
  - 제안: `DELETE` 메서드가 `wrapInCafe24Envelope`의 적용 범위에서 어떻게 처리되는지(spec에서 DELETE에 body가 있는지) 향후 케이스가 생길 경우 추가 테스트 필요.

- **[INFO]** 테스트의 `fetchMock.mock.calls[0]` 인덱스 방식 의존성
  - 위치: `cafe24-api.client.spec.ts` L77, L97, L113, 등
  - 상세: 테스트가 `fetchMock.mock.calls[0][1]`로 첫 번째 호출의 두 번째 인자를 직접 인덱싱한다. 이 방식은 `beforeEach`에서 매번 `fetchMock = jest.fn()`으로 초기화하므로 테스트 간 격리는 보장되지만, 테스트 내에서 fetch가 두 번 호출되는 케이스(예: token refresh path)에서는 인덱스가 틀릴 수 있다. 새 테스트들은 모두 단일 fetch 케이스이므로 현재는 안전하다.
  - 제안: 향후 멀티-fetch 케이스 테스트 추가 시 `calls[0]` 하드코딩 대신 named assertion helper나 `toHaveBeenNthCalledWith`를 사용하도록 패턴을 정립할 것.

---

## 요약

이번 변경은 Cafe24 Admin API의 `request` 봉투 래핑이라는 wire-format 규약을 클라이언트 계층의 단일 순수 함수(`wrapInCafe24Envelope`)에 집중시킴으로써 레이어 책임 분리와 응집도 측면에서 올바른 아키텍처 결정을 따르고 있다. 핸들러와 MCP 제공자 계층은 flat body를 그대로 전달하므로 caller-side 계약은 변경되지 않았으며, 이는 개방-폐쇄 원칙 측면에서도 적합하다. 4개의 신규 테스트는 경계 케이스를 충실히 커버한다. `Cafe24ApiClient` 클래스 전체의 관심사 집중은 이미 존재하던 설계 부채이며 이번 PR에서는 악화되지 않았다. 전반적으로 아키텍처 관점의 위험 요소는 없다.

---

## 위험도

NONE

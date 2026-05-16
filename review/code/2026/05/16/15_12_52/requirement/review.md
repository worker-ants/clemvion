# 요구사항(Requirement) 코드 리뷰

## 발견사항

### 기능 완전성

- **[WARNING]** `DELETE` 메서드에 대한 테스트 커버리지 누락
  - 위치: `cafe24-api.client.spec.ts` — 새로 추가된 테스트 묶음
  - 상세: plan 문서(cafe24-request-envelope-fix.md §계획 1항)에는 "body 가 없는 DELETE 각각" 에 대한 테스트를 선작성한다고 명시되어 있으나, 실제 추가된 테스트에는 DELETE 케이스가 없다. GET 케이스(envelope 미적용 확인)는 추가됐지만, DELETE 는 body 를 허용하는 API 가 이론상 존재할 수 있고 더 중요하게는 plan 의 약속이 이행되지 않았다.
  - 제안: `'DELETE — never wraps in envelope (no body)'` 테스트를 추가하거나, plan 의 해당 항목을 명시적으로 취소/수정한다.

- **[WARNING]** `PATCH` 메서드에 대한 envelope 적용 여부 미정의
  - 위치: `cafe24-api.client.ts` `wrapInCafe24Envelope` 호출부 (line 1934)
  - 상세: 현재 조건이 `opts.body !== undefined && opts.method !== 'GET'` 이므로 `PATCH` 요청이 `Cafe24Method`에 추가된다면 자동으로 envelope 이 적용된다. `Cafe24Method` 타입은 현재 `'GET' | 'POST' | 'PUT' | 'DELETE'` 이지만, Cafe24 Admin API 는 일부 endpoint 에서 PATCH 를 사용하는 경우가 있다. envelope 적용 범위가 메서드 타입 확장 시 어떻게 될지 명세가 없다.
  - 제안: 문서 또는 주석에 "DELETE 포함 비-GET 메서드 전체에 envelope 이 적용된다"는 범위를 명시하거나, envelope 적용 조건을 allowlist (`POST` | `PUT`) 방식으로 좁혀 미래 메서드 추가 시 명시적 결정을 강제한다.

### 엣지 케이스

- **[INFO]** 빈 body 객체(`{}`) 전달 시 동작 미테스트
  - 위치: `cafe24-api.client.spec.ts`
  - 상세: `body: {}` (shop_no 도 없고 다른 필드도 없는 완전 빈 body)를 전달하면 `wrapInCafe24Envelope({})` 는 `{ request: {} }` 를 반환한다. Cafe24 API 가 이 경우에도 400 을 내지 않는지 또는 내는지에 대한 테스트가 없다. degenerate case 테스트로 `shop_no: 1` 만 있는 케이스는 있지만 shop_no 자체도 없는 경우는 다루지 않는다.
  - 제안: `body: {}` 케이스 테스트를 추가하거나, 이 경우가 실제 호출 시나리오에서 발생할 수 없음을 주석으로 명시한다.

- **[INFO]** `null` 값 필드가 body 에 포함될 때 처리
  - 위치: `wrapInCafe24Envelope` 함수
  - 상세: `body: { shop_no: null, product_name: 'x' }` 처럼 `shop_no` 가 `null` 인 경우, 현재 구현은 `shop_no !== undefined` 체크만 하므로 `envelope.shop_no = null` 이 되어 top-level 에 `null` 값의 `shop_no` 가 포함된다. Cafe24 API 가 이를 허용하는지 불명확하다.
  - 제안: `shop_no` 의 truthy 체크로 변경하거나(`if (shop_no)` 혹은 `if (shop_no !== undefined && shop_no !== null)`), 또는 현재 동작이 의도적임을 주석으로 명시한다.

### TODO/FIXME

- **[INFO]** spec 갱신이 in-progress plan 에 미완 항목으로 잔류
  - 위치: `plan/in-progress/spec-update-cafe24-request-envelope.md` 전체
  - 상세: spec 갱신(spec/conventions/cafe24-api-metadata.md 및 spec/4-nodes/4-integration/4-cafe24.md §4.1)은 project-planner 에 위임 예정이고, 본 plan 파일 자체가 `in-progress`에 있다. 구현은 완료됐으나 spec 이 코드보다 뒤처진 상태가 지속된다.
  - 제안: 특별한 차단 요인이 없다면 project-planner 에게 spec 갱신을 즉시 요청하고, 완료 후 두 plan 문서 모두 `plan/complete/`로 이동한다.

### 의도와 구현 간 괴리

- **[INFO]** plan에서 언급된 handler/provider spec 변경 없음 확인의 gap
  - 위치: `cafe24-request-envelope-fix.md` §계획 1항
  - 상세: plan 문서는 `cafe24.handler.spec.ts` 기존 테스트가 변경 없음임을 확인하겠다고 명시하지만, 변경 목록에 `cafe24.handler.spec.ts` 는 포함되지 않았다. 기존 테스트가 여전히 통과하는지는 CI 결과로 확인해야 한다.
  - 제안: CI pass 기록 또는 주석으로 "handler spec 변경 없음 검증 완료" 를 명시하면 향후 리뷰어가 불필요하게 의심하지 않는다.

### 에러 시나리오

- **[WARNING]** `wrapInCafe24Envelope` 가 이미 envelope 된 body 를 중첩 래핑하는 시나리오 미보호
  - 위치: `cafe24-api.client.ts` `wrapInCafe24Envelope` 함수
  - 상세: 호출자가 이미 `{ request: { ... } }` 형태로 래핑한 body 를 전달하면, 함수는 이를 감지하지 못하고 `{ request: { request: { ... } } }` 로 이중 래핑한다. 현재는 handler/provider 가 flat body 만 전달하므로 발생하지 않지만, 계약이 명시적으로 강제되지 않아 미래 호출자가 실수할 수 있다.
  - 제안: 입력 body 에 `request` 키가 있을 경우 경고 로그를 남기거나 에러를 throw 해 잘못된 사용을 조기에 감지하는 가드를 추가한다. 또는 JSDoc에 "caller must not pre-wrap" 을 명시한다.

### 데이터 유효성

- **[INFO]** `shop_no` 타입 검증 없음
  - 위치: `wrapInCafe24Envelope` 함수
  - 상세: `shop_no` 가 숫자여야 한다는 Cafe24 API 계약이 있지만, 함수는 `Record<string, unknown>` 을 받아 `shop_no` 값을 타입 검사 없이 그대로 top-level 에 넣는다. `shop_no: 'bad'` 같은 잘못된 값이 silently 통과한다.
  - 제안: 이 수준의 검증은 caller(handler/metadata)가 책임져야 한다면 JSDoc에 계약을 명시하고, client 레이어에서 한다면 `typeof shop_no !== 'number'` 시 warn 로그를 추가한다.

### 비즈니스 로직

- **[CRITICAL]** Cafe24 Admin API 일부 endpoint 는 `shop_no` 외에도 top-level 에 두어야 하는 필드가 있을 수 있다는 가정 검증 필요
  - 위치: `wrapInCafe24Envelope` 함수 설계
  - 상세: 현재 구현은 오직 `shop_no` 만을 top-level exception 으로 처리한다. Cafe24 API 문서(https://developers.cafe24.com/docs/ko/api/admin/)를 검토하면 대부분의 write endpoint 는 `shop_no` + `request` 패턴을 따르지만, 일부 복합 endpoint 나 특정 버전의 API 에서 다른 top-level 필드(예: `order_id`, `customer_no`)를 요구하는 경우가 있을 수 있다. 이 경우 현재 구현은 이러한 필드를 `request` 안으로 잘못 이동시켜 API 오류를 유발한다.
  - 제안: Cafe24 공식 문서에서 top-level 에 올 수 있는 필드 목록을 확인하고, 현재 `shop_no` 만이 top-level exception 임을 공식 레퍼런스 기반으로 주석에 명시한다. 불확실하다면 allowlist 방식으로 변경하되 기본값은 `shop_no` 만으로 한다.

- **[INFO]** `executeWithRateLimit` 의 body wrapping 조건에서 `'DELETE'` 메서드 처리
  - 위치: `cafe24-api.client.ts` line 1934 `opts.body !== undefined && opts.method !== 'GET'`
  - 상세: plan 문서는 "DELETE 는 path-only (body 없음) 라 envelope 영향 없음"이라고 명시하지만, 기술적으로 `DELETE` 에 body 를 전달하면 envelope 이 적용된다. 이 동작이 의도적인지 명시되어 있지 않다.
  - 제안: `DELETE` + body 조합이 지원 시나리오라면 명시하고, 아니라면 조건에 `opts.method !== 'DELETE'` 를 추가하거나 단언(assertion)을 넣는다.

### 반환값

- **[INFO]** `wrapInCafe24Envelope` 반환 타입의 표현력 부족
  - 위치: `wrapInCafe24Envelope` 함수 시그니처
  - 상세: 반환 타입이 `Record<string, unknown>` 으로 되어 있어 컴파일 시점에 `{ request: Record<string, unknown>, shop_no?: unknown }` 구조임을 보장하지 않는다. TypeScript 의 타입 안전성을 더 활용할 수 있다.
  - 제안: 반환 타입을 `{ request: Record<string, unknown>; shop_no?: unknown }` 으로 명시하면 미래 코드 변경 시 구조 깨짐을 컴파일 오류로 잡을 수 있다.

---

## 요약

이번 변경의 핵심 요구사항(Cafe24 Admin API POST/PUT 본문을 `{ shop_no?, request: { ...rest } }` 형태로 envelope 래핑)은 `wrapInCafe24Envelope` 헬퍼와 `executeWithRateLimit` 에서의 단일 호출 지점으로 올바르게 구현되었다. 토큰 갱신 경로(`/oauth/token`)가 form-urlencoded 로 별도 분리되어 있어 의도치 않은 envelope 적용 위험은 없고, GET 제외 로직도 의도에 부합한다. 다만 CRITICAL 등급으로 분류한 사항처럼 `shop_no` 가 Cafe24 API 에서 유일한 top-level exception 이라는 가정이 공식 문서로 충분히 검증되지 않은 상태이고, plan 에서 약속한 DELETE 테스트가 실제 추가되지 않았으며, 이미 envelope 된 body 가 중첩 래핑될 경우에 대한 가드가 없다는 점이 보완되어야 한다. spec 갱신은 완료되지 않아 코드와 문서 간 gap 이 남아 있고, spec-update plan 이 `in-progress` 에 잔류 중이라 후속 project-planner 위임이 빠르게 이루어져야 한다.

## 위험도

MEDIUM

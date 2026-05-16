# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `opts.body` 객체가 `wrapInCafe24Envelope` 호출 전에 구조 분해(destructuring)되지만, 원본 `opts.body` 객체는 변경되지 않음. 그러나 `executeWithRateLimit` 재귀 호출 시 동일한 `opts` 객체를 그대로 전달하므로, 429 재시도 경로에서 `wrapInCafe24Envelope`이 이미 한 번 감싼 body에 다시 적용될 가능성이 없는지 확인 필요.
  - 위치: `cafe24-api.client.ts` 라인 708 (`bodyString = JSON.stringify(wrapInCafe24Envelope(opts.body))`) 및 재시도 재귀 호출 경로
  - 상세: `executeWithRateLimit`는 429 발생 시 `this.executeWithRateLimit(integration, mallId, accessToken, opts, retries + 1)`을 재귀 호출한다. `opts.body`는 불변 참조로 전달되므로 `wrapInCafe24Envelope`이 새 객체를 반환해 이중 래핑은 발생하지 않는다. 그러나 이 안전성은 `wrapInCafe24Envelope`이 원본 `opts.body`를 mutation 하지 않는다는 전제에 의존한다. 현재 구현(`const { shop_no, ...rest } = body; return { request: rest }`)은 원본 객체를 변경하지 않으므로 실제 버그는 아니지만, 향후 `opts.body` 자체를 변환해 저장하는 식의 리팩토링 시 이중 래핑 위험이 잠재한다.
  - 제안: `wrapInCafe24Envelope`이 순수 함수(pure function)임을 JSDoc에 명시하거나, `executeWithRateLimit` 진입부에서 한 번만 직렬화된 `bodyString`을 생성해 재시도 시 재사용하도록 리팩토링하면 이 잠재적 위험을 구조적으로 제거할 수 있다.

- **[WARNING]** `integration` 객체의 in-place mutation이 여러 경로에서 발생하며, 새로 추가된 envelope 래핑 로직은 이 패턴을 더 광범위한 컨텍스트에서 노출한다.
  - 위치: `cafe24-api.client.ts` — `refreshViaQueue`, `refreshAccessToken`, `markAuthFailed` 내부 mutation; `cafe24-api.client.spec.ts` 라인 944, 1043
  - 상세: `Cafe24ApiClient.call()`은 호출자가 전달한 `integration` 객체를 직접 변경한다(`integration.status`, `integration.statusReason`, `integration.consecutiveNetworkFailures`, `integration.tokenExpiresAt` 등). 이번 변경은 `wrapInCafe24Envelope`이 `opts.body`를 mutation 하지 않아 body 측 부작용은 없으나, 기존 mutation 패턴이 스펙 파일(commit message)에서 "handler→client contract is unchanged (flat body in)"이라고 명시된 것처럼 암묵적 계약으로 고정되어 있다. 새 envelope 로직이 이 계약을 유지하고 있음은 긍정적이나, mutation 패턴 자체는 호출자가 동일 `integration` 참조를 재사용할 경우 상태 오염 위험을 내포한다.
  - 제안: 현재 변경 범위 내에서는 추가 조치 불필요. 다만 `integration` 객체 mutation 패턴을 장기적으로는 반환값 기반(immutable) 설계로 전환하는 것을 별도 개선 항목으로 검토할 것.

- **[INFO]** `DELETE` 메서드에 대한 envelope 적용 여부가 명시되지 않았다.
  - 위치: `cafe24-api.client.ts` 라인 708, `wrapInCafe24Envelope` 함수
  - 상세: 현재 로직은 `opts.body !== undefined && opts.method !== 'GET'` 조건 하에 envelope을 적용한다. 즉 `DELETE` 메서드도 body가 있으면 envelope으로 감싸게 된다. Cafe24 Admin API의 DELETE 엔드포인트가 `request` envelope을 요구하는지 여부가 명세 또는 테스트에 문서화되어 있지 않다. 현재 `Cafe24Method` 타입에 `'DELETE'`가 포함되어 있으나 신규 테스트 케이스는 GET/POST/PUT만 커버한다.
  - 제안: Cafe24 Admin API 문서에서 DELETE + body 조합의 envelope 요구 여부를 확인하고, 필요 시 `DELETE` 케이스를 테스트에 추가하거나 코드 주석으로 명시할 것.

- **[INFO]** `process.env.CAFE24_CLIENT_ID` / `CAFE24_CLIENT_SECRET` 환경 변수 읽기가 테스트 내에서 설정·해제되나, 이는 신규 코드가 아닌 기존 token refresh 경로의 동작이다.
  - 위치: `cafe24-api.client.spec.ts` 라인 673–674, 734–735 등 (기존 코드)
  - 상세: 이번 변경과 직접 관련은 없지만, 환경 변수를 테스트 내에서 직접 변경하는 패턴이 병렬 테스트 실행 시 경쟁 조건을 유발할 수 있다. 신규 envelope 관련 테스트 케이스는 환경 변수에 의존하지 않으므로 이 위험에 노출되지 않는다.
  - 제안: 기존 환경 변수 의존 테스트는 Jest `isolatedModules` 또는 환경 변수 mock 라이브러리로 격리할 것을 별도 개선 항목으로 검토.

- **[INFO]** `wrapInCafe24Envelope`은 모듈-레벨 순수 함수로 추가되었으며 전역 상태, 파일시스템, 네트워크, 이벤트 발생 등 어떠한 부작용도 없다. `integrationLocks` Map은 기존 전역 변수이며 이번 변경에서 수정되지 않았다.
  - 위치: `cafe24-api.client.ts` 라인 1209–1216
  - 상세: 신규 함수는 입력을 구조 분해해 새 객체를 반환하는 단순 변환이다. 원본 `body` 객체에 대한 mutation 없음, 외부 상태 참조 없음.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 `Cafe24ApiClient.executeWithRateLimit` 내부에서 POST/PUT body를 Cafe24 `request` envelope으로 중앙화 래핑하는 단일 목적 수정이다. 부작용 관점에서 핵심 위험은 두 가지다. 첫째, `executeWithRateLimit`가 429 재시도 시 동일 `opts` 객체를 재귀 전달하므로 `wrapInCafe24Envelope`이 재호출되는데, 현재 구현은 원본을 변경하지 않는 순수 함수이므로 이중 래핑이 발생하지 않는다. 그러나 이 안전성은 함수 계약상 명시적으로 보장되지 않아 향후 리팩토링 시 잠재적 함정이 될 수 있다. 둘째, `integration` 객체 in-place mutation 패턴이 이번 변경으로 확대되지는 않았으나, envelope body 계약("flat body in")과의 일관성이 유지되었음을 명시적으로 확인해야 한다. `DELETE` 메서드의 envelope 적용 범위가 문서화되지 않은 점은 잠재적 API 계약 불일치 위험이다. 전반적으로 신규 코드가 전역 상태·파일시스템·환경 변수·네트워크·이벤트 등에 미치는 의도치 않은 부작용은 없으며, 공개 인터페이스(`Cafe24CallOptions`, `Cafe24CallResult`, `call()` 시그니처)도 변경되지 않았다.

## 위험도

LOW

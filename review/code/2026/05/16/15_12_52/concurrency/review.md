### 발견사항

변경된 코드는 두 파일로 구성됩니다.

1. `cafe24-api.client.ts` — `wrapInCafe24Envelope` 순수 함수 추가 + `executeWithRateLimit` 내부에서 호출
2. `cafe24-api.client.spec.ts` — 위 변경을 검증하는 테스트 케이스 4개 추가

---

- **[INFO]** `wrapInCafe24Envelope` 는 순수 함수로, 공유 상태를 전혀 건드리지 않음
  - 위치: `cafe24-api.client.ts` — 새로 추가된 `wrapInCafe24Envelope` 함수 (라인 +1212~+1219)
  - 상세: 입력 `body` 객체를 구조 분해(`{ shop_no, ...rest }`)한 뒤 새 객체를 반환하는 순수 변환이다. 뮤테이션 없음, 클로저 캡처 없음, 전역/공유 변수 없음. 동시성 위험 없음.
  - 제안: 없음 (현재 구현 적절)

- **[INFO]** 호출 지점(`executeWithRateLimit`)은 기존 in-process mutex(`withIntegrationLock`) 범위 내에 있음
  - 위치: `cafe24-api.client.ts` 라인 +1190 (`bodyString = JSON.stringify(wrapInCafe24Envelope(opts.body))`)
  - 상세: `executeWithRateLimit`는 이미 per-integration 뮤텍스로 직렬화되어 있다고 클래스 JSDoc에 명시되어 있으며(`Serialise concurrent calls per Integration via an in-process mutex`), 새 `wrapInCafe24Envelope` 호출은 그 범위 안에서 동기적으로 실행된다. 추가적인 동기화가 필요하지 않다.
  - 제안: 없음

- **[INFO]** 테스트 격리 — `beforeEach`에서 `__resetCafe24LocksForTesting()` 호출로 in-process 뮤텍스 상태를 초기화
  - 위치: `cafe24-api.client.spec.ts` 라인 219
  - 상세: 새로 추가된 테스트들(PUT/POST envelope 케이스)은 각각 독립적인 `fetchMock`과 새 `makeIntegration()` 인스턴스를 사용하며, `beforeEach`의 `__resetCafe24LocksForTesting()`으로 lock 상태가 초기화된다. 테스트 간 상태 오염 없음.
  - 제안: 없음

---

새로 추가된 코드 변경의 동시성 영향 범위는 극히 제한적이다. `wrapInCafe24Envelope`는 순수 동기 함수이며, 기존 동시성 제어 구조(in-process mutex, BullMQ queue-backed refresh)에 어떠한 수정도 가하지 않는다. async/await 패턴, 이벤트 루프, 리소스 풀링 모두 이번 diff와 무관하다. 테스트 코드 역시 Jest의 단일 스레드 실행 모델 안에서 mock을 사용하므로 경쟁 조건이 발생할 구조적 경로가 없다.

### 요약

이번 변경(POST/PUT body를 Cafe24 `request` envelope으로 래핑)은 `executeWithRateLimit` 내부의 JSON 직렬화 직전에 순수 변환 함수 `wrapInCafe24Envelope`를 삽입하는 것이 전부다. 해당 함수는 공유 상태를 읽거나 쓰지 않으며, 이미 per-integration in-process mutex로 보호된 실행 경로 안에서 동기적으로 호출된다. async/await 누락, 경쟁 조건, 데드락, 원자성 훼손, 이벤트 루프 블로킹 등 동시성 관련 문제는 발견되지 않았다. 테스트 역시 `beforeEach`의 lock reset과 각 케이스별 독립적인 mock 설정으로 상태 오염 없이 격리되어 있다.

### 위험도

NONE

# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** `PublicIntegration` 타입의 새 export — 기존 소비자에 대한 영향 없음
  - 위치: `integrations.service.ts` — `export type PublicIntegration = ...`; `integrations.service.spec.ts` — `import { type PublicIntegration }`
  - 상세: `PublicIntegration`은 이미 서비스 내부에서 사용되고 있던 타입이며, 이번 변경에서 테스트 파일이 이를 `import { type PublicIntegration }` 형태로 참조하게 되었다. 타입 전용 import (`type` 키워드)이므로 런타임 부작용이 전혀 없다. 기존에 해당 타입을 import하는 다른 소비자가 있다면 이미 export되어 있었을 것이므로 새 인터페이스 변경으로 볼 수 없다.
  - 제안: 현행 유지. 타입 전용 export/import는 런타임 측면에서 완전히 무해하다.

- **[INFO]** `create()` 내부 제어 흐름 분리 — 동일 공개 시그니처, 내부 동작 변경
  - 위치: `integrations.service.ts` — `create()` 메서드, 라인 538-144 (diff 기준)
  - 상세: 기존에는 `save()`와 `auditLogsService.record()`가 단일 try/catch 블록 안에 있었다. 이번 변경으로 두 연산이 별도 try/catch로 분리되어 audit 실패가 `saved` 변수 참조 전에 swallow된다. `create()`의 공개 시그니처(`Promise<PublicIntegration>`)는 변경되지 않았으며, 호출자가 관찰하는 반환값도 동일하다. 그러나 내부 상태 전이가 달라졌다: 이전에는 audit 실패 시 `UniqueConstraintViolation` 외의 모든 에러가 호출자에게 throw되었는데, 이제는 audit 실패가 warn 로그만 남기고 정상 반환된다. 이는 의도된 변경(best-effort 정책)이며 주석에 명시되어 있다.
  - 제안: 의도가 명확히 문서화되어 있으므로 현행 유지. 다만 `AuditLogsService.record()`가 이미 내부적으로 swallow한다면 이 외부 try/catch는 방어적 중복이다 — 이중 방어선이므로 보수적으로 바람직하다.

- **[INFO]** `saved` 변수의 초기화 보장 — 잠재적 uninitialized 접근 없음
  - 위치: `integrations.service.ts` — `let saved: Integration;` 선언 후 audit 블록 내 `saved.id` 참조
  - 상세: `saved`는 첫 번째 try/catch 블록에서 반드시 assign되거나 throw되므로, 두 번째 try 블록 진입 시점에는 항상 초기화되어 있다. TypeScript 컴파일러도 이를 정적으로 추론할 수 있다. 런타임 부작용 없음.
  - 제안: 현행 유지.

- **[INFO]** `advanceDebounce()` 헬퍼 함수 도입 — 전역 타이머 상태에 대한 반복 조작 패턴 통합
  - 위치: `cafe24-precheck.test.tsx` — `const DEBOUNCE_ADVANCE_MS = 360; async function advanceDebounce()`
  - 상세: 기존에 각 테스트 케이스마다 직접 인라인으로 `await act(async () => { vi.advanceTimersByTime(360); })` 를 작성하던 패턴을 단일 헬퍼로 통합하였다. `vi.advanceTimersByTime()`은 fake timer 전역 상태를 조작하는 부작용을 가지며, `beforeEach`의 `vi.useFakeTimers()`와 `afterEach`의 `vi.useRealTimers()`로 적절히 격리되어 있다. 헬퍼 자체는 새로운 전역 상태를 도입하지 않으며, 기존 패턴을 중앙화한 것이다.
  - 제안: 현행 유지. `DEBOUNCE_ADVANCE_MS` 상수가 page.tsx의 실제 debounce 값(350ms)과 분리되어 관리되는 점은 추후 page.tsx의 debounce 값이 변경될 때 동기화 누락 위험이 있다. 가능하다면 상수를 공유 모듈에서 import하는 방향을 고려할 수 있으나, 테스트 격리 원칙상 현행도 수용 가능하다.

- **[INFO]** `mockPush`, `mockReplace`, `currentSearchParams` — 모듈 수준 변수 (테스트 파일 전역 상태)
  - 위치: `cafe24-precheck.test.tsx` — `let currentSearchParams = new URLSearchParams();`
  - 상세: `currentSearchParams`는 모듈 수준 `let` 변수로, `beforeEach`에서 매 테스트마다 재할당된다. 이번 diff에서 해당 변수 자체가 변경된 것은 아니다. `advanceDebounce()` 도입은 이 전역 상태 관리 방식에 영향을 주지 않는다. 기존부터 존재하던 패턴이며, 현재 변경의 부작용이 아니다.
  - 제안: 현행 유지.

## 요약

이번 변경의 핵심은 두 가지다: (1) `integrations.service.ts`의 `create()` 메서드에서 `save()`와 `auditLogsService.record()` 호출을 별도 try/catch로 분리하여 audit 실패를 best-effort로 처리하는 것, (2) 테스트 파일에서 반복되던 debounce 조작 인라인 코드를 `advanceDebounce()` 헬퍼로 추출하는 것. 공개 API 시그니처(`create()` 반환 타입, HTTP 응답 형태)는 변경되지 않았으며, 내부 제어 흐름의 변화는 의도적이고 주석으로 충분히 문서화되어 있다. `PublicIntegration` 타입의 테스트 파일 import는 타입 전용이므로 런타임 부작용이 없다. 의도하지 않은 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 네트워크 호출 변경, 이벤트/콜백 변경은 없다. 전반적으로 부작용 관점에서 위험 요소가 없는 변경이다.

## 위험도

NONE

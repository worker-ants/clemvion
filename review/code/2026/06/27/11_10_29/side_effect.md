# 부작용(Side Effect) 리뷰

대상:
- `/codebase/packages/web-chat-sdk/src/loader.ts`
- `/codebase/packages/web-chat-sdk/src/loader.spec.ts`

---

## 발견사항

### 1. WARNING — boot 재호출 시 `shutdown()` 예외가 새 인스턴스 생성을 막는 stuck state

- 위치: `loader.ts` `case "boot":` (52-58행)
- 상세: `instance?.shutdown()` 이 예외를 던지면 이후 `instance = bootFn(args[0] as BootConfig)` 가 실행되지 않는다. 이 경우 클로저 내 `instance` 는 여전히 이전(고장난) 인스턴스를 참조하며, 이후 재호출 시마다 동일한 `shutdown()` 예외가 반복되어 `boot` 가 영구히 실패하는 stuck state 가 된다. 새 instance 로 복구하는 방법이 없다.
- 제안: `instance?.shutdown()` 을 try-catch 로 감싼 뒤 실패해도 `instance = null` 로 초기화한 후 `bootFn` 을 호출한다.

```typescript
case "boot":
  try { instance?.shutdown(); } catch { /* 정리 실패 무시 */ }
  instance = null;
  instance = bootFn(args[0] as BootConfig);
  return instance;
```

---

### 2. WARNING — `off(event)` 호출 시 `undefined` 두 번째 인자 전달

- 위치: `loader.ts` `case "off":` (84-90행)
- 상세: `cb` 가 함수가 아닐 때 `instance?.off(event, undefined)` 를 호출한다. `ChatInstance.off` 의 타입 시그니처가 두 번째 인자를 optional 로 선언하더라도, 런타임 구현이 `undefined` 를 "모든 핸들러 해제" 로 처리하지 않고 `undefined` 리스너를 탐색하려 하면 의도치 않은 동작(전체 해제 누락 또는 런타임 오류)이 발생한다. 현재 spec/구현을 검토하지 않고는 안전 여부를 보장하기 어렵다.
- 제안: `ChatInstance.off` 가 `undefined` 두 번째 인자를 "전체 해제" 로 명시적으로 처리함을 확인하거나, 오버로드를 나누어 `cb` 생략 시 단항 호출(`instance?.off(event)`)로 분기한다.

---

### 3. WARNING — 테스트 "data-global" 내 cleanup 이 afterEach 가 아닌 테스트 바디에 위치

- 위치: `loader.spec.ts` 332-345행 ("data-global: 커스텀 전역명에 설치" it 블록)
- 상세: `delete w.SupportChat` 이 테스트 바디 끝에 있어, 테스트 중간 assertion 이 실패하면 `window.SupportChat` 이 남아 이후 테스트를 오염시킬 수 있다. `afterEach` 는 `ClemvionChat` 만 정리하므로 커스텀 전역명은 보호받지 못한다.
- 제안: `describe` 블록 레벨 `afterEach` 에 커스텀 전역명을 추가하거나, `try/finally` 패턴으로 cleanup 을 보장한다.

---

### 4. INFO — 점유 가드 분리 인스턴스 반환이 호출자에게 설치 실패를 알리지 않음

- 위치: `loader.ts` `installGlobal` 118-124행
- 상세: 비-함수 전역이 `window[globalName]` 을 점유 중일 때 `console.warn` 후 window 에 설치되지 않은 분리 인스턴스를 반환한다. 반환 타입은 `GlobalApi` 로 동일해 호출자가 "설치 성공"과 "분리 인스턴스"를 구별할 방법이 없다. `loader.js` 진입점이 반환값을 폐기한다면 문제없으나, 반환값을 신뢰하는 코드가 생기면 버그로 이어질 수 있다.
- 제안: 반환 타입에 `{ installed: boolean }` 메타를 추가하거나, 설치 실패 시 `null` 을 반환하는 명시적 시그니처를 고려한다. 최소한 TSDoc 에 "점유 가드 시 분리 인스턴스 반환(window 미수정)" 을 명시한다.

---

### 5. INFO — `Array.from` 호출 시 `length` 가 큰 sparse array 생성 가능성

- 위치: `loader.ts` 143행 `Array.from(raw as ArrayLike<unknown>)`
- 상세: `length <= 32` 가드로 최대 크기를 제한하므로 메모리 문제는 없다. 그러나 큐 항목의 인덱스가 불연속적인 경우(예: `{ 0: "boot", 2: "extra", length: 3 }`) sparse array 가 생성되어 중간 인덱스가 `undefined` 가 된다. `args[0]` 이 문자열인지 확인하므로 메서드 이름은 안전하지만, 추가 인자가 `undefined` 로 채워져 dispatch 에 전달된다.
- 제안: 정상 스니펫 스텁(`push(arguments)`)이 생성하는 arguments 객체는 항상 연속 인덱스이므로 실제 위험은 낮다. 이상 입력에 대한 경계 조건으로만 기록한다.

---

## 요약

이번 변경의 핵심은 `installGlobal` 의 array-like 큐 항목 replay 정규화(`Array.isArray` → `length` + `Array.from`)와 `data-global` 전역명 지원, 그리고 그에 대응하는 테스트 추가다. 전역 window 변경은 의도된 부작용이며 중복 로드·점유 가드로 적절히 통제된다. 가장 주목할 부작용 위험은 `boot` 재호출 시 이전 `instance.shutdown()` 예외가 새 인스턴스 생성을 차단하여 복구 불가 stuck state 를 만드는 점이다. 테스트 격리 면에서는 커스텀 전역명의 afterEach 미정리가 잠재적 오염원이다. 나머지는 INFO 수준의 설계 명확성 개선 사항이다.

---

## 위험도

LOW

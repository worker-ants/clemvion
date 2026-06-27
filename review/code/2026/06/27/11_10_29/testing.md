# Testing Review

## 발견사항

### 발견사항 1
- **[WARNING]** 큐 replay 방어 가드 분기 미테스트 — 5개 조건이 코드에 존재하지만 어떤 테스트도 해당 경로를 통과하지 않음
  - 위치: `loader.ts` 134–144행 (replay 루프 내 malformed 가드), `loader.spec.ts` 전체
  - 상세: `installGlobal` 의 replay 루프는 다음 5가지 조건으로 항목을 건너뜀:
    1. `typeof raw !== "object"` (원시값 큐 항목)
    2. `raw === null`
    3. `typeof (raw as ArrayLike).length !== "number"` (length 프로퍼티 없음)
    4. `!Number.isFinite(length)` (Infinity / NaN length)
    5. `length > 32` (과도하게 긴 arguments)
    6. `typeof args[0] !== "string"` (첫 요소가 메서드명이 아닌 경우)
    현재 테스트는 정상 array-like(bootArgs/openArgs)와 정상 Array만 커버한다. 이 가드들이 삭제되거나 잘못 수정되어도 회귀 테스트로 탐지할 수 없다. 특히 `length > 32` 가드는 의도적인 보안 경계선인데 이를 검증하는 테스트가 없다.
  - 제안: 다음 케이스를 `installGlobal — 큐 스텁 replay` describe 에 추가:
    ```typescript
    it("큐 항목이 null/원시값이면 skip 후 후속 항목 계속 실행", () => { ... });
    it("length > 32 인 항목은 skip", () => { ... });
    it("첫 요소가 문자열이 아닌 항목은 skip", () => { ... });
    ```
    각 케이스에서 스킵된 항목 뒤의 정상 항목이 실행됨을 `inst.calls` 로 확인.

### 발견사항 2
- **[WARNING]** 커스텀 전역명 테스트의 cleanup 이 `afterEach` 밖에 위치 — 테스트 실패 시 전역 오염
  - 위치: `loader.spec.ts` 332–345행 (`data-global: 커스텀 전역명에 설치` 테스트)
  - 상세: `delete w.SupportChat` 가 테스트 본문 마지막에 인라인으로 배치됨. 중간에 assertion 실패나 예외가 발생하면 cleanup 이 실행되지 않아 `window.SupportChat` 이 후속 테스트에 누출된다. 현재는 다른 테스트가 `SupportChat` 을 참조하지 않아 실질 영향은 없으나, 격리 원칙에 위배.
  - 제안: `afterEach` 에 `delete (window as unknown as Record<string, unknown>).SupportChat` 추가, 또는 해당 describe 블록 안에 별도 `afterEach` 배치.

### 발견사항 3
- **[INFO]** `sendMessage` / `updateProfile` 의 null·undefined args fallback 미테스트
  - 위치: `loader.ts` 72행(`String(args[0] ?? "")`), 74행(`?? {}`); `loader.spec.ts` 전체
  - 상세: `sendMessage` 는 args[0] 이 null/undefined 일 때 빈 문자열 `""` 을 전달하고, `updateProfile` 은 null/undefined 일 때 `{}` 를 전달한다. 이 fallback 동작은 현재 `fakeInstance.sendMessage` 가 `send:${t}` 형태로 기록하므로 쉽게 검증 가능하다.
  - 제안:
    ```typescript
    it("sendMessage: args[0] 생략 시 빈 문자열 전달", () => {
      api("boot", ...);
      api("sendMessage"); // args[0] = undefined
      expect(inst.calls).toContain("send:");
    });
    ```

### 발견사항 4
- **[INFO]** `q` 프로퍼티가 없는 큐 스텁(함수만 설치된 경우) 테스트 미존재
  - 위치: `loader.ts` 128행 (`Array.isArray(existing?.q) ? existing!.q! : []`); `loader.spec.ts` 전체
  - 상세: `q` 프로퍼티가 없거나 배열이 아닌 큐 스텁 함수가 `window.ClemvionChat` 에 존재할 때 빈 큐로 설치를 진행하는 분기가 테스트되지 않음. 현재 `스니펫 미실행` 테스트는 `window.ClemvionChat` 자체가 없는 경우를 커버하지만, 스텁 함수가 있되 `q` 가 없는 경우는 다른 코드 경로다.
  - 제안:
    ```typescript
    it("큐 스텁 함수가 있되 q 없으면 빈 큐로 설치", () => {
      (window as unknown as Record<string, unknown>).ClemvionChat = () => {};
      // q 없음
      const api = installGlobal(window, () => inst);
      expect(typeof api).toBe("function");
    });
    ```

### 발견사항 5
- **[INFO]** `boot` 호출의 반환값 검증 없음
  - 위치: `loader.ts` 57–58행; `loader.spec.ts` 196–203행
  - 상세: `api("boot", config)` 는 `ChatInstance` 를 반환하지만 모든 테스트에서 반환값을 무시한다. 공개 API 명세상 boot 의 반환값은 구현 세부사항에 가깝지만, 타입 계약상 반환이 명시되어 있으므로 최소 1개 케이스에서 검증 추가를 고려.
  - 제안: 기존 boot 테스트에 `const result = api("boot", ...); expect(result).toBe(inst);` 추가.

### 발견사항 6
- **[INFO]** `on` 반환값(Unsubscribe) 미검증
  - 위치: `loader.ts` 81행 (`return instance?.on(...)`); `loader.spec.ts` 전체
  - 상세: `on` 은 구독 해제 함수(`Unsubscribe`)를 반환한다. `fakeInstance.on` 은 `() => void calls.push("unsub")` 를 반환하도록 구현됐으나, 이 반환값을 받아 호출하는 테스트가 없다. Unsubscribe 연결이 끊어져도 현재 테스트로는 탐지 불가.
  - 제안:
    ```typescript
    it("on 반환값(unsub) 호출 시 핸들러 해제 기록", () => {
      api("boot", ...);
      const unsub = api("on", "message", () => {}) as () => void;
      unsub();
      expect(inst.calls).toContain("unsub");
    });
    ```

---

## 요약

전체적으로 테스트 커버리지는 양호하다. `createGlobalApi` 의 모든 공개 메서드 분기(boot·shutdown·open·close·show·hide·sendMessage·updateProfile·on·off·default)가 테스트됐고, `installGlobal` 의 중복 설치 가드·점유 가드·커스텀 전역명·빈 큐 경로도 커버된다. 특히 이번 PR의 핵심인 `push(arguments)` array-like 재현 회귀 테스트(#709)는 과거 버그 조건을 명확히 기록하며 설득력 있다. 가장 유의미한 갭은 replay 루프 내 malformed 항목 가드 분기들이 전혀 테스트되지 않는다는 점이다. 이 가드들은 이번 변경에서 새로 도입된 코드(array-like 처리 + 보안 경계 `length > 32`)이므로, 최소한 null·원시값·length 초과 케이스에 대한 테스트를 보완해야 향후 수정 시 안전망이 확보된다. 커스텀 전역명 cleanup 의 격리 취약점은 현재 실해는 없으나 `afterEach` 로 이전을 권장한다.

## 위험도

LOW

# 요구사항(Requirement) Review

대상: `codebase/packages/web-chat-sdk/src/loader.ts` + `loader.spec.ts`
관련 spec: `spec/7-channel-web-chat/2-sdk.md`

---

## 발견사항

### **[WARNING]** spec §1 `off` 스니펫 형태 불일치 — 객체 형태 미구현
- **위치**: `loader.ts` L87–91 (`case "off"`)
- **상세**: spec §1 은 `off` 의 스니펫 전역 큐 형태를 **`ClemvionChat('off', { event, cb })`** — 단일 객체 payload — 로 명시한다("스니펫 전역 큐 형태 `ClemvionChat('off', { event, cb })` 도 동일"). 그러나 구현은 **위치 인자(positional args)** `ClemvionChat('off', eventName, cb?)` 만 처리한다. 객체 형태로 호출하면 `args[0]` 가 `{ event, cb }` 객체가 되어 `instance.off({ event, cb } as WidgetEvent, undefined)` 로 잘못 위임된다.
- **판단 방향**: `on` 을 포함한 모든 다른 메서드가 위치 인자를 사용하는 점, `on` 의 스니펫 형태가 `ClemvionChat('on', 'message', cb)` 로 일관성 있게 구현된 점을 보면 위치 인자 방식이 의도적으로 선택된 설계이고 spec 의 객체 형태 언급이 부정확한 기술일 가능성이 높다. 그러나 spec 이 명시적으로 해당 형태를 "동일" 기능으로 선언하므로, 단순 SPEC-DRIFT 단정보다 사람이 방향을 확정해야 한다. spec §1 의 `ClemvionChat('off', { event, cb })` 문구를 `ClemvionChat('off', event, cb?)` 로 정정하거나(spec fix), 아니면 객체 형태를 추가로 지원해야 한다(code fix).
- **제안**: project-planner 에 spec §1 해당 문구 검토·정정 위임. 객체 형태를 지원하려면 `args[0]` 가 객체인 경우 `{ event, cb }` 로 언패킹하는 분기를 추가해야 한다.

---

### **[INFO] [SPEC-DRIFT]** 큐 항목 길이 상한(32) 미명세
- **위치**: `loader.ts` L140: `(raw as ArrayLike<unknown>).length > 32`
- **상세**: 큐 항목의 인자 수를 32 로 제한하는 가드가 있다. 합리적인 방어적 구현이나 `spec/7-channel-web-chat/2-sdk.md` 어디에도 이 제약이 명시되지 않는다.
- **제안**: 코드 유지 + spec §1 또는 §R5 에 "큐 항목 인자 수는 32 를 초과하면 형식 불량으로 skip" 문구 추가. 대상 spec 위치: `spec/7-channel-web-chat/2-sdk.md §R5` 또는 §1 명령 큐 패턴 설명.

---

### **[INFO]** `QueueStub.q` 타입 정밀도 — 런타임 원소가 `GlobalCall[]` 아님
- **위치**: `loader.ts` L44: `q?: GlobalCall[]`
- **상세**: `GlobalCall` 은 진짜 `Array` 인데 실제 큐 원소는 `push(arguments)` 산출물인 `arguments` array-like 객체다. 타입은 거짓 정밀도를 제공한다. 주석(L36–38)이 설명하지만, TypeScript 타입 자체가 `ArrayLike<unknown>` 또는 `(GlobalCall | IArguments)[]` 에 더 가깝다.
- **제안**: 필요 시 `q?: (GlobalCall | ArrayLike<unknown>)[]` 로 수정하거나 주석 경고를 타입 레벨로 명시. 현재는 내부 구현 세부사항이며 공개 API 표면이 아니므로 낮은 우선순위.

---

### **[INFO]** `on()` 반환값(Unsubscribe 함수) 테스트 미검증
- **위치**: `loader.spec.ts` L213–222 ("모든 instance 메서드 위임" 케이스)
- **상세**: spec §5 는 `on()` 이 `Unsubscribe` 함수를 반환한다고 명시한다. `createGlobalApi` 의 `return instance?.on(...)` 은 이를 올바르게 전파하지만, 테스트에서 반환값이 호출 가능한 함수인지, 실제 구독을 해제하는지 검증하지 않는다. `fakeInstance`의 `on()` 은 unsubscribe 함수를 반환하도록 구현돼 있어 검증 기반은 있다.
- **제안**: `const unsub = api("on", "message", cb); expect(typeof unsub).toBe("function");` 또는 `unsub()` 호출 후 `inst.calls`에 `"unsub"` 포함 여부 검증 테스트 추가 권장.

---

### **[INFO]** `sendMessage` 빈 문자열 허용
- **위치**: `loader.ts` L73: `instance?.sendMessage(String(args[0] ?? ""))`
- **상세**: `args[0]` 가 `null`/`undefined` 이면 빈 문자열 `""` 을 전송한다. spec §1·§5 는 `sendMessage(text: string)` 을 정의하나 빈 문자열의 유효성은 명시하지 않는다. 빈 메시지가 허용된다면 현재 구현이 맞다. 허용되지 않는다면 빈 문자열 가드가 필요하다.
- **제안**: spec 에 빈 문자열 처리 명시가 없으므로 현 구현 유지 가능. 필요 시 위젯 SPA(1-widget-app) 레이어에서 처리.

---

## 기능 완전성 평가

**핵심 수정(array-like `arguments` 객체 큐 replay)**: 완전히 구현됨. 스텁의 `push(arguments)` 가 생성하는 array-like 객체를 `length` 기반 가드 후 `Array.from` 으로 정규화하는 로직이 정확하다. 과거 `Array.isArray` 필터가 `arguments` 객체를 통째로 버려 `boot` 누락을 야기했던 버그(#709 이후 갭)가 수정됐다.

spec §1 명세 메서드 (`boot`/`shutdown`/`show`/`hide`/`open`/`close`/`sendMessage`/`updateProfile`/`on`/`off`) 전부 구현됐다. 전역명 충돌 방지(`data-global`), 중복 설치 가드(`__wcInstalled`), 점유 가드(비-함수 전역 보존), boot 재호출 시 이전 인스턴스 정리, 큐 예외 흡수 후 계속 실행 — 모두 spec §1·§R5 와 일치한다. `ChatInstance` 타입 계약(spec §5)과 `types.ts` 구현도 일치한다.

TODO/FIXME/HACK 주석 없음.

---

## 요약

loader.ts 와 loader.spec.ts 는 핵심 요구사항(array-like `arguments` 객체를 replay 루프에서 정규화)을 올바르게 구현하고, spec §1·§5 의 전역 API 메서드·충돌 가드·큐 재생 흐름과 전반적으로 일치한다. 주요 미결 사항은 spec §1 의 `ClemvionChat('off', { event, cb })` 형태(객체 payload)가 구현의 위치 인자 방식과 충돌한다는 점이다 — 이 문구가 spec 의 기술 오류인지, 의도된 추가 지원 형태인지 project-planner 확인이 필요하다. 나머지 발견사항은 INFO 수준이며 기능 동작을 차단하지 않는다.

---

## 위험도

**LOW** (WARNING 1건: `off` 스니펫 형태 spec/코드 불일치 — 방향 확정 후 둘 중 하나 수정 필요. INFO 4건: 차단 없음)

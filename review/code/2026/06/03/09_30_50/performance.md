# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `buildHelpers()`가 매 execute() 호출마다 새 객체를 생성
  - 위치: `/codebase/backend/src/nodes/data/code/code.handler.ts` line 23-38, buildSandbox() line 79에서 호출
  - 상세: `buildHelpers()`는 `{ date, crypto: { hash, uuid }, base64: { encode, decode } }` 구조의 새 객체와 내부 중첩 객체를 매번 allocation한다. 클로저 내 참조(`createHash`, `randomUUID`, `Buffer`, `dayjs`)는 불변이며 실행마다 달라지지 않는다. sandbox에 주입되는 `$helpers` 객체 자체는 vm context 격리 목적상 매번 새로 전달해야 하지만, 클로저 함수들을 담는 외부 객체 구조를 미리 정의해 두고 재사용하는 것이 가능하다.
  - 제안: `buildHelpers()`의 반환값을 모듈 레벨 상수(`const SHARED_HELPERS = { ... }`)로 끌어올려 재사용한다. `vm.createContext(sandbox)`는 sandbox 객체를 freezing/proxying하지 않으므로 동일한 helpers 참조를 여러 sandbox에 주입해도 안전하다. 단, sandbox 코드가 `$helpers`를 통해 host realm 상태를 변경하는 경우(현재는 없음)가 생기면 이 최적화를 재검토해야 한다.

- **[WARNING]** `validate()` 내 `vm.Script` 중복 컴파일 — execute()에서 재컴파일
  - 위치: `code.handler.ts` line 149-155 (validate), line 188-193 (execute)
  - 상세: engine 정상 경로(validate → execute)에서 동일한 code string에 대해 `new vm.Script(wrapUserCode(code))` 가 두 번 호출된다. VM Script 컴파일은 V8 코드 파싱·바이트코드 생성을 포함하며, 짧은 코드라도 cold path에서 수백 µs, 복잡한 코드에서는 수 ms가 소요될 수 있다.
  - 제안: 이 변경 범위에서 직접 수정하기는 아키텍처 결정이 필요하다. 단기적으로는 `execute()` 내 재컴파일을 그대로 두되, 중장기적으로 validate()에서 컴파일된 `vm.Script`를 context 캐시(`nodeOutputCache` 또는 별도 WeakMap keyed on code string)에 보관하고 execute()에서 재사용하는 방안을 고려할 수 있다. 단, code가 `{{ }}` 템플릿 치환 후 달라질 수 있으므로 cache key는 치환 후 최종 code string이어야 한다.

- **[INFO]** `deepClone(context.variables)` — JSON 직렬화/역직렬화 비용
  - 위치: `code.handler.ts` line 170
  - 상세: `JSON.parse(JSON.stringify(value))`는 variables 객체가 클 때 O(n) 직렬화 비용이 있으며 `Date`, `undefined`, `Map/Set` 같은 JSON-비직렬화 타입을 소리 없이 손실한다. 현재 구현에서 이는 의도적인 설계(sandbox 격리)이나, workflow에서 variables가 대용량 배열/객체로 누적되는 시나리오에서는 execute() 호출당 눈에 띄는 지연 원인이 된다.
  - 제안: variables 크기 상한을 spec 레벨에서 문서화하거나, 필요 시 structured clone(`structuredClone()`)으로 교체하면 Date 등 타입을 보존하면서 native 구현으로 성능도 유사하거나 개선된다.

- **[INFO]** `Promise.race` 타임아웃 패턴에서 타이머가 GC 전까지 살아있는 구간
  - 위치: `code.handler.ts` line 218-228
  - 상세: `timeoutHandle`은 `finally`에서 `clearTimeout`으로 정리되므로 누수는 없다. 그러나 async code 경로에서 `runPromise`가 정상 완료되어도 setTimeout callback이 실행되기 전까지(최대 timeoutMs) 타이머가 event loop에 남아있다. 이는 `finally` 블록이 clearTimeout을 올바르게 처리하므로 실제로는 문제 없지만, Node.js 프로세스 종료 시 pending timer가 있으면 graceful shutdown이 지연될 수 있다.
  - 제안: 현재 구현은 이미 올바르다. 별도 조치 불필요.

- **[INFO]** `buildSandbox` 객체 리터럴 크기 — 매 실행마다 ~30개 키 allocation
  - 위치: `code.handler.ts` line 74-125
  - 상세: sandbox 객체는 `$input`, `$vars`, `$execution`, `$node`, `$helpers`, `console`, `JSON`, `Math`, ... 등 ~30개 키를 가진다. `undefined` 값 키들(Reflect, Proxy, globalThis 등 ~13개)도 명시적으로 포함되어 있다. 이는 vm context 격리에 필수적이나, 매 execute()마다 동일한 구조가 재생성된다.
  - 제안: undefined shadowing 키들을 Object.assign으로 분리하거나 공유 상수로 관리할 수 있으나, 보안 계약상 각 sandbox가 독립 객체여야 하므로 현 패턴이 적절하다. 성능 민감 환경이라면 Object.create(null)에 key를 수동 assign하는 방식이 미세하게 빠를 수 있으나 가독성 손실 대비 효과가 미미하다.

## 요약

이번 변경의 주요 성능 영향은 `buildHelpers()`가 execute() 호출 경로에 매번 새 객체를 생성한다는 점이다. helpers의 클로저 함수들은 무상태(stateless)이므로 모듈 상수로 추출해 재사용하면 allocation 압력을 줄일 수 있다. validate()와 execute()에서 동일 code를 두 번 vm.Script로 컴파일하는 이중 파싱 문제도 중장기 최적화 대상이다. 그 외 deepClone의 JSON 직렬화 비용은 variables 크기에 따라 달라지나 현 범위에서는 설계상 수용 가능하다. 전반적으로 새로 추가된 $helpers/$node 주입 코드 자체는 경량하며 심각한 성능 회귀를 유발하지 않는다.

## 위험도

LOW

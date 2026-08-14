# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket.service.ts` — `stripExternalOnlyFields`/`stripDeep` 를 depth-1 shallow strip → 깊이 무관(depth-agnostic) 재귀 strip 으로 교체. `execution.waiting_for_input` 이 `turnDebug.llmCalls.llmCalls[]` / `nodeOutput.meta.turnDebug[].llmCalls[]` 두 경로로 raw LLM request/response(시스템 프롬프트·대화 이력 포함)를 외부 fanout(SSE·webhook·chat-channel)에 흘리던 실증된 leak 을 닫는 보안 수정.
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — 위 두 leak 경로에 대한 회귀 테스트 + clone-on-write identity 테스트 추가.
- `plan/in-progress/*.md`, `review/consistency/2026/08/14/07_44_12/*` — plan/consistency 산출 문서. 애플리케이션 코드가 아니므로 보안 관점 특기사항 없음(정보성 문서, 인젝션·인증·시크릿 표면 없음).

## 발견사항

- **[WARNING]** `stripDeep` 이 새로 만드는 `out` 객체에 대해 `out[k] = s` 로 bracket assignment 하여, 페이로드에 리터럴 `"__proto__"` 키가 own-enumerable 속성으로 존재하면(예: `JSON.parse`) 그 값이 필드로 복사되는 대신 **`out` 의 실제 `[[Prototype]]` 을 덮어쓴다** (CWE-1321, Prototype Pollution 계열).
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:363`, `:371` (함수 `stripDeep`, 게이트 349~374행 전체)
  - 상세: `out: Record<string, unknown> = {}` 로 시작해 첫 `"__proto__"` 키 쓰기 시점에 `out` 은 아직 own `"__proto__"` 데이터 속성이 없으므로, bracket assignment 가 `Object.prototype` 의 `__proto__` accessor(setter) 를 그대로 타고 `out` 의 프로토타입 링크를 교체한다. 직접 재현:
    ```
    const raw = JSON.parse('{"nodeOutput": {"__proto__": null, "foo": "bar"}}');
    const stripped = stripDeep(raw);
    stripped.nodeOutput.hasOwnProperty('foo');
    // TypeError: stripped.nodeOutput.hasOwnProperty is not a function
    ```
    같은 재현에서 `JSON.stringify(stripped)` 는 `{"nodeOutput":{"foo":"bar"}}` 로, `"__proto__"` 키 아래 실려 있던 값은 필드로 보존되지 않고 프로토타입 링크로 소비되어 **조용히 사라진다** — payload 손상이다. 값이 `null` 이면 `out.nodeOutput` 은 `hasOwnProperty`/`toString` 등 표준 메서드가 없는 null-prototype 객체가 되어, 이후 파이프라인(`attachRoutingContext`, NestJS/socket.io 직렬화 경로, 그 값을 소비하는 어떤 코드든) 이 그런 메서드를 호출하면 처리되지 않은 `TypeError` 로 emit 경로가 죽을 수 있다 — `emitExecutionEvent`/`emitNodeEvent` 는 엔진 실행마다 호출되는 핫패스라 가용성 영향이 있다.
    이 함수의 원래 목적(`llmCalls` 필드명이 어느 위치에 있든 제거)은 훼손되지 않는다 — 공격자가 `llmCalls` 라는 이름 자체를 임의로 붙일 수 있는 경로는 없기 때문이다. 다만 이 변경으로 새로 도입된 재귀 객체-빌드 패턴 자체가 CWE-1321 급 결함을 안고 있다.
  - 대조: 같은 파일의 형제 함수 `sanitizeInner`(변경 없음, credential 마스킹)는 우연히 이 문제에서 자유롭다 — `result = { ...obj }` 로 **스프레드 먼저** 만든 뒤에만 `result[k] = ...` 를 쓰기 때문에, `"__proto__"` 라는 own 키가 있어도 스프레드 시점에 이미 shadowing own data property 로 존재해 이후 bracket write 가 그 own 속성을 갱신할 뿐 실제 프로토타입 setter 를 타지 않는다. `stripDeep` 은 `out = {}` 로 **빈 리터럴에서 시작**해 첫 쓰기부터 bracket assignment 를 하므로 이 우연한 안전장치가 없다.
  - 제안: `out` 을 `Object.create(null)` 로 만들거나(단, 반환값이 이후 spread/직렬화 전용이면 문제 없음 — 실제로 `wireEnvelope`/`fanoutEnvelope` 조립은 전부 spread 이므로 안전), 또는 `"__proto__"`/`"constructor"`/`"prototype"` 키를 명시적으로 스킵/방어하거나, `Object.defineProperty(out, k, { value: s, enumerable: true, writable: true, configurable: true })` 로 대체. 회귀 테스트로 `{"__proto__": {...}}` 를 포함한 payload 가 `stripDeep` 통과 후에도 형제 키를 정상 보존하고 반환 객체의 프로토타입이 오염되지 않는지 단언하는 케이스를 `websocket.service.spec.ts` 에 추가 권고 (기존 두 leak-path 테스트와 같은 자리).

- **[WARNING]** `stripDeep` 재귀에 `sanitizePayloadForWs`/`sanitizeInner` 가 갖는 `MAX_SANITIZE_DEPTH`(=10) 와 동등한 깊이 상한이 없다. 이 파일 자체 주석이 그 상한을 "하부에 credential 이 숨어 있을 가능성을 차단" 하는 안전장치로 명시하고 있는데, `stripDeep` 은 이 불변식 없이 무한 재귀한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:349`(함수 `stripDeep` 선언부), 대조 `:249`(`sanitizePayloadForWs`)·`:226`(`MAX_SANITIZE_DEPTH`)
  - 상세: 현재는 `emitExecutionEvent`/`emitNodeEvent` 양쪽 모두 `sanitizePayloadForWs(payload)`(depth ≤ 10 로 이미 절단됨) 결과로 만든 `wireEnvelope` 에 대해서만 `stripExternalOnlyFields`→`stripDeep` 을 호출하므로, **호출 순서상 우연히** 깊이가 이미 bounded 되어 있어 지금 당장 스택 오버플로 공격면은 없다. 그러나 이 안전은 타입 시스템이나 `stripDeep` 자체가 보장하는 게 아니라 두 호출부의 순서 관례에 의존한다 — 향후 새 emit 경로가 `sanitizePayloadForWs` 를 거치지 않고 `stripExternalOnlyFields` 를 직접 호출하도록 리팩터되면, 깊이 제한 없는 attacker-controlled JSON(예: AI tool 이 반환한 깊게 중첩된 JSON 이 `nodeOutput` 에 그대로 실리는 경로)이 `RangeError: Maximum call stack size exceeded` 를 유발할 수 있다.
  - 제안: `stripDeep` 에도 동일한 `MAX_SANITIZE_DEPTH` (또는 별도 상수)를 명시적으로 적용해, 이 파일이 이미 채택한 방어 패턴과 호출-순서 의존 없이 일관되게 만들 것. (이 프로젝트가 과거 "방어의 정의를 한 칸 좁게 잡는 실수"를 반복 지적받은 이력이 있는 만큼, 형제 함수와 동일한 방어를 새 함수에도 명시적으로 이식하는 편이 안전하다.)

- **[INFO]** (개선사항 확인) 이번 수정의 핵심 의도 — `EXTERNAL_STRIPPED_FIELDS`(`llmCalls`) 를 depth-1 대신 깊이 무관으로 strip — 는 실제로 존재했던 심각한 정보 노출(시스템 프롬프트·대화 이력·사용자 입력을 포함한 raw LLM request/response 가 `turnDebug.llmCalls.llmCalls[]` 와 `nodeOutput.meta.turnDebug[].llmCalls[]` 두 경로로 SSE/webhook/chat-channel 외부 수신자에게 그대로 도달)를 닫는다. `websocket.service.spec.ts` 에 추가된 두 테스트(중첩 `turnDebug` 두 경로 동시 검증 + no-op 경로의 참조 동일성 검증)는 이 leak 을 실제로 wire 레벨에서 재현·차단 확인하는 유효한 회귀 가드다. 필드명 기반(위치 열거가 아닌) strip 설계는 향후 새 중첩 위치가 생겨도 자동 보호되는 올바른 방향.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:293-374` (JSDoc + `stripDeep`), `codebase/backend/src/modules/websocket/websocket.service.spec.ts:656-735` (신규 테스트 2건)

## 요약

이번 변경은 raw LLM 요청/응답(시스템 프롬프트 포함)이 두 개의 중첩 경로를 통해 외부 SSE/webhook/chat-channel 수신자에게 그대로 노출되던, 실증된 정보 노출 취약점을 닫는 정당한 보안 수정이며 회귀 테스트도 실제 leak 경로를 정확히 검증한다. 다만 depth-1 shallow delete 를 깊이 무관 재귀 strip 으로 바꾸는 과정에서 새로 작성된 `stripDeep` 이 `out[k] = s` 형태의 무방비 bracket assignment 로 객체를 조립하여, 리터럴 `"__proto__"` 키를 가진 하위 페이로드가 유입될 경우 대상 객체의 프로토타입을 오염시키는 CWE-1321 급 결함을 재현 가능한 형태로 확인했다(값 소실 + 표준 메서드 부재로 인한 `TypeError` 크래시 가능). 같은 파일의 형제 함수 `sanitizeInner` 는 스프레드-우선 초기화 덕에 우연히 이 결함이 없어 두 구현 사이에 방어 수준 불일치가 생겼다. 또한 `sanitizePayloadForWs` 가 갖는 깊이 상한이 `stripDeep` 에는 없어 현재는 호출 순서에 의해서만 안전이 보장되는 암묵적 불변식이다. 두 사항 모두 "고쳤다" 고 선언하기 전에 형제 함수 대비 방어 수준을 맞추는 하드닝이 필요하다.

## 위험도

MEDIUM

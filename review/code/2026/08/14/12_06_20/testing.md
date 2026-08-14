# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `it.each` 깊이 경계 테스트의 JSDoc 이 `stripDeep` 의 경계 연산자를 실제 구현과 반대로(현재형으로) 서술한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:798-799` (JSDoc: ``stripDeep` 은 `depth >= MAX_SANITIZE_DEPTH` 에서 멈추고 형제 `sanitizePayloadForWs` 는 `depth > MAX_SANITIZE_DEPTH` 에서 ... 치환한다 — 경계 연산자가 다르다.``) vs 실제 구현 `codebase/backend/src/modules/websocket/websocket.service.ts:393` (`if (depth > MAX_SANITIZE_DEPTH) return value;`, `>` 이지 `>=` 아님)
  - 상세: 같은 커밋(`b49ee4310`, 커밋 메시지 자체가 "연산자는 통일")이 `stripDeep` 의 경계 연산자를 형제 `sanitizePayloadForWs` 와 동일한 `>` 로 통일했다. `websocket.service.ts:388-392` 의 프로덕션 코드 주석은 이를 정확히 과거형으로 적는다 — "경계 연산자를 형제와 **동일하게** 맞춘다(`>`, `>=` 아님). 종전 `>=` 는 형제보다 한 단계 얕게 멈춰... 모호함을 만들었다." 그런데 `websocket.service.spec.ts:798-799` 의 테스트 JSDoc 은 같은 사안을 현재형 동사("멈추고", "치환한다")로 서술해, 두 함수의 경계 연산자가 **지금도** 다른 것처럼 읽힌다. 실제로 대조해 보면(직접 grep 으로 두 파일 확인) 현재 두 함수 모두 `>` 로 일치한다 — 문서가 반대 사실을 주장하는 상태다. 이 저장소는 바로 앞 라운드(`10_32_27` testing W7: "테스트 JSDoc이 'strip은 depth-1이다'를 현재형으로 썼다 → 과거형 정정")에서 정확히 같은 클래스의 결함(테스트 JSDoc 이 이미 바뀐 사실을 현재형으로 서술)을 잡아 고쳤는데, 바로 다음 커밋에서 다른 주석 블록에 같은 패턴이 재발했다.
  - 제안: `798-799` 줄을 "종전엔 `stripDeep` 이 `depth >= MAX_SANITIZE_DEPTH` 에서 멈췄고 형제는 `depth > ...` 를 썼다 — 경계 연산자가 달랐다"처럼 과거형으로 정정하거나, "이 커밋에서 `>` 로 통일했다"는 문장을 덧붙여 production 코드 주석(`:388-392`)과 서술을 맞출 것.

- **[INFO]** `it.each` 깊이 스윕이 discriminating→non-discriminating 전환 경계(정확히 depth 7↔8)를 직접 표본으로 두지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:819` (`it.each([0, 5, 8, 9, 10, 11, 12])`)
  - 상세: 테스트 자체 JSDoc(`:808-817`)이 "0·5 는 RED(판별력 있음), 8 이상은 판별력 없음(이미 `sanitizePayloadForWs` 가 redact)"이라고 명시한다. 실제로 동일 로직을 별도로 재현해 실측한 결과(스크립트로 sanitize 만 분리 실행) **전환은 정확히 depth 7(생존)→8(redact) 사이**에서 일어난다 — 표에 적힌 "8 이상"과 일치해 서술 자체는 정확하다. 다만 샘플이 `{0,5}` 대 `{8,9,10,11,12}` 로 갈라져 있어 전환 경계에 **가장 가까운 지점(7)** 이 표본에 없다. `MAX_SANITIZE_DEPTH` 나 fixture 의 array/object 중첩 offset(현재 +3: `llmCalls` 배열 → 원소 객체 → `requestPayload` 객체)이 한 단계라도 어긋나면, 이 스윕은 그 어긋남을 가장 늦게(또는 아예 못) 잡을 수 있다 — 표본 `5`와 `8` 사이에 2단 간격이 있기 때문이다.
  - 제안: 우선순위 낮음(현재 서술·결론 자체는 실측으로 검증된 정확한 값이라 당장 결함은 아니다). 추후 이 배열을 건드릴 일이 있으면 `7`을 표본에 추가해 정확한 전환 경계를 캐너리로 고정해 두는 편이 이 자리(`11_02_16`에서 리뷰어 넷이 갈렸던 바로 그 자리)의 재발 방지에 유리하다.

- **[INFO]** `emitNodeEvent` 쪽 strip 회귀 테스트는 이번 PR 이 고친 "중첩 누출" 케이스로 확장되지 않고 기존 top-level-only 케이스만 유지한다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:856-879` (`it('emitNodeEvent fanout 도 llmCalls 를 strip...')`) vs 같은 파일의 신규 nested 테스트 `:656-717` (`emitExecutionEvent` 전용)
  - 상세: `emitNodeEvent` 도 동일한 `stripDeep`/`stripExternalOnlyFields` 를 호출한다(`websocket.service.ts:648`, 주석 자체가 "미래 누출 경로를 차단하기 위해 emitExecutionEvent 와 동일 패턴으로 strip 을 걸어둔다"고 명시). 그런데 이번 PR 이 실제로 고친 결함(중첩 `turnDebug.llmCalls`/`nodeOutput.meta.turnDebug[].llmCalls` 누출)을 재현하는 회귀 테스트는 `emitExecutionEvent` 경로에만 추가됐고, `emitNodeEvent` 쪽 테스트(`:856-879`)는 여전히 최상위 `llmCalls` 만 검증한다. 두 호출부가 **같은 depth-agnostic 함수**를 공유하므로 기능적으로는 `emitExecutionEvent` 쪽 nested 테스트가 그 함수를 이미 충분히 커버하지만, `emitNodeEvent` 자체의 회귀 스위트만 놓고 보면 "왜 이 호출부도 안전한지"를 그 파일 안에서 증명하지 못한다.
  - 제안: 낮은 우선순위(현재 node 이벤트에 `llmCalls` 를 중첩해 담는 실제 프로덕션 경로가 없다는 점이 코드 주석에도 명시돼 있음). 두 호출부 중 하나가 향후 중첩 shape 을 갖게 되면, 그때 짝지어 nested 케이스를 `emitNodeEvent` 쪽에도 추가하는 관례로 충분.

## 검증 (직접 실행 확인)

- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 단독 실행: **40/40 통과** (`npx jest src/modules/websocket/websocket.service.spec.ts`).
- `__proto__` 테스트(`:762`)의 판별력을 RESOLUTION.md 주장과 별개로 직접 재현: `stripDeep` 의 `out ??= { ...obj }` 두 곳(`:410`,`:416`)을 `out ??= {}` 로 뮤테이션 → 해당 테스트 **RED**(`nested.keep` 이 `undefined` — `__proto__` 오염 재현) 확인 후 원본 파일로 정확히 복원(재실행 40/40 GREEN, `git status` 로 파일 변경 없음 확인).
- 깊이 경계 전환 지점(7↔8)을 `sanitizePayloadForWs` 로직만 분리 재현한 별도 스크립트로 실측 — 테스트 JSDoc 표(`:808-817`)의 주장과 일치함을 확인.

## 요약

핵심 변경(`stripExternalOnlyFields` 의 depth-1 → 재귀 `stripDeep` 전환)에 대한 테스트는 전반적으로 매우 탄탄하다 — 실제 프로덕션 shape(두 경로: `turnDebug.llmCalls`/`nodeOutput.meta.turnDebug[].llmCalls`)을 그대로 재현한 회귀 테스트, wire/fanout 대조군 쌍, `__proto__` 오염 방지 테스트(뮤테이션으로 판별력을 직접 재현·검증함), 성능 주장을 뒷받침하는 identity 테스트, 그리고 4명의 리뷰어가 갈렸던 깊이 경계를 논증이 아니라 실측(뮤턴트별 RED/GREEN 표)으로 문서화한 `it.each` 스윕까지 — 이 저장소의 "GREEN 은 증거가 아니다" 원칙에 부합하는 드문 수준의 엄격함을 보인다. `beforeEach` 로 매 테스트마다 mock/allocator 를 새로 만들어 격리도 깨끗하고, 40개 테스트 전체가 그린이다(직접 실행 확인). 다만 테스트 JSDoc 하나가 이번 커밋이 통일한 경계 연산자(`>`)를 현재형으로 잘못(반대로) 서술하고 있어 — 이는 바로 이전 리뷰 라운드에서 잡아 고친 것과 같은 클래스의 결함이 재발한 사례라 WARNING 으로 올린다. 나머지 두 건은 표본 선택·호출부 간 테스트 대칭성에 관한 낮은 우선순위 INFO 다.

## 위험도

LOW

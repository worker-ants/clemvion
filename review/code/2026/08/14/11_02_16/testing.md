# 테스트(Testing) 리뷰

리뷰 대상 중 테스트 관점 분석이 실질적으로 적용되는 파일은 `codebase/backend/src/modules/websocket/websocket.service.ts`(핵심 변경)와 `codebase/backend/src/modules/websocket/websocket.service.spec.ts`(신규 테스트)뿐이다. `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/08/14/10_32_27/**`, `review/consistency/2026/08/14/07_44_12/**` 는 코드가 아닌 문서/이전 리뷰 라운드 산출물이라 "테스트 커버리지" 개념이 적용되지 않는다(단, `10_32_27/testing.md`·`RESOLUTION.md` 는 이번 diff 가 그 라운드의 W5/W6/W7 지적을 실제로 반영했는지 대조하는 데 사용했다).

## 사전 대조 — 이전 라운드(`10_32_27`) 지적이 실제로 반영됐는가

`RESOLUTION.md` 는 W5(identity 테스트가 자식만 봄)·W6(nested 테스트에 대조군 없음)·W7(테스트 JSDoc 시제 오류)을 "조치 완료"로 주장한다. 소스를 직접 읽어 확인했다:

- W5: `websocket.service.spec.ts:744` `expect(fanout.payload).toBe(wire);` — 최상위 envelope 동일성 단언 추가 확인.
- W6: `websocket.service.spec.ts:709-713` `wireJson` 을 별도로 만들어 `SECRET PROMPT A`/`B` 가 내부 WS 채널엔 **남아있음**을 대조군으로 단언 — 확인.
- W7: 신규 테스트 JSDoc(`:636-654`)이 "이었다/했었다" 과거형으로 정정돼 있음 — 확인. (프로덕션 JSDoc `:305` 도 "종전엔" 과거형.)

세 항목 모두 실제로 반영됐다 — 이전 라운드의 지적이 이번 diff 에서 유효하게 해소됨.

## 발견사항

- **[CRITICAL]** `stripDeep` 의 깊이 상한(`depth >= MAX_SANITIZE_DEPTH`)이 형제 함수 `sanitizeInner`/`sanitizePayloadForWs` 의 상한(`depth > MAX_SANITIZE_DEPTH`)과 **연산자가 다르다(off-by-one)** — 이로 인해 `llmCalls` 가 정확히 경계 깊이에 있을 때 strip 을 통과해 외부로 샌다. 이 경계는 어떤 테스트도 검증하지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387` (`if (depth >= MAX_SANITIZE_DEPTH) return value;`, `stripDeep`) vs `:251` (`if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';`, `sanitizePayloadForWs`). JSDoc 의 근거 주장은 `:360-364`("깊이 상한은 형제와 같은 `MAX_SANITIZE_DEPTH` 를 쓴다 … 상한 초과 서브트리는 이미 `sanitizePayloadForWs` 가 `[REDACTED_DEPTH]` 로 마스킹한 뒤다").
  - 상세: 두 함수의 실제 diff 코드를 그대로 추출해 재현 스크립트로 검증했다(로직은 `websocket.service.ts:249-262`·`:386-421` 그대로 복제). `llmCalls` 키를 담은 컨테이너 객체를 깊이(container 자체가 위치한 nesting level) 8/9/10/11 에 각각 배치하고 `sanitizePayloadForWs` → `stripDeep` 순서로 통과시킨 결과:
    ```
    containerDepth=8:  sanitized 보존=true  stripped 이후 보존=false  (정상 strip)
    containerDepth=9:  sanitized 보존=true  stripped 이후 보존=false  (정상 strip)
    containerDepth=10: sanitized 보존=true  stripped 이후 보존=true   ← 누출
    containerDepth=11: sanitized 보존=false (이미 REDACTED 마스킹)
    ```
    깊이 10 에서 `sanitizeInner` 는 `depth > 10` 이 아니므로 마스킹하지 않고 원본 구조를 그대로 유지한다(JSDoc 의 전제 "상한 초과 서브트리는 이미 마스킹됐다" 가 이 경계에서는 **거짓**). 그런데 `stripDeep` 은 그 객체를 처리하려는 순간 `depth(10) >= MAX_SANITIZE_DEPTH(10)` 이 참이 되어, 그 객체 **자신의 key 를 순회하기도 전에** 조기 반환한다 — 즉 그 객체가 `llmCalls` 를 직속 키로 갖고 있어도 검사 자체를 건너뛴다. 결과적으로 `llmCalls` 가 정확히 이 경계 깊이에 위치하면 depth-1 shallow strip 시절과 동일한 방식으로 raw LLM 요청/응답이 외부 fanout(SSE/webhook/chat-channel)에 도달한다 — 이번 diff 가 고치려는 바로 그 취약점 클래스가 경계 지점에서 재현된다.
    `websocket.service.spec.ts` 의 nested-strip 테스트(`:656-717`)·identity 테스트(`:724-747`)는 모두 2~4 단계의 얕은 구조만 쓰고, 기존 `MAX_SANITIZE_DEPTH` 경계 테스트(`:199-218`)는 `sanitizeInner`/`sanitizePayloadForWs` 만 겨냥하며 `stripDeep` 을 거치지 않는 순수 mock 객체로 검증한다 — `stripDeep` 자신의 깊이 상한 분기(`:387`)를 실행하는 테스트가 diff 전체에 **하나도 없다**.
  - 제안: (a) `stripDeep` 의 조건을 `depth > MAX_SANITIZE_DEPTH` 로 맞추거나(형제와 동일 시맨틱), 최소한 두 함수가 "같은 경계"를 갖도록 의미를 통일한다. (b) `websocket.service.spec.ts` 에 `MAX_SANITIZE_DEPTH` 경계(깊이 9/10/11)에 `llmCalls` 를 배치한 payload 로 `emitExecutionEvent` 를 호출해 외부 fanout 에 남지 않는지 단언하는 회귀 테스트를 추가한다(기존 `:199` 스타일 + 신규 nested-strip 테스트 스타일을 결합). 이 테스트가 있었다면 이번 라운드에서 바로 RED 였을 것이다.

- **[WARNING]** `stripDeep` 자신의 깊이 상한 분기(`:387`)를 직접 실행·검증하는 테스트가 전무하다 — 위 CRITICAL 과 별개로, 설령 off-by-one 이 없었더라도 "상한에 도달하면 그 이하를 손대지 않는다"는 이 함수 고유의 새 방어 로직 자체가 미검증 상태다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387`. 대조: 형제 함수의 깊이 경계는 `websocket.service.spec.ts:199`(`redacts the whole subtree when sanitize depth exceeds MAX_SANITIZE_DEPTH`)에서 전용 테스트로 검증되는데, `stripDeep` 은 이 짝이 없다.
  - 상세: `RESOLUTION.md` W4 는 "형제와 같은 `MAX_SANITIZE_DEPTH` 를 적용" 을 완료로 보고했지만, 그 보고에 대응하는 테스트가 추가되지 않았다. 형제 함수는 코드와 테스트가 쌍으로 존재하는데 새 함수는 코드만 존재한다 — 이 비대칭이 위 CRITICAL 이 리뷰 라운드를 통과해 남아 있게 된 직접적 원인이다.
  - 제안: 위 CRITICAL 의 제안 (b) 가 이 WARNING 도 함께 해소한다 — 별도 항목으로 두는 이유는, off-by-one 을 고치더라도 "상한 자체가 작동한다"는 사실을 검증하는 테스트는 독립적으로 필요하기 때문이다(경계값 하나(정확히 cap 위치)뿐 아니라 그 이상 깊이에서도 안전한지).

- **[INFO]** 신규 nested-strip 테스트(`turnDebug` 두 경로)가 배열 순회를 단일 원소(`turnDebug: [{ ... }]`, `websocket.service.spec.ts:672-678`, `:733`)로만 검증한다 — `stripDeep` 의 배열 분기(`value.slice()` 기반 부분 clone-on-write, `:388-395`)가 **여러 원소 중 일부만 변경**되는 경우(예: 2번째 원소만 `llmCalls` 포함)에도 올바르게 부분 복제하는지는 확인되지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:672-678`(nested 테스트), `:733`(identity 테스트) — 둘 다 `turnDebugHistory` 를 1-원소 배열로만 구성.
  - 상세: 로직 자체는 단순한 `for` 루프라 위험은 낮지만, `out === null` 최초 발견 시점에만 `value.slice()` 로 배열을 복제하고 그 이전 원소들은 원본 참조를 그대로 `out[i] = s`(불필요하지만 무해)로 채우는 미묘한 clone-on-write 패턴이라, 실제 멀티턴 대화(`turnDebugHistory` 는 턴마다 누적되는 배열)에서 흔히 발생할 "여러 턴 중 특정 턴에만 `llmCalls` 존재" 케이스가 명시적으로 커버되면 더 견고하다.
  - 제안: 필수는 아님. `turnDebugHistory` 를 2개 이상 원소로 구성해 "앞 원소는 그대로 참조 보존, 특정 원소만 strip" 을 단언하는 케이스를 추가하면 배열 분기의 부분 clone-on-write 를 더 정확히 커버할 수 있다.

## 확인했으나 문제 없음 (positive findings)

- 신규 테스트 4건(`:656`·`:724`·`:762`·`:810`) 모두 독립된 `execution-*` ID 를 쓰고 공유 mutable 상태에 의존하지 않는다 — 테스트 격리 양호.
- `nextFanoutEvent`/`gateway.broadcastToChannel` mock 은 실제 프로덕션 로직(`sanitizePayloadForWs`, `stripDeep`)을 스텁하지 않고 그대로 통과시킨다 — 보안에 민감한 핵심 로직이 mock 뒤에 숨지 않고 실제로 실행·검증된다. Mock 적절성 문제 없음.
- `__proto__` 테스트(`:762-793`)는 "빈 `{}` 에서 대입 분기 진입 전 조기 반환" 이라는 vacuous 함정을 이미 인지하고, `__proto__` 의 **값 안에** `llmCalls` 를 넣어 대입 분기를 실제로 통과시킨다(JSDoc `:757-760` 이 이 판별력 확보 과정을 명시) — 뮤테이션(스프레드→`{}`)에서 RED 확인된 이력이 `RESOLUTION.md` 에 기록돼 있고 코드로도 이 설계가 유지됨을 확인.
- W5/W6/W7(대조군 부재·약한 identity 단언·시제 오류) 는 위 "사전 대조" 절에서 확인한 대로 모두 실제로 반영돼 회귀 없음.
- 기존 테스트(top-level strip 3건, `:589`·`:603`·`:619`) 는 diff 로 수정되지 않았고 `stripDeep` 이 top-level 케이스에서 이전 shallow 구현과 동일하게 동작하므로 여전히 유효 — 회귀 없음.

## 요약

핵심 보안 회귀(중첩 `turnDebug.llmCalls` 두 경로 유출)에 대해서는 실제 emit shape 을 정확히 재현한 강한 회귀 테스트가 추가됐고, 이전 라운드(`10_32_27`)가 지적한 identity 단언 약함·대조군 부재·시제 오류도 모두 실제로 해소됐다. 그러나 이번 diff 가 새로 도입한 `stripDeep` 자체의 깊이 상한(`depth >= MAX_SANITIZE_DEPTH`)이 형제 함수의 상한(`depth > MAX_SANITIZE_DEPTH`)과 연산자가 달라 정확히 경계 깊이에서 `llmCalls` 가 strip 을 우회한다는 것을 재현 스크립트로 직접 검증했다 — JSDoc 이 전제하는 "상한 초과 서브트리는 이미 마스킹돼 있다"는 그 경계에서 거짓이다. 이 경계를 실행하는 테스트가 diff 전체에 없어서, "깊이 무관 strip으로 하드닝했다"는 이번 커밋의 핵심 주장이 정확히 그 하드닝 지점(깊이 상한)에서 실증되지 않은 채 남아 있다. 나머지는 테스트 격리·가독성·mock 적절성 모두 양호하고 회귀 위험도 낮다.

## 위험도

CRITICAL

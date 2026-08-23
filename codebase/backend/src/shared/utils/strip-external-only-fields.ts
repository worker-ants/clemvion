import type { NodeHandlerOutput } from '../../nodes/core/node-handler.interface';

/**
 * 외부 수신자에게 **절대 나가면 안 되는 debug 전용 필드**를 깊이 무관으로 제거한다.
 *
 * `llmCalls` 는 LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·
 * 사용자 입력)을 운반한다. 워크스페이스 인증·ownership 으로 게이트된 **내부 WS 채널**
 * (`execution:{executionId}`)에만 전달하고, 외부로 나가는 모든 표면에서는 제거한다.
 *
 * SoT: `spec/5-system/6-websocket-protocol.md` §4.4 `llmCalls[]` strip 결정
 * (+ EIA **§6.2**(waiting — 실제로 샜던 절)·§6.5·§R17, chat-channel CCH-MP-01).
 *
 * ## 왜 공유 유틸인가 — 같은 데이터에 출구가 둘 이상이다
 *
 * 처음엔 이 로직이 `websocket.service.ts` 안에만 있었고, fanout(SSE·webhook·chat-channel)
 * 만 막았다. 그런데 **같은 `iext_*`/`itk_*` 토큰으로 접근하는 REST 스냅샷**
 * (`GET /api/external/executions/:id` → `InteractionService.getStatus`)이 같은
 * `nodeOutput.meta.turnDebug[].llmCalls[]` 를 그대로 돌려주고 있었다 — 그쪽은
 * `deepRedactSecrets` 만 거치는데 그건 **값 마스킹**이지 필드 제거가 아니다
 * (`12_06_21` cross_spec CRITICAL 1, 테스트로 실증).
 *
 * 한 출구를 막고 나머지를 세지 않는 것이 이 결함의 반복 형태라, 처방을 한 곳에 두고
 * **모든 외부 출구가 같은 것을 부르게** 한다.
 *
 * ## ⚠️ 이 함수만 부르는 것은 절반이다 — 값 마스킹을 짝으로 걸어라
 *
 * 여기는 **필드 삭제**만 한다. 외부 표면은 그것과 별개로 **값 마스킹**(API 키·토큰 등
 * secret *패턴*)이 필요하고, 둘은 서로를 대신하지 못한다. 새 표면을 만든다면 자기
 * 형태에 맞는 짝을 반드시 함께 건다:
 *
 * | 표면 형태 | 마스커 | 판정 | 마스크 토큰 | 상한 |
 * |---|---|---|---|---|
 * | REST 스냅샷 | `deepRedactSecrets` | 키 **+ 값** 패턴 | `'***'` | `MAX_REDACT_DEPTH` (`>=`) |
 * | WS fanout | `sanitizePayloadForWs` | **키 패턴만** | `'[REDACTED]'` | `MAX_SANITIZE_DEPTH` (`>`) |
 *
 * 둘은 세 축(판정 범위·토큰·경계 연산자)이 다르다 — **한쪽 테스트가 다른 쪽을 대신하지
 * 못한다**는 뜻이다. 실제로 두 깊이 sweep 의 판별 구간이 갈렸다(`14_55_29` W1).
 * WS 의 `'[REDACTED_DEPTH]'` 는 마스킹이 아니라 **깊이 초과** 표식이라 위 열과 별개다.
 *
 * 두 합성을 공용 헬퍼 하나로 접지 **않은** 이유: WS 는 마스킹이 wire/fanout 분기보다
 * **위에서** 한 번 돌아(내부 wire copy 도 같은 결과를 쓴다) 출구별 합성이 아니고,
 * 마스커·토큰·경계 연산자가 REST 와 다르다. 접으면 호출자가 하나뿐인 헬퍼가 되면서
 * 이름이 "외부 표면 정본 레시피" 로 읽혀 WS 형태에는 틀린 안내가 된다
 * (`15_58_26` architecture W2 — 실측 후 이 표로 대체).
 *
 * ## 계약
 *
 * - **입력을 변형하지 않는다.** 내부 WS wire 는 full payload 를 그대로 유지해야 한다.
 * - **lazy clone-on-write** — 제거가 실제로 일어나기 전에는 아무것도 할당하지 않고,
 *   변경이 없는 서브트리는 입력을 그대로(동일 참조) 돌려준다.
 * - `maxDepth` **값**은 호출부가 명시한다. 각 표면이 자기 자매 sanitizer 와 같은 상한을
 *   쓰게 해서, 두 상한이 조용히 갈라지는 것을 막는다.
 *
 * ## 경계 연산자는 이 함수가 `>` 로 고정한다 — 자매와 다를 수 있다
 *
 * 초판 JSDoc 은 "호출부가 자매와 **같은 값·같은 경계 연산자**를 쓴다" 고 적었는데,
 * REST 호출부의 자매 `deepRedactSecrets` 는 `>=` 다 — **계약이 지켜지지 않는 채로
 * 문서만 그렇게 말하고 있었다** (`14_30_35` architecture/requirement W3).
 *
 * 실제 성질은 이렇다: 연산자는 이 함수가 항상 `>` 로 고정하고, 자매가 `>=` 로 한 단계
 * 먼저 멈추더라도 **그 경계에서 서브트리를 non-object 로 collapse**(`'[REDACTED_DEPTH]'`
 * / `'***'`)한다. 즉 안전의 근거는 "연산자가 같다" 가 아니라 **"그 깊이에서는 둘 중
 * 하나가 객체를 없앤다"** 다.
 *
 * **순서와 무관하다** — 자매가 먼저 돌면 이 함수가 도달했을 때 이미 볼 것이 없고, 이 함수가
 * 먼저 돌면(REST 의 `stripAndRedact`) 상한 밖 서브트리는 손대지 않은 채 남았다가 뒤이어
 * 자매가 collapse 한다. 어느 쪽이든 그 깊이의 raw 내용은 나가지 않는다.
 * (초판은 "자매가 **먼저** collapse 하니 안전" 이라 적어 **한쪽 순서만** 설명했는데, REST
 * 호출부가 정확히 반대 순서였다 — `14_55_29` architecture/documentation W2.)
 *
 * ## 비용 (실측)
 *
 * 호출부는 이 payload 를 이미 한 번 완전 순회한다(`sanitizePayloadForWs` /
 * `deepRedactSecrets`) — 즉 순회가 두 번이다. 8턴 `turnDebugHistory` waiting payload
 * A/B(N=3000, emit 전체): 옛 depth-1 strip **0.0112** → 재귀 strip **0.0314 ms/emit**
 * (2.80배, +20.2 µs).
 *
 * 두 pass 를 하나로 합치지 않은 이유: 자매 sanitizer 는 **wire/fanout 분기 이전**에 돌아
 * 두 채널이 공유하는데, 내부 WS 채널은 `llmCalls` 를 받아야 한다. 합치려면 그 함수에
 * 채널 개념을 넣어야 하고 credential 마스킹·캐시·depth 캡 의미를 건드린다 — 20 µs 를
 * 아끼려고 마스킹 로직을 흔들 이유가 없다.
 *
 * > 이 실측·근거는 종전 `websocket.service.ts` JSDoc 에 있었는데 공유 유틸로 옮기면서
 * > **딸려오지 않았다**. 하필 그 시점에 두 번째 호출자(REST)가 같은 트레이드오프를 지게
 * > 됐는데 문서가 비어 있었다 (`14_30_35` performance W2).
 *
 * ## 순환 참조
 *
 * 다루지 않는다 — 이 payload 는 직후 `JSON.stringify` 로 직렬화되므로 순환이 있으면
 * 어차피 거기서 `TypeError` 로 죽는다. 실패 시점이 앞당겨질 뿐 새 실패 모드가 아니고,
 * 방문 집합을 들고 다니는 비용만 는다.
 */
export const EXTERNAL_STRIPPED_FIELDS = ['llmCalls'] as const;

/**
 * `nodeOutput` 의 **최상위** 키 allowlist — EIA §R17 잔여 항목.
 *
 * ## 왜 deny-list 로는 부족한가
 *
 * 위 {@link EXTERNAL_STRIPPED_FIELDS} 는 **한 칸짜리 deny-list** 라 **새 핸들러가 새 키를
 * 내면 기본값이 통과**한다(fail-open). 실제로 새는 것이 있다 — `NodeHandlerOutput` 의
 * 엔진 내부 필드 `_retryState` 는 `NodeExecution.outputData` 에 **저장되고**
 * (`retry-turn.service.ts`), `llmCalls` 가 아니므로 그대로 외부로 나간다. 자매 필드
 * `_resumeState` 의 JSDoc 이 *"표현식 리졸버·UI 자동완성에 노출되지 않게 `output` 밖에
 * 뒀다"* 고 적은 그 의도가 외부 REST 에서만 지켜지지 않고 있었다.
 *
 * ## 이 목록은 **타입에 결속**돼 있다 — 산문 주장이 아니다
 *
 * `nodeOutput` 은 `NodeExecution.outputData` = `NodeHandlerOutput` shape 이다. 목록을
 * 손으로 나열하면 두 번째 손-동기화 지점이 생기므로, 아래 {@link
 * assertAllowlistCoversHandlerContract} 가 **컴파일타임에** 그 타입의 공개 키를 전부
 * 덮는지 검사한다 — `NodeHandlerOutput` 에 공개 키가 늘면 **빌드가 깨진다**.
 *
 * 반대 방향(allowlist 가 타입보다 넓은 것)은 **의도적으로 허용**한다: `formConfig` 등
 * wire 전용 키는 핸들러 계약에 없지만 위젯 파서가 top-level 로 읽는다.
 *
 * `_resumeCheckpoint`(`stripControlFields` 에만 등장, 이 타입의 키 아님)처럼 **목록에 없는
 * 것은 전부** 떨어진다 — fail-closed 라 열거하지 않아도 닫힌다.
 *
 * | 그룹 | 키 | 근거 |
 * |---|---|---|
 * | 핸들러 계약 공개분 | `config` · `output` · `meta` · `port` · `status` | `NodeHandlerOutput` |
 * | wire 전용 | `formConfig` · `conversationConfig` · `buttonConfig` · `interactionType` | 위젯 파서가 top-level 로 읽는다 |
 *
 * ## **최상위만** 거른다 — 그 아래는 렌더 payload 자체다
 *
 * 깊은 곳은 폼 필드·캐러셀 아이템 같은 **작성자 데이터**라 열거할 수 없다. fail-open
 * 위험은 *새 최상위 핸들러 키*에 있고, 값 축은 자매 `deepRedactSecrets` 가 맡는다.
 *
 * ## 왜 `getStatus` 의 나머지 두 출구에는 안 거나
 *
 * `stripAndRedact` 는 세 출구(waiting `nodeOutput` · terminal `result` · terminal `error`)
 * 전부에 걸리지만, 이 allowlist 는 **shape 에 묶여 있다**. `result` 는
 * `Execution.outputData` = **작성자가 정의한 워크플로 출력**이라 allowlist 를 걸면 정상
 * 데이터가 잘린다. 즉 이건 "세 곳 중 하나만 고쳤다" 가 아니라 **`NodeHandlerOutput`
 * shape 인 곳이 하나뿐**이라서다.
 */
export const NODE_OUTPUT_ALLOWED_KEYS = [
  // NodeHandlerOutput 공개분 (`_resumeState`·`_retryState` 는 의도적 제외)
  'config',
  'output',
  'meta',
  'port',
  'status',
  // wire 전용 — `eia-events.ts` 의 parseWaitingForInput 이 top-level 로 읽는다
  'formConfig',
  'conversationConfig',
  'buttonConfig',
  'interactionType',
] as const;

/**
 * 컴파일타임 결속 — `NodeHandlerOutput` 의 **공개** 키가 전부 allowlist 에 있는지 검사한다.
 *
 * 새 공개 키가 그 인터페이스에 추가되면 이 줄이 타입 오류를 낸다. 그때 판단할 것은
 * "외부 표면에 내보낼 키인가" 이고, 답이 예면 목록에 더하고 아니오면 아래 `Exclude` 에
 * 더한다 — **어느 쪽이든 의식적인 결정을 강제**한다. 목록만 있고 결속이 없으면 새 키가
 * 조용히 차단되어(fail-closed 라 안전하지만) 렌더가 이유 없이 비는 형태로 나타난다.
 */
type PublicHandlerOutputKey = Exclude<
  keyof NodeHandlerOutput,
  // 엔진 내부 — 외부 표면에 나가면 안 된다(이 allowlist 의 존재 이유).
  '_resumeState' | '_retryState'
>;
const assertAllowlistCoversHandlerContract: PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number]
  ? true
  : never = true;
void assertAllowlistCoversHandlerContract;

/**
 * {@link NODE_OUTPUT_ALLOWED_KEYS} 에 없는 **최상위** 키를 떨어뜨린다 (fail-closed).
 *
 * 입력이 객체가 아니면 그대로 돌려준다 — 배열·원시값은 이 계약의 형태가 아니고,
 * 억지로 `{}` 로 만들면 렌더가 조용히 빈다.
 *
 * @returns 떨어뜨릴 키가 없으면 **같은 참조**(copy-on-change). 자매 `stripDeep` 과 같은
 *   관례다 — waiting 폴링은 잦고 대개 떨어뜨릴 것이 없다.
 */
export function allowlistNodeOutputKeys<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const allowed = NODE_OUTPUT_ALLOWED_KEYS as readonly string[];
  let out: Record<string, unknown> | null = null;
  for (const k of Object.keys(obj)) {
    if (allowed.includes(k)) continue;
    out ??= { ...obj };
    delete out[k];
  }
  return (out ?? obj) as T;
}

/**
 * `EXTERNAL_STRIPPED_FIELDS` 를 **어느 깊이에서든** 제거한 값을 돌려준다.
 *
 * @param maxDepth 이 깊이를 **초과**하면 그 아래는 손대지 않는다. 호출부는 자매
 *   sanitizer(`sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH`, `deepRedactSecrets` 의
 *   `MAX_REDACT_DEPTH`)와 **같은 값**을 넘긴다. 경계 연산자·실행 순서에 대한 정확한
 *   성질은 위 §"경계 연산자는 이 함수가 `>` 로 고정한다" 참조.
 */
export function stripExternalOnlyFields<T>(value: T, maxDepth: number): T {
  return stripDeep(value, 0, maxDepth) as T;
}

function stripDeep(value: unknown, depth: number, maxDepth: number): unknown {
  if (depth > maxDepth) return value;

  if (Array.isArray(value)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < value.length; i++) {
      const s = stripDeep(value[i], depth + 1, maxDepth);
      if (s !== value[i]) out ??= value.slice();
      if (out !== null) out[i] = s;
    }
    return out ?? value;
  }
  if (value === null || typeof value !== 'object') return value;

  const obj = value as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const [k, v] of Object.entries(obj)) {
    if ((EXTERNAL_STRIPPED_FIELDS as readonly string[]).includes(k)) {
      out ??= { ...obj };
      delete out[k];
      continue;
    }
    const s = stripDeep(v, depth + 1, maxDepth);
    if (s !== v) {
      out ??= { ...obj };
      // bracket 대입 금지 — `__proto__` 면 접근자를 타 프로토타입을 갈아친다(CWE-1321).
      //
      // 실측: 방어는 위의 **스프레드**가 한다(`{...obj}` 는 CreateDataProperty 라 own
      // `__proto__` 를 옮기고, 그 own 속성이 상속 접근자를 가린다). 빈 `{}` 에서만 오염이
      // 일어난다. 아래 `defineProperty` 는 `out` 생성 방식이 바뀌어도 접근자를 타지 않게
      // 하는 **중복 방어**다 — 회귀는 `__proto__` 테스트가 잡는다(스프레드를 `{}` 로
      // 되돌리는 뮤턴트에서 RED 확인).
      Object.defineProperty(out, k, {
        value: s,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return out ?? value;
}

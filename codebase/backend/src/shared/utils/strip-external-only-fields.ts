/**
 * 외부 수신자에게 **절대 나가면 안 되는 debug 전용 필드**를 깊이 무관으로 제거한다.
 *
 * `llmCalls` 는 LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·
 * 사용자 입력)을 운반한다. 워크스페이스 인증·ownership 으로 게이트된 **내부 WS 채널**
 * (`execution:{executionId}`)에만 전달하고, 외부로 나가는 모든 표면에서는 제거한다.
 *
 * SoT: `spec/5-system/6-websocket-protocol.md` §4.4 `llmCalls[]` strip 결정
 * (+ EIA §6.5, chat-channel CCH-MP-01).
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
 * **모든 외부 출구가 같은 것을 부르게** 한다. 새 외부 표면이 생기면 여기를 부르면 된다.
 *
 * ## 계약
 *
 * - **입력을 변형하지 않는다.** 내부 WS wire 는 full payload 를 그대로 유지해야 한다.
 * - **lazy clone-on-write** — 제거가 실제로 일어나기 전에는 아무것도 할당하지 않고,
 *   변경이 없는 서브트리는 입력을 그대로(동일 참조) 돌려준다.
 * - `maxDepth` 는 **호출부가 명시**한다. 각 표면이 자기 자매 sanitizer 와 같은 상한을
 *   쓰게 해서, 두 상한이 조용히 갈라지는 것을 막는다.
 */
export const EXTERNAL_STRIPPED_FIELDS = ['llmCalls'] as const;

/**
 * `EXTERNAL_STRIPPED_FIELDS` 를 **어느 깊이에서든** 제거한 값을 돌려준다.
 *
 * @param maxDepth 이 깊이를 **초과**하면 그 아래는 손대지 않는다. 호출부의 자매
 *   sanitizer(예: `sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH`, `deepRedactSecrets` 의
 *   `MAX_REDACT_DEPTH`)와 **같은 값·같은 경계 연산자**를 쓴다 — 상한 밖 서브트리는 그
 *   sanitizer 가 이미 마스킹한 뒤라 여기서 더 볼 것이 없다.
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

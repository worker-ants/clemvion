import type { NodeHandlerOutput } from '../../nodes/core/node-handler.interface';

// 자매 `strip-external-only-fields.ts` 와 **의도적으로 분리**된 파일이다
// (`19_00_23` architecture W2). 그쪽은 **순수·범용** deny-list(다중 소비처, 깊은 순회)라
// 도메인 타입을 몰라야 하는데, 이 allowlist 는 `NodeHandlerOutput` 에 결속돼 있고 소비처도
// `getStatus` 한 곳이다. 한 파일에 두면 하위 계층이 상위 도메인 타입을 참조하게 된다.
//
// 두 정책의 관계: deny-list 는 **어느 깊이에서든 아는 것을 뺀다**(fail-open),
// 이 allowlist 는 **최상위에서 아는 것만 남긴다**(fail-closed). `getStatus` 는 둘 다 지난다.

/**
 * `nodeOutput` 의 **최상위** 키 allowlist — EIA §R17 잔여 항목.
 *
 * ## 왜 deny-list 로는 부족한가
 *
 * 자매 파일 `strip-external-only-fields.ts` 의 `EXTERNAL_STRIPPED_FIELDS` 는 **한 칸짜리
 * deny-list** 라 **새 핸들러가 새 키를
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
export const NODE_OUTPUT_ALLOWED_KEYS = Object.freeze([
  // NodeHandlerOutput 공개분 (`_resumeState`·`_retryState` 는 의도적 제외)
  'config',
  'output',
  'meta',
  'port',
  'status',
  // wire 전용 (위젯) — `eia-events.ts` 의 parseWaitingForInput 이 top-level 로 읽는다
  'formConfig',
  'conversationConfig',
  'buttonConfig',
  'interactionType',
  // wire 전용 (chat-channel) — Discord/Telegram/Slack 렌더러가 **top-level** 로 읽는다.
  // 위젯은 `output.rendered`·`config.items` 처럼 한 겹 아래로 읽어 이 넷 없이도 되지만,
  // chat-channel 은 flat legacy shape 을 그대로 본다 — `extractRendered` 가
  // `nodeOutput.rendered` 를, 카드·제목 렌더가 `nodeOutput.payload`·`nodeOutput.title` 을,
  // 라우팅이 `nodeOutput.nodeType` 을 읽는다.
  //
  // **표면별로 목록을 가르지 않는다** — 그러면 손-동기화 지점이 둘 생긴다. 이 넷도
  // §R17 이 정의한 "렌더에 필요한 키" 에 해당한다.
  'payload',
  'title',
  'rendered',
  'nodeType',
  // `as const` 는 **컴파일타임 리터럴 타입**만 준다 — `.push`/`.splice` 를 막지 않는다.
  // 이 상수는 보안 경계라 런타임 불변까지 강제한다 (`19_24_24` security INFO 2).
] as const);

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
    // `delete` 로 안전하다 — 자매 `stripDeep` 이 `Object.defineProperty` 를 쓰는 것은
    // **대입**(`out[k] = v`)이 상속 setter 를 탈 수 있어서고, `[[Delete]]` 는 own 속성만
    // 건드려 그 경로가 없다. 위 스프레드가 own `__proto__` 를 먼저 옮겨 오는 것도 같다.
    delete out[k];
  }
  return (out ?? obj) as T;
}

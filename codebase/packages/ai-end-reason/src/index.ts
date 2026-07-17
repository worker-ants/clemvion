/**
 * AI 노드(AI Agent · Information Extractor)가 생산하는 `output.result.endReason`
 * 도메인의 단일 진실.
 *
 * ## 왜 패키지인가
 *
 * 이 값 목록은 backend 가 선언하고 frontend 가 소비한다. 예전엔 frontend 가
 * **손으로 베낀 사본**(`output-shape.ts` 의 `CONVERSATION_END_REASONS`)을 들고
 * 있었고, 그 사본이 backend 와 어긋날 때마다 **대화 미리보기 탭이 통째로
 * 사라졌다** — `error`·`condition` 누락으로 두 번 발생했다 (PR #959).
 *
 * 그 사본을 없애고 양쪽이 같은 선언을 import 하게 해 **drift 를 구조적으로
 * 불가능**하게 만든다.
 *
 * ## SoT 경계
 *
 * - **값 도메인** = 이 패키지 (코드 레벨 SoT)
 * - **의미·port 매핑·산문** = `spec/4-nodes/3-ai/1-ai-agent.md` ·
 *   `spec/4-nodes/3-ai/3-information-extractor.md`
 * - **출력 봉투(`output.result.*`) 구조** = `spec/conventions/node-output.md`
 *   (이 패키지는 봉투 구조를 소유하지 않는다 — endReason **값**만)
 */

/**
 * AI Agent multi-turn 종결 사유.
 *
 * 엔진이 `endMultiTurnConversation(state, endReason, …)` 로 전달한다
 * (`nodes/core/node-handler.interface.ts`).
 */
export type AiAgentEndReason =
  | 'user_ended'
  | 'max_turns'
  | 'condition'
  | 'error';

/**
 * Information Extractor multi-turn 종결 사유.
 *
 * AI Agent 와 **의도적으로 다르다** — IE 는 `condition` 라우팅이 없고, 대신
 * 추출 완료(`completed`)·재수집 소진(`max_retries`) 종결을 갖는다. 두 도메인을
 * 하나로 합치지 않는 이유가 이것이다 (각 노드의 종결 의미가 흐려진다).
 *
 * `timeout` 은 현재 생산자가 없다 (`portForEndReason` 에 case 도 없어 default →
 * `error` 로 떨어진다). 선언이 남아 있는 한 아래 파생 유니온에 포함되며, 그건
 * **무해**하다 — 소비 측이 `result.messages` 존재를 먼저 요구하기 때문. 정리하려면
 * 이 유니온에서 지우는 것이 옳은 자리다.
 */
export type InformationExtractorEndReason =
  | 'completed'
  | 'max_turns'
  | 'user_ended'
  | 'timeout'
  | 'max_retries'
  | 'error';

/**
 * 대화 UI 가 "종결" 로 인식해야 하는 전체 도메인 — **파생**이다.
 *
 * 손으로 유지하지 않는다. 어느 노드 유니온에 값이 추가되면 자동으로 넓어지고,
 * 아래 {@link CONVERSATION_END_REASONS} 의 exhaustiveness 검사가 배열 갱신을
 * **컴파일 타임에 강제**한다.
 *
 * 단일턴 종결(`'out'`)은 포함하지 않는다 — 두 노드 유니온 어디에도 없고,
 * 단일턴 출력에는 `result.messages` 가 없어 대화 판정 대상이 아니다.
 */
export type ConversationEndReason =
  | AiAgentEndReason
  | InformationExtractorEndReason;

/**
 * {@link ConversationEndReason} 의 런타임 값 목록.
 *
 * 아래 두 장치가 배열과 유니온을 **양방향으로** 잠근다:
 * - `satisfies` → 배열 ⊆ 유니온 (오타·죽은 값 차단)
 * - `Exclude`   → 유니온 ⊆ 배열 (누락 차단 — 미리보기 소실을 막는 축)
 *
 * 둘 중 하나만으로는 부족하다. `const x: ReadonlyArray<T> = VALUES` 같은 구조는
 * 전자만 검사해 **누락을 놓친다**.
 */
export const CONVERSATION_END_REASONS = [
  'user_ended',
  'max_turns',
  'condition',
  'error',
  'completed',
  'timeout',
  'max_retries',
] as const satisfies readonly ConversationEndReason[];

type MissingEndReason = Exclude<
  ConversationEndReason,
  (typeof CONVERSATION_END_REASONS)[number]
>;
const _exhaustive: [MissingEndReason] extends [never] ? true : never = true;
void _exhaustive;

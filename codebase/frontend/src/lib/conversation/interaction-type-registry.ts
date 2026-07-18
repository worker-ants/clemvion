/**
 * `WaitingInteractionType` · `ConversationTurnSource` 의 **값 목록**과 그 목록이
 * 타입과 일치함을 보장하는 컴파일 타임 단언.
 *
 * ## 왜 소스 파일인가 (테스트 파일이 아니라)
 *
 * 이 단언들은 원래 `lib/__tests__/interaction-type-exhaustiveness.test.ts` 안에
 * 있었는데, **`tsconfig.json` 이 `src/**\/__tests__/**` 를 exclude 하므로 tsc 가
 * 그 파일을 아예 읽지 않는다** — 즉 거기 있던 컴파일 타임 단언은 전부 무효였다
 * (실측: 테스트 파일에 명백한 타입 에러를 넣어도 `tsc --noEmit` 이 0건 보고).
 * vitest 도 esbuild 로 타입을 스트립하므로 검사하지 않는다.
 *
 * 목록을 tsc 가 보는 소스로 옮겨야 단언이 실제로 동작한다. 테스트는 여기서
 * import 해 AST 가드(코드 사이트에 각 값이 등장하는지)를 수행한다.
 *
 * SoT: `spec/conventions/interaction-type-registry.md`
 */

import type { WaitingInteractionType } from "@/lib/stores/execution-store";
import type { ConversationTurnSource } from "./conversation-utils";

/** `WaitingInteractionType` 의 전체 값. */
export const INTERACTION_TYPE_VALUES = [
  "form",
  "buttons",
  "ai_conversation",
  "ai_form_render",
] as const satisfies readonly WaitingInteractionType[];

type MissingInteractionType = Exclude<
  WaitingInteractionType,
  (typeof INTERACTION_TYPE_VALUES)[number]
>;
const _noMissingInteractionType: [MissingInteractionType] extends [never]
  ? true
  : never = true;
void _noMissingInteractionType;

/** `ConversationTurnSource` 의 전체 값 (frontend 합성 source 포함). */
export const CONVERSATION_SOURCE_VALUES = [
  "ai_user",
  "ai_assistant",
  "ai_tool",
  "presentation_user",
  "system",
  "system_error",
  "rag",
] as const satisfies readonly ConversationTurnSource[];

type MissingSource = Exclude<
  ConversationTurnSource,
  (typeof CONVERSATION_SOURCE_VALUES)[number]
>;
const _noMissingSource: [MissingSource] extends [never] ? true : never = true;
void _noMissingSource;

/**
 * 각 `WaitingInteractionType` 이 **multi-turn 대화**인지.
 *
 * `Record<WaitingInteractionType, …>` 라서 **값이 추가되면 컴파일러가 여기서
 * 결정을 강제**한다 — 이게 이 구조의 전부다.
 *
 * 왜 AST 가드가 아니라 이 방식인가: 아래 {@link MULTI_TURN_INTERACTION_TYPES}
 * 는 전체 4값의 **부분집합**(2값)이다. 기존 AST 가드는 "모든 값이 모든 사이트에
 * 등장" 모델이라 부분집합에 쓰면 `form`·`buttons` 를 누락으로 오탐한다 (실측).
 * 부분집합은 "빠짐없이 분류했는가" 를 물어야 하고, 그건 exhaustive Record 가
 * 정확히 하는 일이다.
 */
const IS_MULTI_TURN_INTERACTION: Record<WaitingInteractionType, boolean> = {
  form: false,
  buttons: false,
  ai_conversation: true,
  ai_form_render: true,
};

/**
 * multi-turn 대화 interactionType 만. `isConversationOutput` 이 대화 노드 판정에
 * 쓴다 — 여기서 누락되면 **미리보기 탭이 사라진다** (PR #959 의 endReason 누락과
 * 같은 계열).
 */
export const MULTI_TURN_INTERACTION_TYPES: ReadonlySet<string> = new Set(
  Object.entries(IS_MULTI_TURN_INTERACTION)
    .filter(([, isMultiTurn]) => isMultiTurn)
    .map(([type]) => type),
);

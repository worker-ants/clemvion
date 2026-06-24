/**
 * Display-only presentation 노드 타입 4종.
 *
 * 버튼 없이 자동 진행(non-blocking)하면 메시지/표현만 출력하고 흐름이 이어진다.
 * (버튼이 있으면 `output.status === 'waiting_for_input'` 으로 blocking 전환 → 별 경로.)
 *
 * `form` 은 항상 blocking 이라 제외 (`nodes/presentation/index.ts` 의 `PRESENTATION_COMPONENTS`
 * 는 form 을 포함하므로 본 집합과 다르다).
 *
 * **단일 출처** — 다음 두 소비처가 import 한다 (의존 방향 위반·중복 정의 방지):
 * - `execution-engine` : 비차단 완료 시 `execution.message` 발행 대상 판별.
 * - `chat-channel.dispatcher` : `execution.node.completed` 중 발화 대상 sub-filter.
 */
export const PRESENTATION_NODE_TYPES: ReadonlySet<string> = new Set<string>([
  'carousel',
  'table',
  'chart',
  'template',
]);

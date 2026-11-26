import type { InteractCommand } from './dto/interact.dto';
import type { InteractionTokenService } from './interaction-token.service';

/**
 * 인터랙션 블록 빌더 — 웹훅 202 응답과 `execution.waiting_for_input` 알림 웹훅이 같이 쓴다.
 *
 * - 202 응답(REQ-EIA-002 · 003)은 {@link buildInteractionBlock} 결과를 그대로 싣는다. 그 계약은 바꾸지 않는다.
 * - 알림 웹훅(REQ-EIANOTI-033)은 같은 결과에 `expectedCommands` 를 더해 마스킹이 끝난 payload 에 붙인다.
 *   SSE 이벤트에는 붙이지 않는다. 논리 이름과 wire 이름의 대응은 CLE-EIA-NOTIFY-EVENTS 의 대응표가 정한다.
 */

/** 다섯 엔드포인트. 상대 경로이고 `/v1/` 구간이 없다(CLE-API-CONV). */
export interface InteractionEndpoints {
  stream: string;
  submit: string;
  status: string;
  cancel: string;
  refresh: string;
}

/** 202 응답의 `interaction` 블록. `token` · `expiresAt` 은 `per_execution` 일 때만 있다. */
export interface InteractionBlock {
  token?: string;
  expiresAt?: string;
  endpoints: InteractionEndpoints;
}

/** 알림 웹훅 `execution.waiting_for_input` payload 의 `interaction` 블록. */
export interface NotificationInteractionBlock extends InteractionBlock {
  expectedCommands: InteractCommand[];
}

export function buildInteractionEndpoints(
  executionId: string,
): InteractionEndpoints {
  const base = `/api/external/executions/${executionId}`;
  return {
    stream: `${base}/stream`,
    submit: `${base}/interact`,
    status: base,
    cancel: `${base}/cancel`,
    refresh: `${base}/refresh-token`,
  };
}

/**
 * 트리거 설정(`config.interaction`)으로 인터랙션 블록을 만든다. 인터랙션이 꺼져 있으면 `null` 이다.
 *
 * `per_execution`(기본값)이면 부를 때마다 새 실행 단위 토큰을 발급한다. jti 는 `execution_token` 에 남고
 * 실행이 끝나면 `revokeAllForExecution` 이 폐기한다. `per_trigger` 면 토큰을 싣지 않는다. 호출자는 트리거
 * 생성 응답이나 per_trigger 를 켠 PATCH 응답에서 한 번 받은 `itk_*` 를 쓴다. 다시 받으려면 `revoke-token`
 * 으로 재발급한다(NERV Task `CLE-T-EMB0YG`).
 */
export async function buildInteractionBlock(
  config: Record<string, unknown>,
  executionId: string,
  tokenService: Pick<InteractionTokenService, 'issuePerExecution'>,
): Promise<InteractionBlock | null> {
  const interactionCfg = (config as { interaction?: unknown }).interaction;
  if (!interactionCfg || typeof interactionCfg !== 'object') return null;
  const enabled = (interactionCfg as { enabled?: unknown }).enabled === true;
  if (!enabled) return null;
  const strategy =
    (interactionCfg as { tokenStrategy?: unknown }).tokenStrategy ??
    'per_execution';
  const endpoints = buildInteractionEndpoints(executionId);
  if (strategy === 'per_execution') {
    const issued = await tokenService.issuePerExecution(executionId);
    return { token: issued.token, expiresAt: issued.expiresAt, endpoints };
  }
  return { endpoints };
}

/**
 * 입력 대기 표면(`interactionType`)별 권장 명령. 서버가 강제하는 허용 명령 매트릭스와 다를 수 있는 힌트다
 * (CLE-EXEC-WORKER 「발행 전 사전 검증」). `ai_form_render` 는 EIA 외부 계약대로 `ai_conversation` 에
 * 합친다(CLE-IX-TYPES 「엔진 네 값과 외부 세 값」). 모르는 값이면 빈 배열이다.
 */
const EXPECTED_COMMANDS: Readonly<Record<string, readonly InteractCommand[]>> =
  {
    form: ['submit_form'],
    buttons: ['click_button'],
    ai_conversation: ['submit_message', 'end_conversation'],
    ai_form_render: ['submit_message', 'end_conversation'],
  };

export function expectedCommandsFor(
  interactionType: unknown,
): InteractCommand[] {
  if (typeof interactionType !== 'string') return [];
  if (
    !Object.prototype.hasOwnProperty.call(EXPECTED_COMMANDS, interactionType)
  ) {
    return [];
  }
  return [...EXPECTED_COMMANDS[interactionType]];
}

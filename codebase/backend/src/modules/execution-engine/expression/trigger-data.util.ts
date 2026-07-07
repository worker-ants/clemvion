import {
  TRIGGER_TRANSPORT_KEYS,
  type TriggerExpressionData,
} from '../../../nodes/core/node-handler.interface';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `Execution.inputData` 에서 expression `$trigger` 용 transport 데이터를 추출한다
 * (spec/5-system/5-expression-language.md §4.5). webhook adapter 는
 * `__triggerSource: 'webhook'` 마커와 `body`/`headers`/`query`/`method` 를 stamp 한다.
 *
 * webhook 이 아닌 경로(manual/schedule 는 `{ parameters }` 만)는 `undefined` 를 반환하며,
 * 이때 `buildExpressionContext` 는 `$trigger = {}` 를 주입한다. `parameters` 는 `$trigger`
 * 에 포함하지 않는다 — `$params`/`$input.parameters` 로 이미 노출된다.
 *
 * 재수화(§7.5) 시에도 `Execution.inputData`(durable)에서 동일하게 복원되므로 `$trigger` 는
 * park→resume 후에도 `{}` 로 비지 않는다.
 */
export function extractTriggerData(
  inputData: unknown,
): TriggerExpressionData | undefined {
  if (
    inputData === null ||
    typeof inputData !== 'object' ||
    Array.isArray(inputData)
  ) {
    return undefined;
  }
  const input = inputData as Record<string, unknown>;
  const source = input.__triggerSource;
  // 명시 마커 우선. 마커 부재 시 transport 필드 존재로 webhook 후방 탐지
  // (manual/schedule adapter 는 transport 를 절대 싣지 않는다 — manual-trigger.handler 와 동일 규칙).
  const isWebhook =
    source === 'webhook' ||
    (source === undefined && TRIGGER_TRANSPORT_KEYS.some((k) => k in input));
  if (!isWebhook) return undefined;

  const data: TriggerExpressionData = {};
  if ('body' in input) data.body = input.body;
  // webhook adapter(hooks.controller)가 헤더/쿼리를 string 값만 담아 stamp 하므로
  // (비-string 은 이미 제외됨) plain-record 확인 후 string 맵으로 취급한다.
  if (isPlainRecord(input.headers))
    data.headers = input.headers as Record<string, string>;
  if (isPlainRecord(input.query))
    data.query = input.query as Record<string, string>;
  if (typeof input.method === 'string') data.method = input.method;
  return data;
}

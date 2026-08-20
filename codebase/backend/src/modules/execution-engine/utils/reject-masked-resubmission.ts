import {
  MAX_REDACT_DEPTH,
  isMaskedMarker,
} from '../../../shared/utils/sanitize-error-message';
import {
  TriggerParameterDefinition,
  TriggerParameterValidationError,
  TriggerParameterValidationException,
} from '../types/trigger-parameter.types';
import { resolveTriggerParameters } from './resolve-trigger-parameters';

/**
 * 마스킹된 값의 재제출을 거부하면서 트리거 파라미터를 resolve 한다 (EIA §R17).
 *
 * ## 왜 필요한가
 *
 * `Execution.inputData` 는 응답 시 자격증명 값-패턴이 마스킹된다. 그 값은 **표시 전용이
 * 아니라 재제출된다** — Re-run 모달이 `inputOverride` 로 되보내고, 에디터 "히스토리에서
 * 불러오기" 가 JSON textarea 로 적재해 재실행한다. 그대로 두면 리터럴 `'***'` 가 **새
 * 실행의 실제 입력값**이 된다. 프런트가 막지만 그건 **렌더 경로**라 `curl` 로는 우회된다.
 *
 * ## 범위 — Manual 실행 경로 한정
 *
 * 이 함수를 쓰는 곳은 re-run 과 `POST /workflows/:id/execute` 둘뿐이다. **webhook ingestion
 * 과 schedule 은 그냥 {@link resolveTriggerParameters} 를 직접 부른다** — 그쪽 body 는 외부
 * 시스템이 저작하는 임의 페이로드라 리터럴 `'***'` 가 정상 값일 수 있다.
 *
 * > 판정 기준은 "출처" 가 아니라 **페이로드의 저작 주체**다. execute 는 재제출 전용이
 * > 아니라 Manual 실행 전체의 진입점이고 출처 플래그가 없다 — 마커 세 문자열은 Manual
 * > 파라미터의 **예약어**이며, 프런트도 같은 규칙을 쓴다(두 층이 갈리면 한쪽만 통과하는
 * > 값이 생긴다).
 *
 * ## 왜 resolve 를 감싸는가 — 검사 시점이 정확성을 가른다
 *
 * 초판은 **resolve 결과만** 검사했다가 세 갈래로 뚫렸다(`00_03_57` CRITICAL·W1·W2,
 * 무수정 프로브로 실증):
 *
 * | 타입 | resolve 후 | 결과 |
 * |---|---|---|
 * | `boolean` | `Boolean('***')` → `true` | **완전 우회** — 문자열이 사라져 못 본다 |
 * | `number` | `coerce_failed` 를 먼저 throw | 사용자가 *"타입 오류"* 를 본다 — 안내가 틀린다 |
 * | `defaultValue: '***'` | 손대지 않아도 채워짐 | **과잉 차단** — 매 실행 400 |
 *
 * 그래서 **raw 를 먼저** 본다(문자열이 살아 있는 시점). 다만 raw 만으로는 부족하다 —
 * object/array 파라미터를 JSON **문자열**로 보내면(`'{"apiKey":"***"}'`) 마커는 파싱 뒤에야
 * leaf 로 드러난다. 그래서 resolve 뒤에도 한 번 더 본다.
 *
 * 두 검사 모두 **raw 에 실제로 있는 키만** 대상으로 한다 — 그래야 `defaultValue` 로 채워진
 * 필드(사용자가 손대지 않은 값)를 막지 않는다.
 *
 * > **호출부가 아니라 여기서 순서를 소유한다.** 초판은 판정 4줄을 두 호출부에 복붙했는데,
 * > 이 PR 자체가 두 호출부 사이 에러 봉투 드리프트를 이미 겪었다(`errors` vs `details`).
 * > 세 번째 Manual 경로가 생기면 이 함수를 부르면 된다 — 순서를 다시 틀릴 자리가 없다.
 */
export function resolveTriggerParametersRejectingMasked(
  schema: TriggerParameterDefinition[] | undefined | null,
  rawSource: unknown,
): Record<string, unknown> {
  // ① raw 검사 — coerce 가 문자열을 지우기(`Boolean('***')`) 전이고,
  //    `coerce_failed` 가 안내를 선점하기 전이다.
  throwIfAny(findMaskedResubmissions(schema, rawSource, rawSource));

  const resolved = resolveTriggerParameters(schema, rawSource);

  // ② resolve 검사 — object/array 를 JSON 문자열로 보낸 경우는 파싱 뒤에야 leaf 가 보인다.
  throwIfAny(findMaskedResubmissions(schema, rawSource, resolved));

  return resolved;
}

function throwIfAny(errors: TriggerParameterValidationError[]): void {
  if (errors.length > 0) {
    throw new TriggerParameterValidationException(errors);
  }
}

/**
 * `values` 안에서 마스킹 마커가 실린 파라미터를 찾는다 — **`rawSource` 에 실제로 있는
 * 스키마 필드만** 대상이다.
 *
 * `rawSource` 와 `values` 를 따로 받는 이유: 같은 판정을 raw 단계와 resolve 단계에 각각
 * 적용하되, **대상 키 집합은 언제나 raw 기준**이어야 하기 때문이다(사용자가 보낸 것만 본다).
 *
 * ## 경계 두 가지 — 둘 다 프런트 미러와 같아야 한다
 *
 * 1. **정확 일치만.** `a***b` 처럼 마커를 포함만 하는 정상 값은 통과시킨다. 부분 매칭으로
 *    넓히면 가드가 정상 워크플로를 망가뜨린다.
 * 2. **깊이 상한은 {@link MAX_REDACT_DEPTH} 와 같다.** 마스커가 그 깊이에서 서브트리를
 *    마커로 **치환**하므로, 마스킹된 값에서 마커가 놓일 수 있는 가장 깊은 자리가 그
 *    지점이다. 그 아래는 사용자가 직접 만든 구조지 마스킹의 산물이 아니다.
 *
 * > **값 검사가 깊이 검사보다 먼저다.** 치환된 마커는 상한 **그 자리에** 있으므로, 순서를
 * > 뒤집으면 그 마커를 검사도 않고 지나친다 — off-by-one 이 곧 fail-open 이다.
 */
export function findMaskedResubmissions(
  schema: TriggerParameterDefinition[] | undefined | null,
  rawSource: unknown,
  values: unknown,
): TriggerParameterValidationError[] {
  if (!schema || schema.length === 0) return [];
  if (!isPlainRecord(rawSource) || !isPlainRecord(values)) return [];

  return schema
    .filter((def) => Object.prototype.hasOwnProperty.call(rawSource, def.name))
    .filter((def) => hasMaskedLeaf(values[def.name], 0))
    .map((def) => ({
      field: def.name,
      reason: 'masked_value_resubmitted' as const,
    }));
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function hasMaskedLeaf(value: unknown, depth: number): boolean {
  // 값 검사가 **먼저** — 상한 지점에 놓인 치환 마커를 놓치지 않기 위해.
  if (isMaskedMarker(value)) return true;
  if (depth >= MAX_REDACT_DEPTH) return false;
  if (Array.isArray(value)) {
    return value.some((v) => hasMaskedLeaf(v, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) =>
      hasMaskedLeaf(v, depth + 1),
    );
  }
  return false;
}

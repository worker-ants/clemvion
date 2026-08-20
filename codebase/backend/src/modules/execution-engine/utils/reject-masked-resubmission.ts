import {
  MAX_REDACT_DEPTH,
  isMaskedMarker,
} from '../../../shared/utils/sanitize-error-message';
import { TriggerParameterValidationError } from '../types/trigger-parameter.types';

/**
 * 마스킹된 값이 그대로 재제출된 파라미터를 찾아낸다 (EIA §R17).
 *
 * ## 왜 필요한가
 *
 * `Execution.inputData` 는 응답 시 자격증명 값-패턴이 마스킹된다. 그 값은 **표시 전용이
 * 아니라 재제출된다** — Re-run 모달이 `inputOverride` 로 되보내고, 에디터 "히스토리에서
 * 불러오기" 가 JSON textarea 로 적재해 재실행한다. 그대로 두면 리터럴 `'***'` 가 **새
 * 실행의 실제 입력값**이 된다.
 *
 * 프런트가 2026-08-20 부터 세 소비처에서 막지만 그건 **렌더 경로**다 — `curl` 로 API 를
 * 직접 치면 우회된다. 이 함수가 같은 규칙을 API 레벨에 둔다.
 *
 * ## 범위 — Manual 실행 경로 한정
 *
 * 호출부는 re-run 과 `POST /workflows/:id/execute` 둘뿐이다. **webhook ingestion 과
 * schedule 은 대상이 아니다** — 그쪽 body 는 외부 시스템이 저작하는 임의 페이로드라
 * 리터럴 `'***'` 가 정상 값일 수 있다. 그래서 이 판정을 `resolveTriggerParameters` 공유
 * 함수 안에 넣지 않는다(공유 프리미티브를 넓히면 무관한 경로가 오염된다).
 *
 * > **판정 기준은 "출처" 가 아니라 페이로드의 저작 주체다.** execute 엔드포인트는 재제출
 * > 전용이 아니라 Manual 실행 전체의 진입점이고 출처를 구분할 플래그가 없다 — 사용자가
 * > 직접 타이핑한 마커도 거부된다. 마커 세 문자열은 Manual 파라미터의 **예약어**이며,
 * > 프런트 가드가 이미 같은 비용을 치르고 있다(두 층이 갈리면 한쪽만 통과하는 값이 생긴다).
 *
 * ## 경계 두 가지 — 둘 다 프런트 미러와 같아야 한다
 *
 * 1. **정확 일치만.** `a***b` 처럼 마커를 포함만 하는 정상 값은 통과시킨다. 부분 매칭으로
 *    넓히면 가드가 정상 워크플로를 망가뜨린다.
 * 2. **깊이 상한은 {@link MAX_REDACT_DEPTH} 와 같다.** 마스커가 그 깊이에서 서브트리를
 *    마커로 **치환**하므로, 마스킹된 값에서 마커가 놓일 수 있는 가장 깊은 자리가 정확히
 *    그 지점이다. 그 아래는 사용자가 직접 만든 구조지 마스킹의 산물이 아니다.
 *
 * > **값 검사가 깊이 검사보다 먼저다.** 치환된 마커는 상한 **그 자리에** 있으므로, 순서를
 * > 뒤집으면 그 마커를 검사도 않고 지나친다 — off-by-one 이 곧 fail-open 이다.
 */
export function findMaskedResubmissions(
  resolved: Record<string, unknown>,
): TriggerParameterValidationError[] {
  return Object.entries(resolved)
    .filter(([, value]) => hasMaskedLeaf(value, 0))
    .map(([field]) => ({
      field,
      reason: 'masked_value_resubmitted' as const,
    }));
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

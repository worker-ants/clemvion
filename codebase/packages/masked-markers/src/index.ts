/**
 * egress 마스킹이 남기는 **마커 집합의 단일 진실**.
 *
 * ## 왜 공유 패키지인가
 *
 * 이 값들은 **backend 가 만들고 frontend 가 판정한다.** backend 의 마스커가 자격증명 값을
 * 마커로 치환하고, frontend 는 그 마커를 알아보아 "이미 가려진 값" 을 폼에 프리필하거나
 * 재제출하지 않는다. 양쪽이 **같은 집합**을 봐야 그 보장이 성립한다.
 *
 * 원래는 두 스택에 손으로 복제돼 있었다. 미러를 기계가 대조하게 만들려고 했더니 CI 경로
 * 게이팅에 막혔다 — `frontend-checks` 는 `codebase/backend/**` 변경 때 검사를 생략하고
 * `backend-checks` 는 `codebase/frontend/**` 때 생략한다. **한쪽에 둔 계약 가드는 반대쪽이
 * 마커를 바꾸는 방향에 무력하다.** 두 워크플로 모두 `codebase/packages/**` 는 relevant 로
 * 잡으므로, 여기 두면 그 갭이 사라지고 애초에 대조할 미러가 없어진다.
 *
 * 선례: `@workflow/ai-end-reason` — 같은 형태(backend 가 생산, frontend 가 판정)의 값 도메인.
 *
 * ## 리터럴이 같다고 같은 계약은 아니다
 *
 * 저장소에는 `'***'` · `'[REDACTED]'` 를 **독립적으로** 쓰는 마스커가 여럿 있다(HTTP 노드의
 * 쿼리 파라미터 가림, 응답 헤더 가림, 이메일 로컬파트 가림 등). 그것들은 이 집합과 **무관**
 * 하며 spec 이 합성을 명시적으로 금지한 곳도 있다. 이 패키지를 import 하지 않는 리터럴을
 * 발견해도 자동으로 결함이 아니다 — 판단 기준은 *"프런트의 마커 판정과 같은 계약인가"* 다.
 */

/** 값-패턴 마스커가 남기는 마커. */
export const VALUE_MASK_MARKER = "***";

/** 키-이름 마스커(WS payload · webhook ingestion)가 남기는 마커. */
export const KEY_MASK_MARKER = "[REDACTED]";

/** 깊이 상한을 넘은 서브트리가 치환되는 마커. */
export const DEPTH_MASK_MARKER = "[REDACTED_DEPTH]";

/**
 * 마커 전체 집합.
 *
 * **`Set` 이 아니라 동결된 배열이다.** `Object.freeze(new Set(...))` 은 플라시보다 —
 * `Set` 의 데이터는 own property 가 아니라 내부 슬롯에 있어 `freeze` 가 닿지 않고 `.add()`
 * 가 그대로 성공한다(실측). 이 집합은 egress 마스킹과 재제출 거부 **두 판정기가 공유**하므로
 * 변형이 파급되면 양쪽이 동시에 오염된다.
 */
export const MASKED_MARKERS: readonly string[] = Object.freeze([
  VALUE_MASK_MARKER,
  KEY_MASK_MARKER,
  DEPTH_MASK_MARKER,
]);

/**
 * 이 값이 egress 마스킹의 산물인가.
 *
 * **정확 일치만 본다.** 부분 포함(`a***b`)은 통과시킨다 — 사용자가 실제로 그런 값을 쓸 수
 * 있고, 여기서의 거짓양성 비용(정상 입력을 막는다)이 거짓음성 비용보다 크다.
 */
export function isMaskedMarker(v: unknown): boolean {
  return typeof v === "string" && MASKED_MARKERS.includes(v);
}

/**
 * 값 마스커가 서브트리를 치환하는 깊이 — 그리고 마커 스캐너가 **반드시 닿아야 하는** 깊이.
 *
 * ## 왜 두 역할이 같은 수를 공유해야 하나
 *
 * 마스커는 이 깊이에서 서브트리를 마커로 **치환한다.** 따라서 마커가 놓일 수 있는 가장 깊은
 * 자리가 정확히 이 깊이다(실측: 입력 깊이 11 이면 마커는 깊이 10 에 놓인다). 스캐너의 상한이
 * 이보다 **작으면 그 차이만큼 가드가 조용히 뚫린다.**
 *
 * 스캐너는 **값 검사를 깊이 검사보다 먼저** 해야 한다 — 그러지 않으면 상한 지점에 놓인
 * 치환 마커를 한 칸 차이로 놓친다.
 *
 * ## 이름
 *
 * 두 소비 관점이 각각 다른 이름을 쓰고 있었다 — 마스커 쪽 `MAX_REDACT_DEPTH`, 스캐너 쪽
 * `MAX_MARKER_SCAN_DEPTH`. 어느 한쪽을 정본으로 고르면 반대편에서 오독되므로 **중립 이름**을
 * 정본으로 둔다. 각 스택은 필요하면 지역 별칭으로 재export 한다.
 *
 * > **WS 마스커의 `MAX_SANITIZE_DEPTH` 는 이것이 아니다.** 그쪽은 비교가 `depth > N` 이라
 * > 마커를 한 칸 더 깊은 자리에 놓고, 프런트 스캐너는 WS 페이로드를 스캔하지 않는다(실측).
 * > 별개 불변식이므로 합치지 않는다 — 공유 프리미티브를 넓히면 무관한 경로가 오염된다.
 */
export const MAX_MASK_DEPTH = 10;

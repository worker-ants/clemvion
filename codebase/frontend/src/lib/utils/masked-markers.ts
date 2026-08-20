/**
 * egress 값-마스킹이 남기는 마커 — backend `sanitize-error-message.ts` 의
 * `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 의 프런트 미러다.
 *
 * **SoT 는 backend 상수**다. frontend(CSR Next.js)는 backend NestJS 모듈을 직접 import 할 수
 * 없어(빌드/번들 분리) 값을 복제한다 — 변경 시 **양쪽 미러를 함께** 갱신한다.
 *
 * 이 목록이 backend 와 어긋나면 아래 가드들이 조용히 뚫린다(마스킹된 값을 못 알아보고
 * 프리필해 재제출) — 그래서 값을 넓히기보다 backend 와 **정확히 같은 집합**으로 둔다.
 *
 * **이름을 backend 와 똑같이 둔다** (`MASKED_MARKERS`/`isMaskedMarker`) — 미러의 동기화는
 * 결국 사람이 grep 으로 찾는다. 이름이 갈리면 그 검색이 실패한다.
 *
 * > **왜 컴포넌트에서 여기로 옮겼나 (2026-08-20)**: 처음엔 `dynamic-form-ui.tsx` 안에 있었다.
 * > 소비처가 셋(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)이 되면서 모달·툴바가 무관한
 * > 폼 UI 컴포넌트를 import 해야 하는 의존 방향이 생겨 `lib/utils/` 로 승격했다.
 */
export const MASKED_MARKERS: ReadonlySet<string> = new Set([
  "***",
  "[REDACTED]",
  "[REDACTED_DEPTH]",
]);

/**
 * 이 값이 egress 마스킹의 산물인가.
 *
 * ## 왜 필요한가 — 마스킹된 값이 **되돌아와 실제 입력이 된다**
 *
 * `Execution.inputData` 와 `formConfig` 는 응답·emit 시점에 자격증명 값-패턴이 마스킹된다
 * ([EIA §R17](../../../../../spec/5-system/14-external-interaction-api.md)). 그런데 이
 * 값들은 **표시 전용이 아니라 재제출된다** — 폼이 `defaultValue` 로 프리필되고, Re-run 모달이
 * `inputOverride` 로 되보내고, 에디터 히스토리 로드가 JSON 을 그대로 재실행한다.
 *
 * 그대로 두면 리터럴 `'***'` 가 **새 실행의 실제 입력값**이 된다 — 가시성 저하가 아니라
 * **조용한 데이터 오염**이다. 그래서 **소비 쪽에서 마커를 감지**해 프리필을 건너뛰거나
 * 제출을 막는다.
 *
 * ## 보장의 경계 — **정확 일치만** 잡는다 (의도)
 *
 * backend 의 값-마스킹에는 **부분 치환**도 있다 — `scheme://user:pass@host` 는
 * `scheme://***@host` 가 되고 문자열 전체가 마커가 아니다. 그런 값은 여기서 **감지되지 않아
 * 그대로 통과한다**(자격증명은 이미 지워졌으니 노출은 아니지만, 같은 "왕복" 성질은 남는다).
 *
 * **부분 포함으로 넓히지 않는 이유**: `a***b` 처럼 마커를 우연히 포함할 뿐인 정상 값까지
 * 막게 되어 가드가 정상 워크플로를 망가뜨린다. 오탐 비용이 미탐 비용보다 크다 — 미탐 쪽은
 * 이미 자격증명이 제거된 값이기 때문이다. 이 경계는 테스트가 양방향으로 고정한다.
 */
export function isMaskedMarker(v: unknown): boolean {
  return typeof v === "string" && MASKED_MARKERS.has(v);
}

/**
 * 중첩 구조 어딘가에 마스킹 마커 **leaf** 가 있는가.
 *
 * 에디터 "히스토리에서 불러오기" 는 `Execution.inputData` 를 **JSON 텍스트 전체**로 적재한다.
 * 필드 단위로 비울 수 없는 표면이라, 마커가 남아 있는 동안 실행을 막는 데 쓴다.
 *
 * > **raw 문자열 substring 매칭을 쓰지 않는다** (`12_08_46` W2). 텍스트를 그대로 훑으면
 * > 마크다운 `***bold***` 같은 정상 입력이 걸린다 — {@link isMaskedMarker} 가 *"값 전체가
 * > 마커와 정확히 일치"* 로 좁혀 둔 경계를 되돌리는 셈이다. **파싱된 값의 leaf 만** 본다.
 *
 * 순환 참조는 `JSON.parse` 산물에 존재할 수 없으므로 방문 집합을 두지 않는다.
 *
 * ## 깊이 상한 — 자매 함수와 같은 숫자, 같은 이유
 *
 * 이 함수가 받는 입력은 **backend 검증을 거치지 않은 사용자 입력**일 수 있다. 에디터
 * "Run with Input" 텍스트에어리어는 사용자가 그 자리에서 타이핑·붙여넣기한 임의 JSON 을
 * `JSON.parse` 한 뒤 곧바로 여기에 넘긴다. 실측(node 24, V8):
 *
 * | 중첩 깊이 | `JSON.parse` | 상한 없는 재귀 탐색 |
 * |---|---|---|
 * | 1,000 | OK | OK |
 * | 5,000 | **OK** | `RangeError: Maximum call stack size exceeded` |
 * | 100,000 | **OK** | 동상 |
 *
 * `JSON.parse` 는 반복적 구현이라 통과시키는 깊이를 재귀 탐색이 못 따라간다 — 렌더 경로
 * (`useMemo`)에서 던지면 이벤트 핸들러 예외와 달리 React 트리로 전파돼 화면이 깨진다.
 *
 * **상한 값은 backend `MAX_REDACT_DEPTH` 와 같아야 한다.** 그 함수는 `depth >= 10` 에서
 * 서브트리를 통째로 마커로 **치환**하므로, backend 를 거쳐 온 값에는 depth 10 아래에
 * 아무것도 없다 — 즉 여기서 10 아래를 안 봐도 **놓치는 마커가 없다**(그 아래 구조는 사용자가
 * 직접 만든 것이지 마스킹의 산물이 아니다).
 *
 * > **off-by-one 이 곧 fail-open 이다.** 치환된 마커는 **depth 10 그 자리에** 있으므로,
 * > 값 검사(`isMaskedMarker`)를 깊이 검사보다 **먼저** 해야 한다. 순서를 뒤집으면 상한
 * > 지점의 마커를 검사도 안 하고 지나친다. 테스트가 이 경계를 정확히 그 깊이로 고정한다.
 */
export function hasMaskedMarkerLeaf(value: unknown): boolean {
  return scanForMarker(value, 0);
}

/**
 * backend `MAX_REDACT_DEPTH` 의 프런트 미러 — {@link hasMaskedMarkerLeaf} 참조.
 * 두 값은 **같아야 한다**. 여기가 더 작으면 그 차이만큼 가드가 조용히 뚫린다.
 */
const MAX_MARKER_SCAN_DEPTH = 10;

function scanForMarker(value: unknown, depth: number): boolean {
  // 값 검사가 **먼저**다 — 상한 지점에 놓인 치환 마커를 놓치지 않기 위해.
  if (isMaskedMarker(value)) return true;
  if (depth >= MAX_MARKER_SCAN_DEPTH) return false;
  if (Array.isArray(value)) {
    return value.some((v) => scanForMarker(v, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((v) =>
      scanForMarker(v, depth + 1),
    );
  }
  return false;
}

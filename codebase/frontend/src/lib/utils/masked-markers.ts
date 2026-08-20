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
 */
export function hasMaskedMarkerLeaf(value: unknown): boolean {
  if (isMaskedMarker(value)) return true;
  if (Array.isArray(value)) return value.some(hasMaskedMarkerLeaf);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(
      hasMaskedMarkerLeaf,
    );
  }
  return false;
}

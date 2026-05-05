/**
 * 접근성(a11y) 관련 공유 상수.
 *
 * Skip-link target 같은 ID 가 두 곳에서 문자열 리터럴로 결합되면 한쪽만
 * 변경됐을 때 조용히 깨진다 — 단일 출처로 유지해 변경이 양쪽에 동시 적용
 * 되도록 한다.
 */

/** `<main>` 요소의 id. `SkipToMain` 의 `href="#main-content"` 와 짝. */
export const MAIN_CONTENT_ID = "main-content";

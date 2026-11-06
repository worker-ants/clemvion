import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
} from "./theme-constants";

/**
 * 첫 화면을 그리기 전에 `<html>` 에 테마 클래스를 붙이는 인라인 스크립트(REQ-PROFILE-029).
 *
 * 루트 레이아웃 `<head>` 에 넣어 브라우저가 HTML 을 읽는 동안 바로 실행한다. React 가
 * hydrate 하기 전이라 store 를 쓰지 못한다. 그래서 `theme-store` 의 적용 규칙
 * (기억한 값 → 없거나 잘못된 값이면 기본값 → `system` 은 OS 색상 모드)을 문자열로 옮겼다.
 * 두 쪽 결과는 단위 테스트(`__tests__/theme-init-script.test.ts`)가 맞춘다.
 *
 * localStorage 나 matchMedia 를 쓸 수 없으면 기본값 라이트로 그린다. 그 뒤
 * `ThemeSync` 가 사용자 정보의 테마를 받아 다시 적용한다.
 */
export const THEME_INIT_SCRIPT = [
  "(function(){",
  "var d=document.documentElement;",
  `var t=${JSON.stringify(DEFAULT_THEME)};`,
  "try{",
  `var s=window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});`,
  `if(${JSON.stringify(THEMES)}.indexOf(s)!==-1)t=s;`,
  `if(t==="system")t=window.matchMedia&&window.matchMedia(${JSON.stringify(DARK_MEDIA_QUERY)}).matches?"dark":"light";`,
  `}catch(e){t=${JSON.stringify(DEFAULT_THEME)};}`,
  'd.classList.remove("light","dark");',
  "d.classList.add(t);",
  "})();",
].join("");

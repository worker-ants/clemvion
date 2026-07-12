import "@testing-library/jest-dom/vitest";

// 위젯 기본 대상 언어는 한국어(spec 7-channel-web-chat). 테스트 환경도 한국어 브라우저로 시뮬레이션한다 —
// jsdom 기본 navigator.language 는 "en-US" 라, 명시 없이 auto-detect(resolveLocale) 가 en 으로 흘러
// KO chrome 단언(대다수 위젯 테스트)이 깨진다. EN 경로는 각 테스트가 명시 locale 또는 navigator override 로 검증한다.
Object.defineProperty(navigator, "language", { value: "ko-KR", configurable: true });

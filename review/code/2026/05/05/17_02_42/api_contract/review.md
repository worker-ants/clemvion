해당 없음

이번 변경사항은 전적으로 프론트엔드 접근성(a11y) 개선에 관한 것입니다: Playwright/axe-core 테스트 인프라 추가, ARIA 속성(`aria-label`, `aria-hidden`, `aria-invalid`, `aria-live`, `role="dialog"` 등) 적용, skip-to-main 링크, 시맨틱 랜드마크(`<nav>`, `<main>`), 포커스 트랩(`FocusScope`), i18n 사전에 ARIA 문자열 추가가 포함되어 있습니다. 백엔드 API 엔드포인트, 요청/응답 스키마, HTTP 계약, 인증/인가 로직에 대한 변경은 전혀 없습니다.

### 요약
변경된 파일은 모두 UI 컴포넌트, 테스트 설정, 패키지 의존성(dev 전용), i18n 사전으로 구성되어 있으며, API 계약과 관련된 코드 변경이 존재하지 않습니다.

### 위험도
NONE
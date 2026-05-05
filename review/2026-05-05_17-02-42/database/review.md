해당 없음

이번 변경사항은 전적으로 프론트엔드 접근성(a11y) 개선에 관한 것입니다. 변경 내용은 ARIA 속성 추가(`aria-label`, `aria-hidden`, `aria-invalid`, `aria-describedby`, `aria-live`, `role`), skip-to-main 링크 컴포넌트 추가, Playwright/axe-core e2e 테스트 셋업, i18n 번역 키 추가, `<aside>` → `<nav>` 시맨틱 태그 변경, `FocusScope` 포커스 트랩 적용 등으로 구성되어 있으며, 데이터베이스와 관련된 코드 변경은 전혀 포함되어 있지 않습니다.

### 요약
분석 대상 30개 파일 모두 UI 컴포넌트, 테스트 설정, i18n 딕셔너리, 패키지 의존성에 해당하며, 데이터베이스 쿼리·스키마·트랜잭션·마이그레이션과 관련된 코드가 없습니다.

### 위험도
NONE
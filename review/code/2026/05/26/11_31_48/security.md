# Security Review — docs-mobile-sidebar

## 발견사항

- **[INFO]** `onClickCapture` 를 통한 앵커 클릭 감지 방식 — XSS 위험 아님, 단순 UI 제어
  - 위치: `codebase/frontend/src/components/docs/docs-mobile-sidebar.tsx` — `onClickCapture` 핸들러 (L51–55)
  - 상세: `e.target.closest("a")` 로 앵커 여부를 판단해 drawer 를 닫는다. 이 패턴 자체는 DOM traversal 이며 외부 입력을 실행하지 않는다. 단, drawer 안에 외부 출처 URL 을 그대로 렌더하는 링크가 포함될 경우 open-redirect 벡터가 될 수 있으나, 현재 `DocsSidebar` 의 href 는 `DocsSection` 데이터에서 오며 서버 빌드 타임에 고정된 내부 경로이므로 실질적 위험 없음.
  - 제안: `href` 가 외부 출처(사용자 입력 등)로 확장될 경우 `URL` 파싱 후 동일 origin 여부를 검증하는 가드를 추가할 것.

- **[INFO]** `Element.prototype.scrollIntoView` 전역 교체(테스트 파일)
  - 위치: `codebase/frontend/src/components/docs/__tests__/docs-mobile-sidebar.test.tsx` — L286–287
  - 상세: `Element.prototype.scrollIntoView = scrollSpy` 는 테스트 환경 전역 프로토타입을 변경한다. 보안 취약점은 아니나, 테스트 격리가 불완전하면 후속 테스트에 의도치 않은 spy 를 남길 수 있다. 현재 `afterEach` 에 복원 코드가 없다.
  - 제안: `afterEach` 또는 `afterAll` 에서 `Element.prototype.scrollIntoView = originalScrollIntoView` 복원을 추가할 것 (보안보다 테스트 격리 이슈이나 기록).

- **[INFO]** `document.body.style.overflow` 직접 조작 — 모듈 수준 전역 카운터
  - 위치: `codebase/frontend/src/components/ui/slide-drawer.tsx` — `openDrawerCount` 전역 변수 (L70)
  - 상세: `openDrawerCount` 가 모듈 수준 변수로 선언되어 SSR 환경에서 요청 간 상태를 공유할 가능성이 있다. Next.js App Router 에서 `"use client"` 파일은 브라우저에서만 실행되므로 현재 구성에서는 직접적인 취약점이 아니다. 단, 향후 SSR/RSC 경계가 바뀌거나 서버 사이드 테스트에서 임포트될 경우 요청 간 상태 누출이 발생할 수 있다.
  - 제안: `"use client"` 지시어가 유지되는 한 현 구조로 충분하나, 주석에 "클라이언트 전용 모듈 수준 변수" 를 명시해 SSR 로 이동 금지 의도를 표시하면 좋음.

- **[INFO]** i18n 키 값이 사용자에게 그대로 노출되는 UI 문자열
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/docs.ts`, `codebase/frontend/src/lib/i18n/dict/ko/docs.ts`
  - 상세: `mobileSidebarToggle`, `mobileSidebarTitle` 은 사용자 인터페이스 레이블로 XSS 벡터가 될 수 있는 동적 입력이 아닌 빌드 타임 상수이다. React 의 JSX 텍스트 삽입은 기본적으로 이스케이프되므로 위험 없음.
  - 제안: 해당 없음.

## 요약

이번 변경은 모바일 전용 문서 사이드바 진입 UI(토글 버튼 + SlideDrawer)를 추가한다. 처리하는 데이터는 빌드 타임에 고정된 docs 메타데이터와 i18n 상수 문자열 뿐이며, 사용자 입력이 직접 DOM에 삽입되는 경로가 없다. 인증·인가 변경, 하드코딩 시크릿, 서버 측 API 호출, 외부 네트워크 요청이 전혀 없다. SlideDrawer 의 포커스 트랩(`FocusScope`), `aria-modal`, `inert` 속성 처리는 접근성과 함께 키보드 탈출 경로를 올바르게 막는다. 테스트 파일의 전역 프로토타입 교체 복원 누락과 모듈 수준 카운터의 SSR 주의 사항은 기록하나 현재 아키텍처에서 실질적 위협은 아니다. 전체적으로 보안 위험이 없는 순수 UI 변경이다.

## 위험도

NONE

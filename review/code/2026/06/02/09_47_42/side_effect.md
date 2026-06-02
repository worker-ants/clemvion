# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `hookInstalled` 모듈 레벨 전역 변수 — 테스트 간 오염 가능
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` line 13
- 상세: `let hookInstalled = false;` 는 ES 모듈 레벨에서 선언된 변수다. 프로덕션 브라우저 환경에서는 모듈이 한 번만 로드되므로 훅이 1회만 설치되어 의도대로 동작한다. 그러나 vitest 테스트 환경에서는 모듈 캐시가 테스트 파일 간 공유되는 경우, 첫 번째 테스트에서 `hookInstalled = true` 로 설정된 상태가 이후 테스트에서 초기화되지 않고 남아 훅 관련 동작을 테스트하기 어려울 수 있다. 특히 `DOMPurify.addHook` 은 글로벌 DOMPurify 인스턴스에 훅을 누적 등록하는 부작용이 있다 — 테스트 간 `DOMPurify.removeHooks("afterSanitizeAttributes")` 없이 훅이 중복 실행될 가능성이 있다.
- 제안: 테스트 환경에서는 `beforeEach`/`afterEach` 에서 `DOMPurify.removeHooks("afterSanitizeAttributes")` 호출 및 `hookInstalled` 리셋을 고려하거나, 훅 등록 함수를 순수 팩토리 패턴으로 분리하는 것을 권장한다.

### [WARNING] `DOMPurify.addHook` — 전역 DOMPurify 인스턴스의 영구 상태 변경
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` lines 16-20
- 상세: `DOMPurify.addHook("afterSanitizeAttributes", ...)` 은 글로벌 DOMPurify 인스턴스에 영구적으로 훅을 추가한다. 위젯이 iframe 내부에서 동작하므로 격리되어 호스트 페이지에 직접 영향을 주지는 않는다. 그러나 동일 iframe 내에서 DOMPurify 를 다른 목적으로 사용하는 코드가 추후 추가될 경우, 이 훅이 모든 `sanitize()` 호출에 적용되어 예상치 못한 `target="_blank"` + `rel` 주입이 발생할 수 있다. `hookInstalled` 가드로 1회만 설치하는 점은 긍정적이나, 훅 제거 경로가 없어 앱 생명주기 내에서 영구 등록된다.
- 제안: 현재 용도(링크 새 탭 강제)는 위젯 전역 정책으로 의도된 것이므로 수용 가능하다. 향후 DOMPurify 추가 사용 시 이 훅의 영향을 인지할 수 있도록 주석에 "글로벌 DOMPurify 훅 — 모든 sanitize 호출에 적용됨" 을 명시하는 것을 권장한다.

### [INFO] `ChartData` 인터페이스 확장 — optional 필드 추가로 하위 호환 유지
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` lines 46-50
- 상세: `ChartData` 에 `xLabel?: string` 와 `yLabel?: string` 이 추가되었다. 두 필드 모두 optional 이므로 기존 소비자 코드가 즉시 깨지지 않는다. codebase 내 `ChartData` 소비는 `presentations.tsx` 의 `ChartView` 뿐이며, 이미 업데이트되었다.
- 제안: 문제없음.

### [INFO] `CartesianChart` 신규 내부 컴포넌트 — `ChartView` 분리로 구조 변경
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`
- 상세: `ChartView` 에서 bar/line/area 렌더 로직이 `CartesianChart` 와 `PieChart` 로 분리되었다. 기존 `<div data-testid="wc-chart">` 래퍼는 유지되므로 테스트 선택자에 영향 없다. pie/donut 의 SVG `viewBox` 가 기존 `0 0 280 <H>` 에서 `0 0 140 140` 으로 변경되었으나, 테스트 파일에서 `viewBox` 를 직접 검증하는 코드가 없으므로 실질적 영향 없다.
- 제안: 문제없음.

### [INFO] `TemplateView` — `dangerouslySetInnerHTML` 도입
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx`
- 상세: 기존 `{rendered}` (React 텍스트 렌더) 에서 조건부로 `dangerouslySetInnerHTML={{ __html: safeHtml }}` 이 도입되었다. XSS 방어는 `DOMPurify.sanitize()` 가 담당하며, `safeHtml` 이 `null` 인 경우(text 포맷, SSR/static 빌드, `window` 미가용)에는 여전히 `{rendered}` 를 사용한다. sanitize 를 통과하는 의도적 부작용(링크에 `target="_blank"` 자동 주입)은 훅으로 명시적으로 제어되고 있다.
- 제안: 현재 구현은 적절하다. `DOMPurify` 의 `FORBID_TAGS` 에 `button` 이 포함되어 HTML 내의 버튼도 제거됨을 인지해야 한다 — 이는 의도된 동작이다.

### [INFO] `marked` 동기 모드 타입 단언
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts` line 26
- 상세: `marked.parse(rendered, { async: false }) as string` 타입 단언을 사용한다. `marked` v18 에서 `async: false` 는 동기 `string` 반환이 보장되지만, 향후 major 버전 변경 시 API 가 달라질 경우 런타임 오류 가능성이 있다. 현재 lock 파일은 `^18.0.4` 로 고정되어 있어 단기적 위험은 없다.
- 제안: 문제없음. 단 `marked` 메이저 버전 업그레이드 시 재검토 필요하다.

### [INFO] 환경 변수·파일시스템·네트워크 부작용 없음
- 상세: 변경된 모든 파일에서 `process.env` 읽기/쓰기, 파일시스템 접근, fetch/XHR/WebSocket 등 외부 네트워크 호출이 새롭게 도입되지 않았다. `typeof window === "undefined"` 체크는 런타임 전역 객체 감지이며 환경 변수 부작용이 아니다.
- 제안: 해당 없음.

## 요약

이번 변경은 channel-web-chat 위젯의 template presentation 에 DOMPurify + marked 기반 풍부 렌더를 추가하고, 차트 컴포넌트에 축 레이블·x틱·툴팁·범례를 보강한 것이다. 부작용 관점에서 가장 주목해야 할 점은 `safe-html.ts` 의 `hookInstalled` 모듈 레벨 변수와 `DOMPurify.addHook` 의 전역 DOMPurify 인스턴스 변경이다. 프로덕션 환경(iframe 내 단일 모듈 인스턴스)에서는 문제가 없지만, vitest 환경에서 모듈 캐시가 공유될 경우 훅 중복 등록 및 `hookInstalled` 상태 오염이 테스트 격리에 영향을 줄 수 있다. `ChartData` 인터페이스의 optional 필드 추가는 완전히 하위 호환되며, `dangerouslySetInnerHTML` 도입은 DOMPurify sanitize 경로 뒤에만 사용되어 XSS 위험이 적절히 통제되고 있다. 전반적으로 의도치 않은 외부 상태 변경·파일시스템 부작용·네트워크 호출·환경 변수 오염은 발견되지 않았다.

## 위험도

LOW

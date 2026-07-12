# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** `Object.freeze(WIDGET_STRINGS)` 는 shallow freeze 라 주석이 주장하는 "런타임 변형 방어"를 완전히 달성하지 못함
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts:39-40` (`export const WIDGET_STRINGS = Object.freeze({ ... })`)
  - 상세: `Object.freeze()` 는 최상위 객체(`WIDGET_STRINGS` 자체)만 동결한다. `WIDGET_STRINGS.ko = {...}` 같은 **최상위 프로퍼티 재할당**은 막히지만, `WIDGET_STRINGS.ko["composer.send"] = "변조"` 같은 **중첩(leaf) 프로퍼티 변경은 막히지 않는다** — `ko`/`en` 은 각각 별도 객체 참조이고 그 자체는 frozen 이 아니다. 도입 주석("`Object.freeze`: ... 런타임 변형(실수/외부 조작)까지 방어적으로 차단한다")이 실제 보호 범위보다 강하게 서술돼 있어, 향후 개발자가 "이 카탈로그는 완전히 불변"이라고 오신뢰할 위험이 있다. `WIDGET_STRINGS` 는 모듈 스코프의 사실상 전역 싱글턴이라, 한쪽 leaf 를 실수로 변조하면 그 프로세스의 모든 위젯 렌더에 즉시 전파되는데(멀티 인스턴스/멀티 탭 iframe 은 각자 별도 JS 컨텍스트라 크로스 인스턴스 오염은 아님) 현재 freeze 는 이를 막지 못한다.
  - 현재 코드베이스에서 `WIDGET_STRINGS` 는 read-only 로만 소비됨(`use-widget.ts`·`context.tsx`·`catalog.test.ts` 확인, 변조 코드 없음)을 확인했으므로 **지금 당장 활성 버그는 아님** — 방어 코드의 실효성과 주석 정확성에 대한 지적.
  - 제안: (a) leaf 까지 재귀적으로 freeze 하는 소형 `deepFreeze` 헬퍼로 교체하거나, (b) 그럴 필요가 없다고 판단되면 주석을 "최상위 `ko`/`en` 키 교체만 방지(leaf 값 변경은 비대상)"처럼 실제 보호 범위에 맞게 정정.

- **[INFO]** `Locale`/`TranslationKey` → `WidgetLocale`/`WidgetTranslationKey` 타입 rename 은 시그니처 변경이지만 외부 소비자 영향 없음(검증 완료)
  - 위치: `codebase/channel-web-chat/src/lib/i18n/{catalog.ts,context.tsx,index.ts,resolve-locale.ts}`, `codebase/channel-web-chat/src/widget/{widget-app.tsx,components/panel.tsx}`
  - 상세: `resolveLocale`/`makeTranslate`/`I18nProvider` 등 공개 함수의 파라미터·리턴 타입 이름이 바뀌었으나(§4 "시그니처 변경"/§5 "인터페이스 변경" 관점), 값 자체의 런타임 구조(`"ko"|"en"` 유니온)는 동일한 타입 별칭 rename 이라 런타임 동작 변화 없음. `grep` 으로 `codebase/` 전체를 확인한 결과 `frontend/src/lib/i18n` 의 동명 `TranslationKey`/`Locale`(별개 메인 앱 dict 시스템, `frontend/src/lib/i18n/core.ts` SoT)만 존재하고 `channel-web-chat/src/lib/i18n` 의 옛 타입명을 참조하는 외부 코드는 없음 — `codebase/channel-web-chat` 은 별도 정적 export 번들이라 다른 패키지(`codebase/packages/web-chat-sdk` 등)에서 import 되지 않는다. plan 문서(`plan/in-progress/webchat-i18n-followups-cleanup.md`)의 "외부 소비자 없음" 주장과 일치.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 테스트 전역 상태(`navigator.language`) 조작 헬퍼 추출은 격리 안전
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:30-39` (`withNavigatorLanguage`)
  - 상세: 기존에는 override 값을 하드코딩 `"ko-KR"` 로 복원했으나, 신규 헬퍼는 호출 시점의 실제 `navigator.language` 값을 캡처해 `finally` 에서 복원한다. 이 파일 내 `navigator.language` override 호출부는 해당 헬퍼 사용 1곳뿐이고, `vitest.setup.ts` 가 매 테스트 파일 로드 시 `"ko-KR"` 로 재설정하므로 오염 전파 위험은 없음. `try/finally` 로 assertion 실패 시에도 복원이 보장됨(기존 패턴과 동일 수준의 안전성 유지).
  - 제안: 없음.

- **[NONE]** `spec/7-channel-web-chat/2-sdk.md`, `_product-overview.md`, `spec/conventions/i18n-userguide.md`, `plan/in-progress/webchat-i18n-followups-cleanup.md` 변경은 문서(markdown)로 런타임/파일시스템/네트워크 부작용 없음.

## 요약

이번 변경셋은 PR #929 의 defer 항목 8건 중 side-effect 관련 항목(#1 타입 개명, #5 `Object.freeze`)과 부수 테스트 리팩터(#6~#8)를 포함한다. 타입 rename 은 순수 컴파일타임 별칭 변경으로 `codebase/` 전역 grep 검증 결과 외부 소비자·시그니처 실질 파급이 없음을 확인했고, 테스트 헬퍼 추출도 전역 `navigator.language` 상태 복원이 `try/finally` + `beforeEach` 이중 보장으로 안전하다. 유일하게 실질적으로 짚을 지점은 `WIDGET_STRINGS` 에 추가된 `Object.freeze` 가 shallow freeze 라 주석이 명시한 "런타임 변형까지 방어" 를 완전히 달성하지 못한다는 점이다 — 현재 코드에 변조 경로가 없어 즉각적 버그는 아니지만, 방어 코드의 실효성과 문서 정확성 측면에서 조치를 권장한다.

## 위험도

LOW

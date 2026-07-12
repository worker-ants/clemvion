# 테스트(Testing) 리뷰 — channel-web-chat 위젯 chrome i18n (EN 활성화)

## 검증 수행

- `cd codebase/channel-web-chat && npx vitest run` → **22 files / 335 tests, 전부 pass** (신규 3파일 `catalog.test.ts`·`context.test.tsx`·`resolve-locale.test.ts` 포함, 기존 `panel.test.tsx`·`composer.test.tsx`·`presentations.test.tsx`·`widget-app.test.tsx` 등 회귀 없음).
- `cd codebase/channel-web-chat && npx tsc --noEmit -p tsconfig.json` → 에러 0. `TranslationKey` 리터럴 유니온을 소비하는 6개 컴포넌트(`composer`/`dynamic-form`/`launcher`/`panel`/`presentations`/`use-widget`) 전체가 타입 체크를 통과 — "vitest 는 타입 strip" 이슈([`feedback_type_guard_test_actually_runs`])와 무관하게 컴파일 타임 키 존재 보장이 실제로 걸린다.

## 발견사항

- **[INFO]** `panel.tsx` 의 유일한 사용자 노출 에러 렌더(`role="alert"`, `t("error.generic")`) 를 직접 검증하는 테스트 부재
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (`{error && <div className="wc-error" role="alert">{t("error.generic")}</div>}`), `src/widget/components/panel.test.tsx`
  - 상세: 이번 diff 가 `{error}`(원문 그대로 렌더) → `{t("error.generic")}`(항상 고정 catalog 키로 지역화 렌더) 로 명시적으로 바꾼 경로다. `state.error` 는 `errMessage()` 가 항상 `GENERIC_ERROR_MESSAGE` 를 반환하므로 ko 렌더 결과는 이전과 동일해 회귀 위험은 낮지만, 정작 `panel.test.tsx`·`use-widget-eager-start.test.ts` 어디에도 `wc-error`/`role="alert"` 렌더 텍스트를 단언하는 테스트가 없다(에러→ended 전이만 검증). "렌더되는 에러는 항상 이 generic" 이라는 코드 주석의 불변식을 지키는 회귀 가드가 비어 있다.
  - 제안: `panel.test.tsx` 에 `state.error` 가 set 된 상태를 렌더해 `screen.getByRole("alert")` 텍스트가 (ko 기본) `"일시적인 오류로 대화를 진행할 수 없어요..."`(= `WIDGET_STRINGS.ko["error.generic"]`) 와 일치함을 단언하는 테스트 1개 추가.

- **[INFO]** EN 로케일에서 `confirm.yesAria` 중첩 보간(`t("confirm.yesAria", { label: t(confirmLabelKey) })`) 조합이 통합 레벨에서 미검증
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (`aria-label={t("confirm.yesAria", { label: t(CONFIRM_COPY[confirming].confirmLabelKey) })}`)
  - 상세: `context.test.tsx` 는 `makeTranslate("en")("confirm.yesAria", { label: "New chat" })` 처럼 **평문 파라미터**로만 보간을 검증한다. 실제 `panel.tsx` 는 `t()` 를 중첩 호출(`label` 자체가 또 다른 번역 결과)하는데, 이 조합은 기존 `panel.test.tsx` 의 ko 케이스("대화 종료 확정"/"새 대화 시작 확정")에서만 통합 검증되고, `widget-app.test.tsx` 에 신규 추가된 EN 테스트는 확인(confirm) 다이얼로그를 열지 않아 EN 경로에서 동일 조합이 올바르게 렌더되는지 실측하지 못한다.
  - 제안: `widget-app.test.tsx` EN 테스트 또는 `panel.test.tsx` 에 `I18nProvider locale="en"` 로 감싼 뒤 "New chat"/"End chat" 클릭 → `getByRole("button", { name: "Confirm New chat" })` 류 단언 1개 추가.

- **[INFO]** `makeTranslate` 방어적 폴백 체인의 뒤 2단계(`WIDGET_STRINGS.ko[key] ?? key`) 미검증
  - 위치: `codebase/channel-web-chat/src/lib/i18n/context.tsx:14` (`const template: string = dict[key] ?? WIDGET_STRINGS.ko[key] ?? key;`)
  - 상세: `TranslationKey` 타입이 컴파일 타임에 존재하지 않는 키 접근을 차단하므로, 정상 타입-안전 호출 경로에서는 `en` 결손 폴백·키 자체 폴백 분기 모두 도달 불가능한 방어 코드에 가깝다. `catalog.test.ts` 의 parity 가드가 `en` 결손을 이미 hard-fail 로 선차단하므로 실질 위험은 낮지만, 두 폴백 분기 모두 어떤 테스트로도 실행되지 않는다.
  - 제안: 선택적 — `makeTranslate(locale)(("nonexistent" as TranslationKey))` 형태로 타입 우회 호출 1개를 추가해 폴백 체인이 실제로 동작함을 문서화 목적으로 검증(우선순위 낮음, 필수 아님).

- **[INFO]** `navigator.language` override/restore 상용구가 반복될 가능성 — 헬퍼화 제안
  - 위치: `codebase/channel-web-chat/vitest.setup.ts` (전역 `ko-KR` 고정), `src/widget/widget-app.test.tsx` (auto-detect 테스트가 `Object.defineProperty` + `try/finally` 로 직접 override/restore)
  - 상세: 격리 자체는 올바르다(각 override 테스트가 `finally` 로 복원해 후속 테스트를 오염시키지 않음, `beforeEach` 의 fetch/DOM 리셋과도 독립적으로 안전). 다만 이 override/restore 패턴이 현재 위젯 전역에서 이번 1곳에만 등장하며, 향후 EN 관련 테스트가 늘어나면 동일 보일러플레이트가 반복될 가능성이 크다.
  - 제안: `withNavigatorLanguage(lang, fn)` 류 테스트 헬퍼를 `vitest.setup.ts` 또는 별도 test-utils 로 추출하면 가독성·실수 방지(복원 누락) 측면에서 유리. 필수 아님, 리팩터 제안.

## 강점 (참고)

- `resolve-locale.test.ts` 가 대소문자·구분자(`-`/`_`)·거짓양성 단어경계("english")·null/undefined 이중 표현·미지원 명시값 폴백까지 경계값을 촘촘히 커버.
- `catalog.test.ts` 는 존재 여부(parity)뿐 아니라 "빈 문자열 아님"·"보간 placeholder 집합 일치" 까지 3중 가드 — 향후 키 추가 시 누락을 구조적으로 차단.
- `context.test.tsx` 는 Provider 부재 시 ko 기본 폴백(`useContext` 기본값)까지 검증해, `composer.test.tsx`/`panel.test.tsx` 등 기존 컴포넌트 단위 테스트가 `I18nProvider` 없이도 그대로 통과하는 이유(회귀 0의 근거)를 스스로 증명.
- `presentations.test.tsx` 는 이번 diff 로 실제로 값이 바뀐 단 1개 단언(donut chart aria-label)만 정확히 갱신하고 나머지는 `getByTestId` 기반이라 불필요한 광범위 수정 없이 최소 diff 유지.
- `widget-app.test.tsx` 신규 2테스트는 "명시 locale 우선"과 "auto-detect" 우선순위 두 경로를 다른 컴포넌트 트리 깊이(런처만 vs 패널 하위 3개 aria-label)까지 내려가 검증 — Provider 전파가 실제 DOM 까지 도달함을 확인.
- 의존성 주입 설계가 테스트 용이성을 잘 반영: `resolveLocale(explicit, navigatorLang)` 은 순수함수로 전량 unit 커버되고, 전역 `navigator` 를 읽는 부분은 `currentNavigatorLang()` 한 곳으로 격리돼 있어 통합 테스트에서만 monkey-patch 가 필요.

## 요약

신규 위젯 로컬 i18n 모듈(`catalog`/`resolve-locale`/`context`) 은 콜로케이트 테스트 3종으로 순수 로직·경계값·parity 를 촘촘히 커버하고, 8개 컴포넌트 배선 변경에 대해서도 기존 335개 테스트가 전부 회귀 없이 통과하며(`vitest run` 실측), `tsc --noEmit` 도 클린해 `TranslationKey` 리터럴 유니온의 컴파일 타임 안전성이 실제로 작동함을 확인했다. 발견된 갭은 전부 INFO 수준 — (1) `panel.tsx` 의 유일한 사용자 노출 에러 렌더 자체를 직접 단언하는 테스트가 없고, (2) EN 로케일에서의 `confirm.yesAria` 중첩 보간 조합이 통합 레벨에서 미검증이며, (3) `makeTranslate` 의 방어적 폴백 체인 뒤 2단계가 타입 안전성에 가려져 실행되지 않는다. 셋 다 현재 동작을 깨뜨리지 않는 낮은 우선순위의 커버리지 보강 제안이다.

## 위험도

LOW

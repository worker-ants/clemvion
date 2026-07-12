# 요구사항(Requirement) 리뷰 결과

## 발견사항

- **[WARNING]** `Object.freeze` 가 shallow 라 주석이 약속한 "런타임 변형 방어적 차단"을 leaf 값(실제 번역 문자열) 수준에서 달성하지 못함
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts:8-9` (`// Object.freeze: ... 런타임 변형(실수/외부 조작)까지 방어적으로 차단한다.` + `export const WIDGET_STRINGS = Object.freeze({...} as const);`)
  - 상세: `Object.freeze()` 는 최상위 객체(`{ko, en}` 래퍼)만 동결한다. 실측(`node`):
    ```
    Object.freeze({a:{x:1}})
    top frozen: true / nested frozen: false
    obj.a.x = 999 → 성공(999)
    ```
    즉 `WIDGET_STRINGS.ko`/`WIDGET_STRINGS.en` 서브 객체와 그 leaf 문자열은 여전히 런타임에 재할당 가능하다(`WIDGET_STRINGS.ko["composer.send"] = "x"` 는 조용히 성공). 주석이 방어 대상으로 명시한 "실수/외부 조작"의 실질 표적은 최상위 `ko`/`en` 키 재할당이 아니라 개별 번역 문자열(leaf) 변조이므로, 현재 구현은 주석이 약속한 보호 범위를 채우지 못한다. 참고로 `as const` 는 이미 컴파일타임에 nested readonly 를 재귀적으로 부여하므로, 이 shallow freeze 가 추가로 막는 런타임 시나리오는 "TS 우회(`as any`/동적 키 접근)로 최상위 로케일 키를 통째로 바꿔치기" 정도로 한정된다.
  - 제안: 코드 유지 관점에서는 (a) `WIDGET_STRINGS.ko`/`.en` 까지 재귀적으로 동결하는 deep-freeze 로 바꾸거나, (b) 주석을 "최상위 로케일 키 재할당만 차단(leaf 값은 `as const` 컴파일타임 readonly 에만 의존)"으로 정정해 실제 보호 범위와 일치시킨다. 이번 변경은 `plan/in-progress/webchat-i18n-followups-cleanup.md` #5(INFO 항목, "런타임 불변 방어")의 이행이므로 기능적으로 치명적이지는 않으나(방어적 코드일 뿐 정상 동작에 영향 없음), 주석·구현 간 괴리는 정정 대상.

- **[INFO]** spec fidelity: 이번 diff 의 실질 대상은 `spec/7-channel-web-chat/1-widget-app.md §4`(chrome i18n 메커니즘 SoT)이며, 해당 문서는 타입명(`WidgetLocale`/`WidgetTranslationKey`)을 언급하지 않아 이번 개명과 직접 충돌하지 않는다. 함께 수정된 3개 spec 문서(`2-sdk.md`, `_product-overview.md`, `i18n-userguide.md`)는 이번 PR 자체가 "spec 갱신"을 포함하는 cleanup 작업이라 SPEC-DRIFT 대상이 아니라 이번 커밋의 정상 산출물이다. 서술·표(§4 목표 승격, `locale` 주석, dev-only 데모 P6 예외)와 실제 코드가 line-level 로 일치함을 확인(아래 검증 참고).

## 검증 근거 (재현 로그)

- 리네임(`Locale`→`WidgetLocale`, `TranslationKey`→`WidgetTranslationKey`) 전수 반영 확인: `codebase/channel-web-chat/src` 내 옛 이름 잔존 0건(데모 UI 라벨 `"Locale"` 은 무관한 문자열, 변경 불필요 대상이 맞음). 외부 소비자(`codebase/packages/**`) 미참조 확인 — plan 의 "외부 소비자 없음" 주장과 일치.
- `pnpm exec tsc --noEmit`: 에러 없음.
- `pnpm exec eslint` (변경 파일 대상): 에러 없음.
- `pnpm exec vitest run`(channel-web-chat 전체): **22 test files / 339 tests 전부 통과** — plan 의 "unit(339) PASS" 주장과 일치. 신규 테스트 3건(§confirm.yesAria 중첩 보간, makeTranslate 폴백 체인, `withNavigatorLanguage` 리팩터)도 포함되어 통과.
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`: **13/13 통과** — plan 의 "spec-link-integrity 13/13" 주장과 일치.
- `i18n-userguide.md` 신규 P6 예외 문구("dev-only 시뮬레이터는 P6 스코프 밖")를 `codebase/channel-web-chat/src/app/demo/demo-host.tsx` 실제 파일과 대조 — 합쇼체("~습니다") 문자열이 실제로 잔존함을 확인, 서술이 코드 현황과 일치.
- `Panel` 신규 테스트(EN `confirm.yesAria` 중첩 보간)는 `isActiveConversationPhase`(`streaming`/`awaiting_user_message`)·`CONFIRM_COPY` 매핑과 정합적으로 시나리오를 구성함을 소스 대조로 확인(“New chat” 클릭 → 확인바 → `t("confirm.yesAria", {label: t("confirm.newYes")})` = "Confirm Start new chat").
- `makeTranslate` 폴백 체인 테스트는 `dict[key] ?? WIDGET_STRINGS.ko[key] ?? key` 순서와 정확히 대응.
- TODO/FIXME/HACK/XXX 주석: 신규 diff 내 0건.
- 반환값/에러 시나리오: 이번 diff 는 타입 개명·주석·테스트·freeze 추가·spec 문서 정합화로 함수 시그니처·분기·에러 경로 변경 없음(순수 refactor + 문서/테스트 보강) — 회귀 위험 낮음.

## 요약

이번 변경은 PR #929(위젯 chrome EN 다국어화) 이후 defer 됐던 8건의 비차단 cosmetic/coverage 항목을 정리하는 순수 리팩터·문서·테스트 보강 작업이다. 타입 개명(`Locale`→`WidgetLocale`, `TranslationKey`→`WidgetTranslationKey`)은 전수 반영되어 컴파일·린트·전체 유닛 테스트(339)·spec-link-integrity(13/13)가 모두 통과하며, 함께 갱신된 3개 spec 문서(`2-sdk.md`/`_product-overview.md`/`i18n-userguide.md`)는 실제 코드·데모 파일 상태와 line-level 로 일치한다. 유일한 실질 발견사항은 `Object.freeze` 가 shallow 라 주석이 명시한 "런타임 변형(실수/외부 조작)까지 방어적으로 차단" 이라는 보장이 leaf 번역 문자열까지는 미치지 못한다는 점이며, 방어적 코드 성격상 정상 동작에는 영향이 없으나 주석·구현 간 괴리로 정정을 권한다(deep-freeze 로 보강하거나 주석 범위를 축소 정정). 그 외 기능 완전성·엣지 케이스·에러 시나리오·반환값 측면에서는 순수 refactor + 문서/테스트 보강이라 새로운 결함이 없다.

## 위험도
LOW

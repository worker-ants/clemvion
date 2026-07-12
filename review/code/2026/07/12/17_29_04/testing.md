# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `Object.freeze(WIDGET_STRINGS)` 의 "런타임 변형 방어" 주장이 검증되지 않음 — shallow freeze 라 실제로는 leaf 값 변형을 막지 못함
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts:39-40` (`Object.freeze({...} as const)`), 커버 테스트 부재: `codebase/channel-web-chat/src/lib/i18n/catalog.test.ts`
  - 상세: 추가된 주석은 "런타임 변형(실수/외부 조작)까지 방어적으로 차단한다"고 명시하지만, `Object.freeze()`는 **얕은(shallow) 동결**이라 최상위 객체(`WIDGET_STRINGS` 자체, 즉 `ko`/`en` 프로퍼티 재할당)만 보호하고, 중첩된 `WIDGET_STRINGS.ko`/`WIDGET_STRINGS.en` leaf 사전은 동결되지 않는다. 직접 재현: `Object.isFrozen(WIDGET_STRINGS)` → `true`, `Object.isFrozen(WIDGET_STRINGS.ko)` → `false`, 그리고 `WIDGET_STRINGS.ko["composer.send"] = "HACKED"` 대입이 **예외 없이 성공**하고 값이 실제로 바뀐다(이 worktree 에서 vitest 로 직접 검증함, 이 스크래치 테스트는 검증 후 삭제함). 즉 이번 변경이 주장하는 방어 효과의 핵심(leaf 문자열 변형 차단)은 실제로 달성되지 않았는데, `catalog.test.ts`에는 이 동작을 검증하는 테스트가 전혀 없어 이 괴리가 리뷰·CI 어디서도 잡히지 않는다.
  - 제안: (a) 의도가 leaf 까지 보호하는 것이라면 재귀적 freeze(예: `deepFreeze` 헬퍼 또는 `ko`/`en` 각각에도 `Object.freeze` 적용)로 교정하고, `catalog.test.ts`에 `Object.isFrozen(WIDGET_STRINGS.ko)`·leaf 변형 시도가 strict-mode throw 하는지 검증하는 테스트를 추가한다. (b) 최상위 방어만으로 충분하다는 의도라면 주석 문구를 "최상위 `ko`/`en` 프로퍼티 재할당만 방지(leaf 값 자체는 미보호)"로 정정해 실제 보장 범위와 일치시킨다. 어느 쪽이든 최소 `Object.isFrozen(WIDGET_STRINGS)` 를 단언하는 회귀 테스트 1개는 추가해, 향후 리팩터로 `Object.freeze` 호출이 조용히 제거되는 것을 막아야 한다.

- **[INFO]** `context.test.tsx` 의 신규 폴백 체인 테스트는 마지막 분기(`?? key`)만 커버, 중간 분기(en 미보유 → ko 폴백)는 미검증
  - 위치: `codebase/channel-web-chat/src/lib/i18n/context.test.tsx:168-172`, 대상 코드: `codebase/channel-web-chat/src/lib/i18n/context.tsx:299` (`dict[key] ?? WIDGET_STRINGS.ko[key] ?? key`)
  - 상세: `"nope.missing.key" as never` 캐스팅으로 두 사전 모두에 없는 키를 조회해 최종 `?? key` 분기만 검증한다. 중간 분기(`dict[key]` undefined 이나 `WIDGET_STRINGS.ko[key]` 는 존재 — 즉 en 사전에만 결손이 있는 실제 케이스)는 여전히 미검증인 채로 남는다. 다만 `catalog.test.ts` 의 parity 하드-fail 가드가 이 상황 자체를 커밋 시점에 차단하므로 프로덕션에서는 실질적으로 도달 불가능한 방어 코드이며, 테스트 자체의 주석도 이를 명시하고 있어 의도적 트레이드오프로 보인다. 완전성을 위해서라면 `WIDGET_STRINGS` 를 vi.mock 하지 않고, en 사전에서 임시로 한 키를 삭제한 로컬 fixture 사전을 만들어 `makeTranslate` 로직만 별도로 단위 검증하는 방법도 있으나, 현재 커버리지로도 실질 리스크는 낮다.
  - 제안: 우선순위 낮음. 필요 시 위 코멘트에 "중간 분기는 parity 가드에 의해 프로덕션에서 도달 불가"임을 한 줄 더 명시하면 향후 리뷰어의 재질문을 줄일 수 있다.

- **[INFO]** 신규 `Panel` EN 중첩 보간 테스트는 좋은 통합 테스트이나 액션 배선(`newChat` 호출)까지는 검증하지 않음
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx:436-452`
  - 상세: `confirm.yesAria` 중첩 보간(`t("confirm.yesAria", { label: t(...) })`)이 실제 렌더된 aria-label 텍스트("Confirm Start new chat")로 정확히 나타나는지 `getByRole` 로 검증하는 점이 좋다. 다만 확정 버튼을 클릭해 `actions.newChat` 이 실제 호출되는지는 검증하지 않는다 — 이는 이미 같은 파일의 "'새 대화' 확인 → newChat 호출" 테스트(라인 754-771, KO 로케일)가 커버하므로 중복을 피한 합리적 스코프 분리다. 결함 아님, 확인 차 기록.
  - 제안: 없음 (현행 유지 권장).

- **[INFO]** `withNavigatorLanguage` 헬퍼 추출 — 격리·가독성 개선, 리그레션 없음
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:1030-1039`, 적용부: 1182-1188
  - 상세: 기존 인라인 try/finally 패턴을 헬퍼로 승격했고 동작은 동일(`finally` 블록에서 `navigator.language` 원복). 현재 사용처는 1곳뿐이라 추출 효익은 크지 않지만, 플랜 문서(`plan/in-progress/webchat-i18n-followups-cleanup.md`)가 명시한 "향후 auto-detect 관련 테스트 추가 대비" 목적과 일치하며 부작용 없음. 실행 확인 결과 해당 파일 포함 5개 테스트 파일 42개 테스트 전부 통과(로컬 `vitest run` 재현).
  - 제안: 없음.

- **[INFO]** `Locale`→`WidgetLocale`, `TranslationKey`→`WidgetTranslationKey` 리네이밍은 타입 전용 변경으로 런타임 테스트 불필요, 잔존 참조 없음 확인
  - 위치: `catalog.ts`/`context.tsx`/`index.ts`/`resolve-locale.ts`/`panel.tsx` 전반
  - 상세: `grep -rn "\bTranslationKey\b"` / `\bLocale\b`(WidgetLocale 제외) 로 `codebase/channel-web-chat/src` 전수 검색한 결과, 데모 호스트의 UI 라벨 문자열(`demo-host.tsx:176`, `<Field label="Locale">`, 의도된 잔존) 외 스트레이 참조 없음. 타입 전용 리네이밍이라 동작 변화가 없고, 기존 회귀 테스트(42개)가 그대로 통과해 behavior-preserving 리팩터임을 뒷받침한다.
  - 제안: 없음.

## 요약
이번 변경은 대부분 타입 리네이밍(behavior-preserving)과 defer 되었던 테스트 커버리지 보강(EN 중첩 보간, 미지 키 폴백, 테스트 헬퍼 추출) 3건으로, 관련 42개 테스트가 전부 통과하고 리네이밍 잔존 참조도 없어 회귀 위험은 낮다. 다만 `Object.freeze(WIDGET_STRINGS)` 는 방어 목적을 명시한 주석과 달리 shallow freeze 라 leaf 문자열 변형을 실제로 막지 못하는데(직접 재현으로 확인: `WIDGET_STRINGS.ko["composer.send"] = "HACKED"` 가 예외 없이 성공), 이를 검증하는 테스트가 전혀 없어 "새 런타임 방어 기능이 실제로는 동작하지 않는다"는 결함이 리뷰·CI 양쪽에서 조용히 통과했다. 이 부분만 보강(deep freeze 로 교정하거나 최소 `Object.isFrozen` 회귀 테스트 추가)하면 이번 변경 세트의 테스트 품질은 양호하다.

## 위험도
MEDIUM

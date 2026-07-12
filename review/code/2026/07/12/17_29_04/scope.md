# 변경 범위(Scope) 리뷰

## 대상 개요

13개 파일(`codebase/channel-web-chat` 9개 + `plan/in-progress` 신규 1개 + `spec` 3개), 총 98줄 추가/32줄 삭제. `git diff origin/main...HEAD --stat` 결과가 리뷰 payload 와 완전히 일치함을 확인(누락·왜곡 없음).

이 changeset 은 신규 plan `plan/in-progress/webchat-i18n-followups-cleanup.md` 가 명시하는 **정확히 8개 처리 항목**(PR #929 `/ai-review` accept-with-rationale defer 잔여분)을 실행한 것이다. 각 코드/스펙 파일 diff 를 8개 항목에 1:1 대사(mapping)한 결과는 다음과 같다.

| 파일 | 대응 plan 항목 | 부합 여부 |
|---|---|---|
| `catalog.ts` | #1(`Locale`/`TranslationKey`→`WidgetLocale`/`WidgetTranslationKey` 개명), #5(`Object.freeze`) | 일치 |
| `context.test.tsx` | #7(폴백 체인 테스트) | 일치 |
| `context.tsx` | #1(개명) | 일치 |
| `index.ts` | #1(개명) | 일치 |
| `resolve-locale.ts` | #1(개명) | 일치 |
| `panel.test.tsx` | #6(EN `confirm.yesAria` 중첩 보간 통합 테스트) | 일치 |
| `panel.tsx` | #1(개명) | 일치 |
| `widget-app.test.tsx` | #8(`withNavigatorLanguage` 헬퍼 추출 + auto-detect 테스트 리팩터) | 일치 |
| `widget-app.tsx` | #1(개명) | 일치 |
| `plan/in-progress/webchat-i18n-followups-cleanup.md` | 작업 자체의 추적 문서(신규) | 컨벤션상 정상 |
| `spec/7-channel-web-chat/2-sdk.md` | #3(설치 스니펫 `locale` 주석) | 일치 |
| `spec/7-channel-web-chat/_product-overview.md` | #4(EN 다국어화를 "비목표" 예외문구 → "목표(v1)" 목록으로 이동) | 일치 |
| `spec/conventions/i18n-userguide.md` | #2(dev-only 데모 host P6 스코프 밖 명문화) | 일치 |

13개 파일 전부가 8개 항목 중 하나(또는 두 개, `catalog.ts` 는 #1+#5)에 정확히 대응하며, 그 외의 diff hunk 는 발견되지 않았다. 각 항목이 원래 별건 리뷰(PR #929)에서 이미 WARNING/INFO 로 합의·발급된 defer 였다는 점에서, 이번 changeset 의 "의도된 범위"는 그 plan 문서가 SoT 로 명시한 8항목이다.

## 발견사항

### [INFO] 개명(#1)이 6개 파일에 분산 — 응집도상 자연스러운 fan-out, scope creep 아님
- 위치: `catalog.ts`, `context.tsx`, `index.ts`, `resolve-locale.ts`, `panel.tsx`, `widget-app.tsx`
- 상세: `Locale`/`TranslationKey` 타입명이 위젯 i18n 모듈 전역에서 re-export 되며 소비되는 구조라, 개명 시 6개 파일 전부가 함께 바뀌는 게 불가피하다. 각 hunk 는 타입 식별자 치환만 수행하고(로직·값 변경 없음), plan 서술("`\b` 단어경계 sed 로 `resolveLocale`·`LocaleContext`·데모 `label="Locale"` 온전")과도 부합한다.
- 상세(검증): diff 상 각 파일의 변경은 문자 그대로 `Locale`→`WidgetLocale`, `TranslationKey`→`WidgetTranslationKey` 치환뿐이며 그 외 로직 변경 없음.
- 제안: 없음(정상 fan-out).

### [INFO] `catalog.ts` 의 `Object.freeze` 추가(#5) — 런타임 동작에 미세한 side effect 추가지만 plan 에 명시적으로 승인된 항목
- 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts:40,144`
- 상세: `as const` → `Object.freeze({...} as const)` 로 감싸 컴파일타임 불변에 런타임 불변을 추가. 코드 자체 동작(문자열 조회)에는 영향 없고 방어적 변형 차단만 추가하는 minimal 변경. 별도 검증 테스트는 추가되지 않았으나 plan 항목 자체가 "side_effect INFO" 로 원 리뷰에서 이미 등급 매겨진 항목이라 이번 changeset 규모에서 과도하다고 보기 어렵다.
- 제안: 없음.

### [INFO] `_product-overview.md` 편집은 순수 이동(move)이며 신규 서술 확장 없음
- 위치: `spec/7-channel-web-chat/_product-overview.md:36-56`
- 상세: 기존 "비목표" 블록에 있던 EN 다국어화 승격 서술(6줄)을 "목표 (v1)" 블록으로 옮기고, 비목표 쪽에는 짧은 상호참조 문구만 남겼다. 내용 총량은 거의 보존되고 위치만 재배치됐다 — 신규 결정·범위 확장이 아니라 문서 구조 정리(plan #4 그대로).
- 제안: 없음.

## 무관한 수정 / 불필요한 리팩토링 / 포맷팅·주석·임포트·설정 변경 점검 결과

- **무관한 파일/영역**: 없음. `codebase/frontend`, `codebase/backend`, `codebase/packages` 등 다른 영역 파일은 전혀 건드리지 않았다.
- **불필요한 리팩토링**: `widget-app.test.tsx` 의 `withNavigatorLanguage` 헬퍼 추출은 단일 테스트에 국한된 인라인 try/finally 를 재사용 가능한 헬퍼로 뽑은 것으로, plan #8 이 명시적으로 요청한 항목이며 다른 테스트를 건드리지 않았다(diff 범위가 해당 hunk 로 정확히 국한).
- **기능 확장(over-engineering)**: 없음. `Object.freeze` 도 1줄 추가일 뿐 새 API·새 옵션·새 분기를 만들지 않는다.
- **포맷팅 변경 혼입**: 없음. 각 hunk 가 최소 diff(치환/삽입 라인)로 정밀하다 — 들여쓰기·개행 등 무관한 재포맷팅 흔적 없음.
- **주석 변경**: `catalog.ts` 의 `Object.freeze` rationale 주석 1줄, `widget-app.test.tsx` 의 헬퍼 설명 주석은 모두 해당 diff 라인과 직결된 근거 설명이며 무관한 주석 삭제/추가는 없음.
- **임포트 변경**: `panel.test.tsx` 에 `I18nProvider` 신규 import 는 같은 hunk 에서 추가된 새 테스트가 실사용. 미사용 import 정리나 불필요한 재배열은 없음.
- **설정 변경**: 없음(`package.json`/`tsconfig`/CI 설정 등 미포함).

## 요약

이 changeset 은 `plan/in-progress/webchat-i18n-followups-cleanup.md` 가 명시한 정확히 8개 사전 합의 항목(PR #929 defer 잔여분)을 실행한 것으로, 13개 변경 파일 전부가 8개 항목 중 하나 이상에 정밀하게 대응된다. 개명이 6개 파일로 fan-out 된 것은 타입 re-export 구조상 불가피한 정상 범위이며, `Object.freeze` 추가나 문서 이동도 plan 에 명시된 minimal 변경 그대로다. 요청 외 추가 수정, 무관한 리팩토링, 포맷팅/주석/임포트/설정 노이즈는 발견되지 않았다.

## 위험도

NONE

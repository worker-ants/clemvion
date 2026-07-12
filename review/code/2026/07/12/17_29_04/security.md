> **복구본**: disk-write gap — journal 복구.

### 발견사항

- **[INFO]** `Object.freeze(WIDGET_STRINGS)` 추가는 방어적 하드닝
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` (WIDGET_STRINGS 선언부)
  - 상세: `as const` 는 컴파일타임 불변만 보장하므로 런타임에 오브젝트 변형(실수 또는 악의적 스크립트 주입)이 가능했다. `Object.freeze` 로 런타임 불변까지 보강한 것은 supply-chain/런타임 변조 방어 관점에서 긍정적 조치다. 다만 얕은 freeze(top-level)만 적용되어 `WIDGET_STRINGS.ko` 내부 객체는 여전히 변경 가능하나, 위젯 chrome 문자열은 사용자 입력이 아니라 정적 카탈로그이므로 실질 위험은 낮다.
  - 제안: 별도 조치 불필요(정보성).

- **[INFO]** 번역 문자열 보간(`{{name}}`)은 정적 템플릿 대상이라 인젝션 경로 없음
  - 위치: `codebase/channel-web-chat/src/lib/i18n/context.tsx` `makeTranslate()`
  - 상세: `template.replace(/\{\{(\w+)\}\}/g, ...)` 로 사용자 제공 `params` 값을 문자열에 삽입하지만, (1) `template` 은 항상 정적 카탈로그(`WIDGET_STRINGS`)에서 오고 사용자 입력이 아니며, (2) 삽입 결과는 React JSX `{t(...)}` 로 렌더되어 React 의 기본 텍스트 이스케이핑을 거친다(`dangerouslySetInnerHTML` 미사용). 따라서 XSS 벡터가 아니다.
  - 제안: 조치 불필요. 향후 `dangerouslySetInnerHTML` 등으로 렌더 방식이 바뀔 경우 재검토 필요.

- **[INFO]** 타입 리네이밍(`Locale`→`WidgetLocale`, `TranslationKey`→`WidgetTranslationKey`)은 컴파일타임 전용 변경
  - 위치: `catalog.ts`, `context.tsx`, `context.test.tsx`, `index.ts`, `resolve-locale.ts`, `panel.tsx`, `widget-app.tsx`
  - 상세: 순수 타입 별칭 개명이며 런타임 로직·검증 로직 변화 없음. 보안에 영향 없음.

- **[INFO]** 에러 메시지 노출 방지 테스트 강화(긍정적)
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.test.tsx` (`state.error 설정 시... 원값 미노출`)
  - 상세: `state.error = "raw-internal-signal"` 이 그대로 화면에 노출되지 않고 항상 generic 문구(`error.generic`)로 지역화되어 표시됨을 검증한다. 이는 내부 에러 상세 노출을 차단하는 기존 설계를 회귀 없이 유지함을 확인하는 유효한 보안 회귀 테스트다. 이번 diff 자체는 기존 테스트를 이동/재배치한 것으로 신규 위험 없음.

- **[INFO]** `navigator.language` override 헬퍼(`withNavigatorLanguage`) 는 테스트 전용, try/finally 로 전역 상태 복원 보장
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx`
  - 상세: 프로덕션 코드 경로가 아니며 `finally` 블록으로 원복을 보장해 테스트 간 오염을 방지한다. 보안 이슈 없음.

- **[INFO]** spec/plan 문서 변경(`2-sdk.md`, `_product-overview.md`, `i18n-userguide.md`, 신규 plan 파일)
  - 상세: 문서·주석 변경으로 코드 실행 경로에 영향 없음. 하드코딩 시크릿·민감정보 노출 없음(설치 스니펫의 `apiBase`/`triggerEndpointPath` 는 기존 placeholder 이며 "공개 webhook path (비밀 아님)" 으로 명시되어 있어 시크릿이 아님).

### 요약
이번 변경분은 웹채팅 위젯의 i18n 타입 리네이밍(`Locale`/`TranslationKey` → `WidgetLocale`/`WidgetTranslationKey`), `WIDGET_STRINGS` 에 대한 `Object.freeze` 방어 강화, 관련 테스트 추가(EN 확인 다이얼로그 중첩 보간, 미지 키 폴백, navigator.language 테스트 헬퍼 리팩터), 그리고 spec/plan 문서 갱신으로 구성된 순수 cosmetic/coverage 성격의 PR이다. 런타임 로직·데이터 흐름·인증/인가 경로에 대한 실질적 변경이 없으며, 문자열 보간은 정적 카탈로그를 대상으로만 동작하고 React 텍스트 렌더링을 통해 자동 이스케이프되므로 XSS 벡터가 없다. 하드코딩된 시크릿, 인젝션 취약점, 인증/인가 결함, 안전하지 않은 암호화, 민감정보 노출 에러 처리 등 어떤 항목에서도 문제가 발견되지 않았다. `Object.freeze` 추가는 오히려 런타임 변조에 대한 방어를 강화하는 긍정적 조치다.

### 위험도
NONE

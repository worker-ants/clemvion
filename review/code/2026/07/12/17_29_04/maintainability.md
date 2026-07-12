> **복구본**: disk-write gap — journal 복구.

### 발견사항

- **[WARNING]** `Object.freeze`가 top-level만 얕게 동결하는데, 주석은 "런타임 변형(실수/외부 조작)까지 방어적으로 차단"한다고 전체 방어를 주장
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts:39-40` (`// Object.freeze: ... 방어적으로 차단한다` 주석 + `export const WIDGET_STRINGS = Object.freeze({...} as const);`)
  - 상세: `Object.freeze`는 얕은 동결이라 `WIDGET_STRINGS` 객체 자체(top-level `ko`/`en` 키 재할당·신규 키 추가)만 막고, 실제 번역 문자열이 담긴 `WIDGET_STRINGS.ko`/`WIDGET_STRINGS.en` 내부 객체는 그대로 mutable이다. 직접 검증한 결과 `WIDGET_STRINGS.ko["composer.send"] = "MUTATED"`는 예외 없이 성공한다(`Object.isFrozen(WIDGET_STRINGS.ko)` === `false`). 즉 정작 방어하려는 "번역 문자열 실수/외부 조작"의 대부분 사례(leaf 값 변경)는 이 코드로 막히지 않는데, 주석은 이를 보장하는 것처럼 읽혀 향후 유지보수자가 실제 보호 범위를 오해할 소지가 있다.
  - 제안: (a) 재귀적으로 동결하는 `deepFreeze` 헬퍼로 교체해 실질적 방어를 제공하거나, (b) 실질 방어가 top-level 한정임을 정확히 반영하도록 주석을 "`WIDGET_STRINGS` 객체 자체의 재할당/키 추가만 차단(얕은 freeze) — 리프 값 변형까지 막으려면 별도 deep-freeze 필요"로 수정한다. 어느 쪽이든 의도와 실제 동작을 일치시켜야 한다.

- **[INFO]** `Object.freeze` 추가에 대해 런타임 동결 효과를 검증하는 테스트가 없음
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.test.ts` (미변경 — freeze 관련 테스트 부재)
  - 상세: `WIDGET_STRINGS ko/en parity` describe에는 parity·비어있지 않은 문자열·보간 placeholder 검증만 있고, `Object.freeze`가 실제로 어떤 수준의 변형을 막는지(top-level만) 확인하는 테스트는 없다. 위 WARNING과 결합하면 얕은 freeze라는 사실이 향후 회귀로도 드러나지 않는다.
  - 제안: `expect(Object.isFrozen(WIDGET_STRINGS)).toBe(true)` 정도의 최소 스모크 테스트를 추가하거나, 위 WARNING 해소(deep freeze) 시 nested 객체 동결도 함께 검증.

- **[INFO]** `withNavigatorLanguage` 테스트 헬퍼가 현재 단일 호출부에서만 사용됨
  - 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx:1030-1039` (정의), `:1184` (유일한 호출부)
  - 상세: try/finally 기반 override-restore 패턴을 헬퍼로 추출한 것 자체는 좋은 방향(중복 제거 의도)이나, 현재 diff 시점에는 호출부가 하나뿐이라 추상화의 실익이 즉시 드러나지 않는다. 다만 이후 locale 관련 테스트가 늘어날 걸 대비한 선제적 추출로 보이며 위험도는 낮다.
  - 제안: 조치 불필요(향후 재사용 시 정당화됨). 참고로만 남김.

### 요약
이번 변경은 `Locale`/`TranslationKey` → `WidgetLocale`/`WidgetTranslationKey` 개명(메인 앱 동명 타입과의 혼동 해소), `WIDGET_STRINGS`에 `Object.freeze` 추가, 그리고 테스트 커버리지 보강(폴백 체인·중첩 보간·navigator.language 헬퍼 추출)으로 구성된 순수 리팩터/보강이다. 개명은 전 파일에 걸쳐 누락 없이 일관되게 적용됐고(`grep`으로 잔존 참조 없음 확인), 위젯 접두사 네이밍 컨벤션(`WidgetState`류)과도 정합적이다. 신규 테스트는 의도와 근거를 주석으로 상세히 남겨 가독성이 높고, `withNavigatorLanguage` 헬퍼 추출은 중복 제거 방향으로 긍정적이다. 유일한 실질적 지적사항은 `Object.freeze`가 얕은 동결임에도 주석이 전체 방어를 주장하는 점으로, 향후 유지보수자에게 실제 보호 범위에 대한 오해를 줄 수 있어 주석 정정 또는 deep-freeze 전환이 바람직하다. 그 외 함수 길이·중첩 깊이·매직넘버·순환 복잡도 관점에서는 문제되는 변경이 없다.

### 위험도
LOW

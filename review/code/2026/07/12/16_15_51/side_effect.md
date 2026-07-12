### 발견사항

- **[WARNING] `panel.tsx` 에러 렌더가 `state.error` 값 내용에서 분리됨 (data-driven → 상수 렌더)**
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx` (변경 전 `{error && <div ...>{error}</div>}` → 변경 후 `{error && <div ...>{t("error.generic")}</div>}`)
  - 상세: 기존 코드는 `state.error` 에 담긴 문자열을 그대로 렌더했다. 이번 변경은 `error` 를 **진위(truthy) 게이트로만** 쓰고 실제 표시 텍스트는 항상 고정 키 `t("error.generic")` 로 대체한다. 현재는 `use-widget.ts` 의 `GENERIC_ERROR_MESSAGE`(= `WIDGET_STRINGS.ko["error.generic"]`)가 `state.error` 에 들어가는 유일한 값이라는 불변식이 코드 주석("렌더되는 에러는 항상 generic … BLOCKED 코드는 blocked phase 라 미렌더")으로만 보장되고, 타입 시스템은 이를 강제하지 않는다(`error` 는 여전히 일반 `string | null`). 향후 다른 에러 경로가 `state.error` 에 다른 문자열(예: 더 구체적인 진단 메시지)을 넣더라도 UI 는 **항상 동일한 generic 문구만** 보여주고 실제 값은 침묵 무시된다 — locale 활성화(EN 지원) 자체를 위해 필요한 의도된 변경이지만, "표시 = 실제 상태값" 이라는 기존 불변식이 깨졌다는 점은 향후 유지보수자에게 잠재적 함정이다.
  - 제안: `state.error` 를 `boolean`(또는 `{ kind: 'generic' } | null` 같은 판별 유니언)으로 좁혀 "항상 generic 만 렌더" 라는 불변식을 타입으로 강제하거나, 최소한 이 지점에 "state.error 의 실제 문자열 값은 UI 미반영, console 진단 전용" 임을 명시하는 주석을 좀 더 눈에 띄게(코드 리뷰/온보딩 시 놓치기 쉬운 위치이므로) 남길 것.

- **[WARNING] `BootConfig.locale` 활성화 = 기존 저장된 운영 콘솔 설정의 런타임 동작이 재배포 즉시 바뀜**
  - 위치: `spec/7-channel-web-chat/2-sdk.md` §R6, `spec/7-channel-web-chat/5-admin-console.md` §4, `codebase/channel-web-chat/src/widget/widget-app.tsx` (`resolveLocale(config?.locale, ...)`)
  - 상세: 이전에는 `locale` 이 reserved/inert 필드라 운영 콘솔에서 이미 `en` 을 선택·저장해 둔 트리거가 있어도 위젯은 항상 한국어를 렌더했다. 이번 배포로 `resolveLocale` 이 실제로 `config.locale` 을 소비하게 되면서, **코드 재배포 시점에 기존에 저장돼 있던 `locale: 'en'` 값을 가진 트리거는 운영자의 추가 조작 없이 즉시 위젯 chrome 이 영문으로 전환**된다(서버 데이터·운영 콘솔 UI 는 무변경, 순수 클라이언트 소비 로직 변경만으로 발생하는 표시 동작 변화). 의도된 기능 활성화이고 spec/consistency-check 로 검토됐지만, "죽어있던 필드가 배포 순간 살아나 기존 데이터에 즉시 영향" 이라는 side-effect 자체는 배포 커뮤니케이션(운영자 공지) 관점에서 짚어둘 가치가 있다.
  - 제안: 배포 노트/릴리스 공지에 "이미 `locale='en'` 으로 저장된 웹채팅 인스턴스는 이번 배포부터 실제로 영문 chrome 이 렌더됩니다" 를 명시할 것을 권고(코드 수정 요구 아님, 배포 커뮤니케이션 확인 차원).

- **[INFO] `vitest.setup.ts` 가 전역 `navigator.language` 를 패키지 전체 테스트 기본값으로 고정**
  - 위치: `codebase/channel-web-chat/vitest.setup.ts` — `Object.defineProperty(navigator, "language", { value: "ko-KR", configurable: true })`
  - 상세: 이 setup 파일은 `channel-web-chat` 패키지의 **모든** 테스트 파일에 적용되는 global setup 이라, `navigator.language` 의 jsdom 기본값(`en-US`)을 영구히 `ko-KR` 로 덮어쓴다. i18n 관련 회귀(대다수 위젯 테스트의 KO chrome 단언이 깨지는 문제)를 막기 위한 의도된 조치이고 주석으로 근거가 잘 남아있으나, **이 setup 이후 작성되는 무관한 테스트**가 `navigator.language` 를 명시적으로 확인하지 않고 암묵적으로 jsdom 기본값(en-US)을 기대하면 조용히 다른 결과를 얻게 된다(예: 향후 다른 브라우저-locale 의존 기능 테스트). `widget-app.test.tsx` 의 신규 auto-detect 테스트는 `try/finally` 로 원복하므로 안전하지만, 이는 패키지 전체 테스트 스위트의 암묵적 전제를 바꾸는 global mutation 이라는 점은 인지해 둘 필요가 있다.
  - 제안: 조치 불필요(이미 주석으로 근거 명시, 현재 실패 없음). 향후 `navigator.language` 에 의존하는 새 테스트를 작성할 때 이 전역 기본값(ko-KR)을 전제로 작성하도록 팀 공지만 권고.

- **[INFO] `WIDGET_STRINGS` 카탈로그가 `Object.freeze` 없이 공유 export 되어 런타임 변형에 열려 있음**
  - 위치: `codebase/channel-web-chat/src/lib/i18n/catalog.ts` — `export const WIDGET_STRINGS = { ko: {...}, en: {...} } as const;`
  - 상세: `as const` 는 컴파일 타임 리터럴/읽기전용 타입만 강제할 뿐 런타임 불변성은 없다. `context.tsx` 의 `makeTranslate()` 는 매 호출마다 `WIDGET_STRINGS[locale]` 를 직접 참조(캐시하지 않음)하므로, 이 모듈을 import 하는 어떤 코드(테스트 mock, 향후 실수 등)가 `WIDGET_STRINGS.ko["composer.send"] = "..."` 처럼 값을 변경하면 위젯 전역 렌더 결과가 조용히 바뀐다. 현재 diff 범위에서 실제로 이런 변형을 하는 코드는 없다.
  - 제안: (선택) `catalog.ts` 말미에 `Object.freeze(WIDGET_STRINGS.ko); Object.freeze(WIDGET_STRINGS.en); Object.freeze(WIDGET_STRINGS);` 를 추가해 의도치 않은 런타임 변형을 방어적으로 차단.

- **[INFO] 하드코딩 chrome 텍스트가 존재 시 문자 그대로 노출되던 다국어-무관 표면(pie/donut/cartesian chart aria-label)의 KO 기본 렌더 문구가 변경됨**
  - 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` (`aria-label={donut ? t("chart.donut") : t("chart.pie")}` 등), 대응 테스트 `presentations.test.tsx`
  - 상세: 기존에는 KO locale 위젯에서도 pie/donut/cartesian chart 의 `aria-label` 이 영문 하드코딩("pie chart"/"donut chart"/`${type} chart`)이었다. 이번 변경으로 기본(ko) locale 에서 이 aria-label 이 한국어("원형 차트"/"도넛 차트"/`"${type} 차트"`)로 바뀐다 — 스크린리더 사용자 등 접근성 표면에서 실제로 관찰 가능한 텍스트 변경이며, 내부 테스트(`presentations.test.tsx`)는 갱신됐지만 이 aria-label 문자열을 externally(e2e·서드파티 자동화)에서 참조하는 코드가 있다면 영향받을 수 있다. spec §3.3 "경계 규칙 2" 에 의도가 명시돼 있어 계획된 변경이다.
  - 제안: 조치 불필요(의도된 정정). 사내 e2e/타 자동화가 이 aria-label 을 영문으로 하드코딩 검증하고 있는지 한 번 점검 권고.

### 요약
핵심 side effect 는 두 가지다. (1) `panel.tsx` 의 에러 렌더가 `state.error` 실제 값이 아니라 항상 고정 키(`t("error.generic")`)를 보여주도록 데이터-표시 결합이 끊어져, 향후 다른 값이 `state.error` 에 담겨도 조용히 무시되는 잠재 함정이 생겼다(현재는 유일 설정 경로가 동일 문자열이라 안전). (2) `BootConfig.locale` reserved→active 전환은 코드 재배포만으로 기존에 저장된 `locale='en'` 트리거의 위젯 렌더 언어를 즉시 바꾸는 **배포-시점 활성화** 성격의 side effect다 — 기능적으로는 의도된 것이고 spec·consistency-check 로 충분히 검토됐지만 운영 공지 관점에서 짚어둘 필요가 있다. 그 외 `vitest.setup.ts` 의 전역 `navigator.language` 재정의, `WIDGET_STRINGS` 의 비-freeze 공유 객체, chart aria-label 의 KO 기본값 변경은 모두 문서화·테스트로 뒷받침된 저위험 항목이다. 전역 변수 신설(React Context, exported const catalog)은 통상적 패턴 범위 내이며, 시그니처·공개 API 파괴적 변경, 예기치 못한 파일시스템 부작용, 환경 변수 읽기/쓰기, 네트워크 호출은 발견되지 않았다.

### 위험도
MEDIUM

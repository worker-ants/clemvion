# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] BridgeDeps 인터페이스 확장 — 기존 호출자 영향 없음
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` `BridgeDeps` 인터페이스 (라인 20–23)
- 상세: `position?: "bottom-right" | "bottom-left"` 과 `zIndex?: number` 가 옵셔널 필드로 추가되었다. 기존에 `BridgeDeps` 를 직접 객체 리터럴로 생성하는 호출자는 새 필드를 생략해도 컴파일 오류가 없으며, 생략 시 기본 동작(bottom-right, DEFAULT_Z_INDEX)이 적용된다. 공개 API 파괴적 변경 없음.
- 제안: 없음.

### [INFO] DOM 부작용 범위 확대 — 의도된 변경
- 위치: `codebase/packages/web-chat-sdk/src/bridge.ts` `WidgetBridge` 생성자 (라인 63–67)
- 상세: 생성자에서 설정하는 iframe 스타일 속성이 `position:fixed` 1개에서 `bottom`, `left` 또는 `right`, `zIndex` 4개로 늘었다. 이는 버그 수정의 핵심으로 의도된 DOM 부작용 확대다. 그러나 `applyResize` 핸들러가 `width`/`height`/`state` 만 변경하고 `bottom`/`left`/`right`/`zIndex` 는 건드리지 않으므로, wc:resize 이벤트가 도착해도 코너 고정 스타일이 유지된다. 상태 일관성 문제 없음.
- 제안: 없음.

### [INFO] `widgetBaseOverride` 모듈 레벨 전역 변수 — 기존 동작 유지
- 위치: `codebase/packages/web-chat-sdk/src/index.ts` 라인 17
- 상세: `widgetBaseOverride` 는 이번 변경 이전부터 존재하는 모듈 레벨 변수다. 이번 변경이 새 전역 변수를 도입하거나 이 변수의 초기화·변경 경로를 바꾸지 않았다. `DEFAULT_Z_INDEX` 상수는 모듈 레벨이지만 읽기 전용(const)이므로 공유 상태 오염 위험 없음.
- 제안: 없음.

### [INFO] `boot()` 함수 — 시그니처 변경 없음, 동작 변경 있음
- 위치: `codebase/packages/web-chat-sdk/src/index.ts` `boot()` (라인 81–110)
- 상세: `boot(config: BootConfig)` 시그니처는 그대로다. 내부에서 `WidgetBridge` 에 `position`/`zIndex` 를 추가로 전달하는 것이 전부다. 단, 기존에 `appearance.position`/`appearance.zIndex` 를 설정하지 않던 호출자도 이제 iframe 에 `bottom:0; right:0; z-index:2147483000` 이 자동 적용된다. 이는 버그 수정의 의도이며, `position:fixed` 만 있던 이전 상태(화면 밖)보다 정상적으로 동작한다.
- 제안: 없음.

### [INFO] `wc:boot` 메시지로 전체 `config` 전달 — 이번 변경 전부터 존재
- 위치: `codebase/packages/web-chat-sdk/src/index.ts` 라인 94 (`bridge.post("wc:boot", config)`)
- 상세: `config.appearance.position`/`zIndex` 가 `wc:boot` 페이로드에 포함되어 iframe 내부 SPA 로 전달된다. 이는 이번 변경이 아니라 기존 `boot()` 구조에서 이미 의도된 동작이다. 이번 변경은 host iframe 의 CSS 만 추가로 설정하는 것이므로, iframe 내부 SPA 의 동작 변경은 없다.
- 제안: 없음.

### [INFO] 테스트 파일의 DOM 전역 상태 — beforeEach 로 격리됨
- 위치: `codebase/packages/web-chat-sdk/src/bridge.spec.ts` / `index.spec.ts` `beforeEach`
- 상세: 두 spec 파일 모두 `beforeEach(() => { document.body.innerHTML = ""; })` 로 각 테스트 전 DOM 을 초기화한다. `WidgetBridge` 생성자가 `document.body.appendChild(iframe)` 를 호출해 전역 DOM 을 변경하지만 각 테스트 간 격리가 보장된다. 추가된 3개의 신규 테스트 케이스도 같은 격리 패턴을 따른다.
- 제안: 없음.

## 요약

이번 변경은 `BridgeDeps` 인터페이스에 옵셔널 필드 2개(`position`, `zIndex`)를 추가하고, `WidgetBridge` 생성자에서 iframe 의 CSS 코너 고정 스타일을 설정하며, `boot()` 가 이를 `appearance` 설정에서 읽어 전달하는 구조다. 모든 변경이 기존 인터페이스를 파괴하지 않고(옵셔널 확장), 새 전역 변수를 도입하지 않으며, 네트워크/파일시스템/환경 변수 부작용이 없다. DOM 부작용(iframe 스타일 변경)은 버그 수정의 목적이자 spec 준수 행위이며, `applyResize` 와의 속성 충돌 가능성도 없다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE

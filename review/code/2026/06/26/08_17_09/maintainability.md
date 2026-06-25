# 유지보수성(Maintainability) 리뷰

## 발견사항

### bridge.ts

- **[INFO]** `DEFAULT_Z_INDEX` 값 2147483000이 상수로 선언되어 있어 매직 넘버 문제는 없으나, 이 값이 `Int32Max(2147483647)`에 근사한 특정 값인 이유(647 여유를 남긴 근거)가 주석에 명시되지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/bridge.ts` L30
  - 상세: JSDoc 주석에 "spec 2-sdk §3 예시값"이라고 하지만 왜 2147483000인지(예: 일부 브라우저에서 max int32 초과 시 음수 처리 등 의도된 안전 마진 여부) 미설명. 향후 유지보수자가 값 변경 시 근거 불명.
  - 제안: `/** ... CSS z-index 최대 안전값(Int32Max-647). 2147483000은 spec 2-sdk §3 예시값으로 호스트 모달/팝업 위로 배치. */ const DEFAULT_Z_INDEX = 2147483000;` 형태로 근거 1줄 추가.

- **[INFO]** `position` 분기 로직이 `if (deps.position === "bottom-left") ... else ...` 단순 if/else로 작성되어 있고 기본값이 `bottom-right`임이 코드상 명시되어 있지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/bridge.ts` L65-66
  - 상세: 현재 타입은 `"bottom-right" | "bottom-left"`이며 미지정 시 `else` 경로가 곧 `bottom-right`이지만, 나중에 `"bottom-center"` 등 값이 추가될 경우 `else`가 암묵적으로 `bottom-right`로 처리되어 논리 버그 발생 가능. 이는 일반적인 else-as-default 패턴의 확장성 함정.
  - 제안: `else if (deps.position === "bottom-right" || deps.position === undefined) iframe.style.right = "0";` 또는 fallthrough를 명시적 주석으로 문서화.

- **[INFO]** 생성자 내 iframe 스타일 설정 블록(L54-68)이 하나의 긴 연속 코드 덩어리. 이미 `applyResize`, `flush`, `emit` 등 private 메서드 패턴이 확립되어 있으므로 일관성 차원에서 분리 검토 가능.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/bridge.ts` L54-68
  - 상세: 현재 길이는 허용 범위이나, `private applyPositionStyle(position: BridgeDeps["position"], zIndex: number | undefined): void` 형태로 분리하면 생성자 의도(DOM 연결)와 스타일 설정 로직이 명확히 분리됨.
  - 제안: 즉시 수정 강제 수준은 아님. 추후 position 옵션이 확장될 때 함께 리팩터링 고려.

### bridge.spec.ts

- **[INFO]** 새로 추가된 세 테스트 케이스에서 `new WidgetBridge({ iframeSrc: IFRAME_SRC, widgetOrigin: WIDGET_ORIGIN, ... })` 패턴이 `makeBridge()` 헬퍼와 부분 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/bridge.spec.ts` L74-91
  - 상세: `bottom-left` 테스트(L74-82)와 `zIndex override` 테스트(L84-91)는 `iframeSrc`/`widgetOrigin` 상용구를 반복 인라인. `makeBridge(overrides?)` 형태로 옵션 파라미터를 지원하면 중복 제거 가능.
  - 제안: `function makeBridge(overrides: Partial<BridgeDeps> = {}) { return new WidgetBridge({ iframeSrc: IFRAME_SRC, widgetOrigin: WIDGET_ORIGIN, ...overrides }); }` 로 헬퍼 확장.

### index.spec.ts

- **[INFO]** `"2147483000"` 문자열 리터럴이 `bridge.spec.ts`와 `index.spec.ts` 두 파일에 중복 존재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/index.spec.ts` L708, `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-loader-iframe-position-d37b1a/codebase/packages/web-chat-sdk/src/bridge.spec.ts` L70
  - 상세: `DEFAULT_Z_INDEX`가 `bridge.ts`에서 내부 `const`(비공개)로 선언되어 테스트 파일에서 import 불가. 이 때문에 두 파일에 동일 숫자 리터럴이 산재. 값 변경 시 두 곳 모두 수동 수정 필요.
  - 제안: `DEFAULT_Z_INDEX`를 `export const`로 공개하거나, 테스트 전용 재수출 파일을 만들어 공유. 가장 단순한 대안은 `export const DEFAULT_Z_INDEX` 로 변경.

### index.ts

- **[NONE]** `boot()` 함수 내 `WidgetBridge` 생성 객체 리터럴 확장(4개 필드)은 가독성·책임 모두 양호. 기존 단일라인이 멀티라인으로 명확하게 변경되었고, appearance 전달 의도가 주석으로 설명됨. 기존 코드베이스 스타일·패턴 준수.

---

## 요약

이번 변경은 작은 버그픽스(iframe 코너 고정 누락)로 범위가 좁고 코드 품질은 전반적으로 양호하다. `DEFAULT_Z_INDEX` 상수화, 주석 근거 명시, 테스트 구성 모두 기존 코드베이스 패턴을 잘 따르고 있다. 주요 유지보수성 리스크는 두 가지다: (1) `position` 분기의 `else`가 암묵적 기본값으로 동작해 미래 열거값 추가 시 논리 버그 가능성, (2) `DEFAULT_Z_INDEX` 값이 테스트 두 파일에 중복 리터럴로 존재해 값 변경 시 동기화 누락 위험. 두 항목 모두 현 상태에서 즉각적 오류를 야기하지는 않지만 코드베이스 확장 시 유지보수 부담이 될 수 있어 INFO 수준에서 개선을 제안한다.

## 위험도

LOW

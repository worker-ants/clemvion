# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

### [INFO] `demo-host.tsx` — 단일 컴포넌트가 너무 많은 책임을 담당
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx`, `DemoHost` 함수 전체 (약 160 LOC)
- 상세: `DemoHost`는 (1) postMessage 전송, (2) 메시지 수신·origin 검증, (3) iframe 재마운트 부팅 흐름, (4) 명령 전송, (5) 폼 업데이트, (6) 이벤트 로그 관리, (7) 전체 레이아웃 렌더 등 7가지 책임을 한 함수 안에 수행한다. `Section`/`Field`/`Row` 서브 컴포넌트를 별도로 분리한 점은 좋으나, 주 컴포넌트 자체는 여전히 하나의 파일에 모든 로직이 집중되어 있다. dev-only 하니스라 운영 위험은 없으나, 향후 기능 추가·버그 추적 시 파악이 어렵다.
- 제안: postMessage 송수신 로직을 `useWidgetBridge(iframeRef, appendLog)` 커스텀 훅으로 추출하고, 이벤트 로그 상태 관리를 `useEventLog(limit)` 훅으로 분리하면 컴포넌트 본체가 레이아웃·사용자 인터랙션에만 집중할 수 있다. 필수 수준은 아님(dev-only).

---

### [INFO] `demo-host.tsx` — 스타일 객체 `S` 내 매직 넘버 다수
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx`, `S` 객체 (약 80 LOC)
- 상세: `380`, `60`, `220`, `600`, `52`, `40`, `32` 등 숫자 리터럴이 의미 주석 없이 사용된다. `S.panel`의 `width: 380` / `flex: "0 0 380px"` 두 곳에 동일한 `380`이 중복 기입되어 있어, 패널 폭을 바꿀 때 두 곳을 동시에 수정해야 한다. `setLog((prev) => [entry, ...prev].slice(0, 60))`의 `60`(최대 로그 수)도 명명된 상수가 없다.
- 제안:
  ```ts
  const PANEL_WIDTH = 380;
  const MAX_LOG_ENTRIES = 60;
  const LOG_MAX_HEIGHT = 220;
  ```
  로 추출하고 `S` 객체 및 `appendLog`에서 참조. `flex: "0 0 380px"` 도 `flex: \`0 0 ${PANEL_WIDTH}px\`` 로 통일.

---

### [INFO] `demo-host.tsx` — 인라인 스타일 스프레드로 인한 매 렌더 객체 생성
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx`, 렌더 JSX 내 `{ ...S.input, padding: 2, height: 32 }` 등 3곳
- 상세: `{ ...S.input, height: 52, resize: "vertical" }`, `{ ...S.input, height: 40, resize: "vertical" }`, `{ ...S.input, padding: 2, height: 32 }`, `{ ...S.btn, opacity: ready ? 1 : 0.5 }`, `{ ...S.logDir, color: l.dir === "→" ? "#2563eb" : "#16a34a" }` 등이 렌더마다 새 객체를 생성한다. `S`가 모듈 최상위에 정의된 상수이므로 변형 버전도 상수로 추출할 수 있다. `logDir` 색상은 조건부라 어렵지만 나머지는 상수화 가능하다.
- 제안: `S.textareaWelcome`, `S.textareaLauncher`, `S.colorInput`, `S.btnReady`, `S.btnDisabled` 를 `S` 객체에 추가. dev 하니스라 성능 영향은 미미하나, 일관성 측면에서 개선 가치 있음.

---

### [INFO] `demo-host.tsx` — `update` 헬퍼 함수 타입이 매 렌더 새로 생성됨
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx`, line: `const update = <K extends keyof DemoFormState>...`
- 상세: `update`는 `useCallback` 없이 화살표 함수로 선언되어 매 렌더 새 함수 레퍼런스가 생성된다. `onChange` 핸들러들이 이 함수를 즉석 클로저로 감싸므로(`(e) => update("apiBase", e.target.value)`) 최종 핸들러도 항상 재생성된다. `useCallback`을 사용하거나 `setForm`의 함수형 업데이트 패턴으로 정리할 수 있다. dev 하니스라 실질적 영향은 없으나, 패턴 일관성(나머지 핸들러는 모두 `useCallback` 사용) 측면에서 눈에 띈다.
- 제안: `useCallback`으로 감싸거나, 각 input의 `onChange`를 개별 `useCallback`으로 분리하는 대신 현행 패턴을 유지하면서 `// note: not memoized — dev-only` 주석을 추가해 의도적 생략임을 명시.

---

### [INFO] `demo-config.ts` — `buildBootConfig` 내 `form.xxx.trim()` 중복 호출
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-config.ts`, `buildBootConfig` 함수
- 상세: `form.primaryColor.trim()` 이 두 번(`if (form.primaryColor.trim()) appearance.primaryColor = form.primaryColor.trim()`), 마찬가지로 `form.headerTitle.trim()`, `form.welcomeText.trim()`, `form.disclaimer.trim()` 이 각각 두 번씩 호출된다. 총 8번의 중복 `.trim()` 호출이다. 미세한 비효율이고 순수 함수라 부작용은 없지만 가독성을 저해한다.
- 제안: 각 필드를 상단에서 한 번 trim하여 지역 변수로 선언:
  ```ts
  const primaryColor = form.primaryColor.trim();
  const headerTitle = form.headerTitle.trim();
  const welcomeText = form.welcomeText.trim();
  const disclaimer = form.disclaimer.trim();
  ```
  이후 if 조건과 할당 모두 해당 변수 사용.

---

### [INFO] `package.json` — `dev` 스크립트의 shell 의존성
- 위치: `/codebase/channel-web-chat/package.json`, `scripts.dev`
- 상세: `"dev": "source .env 2>/dev/null; next dev --port ${PORT:-3013}"` 는 `source` 내장 명령과 `${:-}` 파라미터 치환에 bash/zsh가 필요하다. npm scripts는 `sh`를 기본 셸로 사용하므로 `source`(bash 내장)가 Windows 또는 POSIX-strict `sh`에서 실패한다. `.`(dot) 는 POSIX 호환이나, `${PORT:-3013}` 치환도 `sh`에서는 동작하나 `npm run` 인자 처리 방식에 따라 달라질 수 있다. README에서 macOS/Linux 로컬 개발 환경으로 명시되어 있어 실질적 위험은 낮다.
- 제안: Windows 지원 불필요라면 현행 유지(주석 추가 권장), 또는 `dotenv-cli`/`cross-env` 패키지를 사용해 cross-platform 스크립트로 전환. README에 "macOS/Linux only" 명시 추가.

---

### [INFO] `demo-host.tsx` — `LogEntry.dir` 필드의 방향 화살표가 리터럴 유니코드
- 위치: `/codebase/channel-web-chat/src/app/demo/demo-host.tsx`, `LogEntry` 인터페이스 및 사용처
- 상세: `dir: "→" | "←"` 타입과 `l.dir === "→" ? "#2563eb" : "#16a34a"` 비교가 소스코드에 유니코드 화살표 리터럴을 직접 포함한다. 파일 인코딩 이슈나 에디터에 따라 가독성이 떨어질 수 있고, `→`/`←` 를 타이핑하는 것이 번거롭다. 타입 시스템이 이미 `"→" | "←"`로 좁혀져 있어 기능 문제는 없다.
- 제안: `type MessageDirection = "outbound" | "inbound"` 로 의미 기반 타입을 사용하고, 렌더 시에만 `dir === "outbound" ? "→" : "←"` 로 변환하면 코드 의도가 더 명확해진다. 또는 현행 유지하되 const로 추출: `const DIR_OUT = "→" as const; const DIR_IN = "←" as const`.

---

## 요약

이번 변경은 dev-only 데모 하니스 추가로, 운영 코드를 건드리지 않고 명확히 격리된 범위에서 이루어졌다. `demo-config.ts` 는 순수 함수 분리·단위 테스트 구비·JSDoc 주석 등 유지보수성이 우수하다. `page.tsx` 는 게이팅 로직만 담아 단일 책임 원칙을 잘 지킨다. `demo-host.tsx` 는 dev 하니스 특성상 허용 범위 내에서 다소 많은 책임이 한 컴포넌트에 집중되어 있고, 스타일 객체 내 매직 넘버·중복 `.trim()` 호출·`update` 헬퍼 불일관 메모이제이션 등 소소한 개선점이 존재하나 어느 것도 운영 결함으로 이어지지 않는다. `package.json` dev 스크립트의 bash 의존성은 Windows 환경에서 잠재적 문제가 될 수 있으나 프로젝트 환경(macOS/Linux)을 고려하면 현실적 위험은 낮다. 전체적으로 코드 품질과 의도 전달이 양호하다.

## 위험도

LOW

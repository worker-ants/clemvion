# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `package.json` dev 스크립트에서 `source .env` 실행 — 셸 환경 오염 가능성
- 위치: `codebase/channel-web-chat/package.json` — `"dev"` 스크립트
- 상세: `source .env 2>/dev/null; next dev --port ${PORT:-3013}` 는 `.env` 파일 내용을 현재 셸 환경으로 로드한다. `npm run dev` 를 실행하는 부모 셸의 환경변수가 `.env` 에 정의된 값으로 덮어씌워질 수 있다. `2>/dev/null` 로 오류는 억제하지만, `.env` 에 `PATH=`, `HOME=`, `NODE_ENV=` 등 민감한 변수가 실수로 포함될 경우 같은 셸 세션 내 후속 명령이 영향을 받는다. 또한 `npm run` 은 자체 child process를 포크하므로 실제 부모 셸 오염은 없으나, 같은 npm run 세션 내에서는 변수 주입이 일어난다.
- 제안: `dotenv-cli` 또는 `next dev` 의 `--env-file` 옵션(Next.js 15+)을 사용해 `.env` 를 명시적으로 격리 로드하는 방식을 권장한다. 또는 현재 방식을 유지하되 `.env.example` 에 "환경에 영향을 주는 변수만 정의하라"는 주석을 추가한다.

### [WARNING] `WIDGET_SRC` 모듈 수준 상수 — 빌드타임 `process.env` 읽기 (전역 상수 도입)
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` — `const WIDGET_SRC = ...` (파일 최상단)
- 상세: `process.env.NEXT_PUBLIC_BASE_PATH` 를 모듈 수준에서 읽어 `WIDGET_SRC` 상수를 초기화한다. Next.js CSR 환경에서 `NEXT_PUBLIC_*` 는 빌드타임 인라인이므로 런타임 변경 불가하며 의도된 동작이다. 그러나 이 상수는 모듈 스코프에 선언되어 있어 모듈이 처음 임포트될 때 평가된다. 테스트 환경에서 `NEXT_PUBLIC_BASE_PATH` 를 mocking 하지 않으면 `undefined` 가 주입되어 `WIDGET_SRC = "/"` 가 된다 — 이는 의도한 기본값과 일치하므로 실제 부작용은 낮다.
- 제안: 현재 구조로 문제 없음. 테스트 문서화 목적으로 `demo-config.test.ts` 와 동급 테스트에서 이 상수는 mocking 대상이 아님을 명시하면 충분하다.

### [INFO] `defaultDemoForm` 모듈 수준 상수 — 공유 참조 위험
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts` — `export const defaultDemoForm: DemoFormState = { ... }`
- 상세: `defaultDemoForm` 은 `export const` 로 선언된 객체다. `DemoHost` 가 `useState<DemoFormState>(defaultDemoForm)` 초기화 시 React 가 얕은 복사를 수행하므로 최상위 프리미티브 필드는 안전하다. 그러나 `demo-config.test.ts` 의 `{ ...defaultDemoForm, ... }` 스프레드 패턴도 안전하다. 실질적 위험 없음.
- 제안: 현행 유지.

### [INFO] `window.addEventListener("message", onMessage)` — `window` 전역 이벤트 리스너 추가
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` — `useEffect` 내 `onMessage` 리스너
- 상세: 컴포넌트 마운트 시 `window` 에 `message` 이벤트 리스너를 등록하고 언마운트 시 제거한다. cleanup 함수(`return () => window.removeEventListener(...)`)가 올바르게 구현되어 있어 메모리 누수·리스너 중복 등록 위험은 없다. `event.source !== iframeRef.current?.contentWindow` 및 `event.origin !== window.location.origin` 이중 검증으로 외부 메시지 오염도 차단된다.
- 제안: 현행 유지.

### [INFO] `iframeKey` 증가로 인한 iframe 재마운트 — DOM 부작용
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` — `handleBoot` 내 `setIframeKey((k) => k + 1)`
- 상세: 부팅 클릭 시 `iframeKey` 를 증가시켜 iframe을 언마운트·재마운트한다. 이는 의도된 동작(위젯 상태 초기화)이며, `setLog([])` 와 `logSeqRef.current = 0` 으로 관련 파생 상태도 함께 초기화된다. React key 변경에 의한 DOM 부작용은 의도적이고 범위가 명확하다.
- 제안: 현행 유지.

### [INFO] `.gitignore` 패턴 변경 — `.env*.local` → `.env*` + `!.env.example`
- 위치: `codebase/channel-web-chat/.gitignore`
- 상세: 기존 `.env*.local` 패턴은 `.env.local`, `.env.production.local` 등 `.local` 접미사 파일만 무시했다. 변경 후 `.env*` 패턴은 `.env`, `.env.production`, `.env.staging` 등 모든 `.env` 변형을 무시한다. `!.env.example` 예외로 example 파일은 추적 유지된다. 부작용: 기존에 Git 추적 중이던 `.env` 파일(예: `.env.production` 이 이미 커밋된 경우)이 있다면 이번 변경만으로는 추적 제거되지 않고(`git rm --cached` 필요), 반대로 신규 `.env` 파일은 자동으로 무시된다. 이 저장소에서 `channel-web-chat/` 가 신규 디렉토리이므로 추적 중인 `.env*` 파일이 없어 실질적 위험은 없다.
- 제안: 현행 유지. 혹시 다른 `.env*` 파일을 추적해야 할 경우 `!.env.production.example` 등의 추가 예외 패턴을 문서화해 둔다.

### [INFO] `isDemoEnabled` 에서 `process.env.NODE_ENV` 직접 읽기 — 환경변수 읽기
- 위치: `codebase/channel-web-chat/src/app/demo/page.tsx` — `DemoPage` 서버 컴포넌트
- 상세: `process.env.NODE_ENV` 와 `process.env.NEXT_PUBLIC_ENABLE_DEMO` 를 렌더 시점에 읽는다. Next.js 빌드 과정에서 `NODE_ENV` 는 `"production"` 으로 고정되고 `NEXT_PUBLIC_ENABLE_DEMO` 는 빌드타임 인라인되므로, 이 분기는 정적 분석으로 결정된다. 런타임 환경변수 변경에 의한 동적 분기 부작용 없음.
- 제안: 현행 유지.

## 요약

이번 변경은 `channel-web-chat` 앱에 dev 전용 `/demo` 라우트와 포트 설정을 추가하는 것으로, 부작용 위험이 전반적으로 낮다. 주목할 점은 `package.json` `dev` 스크립트의 `source .env` 실행이 동일 셸 세션 환경을 변경할 수 있다는 것이다 — 단 npm 의 child process 격리로 부모 셸은 보호되며 실용적 위험은 제한적이다. `window.addEventListener("message", ...)` 전역 이벤트는 cleanup 이 올바르게 구현되어 메모리 누수가 없다. `defaultDemoForm` 공유 객체와 `WIDGET_SRC` 모듈 상수는 각각 React 얕은 복사와 Next.js 빌드타임 인라인으로 안전하게 처리된다. `.gitignore` 패턴 확장은 신규 디렉토리라 소급 적용 문제가 없다. 기존 함수·공개 API 시그니처 변경은 없으며 위젯 본체 상태기계·SDK·백엔드에 대한 부작용도 없다.

## 위험도

LOW

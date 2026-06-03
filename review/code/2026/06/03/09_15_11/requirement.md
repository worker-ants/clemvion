# 요구사항(Requirement) 리뷰

리뷰 대상: Channel Web Chat — 로컬 데모 호스트 + dev 포트 분리 (feat-web-chat-demo)
리뷰 일시: 2026-06-03
관련 spec: `spec/7-channel-web-chat/` (0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security)

---

## 발견사항

### [INFO] `package.json` dev 스크립트 — `source .env` 는 bash 전용, zsh/fish 에서 미동작 가능성
- 위치: `codebase/channel-web-chat/package.json` `scripts.dev`
- 상세: `source .env 2>/dev/null; next dev --port ${PORT:-3013}` 에서 `source` 는 bash 내장 명령이다. `npm run dev` 는 `npm` 이 기본 `/bin/sh` 를 사용하는데, macOS 기본 sh(dash/zsh 링크 등)에서는 `source` 가 아닌 `. .env` 가 표준이다. 실제 npm 은 시스템 sh 로 스크립트를 실행하므로, sh 가 dash 인 환경에서는 `source` 가 "not found"로 실패한다. 그러나 macOS 에서 sh 는 보통 bash 와 동일하므로 대부분 정상 동작하며, 2>/dev/null 로 오류가 묻힌다. 실제 결함보다는 이식성 주의 사항에 가깝다.
- 제안: `. .env 2>/dev/null || true; next dev --port ${PORT:-3013}` 로 교체하면 POSIX sh 호환성이 확보된다. 또는 `.env` 로드를 `dotenv-cli` 패키지로 위임한다. 현재도 macOS 환경에서는 기능상 문제 없음.

---

### [INFO] `.gitignore` 변경 — `.env` 비추적 범위 확대 side effect
- 위치: `codebase/channel-web-chat/.gitignore`
- 상세: 기존 `.env*.local` 만 무시하던 것을 `.env*` (+ `!.env.example`)로 확대했다. 이로써 `.env.local`, `.env.development`, `.env.production` 등도 모두 무시된다. README 에 "`.env` (미추적, `.env.example` 참고)"라고 명시되어 있어 의도적인 변경이며, frontend 앱의 `.gitignore` 패턴을 미러한다고 plan 에 기술되어 있어 정상 범위다. 단, 기존에 `.env.development`/`.env.production` 등을 의도적으로 커밋하는 패턴이 있었다면 이 변경이 그 파일들을 누락시킬 수 있다.
- 제안: 실제 채널 웹채팅 앱에 `.env.development` 등 커밋 예정인 환경별 env 파일이 없으면 이상 없음. 확인 후 유지.

---

### [INFO] `isDemoEnabled` — `nodeEnv` 가 `undefined` 일 때 동작
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts` L63
- 상세: `isDemoEnabled({ nodeEnv: undefined })` 를 호출하면 `undefined !== "production"` 이 `true` 가 되어 demo 가 활성화된다. `page.tsx` 에서 `process.env.NODE_ENV` 를 넘기므로 실제로는 Next.js 빌드 시 항상 `"development"` 또는 `"production"` 으로 채워진다. 런타임 undefined 가능성은 없으나, 테스트에서 `nodeEnv: undefined` 케이스가 없어 명시적 검증이 없다.
- 제안: 단위 테스트에 `isDemoEnabled({})` (인수 없음) 케이스를 추가하면 명시적 행동을 문서화할 수 있다. 기능상 결함은 없음.

---

### [INFO] `buildBootConfig` — `appearance` 는 `primaryColor` 가 비어도 항상 포함됨
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts` L51-53
- 상세: `appearance` 객체는 `{ position: form.position }` 으로 항상 생성되어 `cfg.appearance` 에 할당된다. `primaryColor` 가 비어 있어도 `appearance` 자체는 `undefined` 가 되지 않는다. 이는 spec `2-sdk.md §4 BootConfig` 에서 `appearance` 가 `optional` 로 정의된 것과 대조된다. 데모 맥락에서는 `position` 이 항상 기본값(`"bottom-right"`)을 가지므로 의도적 결정으로 보이며, 테스트(L58-60)도 이 동작을 `// appearance still carries position even when nothing else set` 주석으로 명시하여 검증한다. spec 에서 `appearance` 를 omit할 이유(position 기본값)가 없는 경우라 기능상 문제는 없다.
- 제안: 현행 유지. 단, spec `2-sdk.md §4` 는 `appearance` 전체가 optional 이므로, 위젯 SPA 가 `appearance: undefined` 일 때 position 기본값(`bottom-right`)을 내장하고 있는지 확인 필요.

---

### [INFO] `demo-host.tsx` — `postToWidget` 의 `useEffect` 의존성 배열에 포함되어 불필요한 리스너 재등록 가능성
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` L62-73 (`useEffect`)
- 상세: `useEffect` 의 의존성 배열이 `[appendLog, postToWidget]` 이다. `postToWidget` 은 `useCallback([appendLog])` 로 메모이즈되어 있고 `appendLog` 는 `useCallback([])` 로 고정이므로 실제로 이 effect 가 재실행되지는 않는다. 그러나 `onMessage` 내부에서 `postToWidget` 을 직접 참조하므로, 의존성 배열에서 `postToWidget` 을 제거하려면 `pendingBootRef` + `postToWidget` 을 ref 로 분리해야 한다. 현재 구조는 stale closure 위험이 없고 lint(react-hooks) 도 통과하므로 기능상 문제 없다.
- 제안: 현행 유지. 기능 결함 없음.

---

### [INFO] `demo-host.tsx` — `wc:ready` 가 `pendingBootRef.current` 없이 도달했을 때 `booted` 상태 미갱신
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` L57-66 (`onMessage` 내 `wc:ready` 분기)
- 상세: `wc:ready` 수신 시 `pendingBootRef.current` 가 있을 때만 `setBooted(true)` 를 호출한다. 만약 iframe 이 리로드되어 `wc:ready` 를 재발신하지만 `pendingBootRef.current` 가 이미 소비된 상태라면 `booted` 는 `false` 를 유지한다. 이는 `handleBoot` → `setBooted(false)` → `setIframeKey(k+1)` → iframe 재마운트 → `wc:ready` 도달 → `boot 주입 + setBooted(true)` 플로우에서 정상 동작한다. 엣지 케이스: 사용자가 부팅 없이 위젯 페이지를 직접 새로 고침하거나 iframe 이 외부 원인으로 reload 되면 `pendingBootRef.current` 가 null 이라 부팅이 스킵된다. 이는 데모 목적상 수용 가능한 동작이다.
- 제안: 현행 유지. 데모 하니스 맥락에서 정상 동작 범위.

---

### [INFO] spec fidelity — `BootMessage` 인터페이스 vs spec `2-sdk.md §4 BootConfig`
- 위치: `codebase/channel-web-chat/src/widget/host-bridge.ts` L7-17, `spec/7-channel-web-chat/2-sdk.md §4`
- 상세: spec `BootConfig` 의 모든 필드가 `BootMessage` 에 대응한다. `locale`, `appearance`, `headerTitle`, `welcome`, `launcher`, `disclaimer`, `profile` 모두 일치한다. `appearance` 타입도 `primaryColor?`, `position?`, `zIndex?` 로 spec 과 일치한다. `demo-config.ts` 의 `DemoFormState` 는 `zIndex` 필드를 노출하지 않는데, 이는 데모 맥락에서 고정 레이아웃을 쓰기 때문이며 spec 상 optional 이므로 omit 가능하다. `profile` 필드 또한 `DemoFormState` 에 없지만 spec 상 optional 이고 데모 범위 밖이므로 문제 없다.
- 제안: spec fidelity 충족. 이상 없음.

---

### [INFO] spec fidelity — `2-sdk §3` postMessage 프로토콜 vs `demo-host.tsx` origin 검증 구현
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` L51-55, `spec/7-channel-web-chat/2-sdk.md §3`
- 상세: spec `2-sdk §3` 은 "origin 검증 필수(양방향 `event.origin` 화이트리스트)"를 명시한다. `demo-host.tsx` 의 `onMessage` 는 `e.source !== iframeRef.current?.contentWindow` 와 `e.origin !== window.location.origin` 를 모두 검증하고 있어 spec 요건을 충족한다. 이 구현은 consistency-check 의 I6 항목 반영 사항으로 계획에도 명시되어 있다.
- 제안: spec 요건 충족 확인. 이상 없음.

---

### [INFO] spec fidelity — `wc:command` 에서 `show`/`hide`/`updateProfile` 미노출
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` L12-13, plan `channel-web-chat-demo.md`
- 상세: spec `2-sdk §3` 의 `wc:command` 는 `show`/`hide`/`updateProfile` 를 포함한다. 데모는 `DemoCommand = "open" | "close" | "sendMessage"` 만 노출하며 나머지 3개는 위젯 SPA 미구현(`channel-web-chat-followups §4`)을 이유로 제외한다. 이는 consistency-check I9 반영 사항이며, 미구현 명령을 데모에서 노출해 silent failure 를 유발하지 않기 위한 의도적 설계다. 주석에도 명시되어 있다.
- 제안: 현행 유지. 의도적 범위 제한이며 주석으로 문서화됨.

---

### [INFO] spec fidelity — 데모 라우트 게이팅이 spec 에 명시되지 않음
- 위치: `codebase/channel-web-chat/src/app/demo/page.tsx`, `spec/7-channel-web-chat/1-widget-app.md`
- 상세: 데모 라우트(`/demo`)와 `isDemoEnabled` 게이팅 방식은 spec 에 요구사항으로 정의된 항목이 아니라 개발 편의를 위한 추가 기능이다. spec 은 위젯 SPA 의 런타임·CSR 원칙(`1-widget-app §1`)을 정의하지만 dev harness 는 별도 비프로덕션 경로이므로 spec 갭이 아닌 spec 회색지대다.
- 제안: spec 갱신 필요시 project-planner 위임. 본 PR 범위 밖.

---

### [INFO] `demo-config.ts` — `defaultDemoForm.triggerEndpointPath` 가 빈 문자열로 초기화되어 부팅 불가 상태로 시작
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts` L19
- 상세: `triggerEndpointPath: ""` 는 `isBootReady` 를 `false` 로 만들어 "부팅" 버튼이 처음에 비활성 상태다. UI 에서 hint 를 통해 사용자에게 안내하고 있으므로 UX 상 적절한 동작이다. README 에도 "trigger 는 사용자가 공개 webhook UUID 를 붙여넣어야 부팅 가능"이라 명시되어 있다.
- 제안: 현행 유지. 의도적 설계.

---

## 요약

이번 변경은 `channel-web-chat` 앱 내 dev 전용 데모 호스트(`/demo` 라우트)와 포트 분리(3013) 기능을 완전히 구현하고 있다. 계획 문서(`channel-web-chat-demo.md`)에 명시된 모든 작업 항목이 대응 구현 파일로 완성되었다. `demo-config.ts` 의 순수 헬퍼 함수들은 단위 테스트(`demo-config.test.ts`)로 검증되어 있으며 엣지 케이스(빈 입력, 공백 트리밍, 필드 생략) 처리가 적절하다. spec `2-sdk.md §3·§4` 의 postMessage 프로토콜 및 `BootConfig` 스키마와의 line-level 일치가 확인되었다. consistency-check 에서 식별된 I6(origin 검증), I9(미구현 명령 미노출) 반영도 정상적으로 이루어졌다. 발견된 INFO 항목들은 모두 기능 결함이 아니라 이식성·가독성·문서화 수준의 제언이며, 요구사항 충족에 영향을 주지 않는다.

## 위험도

NONE

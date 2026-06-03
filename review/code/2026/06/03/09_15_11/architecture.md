# 아키텍처(Architecture) 리뷰

리뷰 대상: `channel-web-chat` — 로컬 데모 호스트 + dev 포트 분리 (feat-web-chat-demo)
리뷰 일시: 2026-06-03

---

## 발견사항

### [INFO] demo-config.ts: 단일 책임 원칙 — 순수 함수 모듈로 잘 분리됨
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts`
- 상세: `DemoFormState` 타입 정의, `parseSuggestions`, `isBootReady`, `buildBootConfig`, `isDemoEnabled` 다섯 함수가 모두 React 비의존 순수 함수로 격리되어 있다. 레이어 책임 분리 측면에서 비즈니스 로직(boot payload 조립, 게이팅 결정)이 UI 컴포넌트와 완전히 분리된 모범 사례다. 단위 테스트(`demo-config.test.ts`)가 이 분리를 보강한다.
- 제안: 현행 유지.

### [INFO] demo-host.tsx: 단일 컴포넌트 내 책임 집중 — 허용 수준
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx`, 388줄
- 상세: `DemoHost`는 폼 상태 관리·postMessage 송신·이벤트 수신·로그 관리·iframe 키 재마운트를 모두 처리한다. dev-only 하니스이므로 이 수준의 집중도는 실용적으로 허용 가능하다. 그러나 `postToWidget` + `pendingBootRef` + `iframeKey` 패턴은 실질적으로 "핸드셰이크 상태 기계(ready → boot injected)"를 인라인으로 구현한 것이다. 향후 wc: 프로토콜 이벤트 종류가 늘어나면 메시지 핸들러 if/else 체인이 길어질 수 있다.
- 제안: 현재 범위에서는 허용. 향후 확장 시 `useWidgetBridge` 커스텀 훅으로 postMessage 송수신·핸드셰이크 로직을 추출하면 DemoHost는 순수 레이아웃/폼 렌더 역할로 축소 가능.

### [INFO] page.tsx: 게이팅 책임 분리 — 올바른 패턴
- 위치: `codebase/channel-web-chat/src/app/demo/page.tsx`
- 상세: `DemoPage`(서버 컴포넌트)는 `isDemoEnabled` 체크와 `notFound()` 호출만 담당하고, 실제 UI/브라우저 로직은 `DemoHost`(클라이언트 컴포넌트)에 위임한다. 프레젠테이션/라우트 게이팅/비즈니스 로직 레이어 책임이 명확히 분리되어 있다. CSR-only 원칙(1-widget-app §1)을 침범하지 않는 구조다.
- 제안: 현행 유지.

### [WARNING] demo-host.tsx: `WIDGET_SRC` 모듈 레벨 상수 — same-origin 전제 하드코딩
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx`, 1153번 라인 (`const WIDGET_SRC = ...`)
- 상세: `WIDGET_SRC`는 `process.env.NEXT_PUBLIC_BASE_PATH || ""`를 이용해 빌드타임에 고정된다. postMessage의 `targetOrigin`도 `window.location.origin`으로 same-origin을 전제한다. 데모는 same-origin 운영이므로 현재는 올바르나, 향후 위젯 SPA를 별도 CDN origin에 배포하고 데모를 교차 origin으로 운영하면 이 전제가 깨진다. 현재 `origin === window.location.origin` 수신 필터도 마찬가지다.
- 제안: 단기 허용. 중장기적으로 `WIDGET_SRC` 를 별도 env(`NEXT_PUBLIC_WIDGET_ORIGIN`)로 분리해 발신 targetOrigin과 수신 필터 origin을 동일 소스에서 구성하면 교차 origin 확장 시 변경 지점이 한 곳으로 줄어든다.

### [INFO] 스타일 상수 `S` 객체: 단일 파일 내 응집 — 적절한 선택
- 위치: `codebase/channel-web-chat/src/app/demo/demo-host.tsx`, 1047~1119번 라인
- 상세: dev 전용 하니스이므로 CSS 모듈/Tailwind 대신 인라인 스타일 상수 객체 `S`를 사용하는 선택은 외부 의존성을 추가하지 않는 합리적 결정이다. 다만 `S`는 `Record<string, React.CSSProperties>` 타입으로 키 오타에 대한 타입 안전성이 없다. 렌더 JSX가 `S.nonExistent`를 참조해도 undefined를 조용히 받는다.
- 제안: `as const satisfies Record<string, React.CSSProperties>` 패턴으로 키를 타입 안전하게 만들 수 있으나, dev-only 범위에서 낮은 우선순위다.

### [INFO] package.json dev 스크립트: `source .env` shell 의존성
- 위치: `codebase/channel-web-chat/package.json`, `dev` 스크립트
- 상세: `source .env 2>/dev/null; next dev --port ${PORT:-3013}`는 bash/zsh에서만 동작한다. Windows 환경(PowerShell, cmd.exe)에서는 `source` 명령이 없어 실패한다. `.env` 로딩은 Next.js가 자동으로 처리하므로 `source .env` 없이도 `PORT` 변수 주입은 `.env`가 아닌 다른 방법으로 해결 가능하다.
- 제안: cross-platform 호환이 요구되면 `dotenv-cli` 또는 Next.js의 기본 `.env` 로딩을 활용하고 포트만 `--port` 인수로 전달하는 별도 스크립트를 고려. 단, 이 프로젝트가 macOS/Linux 전용이면 현행 유지 가능.

### [INFO] `DemoFormState`의 locale/position 타입: 유니언 리터럴 타입 적절히 활용
- 위치: `codebase/channel-web-chat/src/app/demo/demo-config.ts`, `DemoFormState` 인터페이스
- 상세: `locale: "ko" | "en"`, `position: "bottom-right" | "bottom-left"` 등 유니언 리터럴 타입으로 형상을 좁힌 설계는 인터페이스 분리(ISP) 측면에서 올바르다. `DemoFormState`가 `BootMessage` 타입의 raw form 표현임을 명확히 하고, `buildBootConfig`가 이를 변환하는 책임을 갖는 구조는 단일 방향 데이터 변환 패턴에 부합한다.
- 제안: 현행 유지.

### [INFO] 순환 의존성 위험 없음
- 위치: `src/app/demo/` 모듈 의존 그래프
- 상세: `page.tsx` → `demo-config.ts`, `demo-host.tsx` / `demo-host.tsx` → `demo-config.ts`, `@/widget/host-bridge` 방향이며 역방향 참조 없다. `demo-config.ts`는 `@/widget/host-bridge`의 `BootMessage` 타입만 import하고 런타임 의존은 없다. 모듈 경계가 명확하다.
- 제안: 현행 유지.

### [INFO] `.gitignore` 변경: `.env*.local` → `.env*` + `!.env.example` — 더 강한 보호
- 위치: `codebase/channel-web-chat/.gitignore`
- 상세: 기존 `.env*.local` 패턴보다 `.env*` + `!.env.example` 패턴이 `.env`, `.env.production` 등 더 넓은 범위를 추적 방지해 보안 측면에서 개선이다. `frontend` 미러 방식으로 일관성도 유지된다.
- 제안: 현행 유지.

---

## 요약

이번 변경의 아키텍처는 전반적으로 건전하다. 핵심 설계 결정 — 순수 함수 모듈(`demo-config.ts`)과 UI 컴포넌트(`demo-host.tsx`) 분리, 서버 컴포넌트 게이트(`page.tsx`)와 클라이언트 렌더러 분리, `isDemoEnabled` 함수의 dependency injection 패턴(env를 인자로 받아 테스트 용이성 확보) — 이 모두 SOLID 원칙과 레이어 책임 분리 관점에서 올바른 방향이다. 주요 WARNING은 하나로, `WIDGET_SRC`와 postMessage `targetOrigin`이 same-origin을 하드코딩하고 있어 향후 교차 origin 배포 시 변경 지점이 분산될 수 있다. 나머지 발견사항은 dev-only 범위와 실용적 절충을 고려할 때 INFO 수준이며 즉각 수정 필요성은 낮다. 모듈 간 순환 의존성은 없고 경계가 명확하다.

---

## 위험도

LOW

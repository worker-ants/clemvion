# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `copy-widget.mjs`: 전역 side-effect — 스크립트 최상위에서 즉시 빌드 명령 실행
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/scripts/copy-widget.mjs` 라인 14–20
- **상세**: `run("pnpm --filter channel-web-chat build", ...)` 와 `run("pnpm --filter @workflow/web-chat build:loader")` 가 module 최상위 스코프(top-level)에서 즉시 실행된다. 이 스크립트를 `node scripts/copy-widget.mjs` 로 실행하면 언제나 두 개의 자식 프로세스(pnpm build)가 생기고 파일시스템을 변경한다. `import` 만 해도 부작용이 발생하므로, `main` 가드(예: `if (process.argv[1] === fileURLToPath(import.meta.url))`)가 없으면 프로그래밍 방식으로 재사용하기 어렵다. 다만, 현재 이 스크립트는 직접 실행(`node scripts/copy-widget.mjs`)으로만 쓰이고 `import` 대상이 아니므로 실질적 피해는 없다.
- **제안**: main 가드를 추가해 재사용 안전성을 확보하거나, 스크립트 상단 주석으로 "직접 실행 전용, import 금지"를 명시.

### [WARNING] `copy-widget.mjs`: `rmSync` + `cpSync` 로 `public/_widget/web-chat/v1/` 전체 삭제·재생성
- **위치**: `copy-widget.mjs` 라인 24–27 (`rmSync` / `mkdirSync` / `cpSync`)
- **상세**: `rmSync(dest, { recursive: true, force: true })` 로 `frontend/public/_widget/web-chat/v1` 디렉터리를 **무조건 삭제** 한 뒤 복사한다. 빌드 중 오류(`cpSync` 실패)가 발생하면 삭제만 된 채로 종료되어 대상 경로가 빈 상태로 남는다. 이미 서빙 중인 위젯 파일을 대체하는 용도라면 원자적(atomic) 교체 전략(임시 경로에 복사 후 rename)이 없어 잠깐 경로가 비는 time-of-check-time-of-use 문제가 있다. CI/배포 파이프라인에서만 실행하고 서빙 중인 환경에서는 실행되지 않는다면 실질 위험 낮음.
- **제안**: 임시 디렉터리에 복사 후 `rename` 으로 원자적 교체 적용. 또는 주석으로 "실행 중 서버에는 적용 금지" 명시.

### [WARNING] `copy-widget.mjs`: `process.env` 통해 `NEXT_PUBLIC_BASE_PATH` 환경변수를 자식 프로세스에 주입
- **위치**: `copy-widget.mjs` 라인 10, `run()` 내 `env: { ...process.env, ...env }` 및 `run("pnpm --filter channel-web-chat build", { NEXT_PUBLIC_BASE_PATH: BASE_PATH })`
- **상세**: `NEXT_PUBLIC_BASE_PATH=/_widget/web-chat/v1/app` 를 강제 주입한다. 이미 환경에 `NEXT_PUBLIC_BASE_PATH` 가 설정되어 있어도 스크립트 값이 override 한다. `channel-web-chat` 빌드에만 영향을 주는 것이 의도이지만, `...process.env` spread 로 인해 부모 프로세스의 **모든** 환경변수(비밀 키 포함)가 `execSync` 자식 프로세스에 그대로 전달된다. `pnpm` 은 이를 다시 하위 subprocess 에 넘기므로 이미 현재 동작과 다름없다. 설계 상 의도된 동작이지만, CI 비밀 변수가 의도치 않게 build 로그나 `next.config.js` 의 `env` expose 에 포함될 수 있다.
- **제안**: 필요한 환경변수만 명시적으로 열거해 자식 프로세스에 전달하는 allowlist 패턴을 고려.

### [INFO] `live-preview.tsx`: `window.addEventListener("message", ...)` 전역 이벤트 리스너 — 정리(cleanup) 확인됨
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/live-preview.tsx` 라인 971–989
- **상세**: `useEffect` 내 `window.addEventListener("message", onMessage)` 는 cleanup 함수에서 `removeEventListener` 를 호출한다. 타이머도 `clearTimeout` 으로 정리된다. 메모리 누수·유령 리스너 우려 없음.

### [INFO] `live-preview.tsx`: `postMessage` 의 `targetOrigin` 폴백으로 `"*"` 사용
- **위치**: `live-preview.tsx` 라인 1083: `widgetOrigin || "*"`
- **상세**: `widgetOrigin` 이 빈 문자열인 경우(SSR 경로 또는 `getWidgetBase()` 반환 실패) `targetOrigin` 이 `"*"` 로 폴백된다. `"*"` 는 어떤 origin 이든 수신 가능하게 해 boot config payload 가 악의적 iframe 에 전달될 수 있다. 단, boot config 는 외형(색상·헤더 텍스트 등)만 포함하고 인증 비밀은 없다(`triggerEndpointPath` 는 공개 UUID). 브라우저 컨텍스트에서는 `getWidgetBase()` 가 항상 `window.location.origin + "/_widget"` 을 반환해 `widgetOrigin` 이 채워지므로 실제 `"*"` 폴백에 도달하는 경우는 SSR뿐이며, SSR에서는 `postMessage` 호출 자체가 의미 없다.
- **제안**: `widgetOrigin` 이 없으면 `postMessage` 를 전송하지 않도록 early-return 처리(`if (!widgetOrigin) return;`)를 고려. 방어적으로 명확.

### [INFO] `live-preview.tsx`: `LivePreview` 컴포넌트 시그니처 변경 (props 추가)
- **위치**: `page.tsx` diff: `<LivePreview />` → `<LivePreview endpointPath={instance.endpointPath} draft={draft} />`
- **상세**: `LivePreview` 가 props 없는 컴포넌트에서 `{ endpointPath, draft }` 를 필수로 받는 컴포넌트로 변경되었다. `page.tsx` 의 유일한 호출 지점이 업데이트되어 있어 누락된 호출자가 없다. TypeScript 필수 props 이므로 컴파일 타임에 누락 감지 가능. 부작용 없음.

### [INFO] `widget-base.ts`: 신규 공개 함수 `getWidgetOrigin()` 추가 — 기존 API 무영향
- **위치**: `widget-base.ts` 라인 1183–1192
- **상세**: 기존 함수(`getWidgetBase`, `getWidgetLoaderUrl`, `getWidgetAppUrl`, `isWidgetHostingConfigured`)는 시그니처/동작 변경 없음. 새 함수만 추가. 부작용 없음.

### [INFO] `plan/in-progress/web-chat-console.md`: Phase 3 체크리스트 항목이 실제 구현과 불일치
- **위치**: `plan/in-progress/web-chat-console.md` 라인 1411–1413 (Phase 3 체크리스트)
- **상세**: 커밋이 Phase 3 기능(iframe 임베드, postMessage, 타임아웃 fallback, 단위 테스트 4건)을 실제로 구현·완료했음에도 plan 파일 내 해당 항목들이 `[ ]` 미완료 상태로 남아 있다. 코드 동작에는 영향 없지만, plan 이 구현 현실을 반영하지 못하는 상태.
- **제안**: Phase 3 항목들을 `[x]` 로 업데이트.

## 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, `copy-widget.mjs` 스크립트가 모듈 최상위에서 외부 프로세스를 즉시 실행하고 파일시스템을 파괴적으로 수정(`rmSync`)하지만, 이 스크립트는 명시적 `build:widget` 스크립트로만 호출되고 import 대상이 아니어서 실운영에서의 의도치 않은 실행 위험은 낮다. 둘째, `postMessage` 의 `"*"` 폴백은 이론적 정보 노출이지만 boot config payload 가 공개 정보(외형 설정)에 한정되고 브라우저 환경에서는 폴백 도달 불가여서 실질 위험은 낮다. 전역 이벤트 리스너·타이머는 cleanup 이 올바르게 구현되었고, `LivePreview` 의 시그니처 변경은 유일한 호출 지점과 함께 업데이트되었다. 전체적으로 의도치 않은 부작용의 위험도는 낮다.

## 위험도

LOW

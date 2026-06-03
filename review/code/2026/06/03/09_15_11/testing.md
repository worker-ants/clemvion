# 테스트(Testing) 리뷰

## 발견사항

### 파일 5–6: `demo-config.test.ts` / `demo-config.ts`

- **[INFO]** `parseSuggestions` — 탭(tab) 구분자 처리 미테스트
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/demo-config.test.ts` (parseSuggestions describe)
  - 상세: 현재 구현은 `[\n,]` split이라 탭 문자는 trim 후 filter 에서 걸러진다. 그러나 이 동작이 의도인지 미검증. 엣지케이스로 명시적 테스트가 있으면 의도를 문서화하는 효과를 가진다.
  - 제안: `parseSuggestions("\ta\tb")` → `["a\tb"]` 인지 확인하는 케이스 1건 추가.

- **[INFO]** `buildBootConfig` — `primaryColor` 가 whitespace-only일 때 `appearance` 에서 제외되는 경로 미검증
  - 위치: demo-config.test.ts buildBootConfig describe
  - 상세: `if (form.primaryColor.trim()) appearance.primaryColor = ...` 분기가 있으나 테스트에 `primaryColor: "   "` 케이스가 없다. 실제 기능 영향은 낮지만 커버리지 갭이다.
  - 제안: "omits empty optional fields" 케이스에 `primaryColor: "   "` 를 추가해 `appearance.primaryColor` 가 undefined 임을 검증.

- **[INFO]** `isDemoEnabled` — `nodeEnv` 미전달(undefined) 경로 미테스트
  - 위치: demo-config.test.ts isDemoEnabled describe
  - 상세: `isDemoEnabled({})` 형태(nodeEnv 없음)는 `env.nodeEnv !== "production"` → `true` 가 된다. 이 동작이 의도인지 테스트로 명시되어 있지 않다.
  - 제안: `expect(isDemoEnabled({})).toBe(true)` 케이스 추가.

- **[INFO]** `isBootReady` — `apiBase` whitespace-only 케이스 단독 미검증
  - 위치: demo-config.test.ts isBootReady describe
  - 상세: `apiBase: ""` 와 `triggerEndpointPath: "  "` 는 테스트하지만 `apiBase: "   "` 단독 케이스는 없다. 구현은 `.trim().length > 0` 이므로 동작 이상 없으나, 현재 3-case 분기가 완전 커버리지를 보장하지는 않는다.
  - 제안: `isBootReady({ ...defaultDemoForm, apiBase: "  " })` → `false` 케이스 추가.

### 파일 7: `demo-host.tsx`

- **[WARNING]** React 컴포넌트 `DemoHost` 에 대한 단위/통합 테스트가 전혀 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/demo-host.tsx`
  - 상세: 데모 호스트는 dev 전용 하니스이므로 e2e 수준 검증이 이상적이나, 최소한 (1) boot 버튼 disabled 상태(isBootReady=false), (2) boot 버튼 클릭 시 `pendingBootRef` 세팅 및 iframeKey 증가, (3) `wc:ready` 메시지 수신 후 `wc:boot` 를 iframe에 postMessage 하는 흐름, (4) 잘못된 origin/source 메시지 무시 경로 — 이 4가지 동작이 자동화 테스트로 검증되지 않는다. `postMessage` 보안 경로(I6 요건)가 테스트 없이 코드 리뷰로만 검증된 상태다.
  - 제안: `@testing-library/react` + jsdom 환경(이미 vitest.config.ts에 설정됨)으로 다음 케이스를 `demo-host.test.tsx` 에 추가한다: (a) 초기 렌더 시 boot 버튼 disabled, (b) apiBase+trigger 입력 후 버튼 enabled, (c) `wc:ready` MessageEvent dispatch 후 iframe contentWindow 에 `wc:boot` postMessage 호출 확인(iframe mock 필요), (d) 다른 origin의 message 는 log 에 추가되지 않음. jsdom 환경에서 iframe contentWindow mock 이 복잡한 경우, (c)는 `postToWidget` 를 별도 훅/유틸로 추출해 단위 테스트 가능하게 구조를 바꾸는 것도 고려할 수 있다.

- **[INFO]** `appendLog` 60건 상한 경계값 테스트 없음
  - 위치: demo-host.tsx appendLog (`[entry, ...prev].slice(0, 60)`)
  - 상세: 로그 60건 상한이 정확히 동작하는지 테스트되지 않는다. 기능 중요도는 낮으나 경계값 동작이 자동 검증에서 누락되어 있다.
  - 제안: demo-host.test.tsx 작성 시 60+1 건 append 후 log.length가 60이 됨을 검증하는 케이스 추가.

### 파일 8: `page.tsx`

- **[INFO]** `DemoPage` 의 게이팅 분기(`notFound` 호출 경로)에 대한 단위 테스트 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/feat-web-chat-demo/codebase/channel-web-chat/src/app/demo/page.tsx`
  - 상세: `isDemoEnabled` 는 순수함수로 이미 테스트되어 있으나, `DemoPage` 가 production 환경에서 실제로 `notFound()` 를 호출하는 경로는 테스트되지 않는다. Next.js 서버 컴포넌트라 jsdom 단위 테스트 적용이 어렵지만, `notFound` mock 을 통해 렌더링 분기를 확인할 수 있다.
  - 제안: 해당 파일은 렌더 위임만 하므로 `isDemoEnabled` 테스트가 이를 간접 커버한다고 판단하는 경우 별도 테스트 생략도 수용 가능하다. 단, 이 결정을 주석 또는 plan에 명시적으로 기록할 것을 권장한다.

### 공통 — 테스트 인프라

- **[INFO]** `demo-host.tsx` 가 `process.env.NEXT_PUBLIC_BASE_PATH` 를 모듈 로드 시 즉시 평가함 — 테스트 환경에서 env override 복잡
  - 위치: demo-host.tsx L1153 `const WIDGET_SRC = ...`
  - 상세: 모듈 최상위에서 `process.env` 를 읽는 `WIDGET_SRC` 상수는 테스트에서 환경변수 override 후 모듈을 re-import 해야 바뀐 값을 테스트할 수 있다(`vi.resetModules()` + 동적 import 패턴). 현재는 테스트 파일 자체가 없으므로 문제가 드러나지 않지만, 나중에 테스트 작성 시 마찰이 발생한다.
  - 제안: `WIDGET_SRC` 계산을 함수 안으로 이동하거나, 별도 getter 함수로 분리하면 테스트 격리가 쉬워진다.

- **[INFO]** `vitest.config.ts` 의 `include` 패턴이 `src/**` 만 포함 — `demo-config.test.ts` 위치는 `src/app/demo/` 이므로 정상 포함됨. 이슈 없음.

## 요약

이번 변경에서 핵심 비즈니스 로직(순수 함수 계층)인 `demo-config.ts`는 `demo-config.test.ts`로 충실하게 커버되어 있다. `parseSuggestions`, `isBootReady`, `buildBootConfig`, `isDemoEnabled` 모두 주요 분기를 검증하며 테스트 가독성과 격리도 양호하다. 그러나 실제 사용자 인터랙션 로직이 집중된 `demo-host.tsx`(postMessage 핸드셰이크, origin 검증, 상태 전이)에 대한 테스트가 전무하다는 점이 이번 리뷰의 주요 갭이다. 특히 I6 보안 요건(event.source/origin 검증)이 코드에는 구현되어 있으나 자동화 테스트로 보장되지 않는 상태다. `demo-host.tsx`는 dev 전용 하니스이므로 기능 위험도는 낮지만, 보안 검증 경로의 테스트 부재는 WARNING 수준으로 판단한다. 나머지 발견사항(경계값 케이스 누락, env 평가 시점 등)은 INFO 수준이다.

## 위험도

LOW

# Testing Review — feat(web-chat): 위젯 co-deploy 빌드 + 라이브 미리보기 iframe (증분 2)

## 발견사항

### [WARNING] getWidgetOrigin() 에 대한 단위 테스트 부재
- 위치: `codebase/frontend/src/lib/web-chat/widget-base.ts` — `getWidgetOrigin()` (신규 추가)
- 상세: `widget-base.test.ts` 는 `getWidgetBase`, `getWidgetLoaderUrl`, `getWidgetAppUrl`, `isWidgetHostingConfigured` 만 테스트한다. 이번 커밋에서 신규 추가된 `getWidgetOrigin()` 에 대한 케이스가 없다. 이 함수는 postMessage origin 검증의 핵심 게이트키퍼로, 아래 경로가 모두 미커버 상태다.
  - `NEXT_PUBLIC_WIDGET_CDN_BASE` 설정 시 CDN URL 에서 origin 추출 (예: `https://cdn.example.com/path` → `https://cdn.example.com`)
  - 동봉 self-origin 시 `window.location.origin` 반환
  - `getWidgetBase()` 가 빈 문자열 반환 시 빈 문자열 반환 (SSR + 미설정)
  - `new URL(base, ref)` 파싱 실패 시 빈 문자열 반환 (catch 경로)
  - `window` 미존재(SSR) 시의 `ref` 처리 경로
- 제안: `widget-base.test.ts` 에 `getWidgetOrigin` import 를 추가하고 위 5개 케이스를 describe 블록으로 추가한다.

### [WARNING] 외형 변경 시 boot 재전송 경로의 테스트 부재
- 위치: `codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx`
- 상세: 현재 4개 테스트는 (1) iframe src 구성, (2) 초기 wc:ready → wc:boot, (3) wrong-origin 무시, (4) 타임아웃 fallback 을 다룬다. 그러나 spec §6.1-5 및 코드의 두 번째 `useEffect` — "외형 폼만 바뀌면 iframe 재마운트 없이 wc:boot 재전송" — 에 대한 테스트가 없다. `ready` 상태 후 `draft` prop 이 바뀔 때 `postMessage` 가 새 payload 로 한 번 더 호출되는지 확인하는 케이스가 필요하다.
- 제안: `fireEvent` / `rerender` 로 draft 를 변경한 뒤 `postMessage` 가 새 `bootConfig` 로 재호출됨을 검증하는 테스트를 추가한다.

### [WARNING] 타임아웃 테스트에서 `waitFor` import 가 미사용 상태
- 위치: `codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx`, line 701
- 상세: `waitFor` 가 import 에 포함되어 있으나 실제 어느 테스트에서도 사용되지 않는다. lint/tree-shaking 에는 무해하나 의도가 불명확하고 실제 필요한 곳(비동기 상태 전환 확인)에 사용되지 않아 코드 품질상 혼란을 유발한다.
- 제안: 미사용이면 import 에서 제거. 비동기 상태 전환을 테스트할 케이스를 추가한다면 해당 테스트에서만 사용한다.

### [INFO] `copy-widget.mjs` 빌드 스크립트에 단위 테스트 없음 (스크립트 특성상 INFO)
- 위치: `codebase/frontend/scripts/copy-widget.mjs`
- 상세: 이 스크립트는 `execSync` + `cpSync` 를 사용하는 top-level 실행 스크립트다. 순수 함수가 없고 `run()` 함수도 Node.js 빌드 프로세스에 결합되어 있어 unit 테스트가 어렵다. 구조상 단위 테스트보다는 CI 통합 검증(실측 복사 확인)이 적합하며, 커밋 메시지에도 "실측 검증(artifacts 복사 확인)"이 언급되어 있다. 다만 경로 계산 로직(`here`, `frontendRoot`, `repoRoot`, `dest`)은 순수 함수로 추출하면 단위 테스트 가능하다. 현재는 테스트 부재가 위험 수준은 아니지만, 경로 로직이 복잡해지면 추출을 고려한다.
- 제안: 단기적으로는 현 구조 유지 허용. 경로 계산 로직을 `resolveOutputPaths(root)` 같은 pure function 으로 추출하면 unit 테스트 가능하게 개선된다.

### [INFO] `wc:ready` 수신 후 status 가 "ready" 로 전환되는 시점에 postBoot 가 한 번만 호출되는지 검증 미흡
- 위치: `live-preview.test.tsx` 테스트 2번 ("wc:ready 수신 시 wc:boot 으로 boot config 를 전달")
- 상세: 현재 테스트는 `postMessage` 가 정확히 1회 호출됨을 `toHaveBeenCalledTimes(1)` 로 검증하여 중복 전송이 없음을 확인한다. 이 검증은 충분하나, 두 번째 `useEffect`(`[bootConfig, status]` dep) 와 첫 번째 `useEffect` 사이의 경쟁 조건(status 초기화 → ready 전환 중 bootConfig 변경)은 현재 테스트로 커버하기 어렵다. 실 운영에서 재현 가능성은 낮으나 이론적 갭.
- 제안: 현 수준 허용. 외형 변경 재전송 테스트(위 WARNING 항목)를 추가하면 해당 흐름도 간접 커버된다.

### [INFO] 테스트에서 `window.location.origin` 의 실제 jsdom 값 의존
- 위치: `live-preview.test.tsx`, line 798 `const ORIGIN = window.location.origin;`
- 상세: jsdom 기본값(`http://localhost`)을 그대로 사용한다. `LivePreview` 컴포넌트의 `getWidgetOrigin()` 이 이 값을 기반으로 origin 검증을 수행하므로 테스트 환경과 실제 환경의 origin 불일치는 발생하지 않는다. 단, 향후 `NEXT_PUBLIC_WIDGET_CDN_BASE` 를 환경에 설정한 경우의 origin 검증 분기는 현재 테스트로 커버되지 않는다 (CDN origin != window origin).
- 제안: CDN override 시나리오에서 wrong-origin 으로 분류되는지 확인하는 테스트를 추가한다.

### [INFO] plan 파일의 Phase 3 체크박스 불일치
- 위치: `plan/in-progress/web-chat-console.md` Phase 3
- 상세: 실제 구현(iframe 임베드, wc:boot, 타임아웃 fallback, unit 테스트 4개)은 완료되었으나 plan 의 Phase 3 체크박스 3개가 모두 `[ ]` 미완료로 남아 있다. 테스트 자체의 문제는 아니나 plan 추적이 구현 상태를 반영하지 못해 혼란을 유발한다.
- 제안: 완료된 항목을 `[x]` 로 갱신한다.

## 요약

4개의 단위 테스트(iframe src 구성, wc:boot 전달, wrong-origin 무시, 타임아웃 fallback)가 `LivePreview` 의 핵심 흐름을 적절히 커버한다. 테스트 격리(cleanup, afterEach 타이머 복구), postMessage spy, `vi.useFakeTimers` 활용 방식은 모두 올바르다. 가장 큰 갭은 두 가지다: (1) 이번 커밋에서 신규 추가된 `getWidgetOrigin()` 에 대한 단위 테스트가 `widget-base.test.ts` 에 전혀 없고, (2) 외형 폼 변경 시 iframe 재마운트 없이 wc:boot 를 재전송하는 경로(두 번째 useEffect, `[bootConfig, status]` 의존성)가 검증되지 않는다. `copy-widget.mjs` 빌드 스크립트는 top-level 실행형이라 단위 테스트 적용이 제한적이며 현 CI 실측 검증으로 대체 가능하다.

## 위험도

MEDIUM

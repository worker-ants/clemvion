# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[WARNING]** `useUpdateWebChatAppearance` — PATCH 시 `enabled: true` 하드코딩으로 비활성 인스턴스 상태 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useUpdateWebChatAppearance` mutationFn
- 상세: `interaction.enabled` 를 `true` 로 하드코딩한다. `mergeExternalConfig` 가 interaction 키를 통째로 교체하므로, 혹시 `config.interaction.enabled` 가 `false` 인 인스턴스에 외형 저장 요청이 들어오면 enabled 가 `true` 로 강제 변경되는 의도치 않은 상태 변경이 발생한다. 웹채팅 콘솔에 노출되는 인스턴스는 `interaction.enabled === true` 조건 필터를 통과한 것이므로 현재 실제 경로에서는 문제가 없으나, 이 훅이 외부에서 재사용될 경우 silent mutation 위험이 있다.
- 제안: `enabled: true` 대신 `enabled: instance.isActive !== false` 또는 인자로 받은 `enabled` 값을 사용하도록 변경하거나, 최소한 JSDoc에 "호출자는 이미 enabled=true인 인스턴스에만 사용해야 함"을 명기한다.

### **[WARNING]** `mockConsole` 클로저 내 공유 배열 변이 — 테스트 격리 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/e2e/web-chat/console.spec.ts` — `mockConsole` 함수
- 상세: `const triggers = [...initial]` 로 복사하여 closure 내부에서 관리하지만, POST 핸들러가 `triggers.push(...)` 로 이 배열을 직접 변이한다. `test.describe` 블록 내 여러 테스트가 동일 `mockConsole` 인스턴스를 공유하는 경우(현재 코드에서는 각 테스트마다 새로 호출하므로 실제 누수는 없음), 혹은 test retry 시 state가 누적될 수 있다. 현재 구조에서는 실제 부작용이 없지만 패턴이 취약하다.
- 제안: stateful mock 이 의도된 설계임을 주석으로 명기한다(현재 JSDoc에 설명 있음). 각 테스트의 `mockConsole` 호출 범위가 독립됨을 확인하는 현행 구조는 적절하나, Playwright retry 정책상 beforeAll 에 올리지 않도록 주의가 필요하다.

### **[WARNING]** `wc:resize` effect — `sendResize` 가 `useCallback([], [])` 이지만 `bridgeRef.current` 에 의존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/channel-web-chat/src/widget/use-widget.ts` — `sendResize` useCallback
- 상세: `sendResize` 는 `useCallback(() => bridgeRef.current?.sendResize(payload), [])` 로 의존성 배열이 비어있다. `bridgeRef` 는 ref 이므로 deps 누락이 린트 경고를 유발하지는 않으나, `widget-app.tsx` 의 `useEffect` 가 `sendResize` 를 deps로 받는다. `sendResize` 가 항상 동일 참조를 반환하는 것은 의도된 것이지만, `bridgeRef.current` 가 교체되는 시점(재마운트·bridge destroy/재생성)에 effect가 재실행되지 않아 이전 bridge 인스턴스로 resize 신호를 보낼 가능성이 있다. 실제로 bridge 교체는 boot 재연결 시 발생한다.
- 제안: `bridgeRef` 자체가 mutable ref 이므로 deps 누락은 React 정책상 허용이지만, bridge 재생성 후 collapsed/expanded 상태를 즉시 재전송하는 로직을 bridge 초기화 경로에도 두는 것을 검토한다.

### **[INFO]** `seedDraft` 에서 `localStorage` 읽기 — SSR 환경에서의 부작용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-appearance-draft.ts` — `readLocalDraft`
- 상세: `readLocalDraft` 는 `typeof window === "undefined"` 가드를 통해 SSR에서는 `null` 반환하도록 방어한다. 그러나 `useAppearanceDraft` 의 `useState(() => seedDraft(...))` 안에서 두 번 호출(`draft` 초기화 + `savedJson` 초기화)되므로 `seedDraft` 내 `readLocalDraft` 가 두 번 localStorage를 읽는다. 동일 값을 읽으므로 실제 부작용은 없으나 불필요한 중복 I/O다.
- 제안: `const initialDraft = seedDraft(instanceId, serverAppearance)` 를 한 번만 계산하여 두 `useState` 에 공유하거나, `useMemo`/`useRef`로 캐시한다.

### **[INFO]** `QueryClient` 캐시 무효화 — `TRIGGERS_KEY` 전체 무효화의 파급 범위
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/use-web-chat.ts` — `useUpdateWebChatAppearance` onSuccess
- 상세: `queryClient.invalidateQueries({ queryKey: TRIGGERS_KEY })` 는 `["triggers"]` prefix 를 공유하는 모든 쿼리를 무효화한다. 트리거 목록 화면에서 대량의 트리거를 조회하는 쿼리가 실행 중이라면, 외형 저장 한 번에 해당 쿼리도 재요청된다. 기능 오류는 아니지만 불필요한 네트워크 요청을 유발할 수 있다.
- 제안: 외형 저장은 웹채팅 콘솔 전용이므로 `WEB_CHAT_INSTANCES_KEY` 만 무효화하는 것도 충분하다. 트리거 상세 드로어에서 즉시 반영이 필요한 경우에만 `TRIGGERS_KEY` 무효화를 유지한다.

### **[INFO]** `afterEach(cleanup)` 전역 등록 — `schedules-page.test.tsx` 이외 영향 없음 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`
- 상세: 최상위 `afterEach(cleanup)` 는 해당 파일 범위로 격리된다(Vitest의 `afterEach` 스코프). 다른 파일에는 영향 없다. 기존 `beforeEach` 내 `cleanup()` 호출과 이 `afterEach` 가 중복되어 일부 테스트에서 cleanup이 두 번 호출되나, `@testing-library/react` 의 `cleanup` 은 멱등(idempotent)하므로 부작용 없다.
- 제안: 현재 패턴 유지. 중복 cleanup을 제거하려면 `beforeEach` 내 `cleanup()` 호출을 제거하면 되지만 필수 아님.

### **[INFO]** `live-preview.tsx` — `setPreviewHeight` 를 `onMessage` 핸들러 내에서 호출
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/live-preview.tsx`
- 상세: `window.addEventListener("message", onMessage)` 에서 iframe 외부의 다른 postMessage 를 origin+source 이중 검증으로 차단하고 있어 의도치 않은 상태 변경 위험은 낮다. `e.source !== iframeRef.current?.contentWindow` + `e.origin !== expectedOrigin` 두 조건 모두 통과해야 `setPreviewHeight` 가 호출된다.
- 제안: 현재 구현 적절. 이벤트 리스너 cleanup (`return () => window.removeEventListener(...)`) 도 올바르게 구현되어 있다.

### **[INFO]** `InteractionConfigDto` 에 `appearance` 추가 — 기존 API 확장, 하위 호환
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts`
- 상세: `appearance` 필드는 `@IsOptional()` 이므로 기존 요청에 포함되지 않아도 유효성 검사를 통과한다. 하위 호환성이 유지된다. `mergeExternalConfig` 가 interaction 키를 통째로 교체하는 기존 동작에 의해 기존 `appearance` 없는 PATCH는 `appearance` 를 `undefined`로 덮어쓴다 — 즉 PATCH body에 `appearance` 필드를 생략하면 기존에 저장된 `appearance` 가 삭제된다. 이는 `useUpdateWebChatAppearance` 가 항상 `appearance` 를 포함하여 전송하는 설계로 보완하고 있지만, 외부(3rd-party) API 호출자가 `appearance` 없이 PATCH 하면 조용히 외형 데이터가 소실된다.
- 제안: EIA 문서(`spec/5-system/14-external-interaction-api.md`)에 "PATCH 시 `interaction` 객체를 통째로 교체하므로 기존 `appearance` 를 보존하려면 함께 전송해야 한다"는 주의사항을 추가한다. (이미 diff에 "mergeExternalConfig 가 interaction 키를 통째로 교체" 주석이 추가됨 — 적절.)

---

## 요약

전체 변경은 웹채팅 콘솔 외형 서버 저장·서버측 interactionEnabled 필터·wc:resize 미리보기 동기화를 추가하는 기능 확장이며 의도치 않은 전역 변수 도입, 파일시스템 부작용, 환경 변수 오염은 발견되지 않았다. 주요 위험은 두 가지다: (1) `useUpdateWebChatAppearance` 의 `enabled: true` 하드코딩으로 비활성 인스턴스에 적용 시 enabled 가 강제 변경될 수 있고, (2) `PATCH /api/triggers/:id` 로 `interaction` 전체 교체 시 `appearance` 를 생략하면 기존 외형 데이터가 소실되는 silent mutation이 발생할 수 있다. 공개 API 인터페이스(`InteractionConfigDto`, `useWidget.actions`, `IframeBridge`)는 모두 선택적 확장으로 하위 호환성을 유지한다. `wc:resize` 는 기존 `WcMessageType` 에 이미 포함되어 있던 타입이며 이번에 payload 인터페이스와 송신 구현만 추가됐다. `useAppearanceDraft` 시그니처 변경(`serverAppearance` 파라미터 추가)은 optional 이므로 기존 호출자에 영향 없다.

---

## 위험도

MEDIUM

(PATCH interaction 전체 교체로 인한 appearance silent 소실 위험이 외부 API 호출자에게 노출될 수 있으며, enabled 하드코딩으로 인한 상태 변경 가능성이 있음. 내부 경로에서는 방어 로직으로 보완되어 있으나 API 계약 레벨에서 명시가 필요하다.)

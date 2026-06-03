# Testing Review

## 발견사항

### **[INFO] `normalizeApiBase` 테스트 커버리지 — 양호, 단 한 가지 갭**
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/app/demo/demo-config.test.ts` `describe("normalizeApiBase")` 블록
- 상세: 핵심 3가지 케이스(trailing `/api` 제거, bare origin 유지, hostname/non-trailing 불간섭)를 모두 다룬다. 그러나 다중 trailing `/api` 중첩(`http://host/api/api`) 케이스가 빠져 있다. 구현은 `replace(/\/api$/i, "")` 를 1회만 적용하므로 `/api/api` 입력 시 `/api` 가 남는다 — 이것이 의도된 행동인지 명시한 테스트가 없다.
- 제안: `it("does not strip repeated /api — only one trailing segment")` 추가로 의도를 문서화.

### **[INFO] `buildBootConfig` 테스트에서 apiBase 정규화 기대값 업데이트 — 올바름**
- 위치: `demo-config.test.ts` line 257
- 상세: 기존 테스트가 `"http://localhost:3011/api"` 입력 기준으로 `cfg.apiBase === "http://localhost:3011/api"` 를 기대했으나, 변경 후 `normalizeApiBase` 적용으로 `"http://localhost:3011"` 로 정확히 갱신됐다. 회귀 없음.
- 제안: 없음. 정상.

### **[INFO] `use-widget.test.ts` — `onError` 콜백 미테스트**
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.test.ts` (전체 파일), `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget-commands.test.ts`
- 상세: `use-widget.ts` 에 추가된 `onError` 핸들러(`console.warn(...)`)에 대한 테스트가 없다. `onError` 가 호출될 때 `console.warn` 이 특정 메시지와 함께 발화되는지, SSE 흐름이 중단되지 않는지(EventSource 재연결 유지) 검증하는 테스트가 부재하다. 이 코드는 진단 목적의 단순 `console.warn` 이라 치명적이지는 않지만, CORS 오류 시나리오에서 경고 메시지 형식이 변경돼도 회귀를 잡지 못한다.
- 제안: `use-widget.test.ts` 또는 별도 SSE error 시나리오 테스트에서 `openStream` 의 `onError` 가 `console.warn` 을 호출하는지 spy 로 검증. EIA 클라이언트 mock 의 `openStream` 에서 `onError` 콜백을 트리거하는 패턴으로 구현 가능.

### **[INFO] `demo-host.test.tsx` — apiBase 기본값 변경 반영 여부 확인**
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/app/demo/demo-host.test.tsx` line 21
- 상세: 테스트는 "기본 apiBase 는 있으나 trigger 가 비어 있음" 으로 boot 버튼 disabled 를 검증한다. `defaultDemoForm.apiBase` 가 `"http://localhost:3011/api"` → `"http://localhost:3011"` 으로 변경됐지만, 이 테스트는 apiBase 값 자체를 assert 하지 않으므로 영향 없다. 회귀 없음.
- 제안: 없음.

### **[INFO] CORS 힌트 UI(`<p style={S.hint}>`) 는 렌더 전용, 테스트 불필요 수준**
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/app/demo/demo-host.tsx` (추가된 `<p>` 블록)
- 상세: 추가된 CORS 안내 단락은 순수 정적 텍스트이므로 별도 단위 테스트의 우선순위가 낮다. 단, 이 힌트가 항상 노출되고(`!ready` 조건과 무관) 기존 테스트들이 DOM 구조를 검사하지 않으므로 회귀 없음.
- 제안: 없음. (선택적으로 `screen.getByText(/WEB_CHAT_WIDGET_ORIGINS/)` 로 존재 여부 smoke test 추가 가능하나 의무 아님.)

### **[WARNING] `normalizeApiBase` — 빈 문자열 입력 케이스 미테스트**
- 위치: `demo-config.test.ts` `describe("normalizeApiBase")` 블록
- 상세: `normalizeApiBase("")` 는 `""` 를 반환하는데, `isBootReady` 가 먼저 빈 apiBase 를 필터하므로 실제 경로에서 빈 값이 `normalizeApiBase` 에 도달할 가능성은 낮다. 그러나 함수 자체의 계약(contract)으로서 엣지 입력(`""`, 공백만, 슬래시만 `"/"`) 에 대한 명시 테스트가 없어 유지보수 시 리그레션 위험이 있다.
- 제안:
  ```ts
  it("handles empty / whitespace-only input without throwing", () => {
    expect(normalizeApiBase("")).toBe("");
    expect(normalizeApiBase("   ")).toBe("");
    expect(normalizeApiBase("/")).toBe("");
  });
  ```

### **[WARNING] `use-widget.ts` `onError` 는 테스트 불가 구조로 인라인됨**
- 위치: `/Volumes/project/private/clemvion/codebase/channel-web-chat/src/widget/use-widget.ts` lines 1128-1133
- 상세: `onError` 콜백이 `openStream` 내부에 직접 인라인되어 있다. `EiaClient.openStream` 의 `onError` 옵션을 테스트 환경에서 시뮬레이션하려면 mock 구조가 필요하다. 현재 `use-widget.test.ts` 는 `refreshDelayMs` 순수 함수만 테스트하고, `use-widget-commands.test.ts` 는 `fetch` 를 stub 하는 수준이다. `openStream` 의 `onError` 경로를 검증하려면 `EiaClient` 의 `openStream` 구현체를 mock 해야 하는데, 이를 위한 주입 지점이 없다(`clientRef.current` 는 내부에서 `new EiaClient(...)` 로 생성).
- 제안: 테스트 용이성을 높이려면 `EiaClient` 생성을 팩토리 함수로 추출하거나, `openStream` 에 전달되는 `handlers` 객체를 외부에서 주입할 수 있도록 리팩토링 필요. 단기적으로는 `console.warn` spy + `onError` 트리거 패턴으로 블랙박스 테스트 가능.

## 요약

이번 변경의 핵심은 `normalizeApiBase` 함수 추출, `defaultDemoForm.apiBase` 기본값 수정, 그리고 `use-widget.ts` 의 SSE `onError` 진단 로깅 추가다. `demo-config.test.ts` 는 새 함수에 대한 테스트를 동시에 추가했고, 기존 `buildBootConfig` 기대값도 올바르게 갱신했으며, `demo-host.test.tsx` 는 변경에 영향받지 않는다. 전반적으로 테스트 추가가 충실하다. 다만 `normalizeApiBase` 의 빈 문자열·경계값 케이스가 명시적으로 테스트되지 않았고, `use-widget.ts` 에 추가된 `onError` 콜백은 현재 테스트 구조상 검증할 수 없는 상태다 — `EiaClient` 가 내부에서 직접 생성되어 mock 주입 지점이 없어 테스트 용이성에 구조적 제약이 있다. 이 두 갭은 즉각 차단 사유는 아니나, `onError` 의 테스트 불가 구조는 향후 `EiaClient` 팩토리 추출 시 함께 개선할 것을 권장한다.

## 위험도

LOW

# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] `ChartView` 내 매직 넘버 — SVG 레이아웃 상수 인라인 하드코딩
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `ChartView` 함수 내 `W = 280`, `H = 140`, `pad = 24`
- 상세: `W`, `H`, `pad` 가 함수 지역 변수로 선언돼 있어 이름이 있지만 의미가 약하다(`W`/`H`는 단독으로 너비/높이임을 충분히 전달하나 `pad`는 padding-x/y 구분이 없다). `styles.ts`의 `.wc-chart-svg { max-width: 280px }` 와 `W = 280` 이 두 파일에 분산돼 있어 한쪽만 변경 시 불일치가 발생할 수 있다. 외부에서 선언된 `DEFAULT_CHART_COLORS`와 달리 이 값들은 함수 내부에 묻혀 있어 차트 전체 크기 조정 시 수정 위치를 찾기 어렵다.
- 제안: `W`, `H`, `pad`를 파일 상단 상수(`CHART_SVG_W`, `CHART_SVG_H`, `CHART_SVG_PAD`)로 올리거나 `DEFAULT_CHART_COLORS` 옆에 `CHART_SVG_DEFAULTS` 객체로 묶는다. `styles.ts`의 `max-width: 280px`과 동기화 주석을 추가한다.

### [INFO] `PieSlices` 내 O(n²) prefix-sum — 주석 필요 수준의 비자명 코드
- 위치: `codebase/channel-web-chat/src/widget/components/presentations.tsx` — `PieSlices` 함수, `starts` 배열 계산
- 상세: 코드 자체에 "n 작아 O(n²) 무해" 주석이 달려 있어 의도는 명확하다. 그러나 복잡도를 설명하는 주석이 필요할 만큼 비자명한 코드보다는 O(n) 누적 루프가 더 단순하고 관용적이다.
- 제안: `const starts: number[] = []; let acc = 0; for (const p of pts) { starts.push(acc); acc += Math.max(0, p.value) / total; }` 패턴으로 단순화하면 주석 없이도 의도가 명확하다. 필수 변경은 아님.

### [INFO] `use-widget.ts` — 마운트 `useEffect` 내 `applyConfig` 함수가 6가지 책임 혼합
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — 마운트 `useEffect` 내 `applyConfig` 함수(303~323라인 구간)
- 상세: `applyConfig`는 임베드 허용 검증 → configRef/setConfig 설정 → clientRef 생성 → 세션 복원 → SSE 재연결 → 토큰 갱신 예약까지 6가지 책임을 순차적으로 수행한다. `scheduleRefresh`도 같은 `useEffect` 내에 선언돼 있어 mount effect 전체가 ~100행의 큰 함수 블록이 됐다. 단독 테스트나 추출이 어렵다.
- 제안: `applyConfig`를 `useCallback`으로 추출하거나, 최소한 단계별 주석 블록(`// 1. 임베드 검증`, `// 2. 클라이언트 초기화`, `// 3. 세션 복원`)으로 가독성을 높인다.

### [INFO] `hooks.controller.ts` — 인라인 매직 넘버 `300` (Cache-Control max-age)
- 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts` — `getEmbedConfig` 메서드 내 `'public, max-age=300'`
- 상세: `300`초(5분)가 인라인 문자열에 포함돼 있다. 코드 주석("5분")이 있어 의미를 알 수 있지만, 서비스 SLA 변경 시 단일 위치에서 수정할 수 없다.
- 제안: `const EMBED_CONFIG_CACHE_SEC = 300;`으로 추출해 `res.set('Cache-Control', \`public, max-age=${EMBED_CONFIG_CACHE_SEC}\`)` 형태로 사용한다.

### [INFO] `widget-app.test.tsx` — `boot` 함수 내 `await Promise.resolve()` 이중 호출의 취약성
- 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx` — `boot` async 함수 내 연속 2회 `await Promise.resolve()`
- 상세: 코드 주석("applyConfig → isEmbedAllowed(fetch) → setConfig 의 microtask 체인 flush")이 이유를 설명하고 있어 의도는 명확하다. 그러나 숫자(2회)가 내부 마이크로태스크 체인 깊이에 의존하고 있어, 내부 구현이 변경되면 테스트가 조용히 flaky해질 수 있다.
- 제안: `@testing-library/react`의 `waitFor` 또는 `flushPromises` 유틸로 대체하는 것이 더 견고하다. 단기적으로는 현재 접근 방식도 동작하며 주석이 있으므로 INFO 수준이다.

### [INFO] `EmbedConfigService.resolve` — `settings?.['interactionAllowedOrigins']` 브라켓 접근으로 오타 취약성
- 위치: `codebase/backend/src/modules/hooks/embed-config.service.ts` — `resolve` 메서드 내 `workspace?.settings?.['interactionAllowedOrigins']`
- 상세: 브라켓 접근은 `Workspace.settings`에 해당 필드가 타입으로 정의되지 않아 발생한 것으로 보인다. 이 키 이름이 CORS 설정 등 여러 곳에서 문자열 리터럴로 반복될 경우 오타 취약성이 있다.
- 제안: `Workspace.settings` 타입에 `interactionAllowedOrigins?: string[]`을 추가하거나, 단일 상수(`const INTERACTION_ALLOWED_ORIGINS_KEY = 'interactionAllowedOrigins'`)로 추출해 재사용한다.

### [INFO] `_ensure_web_chat_deps` — `test-stages.sh` 세 커맨드 각각 중복 호출
- 위치: `.claude/test-stages.sh` — `cmd_lint`, `cmd_unit`, `cmd_build` 각 함수 내 `_ensure_web_chat_deps` 호출
- 상세: 세 커맨드 모두 `_ensure_web_chat_deps`를 호출한다. 각 커맨드가 독립 실행 가능해야 한다는 요건 하에서는 합리적이지만, 로컬에서 연달아 실행 시 조건 체크가 세 번 발생한다. CI job 분리 환경에서는 문제없다.
- 제안: 현재 설계는 각 단계 독립성을 유지하므로 수용 가능. 필요하다면 `cmd_all` 같은 래퍼에서 한 번만 호출하는 구조를 문서화한다.

### [INFO] `presentation.ts` — `asRecord`/`asArray`/`asButtons` 헬퍼 이름에서 "방어적 캐스팅" 의미 미반영
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` — 파일 상단 헬퍼 함수 3개
- 상세: `asRecord`, `asArray`, `asButtons`는 역할이 명확하나 이 함수들이 `unknown` 입력을 방어적으로 캐스팅함을 이름에서 알기 어렵다. `safeAsArray`, `coerceToRecord` 등이 의도를 더 명확히 전달한다. 파일 범위 내에서만 쓰이고 맥락으로 유추 가능하므로 INFO 수준이다.
- 제안: 파일 상단에 "// 방어적 타입 강제 헬퍼 — unknown 입력을 안전하게 캐스팅" 주석 한 줄 추가로도 충분하다. 필수 변경 아님.

## 요약

이번 변경(임베드 allowlist 소프트 검증, rich presentation 렌더러, 토큰 자동 갱신, CI wiring, BYO-UI 정식화)은 전반적으로 유지보수성이 양호하다. 각 파일의 책임 분리가 명확하고(`EmbedConfigService`, `presentation.ts`, `widget-state.ts` 등), 헬퍼 함수 추출(`asRecord`, `asButtons`, `refreshDelayMs`)과 상수화(`CAROUSEL_LAYOUTS`, `CHART_TYPES`, `TOKEN_REFRESH_LEAD_MS`)가 일관되게 적용됐다. 주요 개선 여지는 `ChartView` SVG 매직 넘버(`W=280`이 `styles.ts`와 분산), `use-widget.ts` 마운트 effect의 `applyConfig` 함수 길이(6가지 책임 혼합), `hooks.controller.ts`의 인라인 `max-age=300`, 테스트의 이중 `Promise.resolve()` 취약성 정도이며 모두 INFO 수준이다. CRITICAL·WARNING 발견사항 없음.

## 위험도

NONE

---

STATUS=success ISSUES=8

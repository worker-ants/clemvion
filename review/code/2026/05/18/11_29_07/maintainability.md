# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1 & 2: integration-expiry-scanner.service.spec.ts / .ts

- **[WARNING]** `savedExpired` 검증 로직 중복 (spec.ts 내 두 곳)
  - 위치: spec.ts 라인 99~110, 185~194
  - 상세: `cafe24 refresh enqueue throws` 테스트와 `enqueues cafe24-token-refresh` 테스트 양쪽에 `savedArgs.some(...)` → 중첩 `arr.some(...)` 구조가 완전 동일하게 두 번 반복된다. 5~6줄짜리 타입 단언 + 배열 순회 블록이므로 변경 시 두 곳을 동시에 수정해야 하는 취약점이 생긴다.
  - 제안: 헬퍼 함수(`hasSavedExpiredStatus(mockCalls)`)로 추출해 두 테스트가 공유.

- **[WARNING]** `isCafe24RefreshCapable` 과 `Cafe24McpToolProvider.tryRecoverExpired` 내부의 refresh_token 추출 코드 중복
  - 위치: integration-expiry-scanner.service.ts (파일 2 신규 함수), cafe24-mcp-tool-provider.ts `tryRecoverExpired` 라인 1167~1172
  - 상세: 두 파일 모두 `const creds = integration.credentials as Record<string, unknown> | null | undefined; const rt = creds?.refresh_token; return typeof rt === 'string' && rt.length > 0` 패턴을 독립적으로 구현한다. 향후 `credentials` 스키마 변경 시 누락 위험.
  - 제안: `cafe24-token-refresh.constants.ts` 또는 `cafe24-credentials.utils.ts` 에 `hasRefreshToken(integration: Integration): boolean` 유틸 함수 하나로 통합.

- **[INFO]** `isCafe24RefreshCapable` 함수 위치가 모듈 파일 말단에 위치 — 관련 로직(`connected-expiry 0d` 분기)과 거리가 멀어 탐색 비용이 높음
  - 위치: integration-expiry-scanner.service.ts 라인 272~280 (diff 기준)
  - 상세: 함수가 484라인 이후에 배치되어, 호출 지점인 351라인 부근에서 바로 찾기 어렵다. 현행 파일 스타일은 대형 클래스 + 파일 말단 헬퍼 패턴을 따르지만, 이 함수는 public 이 아닌 module-private 유틸이라 module 내 재사용 가능성이 낮아 응집성이 떨어짐.
  - 제안: JSDoc 주석은 잘 작성되어 있으므로 허용 가능. 단, 향후 다른 provider 유사 함수 추가 시 유틸 파일 분리를 고려.

- **[INFO]** 매직 문자열 `'background'` 가 source 필드에 하드코딩
  - 위치: integration-expiry-scanner.service.ts, `cafe24RefreshQueue.add` 호출 내 payload
  - 상세: `{ integrationId: integration.id, source: 'background' }`. `Cafe24RefreshJobData` 의 `source` 타입(`'proactive' | 'background'`)이 이미 상수화된 값인데, scanner 호출부에서는 리터럴 문자열로 반복된다. `CAFE24_REFRESH_JOB` 처럼 상수로 추출하거나 타입에서 값 추출 방식을 사용하면 오타를 컴파일 타임에 잡을 수 있음.
  - 제안: `cafe24-token-refresh.constants.ts` 에 `CAFE24_REFRESH_SOURCE_BACKGROUND = 'background' as const` 추가 또는 `Cafe24RefreshJobData['source']` 타입 활용.

---

### 파일 6: cafe24-mcp-tool-provider.ts

- **[WARNING]** `tryRecoverExpired` 메서드가 여러 책임을 겸함 — 분기 판단 + 큐 호출 + 재조회 + 상태 해석을 한 메서드가 모두 처리
  - 위치: `tryRecoverExpired`, 라인 1158~1208 (diff 기준, 약 50라인)
  - 상세: 메서드 내부에서 (1) install_timeout 조기 반환, (2) refresh_token 유무 검사, (3) `refreshTokenViaQueue` 비동기 호출, (4) 재조회, (5) 상태 판단의 5단계를 순차적으로 처리한다. 복잡도 자체는 허용 범위(순환복잡도 ~4)이나 try-catch 2중첩이 있어 오류 경로 추적이 조금 복잡하다. 단일 메서드로서 일관성은 있으나 이름(`tryRecoverExpired`)이 "시도"와 "결과 반환"을 동시에 포함하는 점이 미묘하게 모호.
  - 제안: 현재 구조는 전반적으로 수용 가능. 단, 재조회 실패 경로(`lookup_failed`)와 `auth_failed` 경로를 각각 분리한 내부 헬퍼(`fetchFreshAfterRefresh`)로 나누면 테스트 격리가 쉬워짐.

- **[WARNING]** `buildTools` 내 통합 status 별 분기 (`expired` / `pending_install` / `else`) 가 3단 `if-else if-else if-else` 구조로 중첩 깊이 증가
  - 위치: cafe24-mcp-tool-provider.ts diff 기준 라인 1076~1119
  - 상세: `integration.status === 'expired'` → `recovered.kind === 'recovered'` → 내부 분기로 이어지는 구조가 `continue` + `else` 의 조합으로 읽힌다. 각 비정상 상태는 `pushMcpServerSummary + continue` 패턴이 반복되어 실질적으로 guard clause 패턴인데, `if-else if-else if-else` 형태가 이를 흐린다.
  - 제안: 각 비정상 분기를 명시적 guard clause(`if (status === 'expired') { ...; continue; } if (status === 'pending_install') { ...; continue; } if (status !== 'connected') { ...; continue; }`)로 평탄화하면 main 흐름(`connected` 정상 경로)이 더 명확해짐.

- **[INFO]** `pushMcpServerSummary` 호출부마다 `serviceType: 'cafe24'` 를 반복하여 하드코딩
  - 위치: cafe24-mcp-tool-provider.ts diff 기준 총 4회 이상 반복
  - 상세: `pushMcpServerSummary(ctx.mcpDiagnostics, { integrationId: ..., serviceType: 'cafe24', ... })`. 이 provider 내에서 serviceType 은 항상 `'cafe24'` 이므로 매 호출마다 명시가 중복. `readonly serviceType = 'cafe24'` 로 클래스 필드를 활용하거나 provider 내 wrapping 헬퍼를 두면 오타 위험 제거.
  - 제안: `private pushSummary(diag, entry: Omit<McpServerSummary, 'serviceType'>)` 헬퍼 메서드로 추출.

---

### 파일 7: cafe24-api.client.ts

- **[INFO]** `refreshTokenViaQueue` 의 폴백 분기(`this.refreshAccessToken`)가 테스트 환경 전용이라는 설명이 JSDoc 에만 있고 런타임 guard 없음
  - 위치: cafe24-api.client.ts, `refreshTokenViaQueue` 메서드
  - 상세: `if (this.refreshQueue && this.refreshQueueEvents)` 조건이 false 인 상황(큐 미바인딩)에서 in-process refresh 로 폴백하는데, 이 경로는 단위 테스트에서만 사용된다고 설명되어 있다. 그러나 조건 자체는 production 에서도 false 가 될 수 있으며, 이 경우 jobId dedup 우회가 발생함에도 런타임 경고(warn) 가 없다.
  - 제안: 폴백 진입 시 `this.logger.warn('cafe24 refreshQueue not bound — falling back to in-process refresh (test env only)')` 한 줄 추가.

---

### 파일 3: ai-agent.handler.ts

- **[WARNING]** `mcpDiagnosticsAcc` 변수 선언이 single-turn / multi-turn 양쪽에 동일하게 반복되어 정의 중복 발생
  - 위치: ai-agent.handler.ts diff 기준 라인 457, 492
  - 상세: `const mcpDiagnosticsAcc: McpServerSummary[] = []` 가 `executeSingleTurn`(추정) 과 `resumeMultiTurn`(추정) 두 메서드 상단에 동일하게 선언된다. 두 경로의 로직이 다르므로 공유할 수 없다는 설명은 주석(`매 turn 새로 결정`)으로 충분하지만, 타입 표기(`McpServerSummary[]`)가 양쪽에 겹치는 것은 중복으로 간주될 수 있다.
  - 제안: 현재 구조는 불가피한 중복(실행 경로가 분리됨)이므로 현행 유지 가능. 단, `buildMcpDiagnosticsMeta` 호출 패턴(`?? {}`) 이 세 군데에서 동일하게 반복되는 것은 inline 대신 `...spread(AiAgentHandler.buildMcpDiagnosticsMeta(acc))` 형태의 유틸로 추상화 고려.

- **[INFO]** `buildMcpDiagnosticsMeta` static 메서드 이름이 "build" prefix를 사용하나 실질적으로 변환·필터 역할 수행 — 의도가 약간 모호
  - 위치: ai-agent.handler.ts 라인 570~575 (diff 기준)
  - 상세: `build*`는 일반적으로 객체 생성·조립 패턴을 의미한다. 이 메서드는 빈 배열 여부에 따라 `undefined` 를 반환하는 "conditional mapper" 에 가깝다. `mcpDiagnosticsMetaOrUndefined` 혹은 `toMcpDiagnosticsMeta` 가 의도를 더 정확히 전달.
  - 제안: 이름 변경(`toMcpDiagnosticsMeta` 또는 `mcpDiagnosticsMetaFor`) 권장 — 현재 이름으로도 이해 가능하므로 LOW 우선순위.

---

### 파일 4: agent-tool-provider.interface.ts

- **[INFO]** `mcpDiagnostics` 필드를 `ProviderBuildCtx` 에만 추가하고 `ProviderExecCtx` 에는 없음 — 비대칭
  - 위치: agent-tool-provider.interface.ts
  - 상세: `buildTools` 단계에서만 진단 정보를 수집하는 설계 의도는 JSDoc 에 명시되어 있어 이해 가능하다. 단, 향후 `execute` 단계에서도 진단이 필요해지면 `ProviderExecCtx` 를 별도 갱신해야 함을 주석으로 남겨두면 좋다.
  - 제안: `ProviderExecCtx` 에 `// mcpDiagnostics 는 buildTools 단계에서만 수집 — ProviderBuildCtx 참조` 한 줄 추가.

---

### 파일 5: cafe24-mcp-tool-provider.spec.ts

- **[WARNING]** `buildTools` ctx 리터럴 객체(`{ config: { mcpServers: [...] }, workspaceId: 'ws-1', executionId: 'exec-1', mcpDiagnostics: summaries }`)가 약 10개 테스트에 걸쳐 거의 동일하게 반복됨
  - 위치: cafe24-mcp-tool-provider.spec.ts, 각 `buildTools` 호출부
  - 상세: `integrationId` 값과 `summaries` 외에는 모두 고정값인 ctx 리터럴이 매 케이스마다 복사·붙여넣기 형태로 반복된다. 실제로 달라지는 값은 `integrationId`(`'abcdef1234567890'`로 고정)와 `mcpDiagnostics`(`summaries` 변수)뿐이다.
  - 제안: `makeCtx(summaries: McpServerSummary[]): ProviderBuildCtx` 헬퍼를 테스트 파일 상단에 정의해 반복 제거. `integrationId` 가 달라지는 경우가 없다면 파라미터로 추출 불필요.

- **[INFO]** `import('./mcp-diagnostics').McpServerSummary[]` 형식의 인라인 동적 임포트 타입이 각 `it` 블록마다 반복됨
  - 위치: cafe24-mcp-tool-provider.spec.ts, `summaries` 선언부 (약 8~10회)
  - 상세: 파일 상단에 `import type { McpServerSummary } from './mcp-diagnostics'` 를 정적으로 추가하면 각 블록의 `import('./mcp-diagnostics').McpServerSummary[]` 를 `McpServerSummary[]` 로 단순화할 수 있다. 현재 방식은 타입이 길어 가독성을 떨어뜨린다.
  - 제안: 파일 상단 정적 import 추가.

---

### 파일 8~12: spec 문서 (md)

- **[INFO]** `spec/2-navigation/4-integration.md` §11.1 `connected-expiry` 행 설명이 매우 길어 한 셀에서 여러 분기 정책을 모두 기술
  - 위치: spec/2-navigation/4-integration.md 라인 1291 (diff 기준)
  - 상세: 표의 "동작" 셀 하나에 `remain ≤ 0d`, cafe24 분기, refresh 성공/실패, 그 외 provider, `remain ≤ 3d`, `remain ≤ 7d` 설명이 모두 포함되어 셀이 수백자를 넘는다. 의사코드 블록(`connected-expiry 흐름 의사코드`)이 바로 아래에 추가된 것은 좋은 보완이지만, 표 셀 자체는 유지보수 시 diff 파악이 어렵다.
  - 제안: 표 셀은 `remain ≤ 0d` 정책 한 줄 요약 + "상세는 아래 의사코드 참조" 형태로 단축, 세부 분기는 의사코드 블록으로 일원화.

---

## 요약

이번 변경은 cafe24 통합의 `expired` 자가 회복 경로를 scanner(0d 분기) 와 `buildTools` 두 계층에 추가하는 복잡한 기능 추가다. 전반적으로 JSDoc·인라인 주석이 풍부하고 spec 링크가 명시되어 있어 코드 의도 파악은 용이하다. 핵심 유지보수성 우려는 두 가지다: (1) `isCafe24RefreshCapable`(scanner)와 `tryRecoverExpired`(provider) 가 동일한 `credentials.refresh_token` 추출 패턴을 독립적으로 구현하는 논리 중복 — 향후 `credentials` 구조 변경 시 한 곳을 놓칠 위험이 있다. (2) 테스트 코드에서 `buildTools` ctx 리터럴과 `savedExpired` 검증 블록이 반복되어 테스트 추가 시 복사·붙여넣기 패턴이 고착될 우려가 있다. `cafe24-mcp-tool-provider.ts` 의 `buildTools` 분기 구조는 guard clause 패턴을 일관되게 적용하면 가독성이 개선된다. spec 문서는 정책이 정확히 반영되어 있으나 일부 표 셀이 과도하게 길어 변경 추적이 어렵다.

## 위험도

LOW

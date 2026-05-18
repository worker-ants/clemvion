# Architecture Review — cafe24-expired-self-healing

## 발견사항

### [INFO] isCafe24RefreshCapable 헬퍼의 위치와 재사용성
- 위치: `integration-expiry-scanner.service.ts` 하단 파일-스코프 함수
- 상세: `isCafe24RefreshCapable` 함수는 `credentials` JSONB 에서 `refresh_token` 존재를 검사하는 로직을 캡슐화한다. 동일 판단 로직(`creds?.refresh_token` typeof 검사)이 `cafe24-mcp-tool-provider.ts` 의 `tryRecoverExpired` 메서드 내부에도 독립적으로 구현되어 있다. 두 구현이 동기화를 유지해야 하는 결합이 존재한다.
- 제안: `cafe24-token-refresh.constants.ts` 또는 공유 유틸리티 파일로 추출하거나, 향후 Integration 엔티티에 `hasCafe24RefreshToken()` 도메인 메서드로 캡슐화하는 것을 검토한다. 현 시점 복제 수준(2개 사이트)은 수용 가능하나 세 번째 진입점이 생기면 즉시 추출할 필요가 있다.

---

### [INFO] Cafe24McpToolProvider가 상태 변이를 직접 수행하지 않고 큐에 위임하는 설계
- 위치: `cafe24-mcp-tool-provider.ts` `tryRecoverExpired` / `cafe24-api.client.ts` `refreshTokenViaQueue`
- 상세: buildTools 단계에서 `refreshTokenViaQueue` → BullMQ → `Cafe24TokenRefreshProcessor` 경로를 경유해 status 를 변경한다. 이는 비즈니스 상태 전이를 큐 worker 에 위임하므로 도메인 로직의 책임이 두 모듈에 분산된다. 그러나 dedup(jobId) 및 클러스터 직렬화 요구사항이 이 선택을 정당화하며 코드에 주석으로 명시되어 있다. 아키텍처 결정이 spec에도 기록되어 있어 의도적 설계임이 명확하다.
- 제안: 현재 설계 유지. 다만 세 번째 refresh 진입점(future Shopify 등)이 추가될 경우, `isCafe24RefreshCapable`에 해당하는 판별 로직을 provider-agnostic 추상화로 격상하는 확장 지점을 미리 spec에 기록해두면 좋다.

---

### [WARNING] Cafe24McpToolProvider가 Cafe24ApiClient에 직접 의존하며 네트워크 레이어 호출을 수행
- 위치: `cafe24-mcp-tool-provider.ts` 생성자 + `tryRecoverExpired`
- 상세: `AgentToolProvider` 인터페이스는 tool catalog 구성(`buildTools`)과 tool 실행(`execute`)을 정의한다. `Cafe24McpToolProvider.buildTools`가 refresh 큐 enqueue라는 인프라 조작을 수행하는 것은 "빌드" 단계의 책임 범위를 넘는다. 본 메서드는 catalog 구성과 토큰 자가 회복이라는 두 책임을 보유한다.
- 제안: 단기적으로는 `tryRecoverExpired`가 별도 private 메서드로 분리되어 있어 읽기 가독성은 충분히 확보되어 있다. 장기적으로 `AgentToolProvider` 인터페이스에 `precheck(ctx)` hook 또는 `buildTools`의 반환 타입에 진단 정보를 포함하는 방식으로 인터페이스 계약을 명시적으로 확장하는 방안을 고려할 수 있다. 현재 방식은 실용적 트레이드오프로 수용 가능한 수준이다.

---

### [WARNING] ProviderBuildCtx.mcpDiagnostics가 뮤터블 배열 참조(push 기반 side effect)
- 위치: `agent-tool-provider.interface.ts` `ProviderBuildCtx.mcpDiagnostics`, `cafe24-mcp-tool-provider.ts` `pushMcpServerSummary` 호출부
- 상세: `mcpDiagnostics` 필드는 핸들러가 소유하는 배열의 참조를 provider에 전달하고, provider는 `push`를 통해 side effect로 데이터를 누적한다. 이는 out-parameter 패턴으로 인터페이스 계약이 명시적이지 않고(push 해야 한다는 사실이 타입 시스템에 강제되지 않음) 여러 provider가 동시에 같은 배열에 push할 때 순서나 중복 보장이 없다. 현재 단일 provider 경로에서는 문제가 없으나, 향후 McpToolProvider도 동일 배열을 참조할 때 레이스 조건(async 병렬 buildTools)이 생길 여지가 있다.
- 제안: `buildTools` 반환 타입을 `{ tools: ToolDef[], diagnostics?: McpServerSummary }` 로 변경해 핸들러가 결과를 수집하는 구조가 더 명시적이다. 또는 `mcpDiagnostics`를 Collector 객체(push 메서드를 타입으로 강제)로 감싸는 방법도 있다. 현재 구조는 동기적으로 순차 호출되는 `for...of` 루프 안에서만 사용되므로 실제 레이스는 없지만, 인터페이스 의도가 타입 서명에서 드러나지 않는 점은 주의 필요하다.

---

### [INFO] IntegrationExpiryScannerService가 CAFE24_REFRESH_QUEUE 의존성을 직접 주입받음
- 위치: `integration-expiry-scanner.service.ts` 생성자 `@InjectQueue(CAFE24_REFRESH_QUEUE)`
- 상세: `IntegrationExpiryScannerService`는 통합 도메인의 만료 스캔 전반을 담당하는 서비스이지만, 이제 `cafe24-token-refresh` 큐라는 Cafe24 특화 인프라에 직접 의존한다. 향후 Shopify, Naver Smartstore 등 다른 first-party provider가 동일 패턴을 요구할 경우, 생성자에 provider별 큐가 누적될 위험이 있다.
- 제안: 현재 Cafe24 단일 케이스이므로 수용 가능하다. 향후 provider가 추가될 때를 대비해 `RefreshCapableProvider` 추상화(provider별 큐 참조를 registry로 관리)를 선제적으로 spec에 기록해두면 확장 시 설계 혼선을 예방할 수 있다.

---

### [INFO] `mcp-diagnostics.ts` 모듈의 응집도
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` (변경된 파일에서 import 확인)
- 상세: `McpServerSummary`, `McpSkipReason`, `pushMcpServerSummary`가 별도 파일로 분리된 것은 바람직하다. 진단 관련 타입과 헬퍼가 단일 책임 모듈로 응집되어 있고, `agent-tool-provider.interface.ts`와 `cafe24-mcp-tool-provider.ts` 양쪽이 이 모듈을 참조하는 단방향 의존 구조가 성립한다.
- 제안: 현재 구조 유지. `pushMcpServerSummary`가 null-safe guard(`if (!arr) return`)를 포함해 미주입 환경 호환을 보장하는 점도 적절하다.

---

### [INFO] 알림 발사 위치 — 0d cafe24 분기에서도 notification이 scanner에서 직접 발사됨
- 위치: `integration-expiry-scanner.service.ts` 0d 분기
- 상세: cafe24 refresh enqueue 분기에서도 `notificationsService.createMany`가 scanner 단에서 직접 호출된다(테스트 코드 line 113–120 검증). refresh 성공 후 `connected` 유지 케이스에서는 `integration_expired` 알림이 발사되지만 실제로 토큰이 갱신되면 사용자 입장에서는 알림이 오인될 수 있다. 이는 기능 요구사항(spec에 "알림은 그대로 발사하여 사용자에게 가시성 유지" 명시)에 따른 의도적 설계이나, 알림 정확성과 사용자 경험 관점에서 향후 재검토 여지가 있다.
- 제안: 아키텍처상 스캐너의 알림 책임과 worker의 상태 전이 책임 분리는 명확하므로 현재 구조를 유지하되, spec에 "0d cafe24 분기의 알림은 refresh 결과에 무관하게 발사"임을 명시적으로 기록해두는 것이 좋다(현재 spec에 이미 언급됨).

---

### [INFO] 레이어 책임 분리 — spec 파일이 구현 코드 경로를 코드 수준으로 명세
- 위치: `spec/data-flow/5-integration.md` mermaid 다이어그램, `spec/4-nodes/4-integration/4-cafe24.md §8.6`
- 상세: spec 문서가 `Cafe24McpToolProvider.buildTools()`, `refreshViaQueue` 같은 구현 클래스명까지 명시한다. Spec이 구현 내부를 지나치게 구체적으로 기술하면 구현 변경 시 spec과의 drift가 발생하기 쉽다. 이 프로젝트는 SDD(Spec-Driven Development) 방법론을 따르므로 이 수준의 상세화는 의도적이나, 구현 심도의 경계를 어디에 둘지 지속적으로 주의가 필요하다.
- 제안: 진단 목적으로 허용 가능. 리팩토링 시 spec 동기화 비용을 인식하고 작업하는 것이 중요하다.

---

## 요약

이번 변경은 cafe24 통합의 `expired` 상태 자가 회복을 위해 세 개의 진입점(connected-expiry scanner의 0d 분기, Cafe24McpToolProvider.buildTools, Cafe24ApiClient.refreshTokenViaQueue)을 동일한 BullMQ `cafe24-token-refresh` 큐로 단일화하는 아키텍처를 구현한다. 핵심 설계 결정(jobId dedup을 통한 클러스터 직렬화, status 변이를 worker에 위임하는 책임 분리)은 아키텍처적으로 타당하며 spec과 코드 주석에 충분히 문서화되어 있다. `ProviderBuildCtx.mcpDiagnostics`의 뮤터블 out-parameter 패턴과 refresh 판별 로직의 두 군데 복제는 현재 단일 provider 수준에서는 수용 가능하나, 향후 provider 확장 시 추상화 부채로 전환될 수 있는 지점으로 모니터링이 필요하다. `IntegrationExpiryScannerService`가 Cafe24 특화 큐를 직접 주입받는 구조도 동일한 확장성 위험을 내포하며, 다른 first-party provider가 추가되는 시점에 registry 패턴으로의 전환을 고려해야 한다. 전반적으로 복잡한 분산 상태 관리 문제를 기존 인프라(BullMQ dedup) 위에서 최소한의 새 코드로 해결한 실용적 설계다.

## 위험도

LOW

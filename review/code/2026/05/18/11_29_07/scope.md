# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 파일 3 (`ai-agent.handler.ts`) — `mcpServerSummaries` 가 multi-turn `emitTurnOutput` 경로에도 추가됨
  - 위치: diff 라인 +514, +522 (두 곳의 turnDebug emit 경로)
  - 상세: PR 의 핵심 목적은 "cafe24 expired 자가 회복"이며, `mcpDiagnostics.serverSummaries` 노출은 그 진단 채널로서 직접 연결된다. multi-turn 경로의 emit 추가는 turn 단위 스냅샷 노출을 위한 것으로 spec §6.2 문서("multi-turn resume 시 재build → snapshot 갱신")에도 명시되어 있어 범위 내 변경으로 판단된다.
  - 제안: 무관한 확장이 아니므로 조치 불필요.

- **[INFO]** 파일 3 (`ai-agent.handler.ts`) — `buildMcpDiagnosticsMeta` static helper 메서드 신설
  - 위치: diff 라인 +564~575
  - 상세: emit 호출부 3곳에서 동일 패턴(`summaries.length === 0 → omit`)을 공유하기 위한 private helper. 기능 확장이 아닌 내부 정리이며 emit 로직 외 다른 동작은 없다. 별도 public API 노출 없음.
  - 제안: 조치 불필요.

- **[INFO]** 파일 4 (`agent-tool-provider.interface.ts`) — `ProviderBuildCtx` 에 `mcpDiagnostics?` 필드 추가
  - 위치: diff 라인 +620~626
  - 상세: `optional` 필드 추가로 기존 provider 와의 하위 호환성이 유지된다. `Cafe24McpToolProvider` 가 이 필드를 사용하고, 다른 provider 는 undefined 로 받아 no-op 처리된다. 이 인터페이스 변경은 파일 6의 실제 구현을 지지하는 필수 변경이다.
  - 제안: 조치 불필요.

- **[INFO]** 파일 7 (`cafe24-api.client.ts`) — `refreshTokenViaQueue` public 메서드 신설
  - 위치: diff 라인 +1247~1257
  - 상세: `Cafe24McpToolProvider.buildTools()` 가 `refreshViaQueue` 를 직접 호출하는 대신 이 public entry 를 사용하도록 설계된 진입점이다. 기존 private `refreshViaQueue` 를 외부에 노출하되 테스트 환경 폴백(in-process `refreshAccessToken`) 도 포함한다. PR의 핵심 흐름(buildTools 자가 회복)을 지지하는 필수 변경이다. 단, 이 메서드는 향후 다른 호출자도 사용할 수 있는 범용 진입점으로 기능하므로 "기능 확장"과 경계에 있다. 그러나 현재 PR의 자가 회복 경로를 직접적으로 지지하고, 주석에도 현재 유일한 호출자를 명시하므로 범위 내로 판단된다.
  - 제안: 조치 불필요.

- **[INFO]** 파일 13 (`mcp-diagnostics.ts`) — 신규 파일
  - 위치: 전체 파일
  - 상세: `McpServerSummary`, `McpSkipReason`, `pushMcpServerSummary` 타입/함수 정의. PR 주석("본 PR 은 `mcpDiagnostics` 의 전체 surface 중 `serverSummaries[]` slice 만 시동 — 나머지 필드는 follow-up")에서 의도적인 부분 구현임을 명시하고 있다. 새 파일이지만 scope 초과가 아니라 PR의 진단 채널 구현에 필수인 타입 모듈이다.
  - 제안: 조치 불필요.

- **[INFO]** spec 파일 3종 (`spec/2-navigation/4-integration.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/11-mcp-client.md`, `spec/data-flow/5-integration.md`) — 구현 변경에 대응하는 spec 갱신
  - 위치: 파일 8~12
  - 상세: 구현 변경(connected-expiry 0d 분기 변경, buildTools 자가 회복, serverSummaries 진단 노출)을 spec에 반영한 동기화 갱신이다. CLAUDE.md의 SDD(Spec-Driven Development) 정책에 따르면 spec과 구현의 정합성 유지는 의무이므로, 이 spec 변경들은 과잉이 아니라 요구된 변경이다.
  - 제안: 조치 불필요.

- **[INFO]** 파일 1 테스트(`integration-expiry-scanner.service.spec.ts`) — 기존 `'escalates to expired status'` 테스트 케이스 제목 변경 및 `serviceType`, `credentials` 필드 추가
  - 위치: diff 라인 +36, +44~45, +53~54
  - 상세: 기존 테스트가 "non-cafe24 / no refresh_token" 경로를 명확히 표현하도록 제목과 mock 데이터를 수정했다. 구현 변경(cafe24 분기 추가)으로 인해 기존 테스트가 두 경로 중 하나를 검증하도록 구체화된 것이다. `expect(cafe24RefreshQueue.add).not.toHaveBeenCalled()` assertion 추가도 새 분기의 비해당 케이스를 검증하는 정당한 수정이다.
  - 제안: 조치 불필요.

## 요약

총 13개 파일의 변경은 "cafe24 expired 통합의 자가 회복" 기능을 구현하기 위한 것으로, 변경 범위가 명확하게 단일 목적 주위에 집중되어 있다. 핵심 로직(scanner 0d 분기 변경, buildTools 자가 회복, 진단 채널 serverSummaries), 이를 지지하는 인터페이스/타입 모듈, 대응하는 테스트 케이스, 그리고 SDD 원칙에 따른 spec 동기화 갱신으로 구성된다. 불필요한 리팩토링, 무관한 파일 수정, 임의 포맷팅 변경, 요청하지 않은 기능 추가는 발견되지 않았다. `buildMcpDiagnosticsMeta` helper와 `refreshTokenViaQueue` public 메서드는 기능 확장과의 경계에 있으나, 둘 다 이번 PR의 emit/refresh 흐름에 직접 귀속되어 있고 주석으로 현재 유일 호출자를 명시하고 있어 범위 내로 판단된다.

## 위험도

NONE

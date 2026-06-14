# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [SPEC-DRIFT] [WARNING] spec §6.2 383행과 구현 간 언어 모순 — spec 갱신 필요
- 위치: `spec/5-system/11-mcp-client.md` 383행
- 상세: spec 본문 383행은 "외부 MCP 의 connect/initialize/tools-list 실패는 종전대로 `errors[]` 에 누적되므로 **별도 skipReason 값을 도입하지 않는다** (정보 중복 회피)" 라고 명시한다. 그러나 이번 구현(`McpToolProvider.openServer`)은 외부 MCP의 status/connect/list 실패를 `skipped(skipReason='error')` 로 `serverSummaries[]` 에 push 한다. 또한 spec §6.2 393행 skipReason vocabulary 표에는 이미 `error` 항목의 적용 provider가 `cafe24 / mcp` 로 표기되어 있어, 표와 설명 본문 383행이 서로 상충한다. 구현 현황 주석(354행·2026-06-14 갱신)은 이 변경을 명시적으로 기술하고 있으므로, 코드의 의도는 명확하고 합리적이며 되돌리는 것이 오답이다. 단 383행 산문 설명("별도 skipReason 값을 도입하지 않는다") 이 낡았다.
- 제안: 코드 유지 + spec §6.2 383행 설명 갱신. 구체적으로 "외부 MCP 의 connect/initialize/tools-list 실패는 `serverSummaries[]` 에 `skipped(skipReason='error')` 로 표면화된다 — `errors[]` 필드(미구현)와 이중 기록이 되나, `errors[]` 도입 전까지 `serverSummaries[]`가 단일 진단 표면이므로 여기에 기록한다" 와 같이 수정 필요. 대상 spec: `spec/5-system/11-mcp-client.md` §6.2 `skipReason vocabulary` 도입 단락(383행).

---

### [INFO] `pushMcpServerSummary` 의 `acc` undefined 처리와 재사용 세션 경로의 동일 실행 중복 push 가능성
- 위치: `mcp-tool-provider.ts` `materializeServer` (1677–1698행)
- 상세: 캐시 히트 경로(`existing` 분기)에서 `pushConnectedSummary`를 호출한다. 동일 `executionId` 로 `buildTools`가 두 번 이상 호출될 때(예: 테스트 "caches the session for reuse" 케이스) 같은 `mcpDiagnostics` 배열에 동일 `integrationId`의 connected entry가 중복 push된다. 이 동작이 의도적인지(multi-turn resume 시 재build → snapshot 갱신) spec §6.2 의 "multi-turn resume 시 재build → snapshot 갱신"과 일치하는지 확인 필요. `pushMcpServerSummary` 자체에는 중복 방지 로직이 없다.
- 제안: 명시적 문서화 또는 핸들러가 `buildTools` 호출 전 `mcpDiagnostics` 배열을 매번 초기화하는 방식으로 관리함을 주석에 명확히. 다만 현재 스펙이 "multi-turn 동안 snapshot 갱신"을 허용하므로 INFO 수준에서 모니터링.

---

### [INFO] `toolCount`가 `enabledTools` allowlist 적용 후 수가 아닌 catalog 전체 수 반영
- 위치: `mcp-tool-provider.ts` `pushConnectedSummary` (1701–1712행), `buildTools` 성공 경로
- 상세: `entry.toolDefs.size`는 allowlist 필터링 이전에 확정된 `openServer` 결과에서 비롯된다. `toolDefs`는 `ref.enabledTools`를 적용한 후 채워지므로 allowlist가 있으면 실제 LLM에 노출되는 도구 수와 일치한다. 그러나 `materializeServer`에서 `existing` 세션 재사용 시 `pushConnectedSummary(ctx, existing)`을 호출하는데, `existing.toolDefs`는 최초 연결 시 사용된 `ref.enabledTools`를 기준으로 이미 필터링된 맵이다. 두 번째 호출에 다른 `enabledTools`가 전달되어도 `existing` 세션을 재사용하므로 `toolCount`는 첫 번째 호출의 allowlist 기준으로 고정된다. 이는 multi-call 시 혼동을 줄 수 있으나 현재 spec에 이 엣지 케이스에 대한 명세가 없어 INFO 수준.

---

### [INFO] `openServer`의 `status !== 'connected'` 실패가 `skipped(skipReason='error')` 로 분류
- 위치: `mcp-tool-provider.ts` `openServer` (1748–1753행, 외부 catch)
- 상세: Integration의 `status`가 `'error'` 또는 `'disconnected'` 등인 경우, `integration.status !== 'connected'` 체크에서 throw하여 외부 catch에서 `skipped(skipReason='error')` 로 push된다. spec §6.2 skipReason 표의 `error` 항목은 `status='error'` 를 명시하고 있어 이 케이스와 부합한다. 단 `status='disconnected'`나 `status='pending_install'`(cafe24 전용 상태가 외부 MCP에 있을 경우) 등도 동일하게 `'error'` skipReason으로 흡수된다. 외부 MCP의 상태 vocabulary가 cafe24보다 단순하므로 현행 처리가 실용적이나, spec에는 외부 MCP에서 `status !== 'connected'`일 때의 skipReason 값이 명시되지 않았다.

---

## 요약

이번 변경의 핵심 기능인 §6.2 외부 MCP serverSummaries 진단 표면화(항목 2)는 완전히 구현되었다. `McpToolProvider`가 connect+list 성공 시 `connected(toolCount)` entry를, serviceType 확정 이후의 모든 실패 시 `skipped(skipReason='error')` entry를 `serverSummaries[]`에 push하며, Cafe24 Internal Bridge와 대칭을 이룬다. 테스트 2건(§6.2 성공/실패)도 이 동작을 정확히 검증한다. 주요 이슈는 spec §6.2 383행 산문("외부 MCP ... 별도 skipReason 값을 도입하지 않는다")이 실제 구현 및 393행 skipReason 표(`error | ... | cafe24 / mcp`)와 상충하는 낡은 텍스트라는 점이다 — 이는 코드 버그가 아니라 spec 갱신 누락(SPEC-DRIFT)이다. plan 파일(`spec-sync-mcp-client-gaps.md`)의 체크박스 상태(§6.2 항목 2 완료 표시)도 구현 상태와 일치한다.

## 위험도

LOW

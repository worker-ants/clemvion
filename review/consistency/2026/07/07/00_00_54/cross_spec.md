### 발견사항

- **[CRITICAL]** target 문서 §2.3 이 §6.2 와 자기모순 — Internal Bridge call-phase `errors[]` 누적을 "Planned"라고 잘못 기술
  - target 위치: `spec/5-system/11-mcp-client.md` §2.3 "에러 처리" 단락 (라인 81)
  - 충돌 대상: 같은 문서 §6.2 "진단 누적" (라인 356-361, 특히 358·361) 및 §8.1(라인 448)·§8.2 — 그리고 실제 구현 diff(`cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts`의 `mcpErrorDelta` 추가, `mcp-diagnostics.ts` 주석 갱신)
  - 상세: §2.3 은 "Cafe24 의 call-phase 실패가 `tool_result.error` + `IntegrationUsageLog` 로만 표면화되며, `mcpDiagnostics.errors[]` 로의 누적은 **Planned** (§6.2 잔여)" 라고 서술한다. 그러나 같은 문서 §6.2 는 "**call 단계** `errors[]`(mcpErrorDelta)는 Internal Bridge 도 보고한다"(라인 358), "Internal Bridge 는 `CAFE24_*`/`MAKESHOP_*` vocabulary(§2.3)"(라인 361) 라고 명시해 **이미 구현됨**을 전제로 서술한다. 실제 diff 역시 `Cafe24McpToolProvider.execute`/`MakeshopMcpToolProvider.execute` 가 4xx/5xx 및 transport 실패 시 `mcpErrorDelta`(phase=`tools/call`, `CAFE24_*`/`MAKESHOP_*` code)를 채워 반환하고, 대응 테스트(`cafe24-mcp-tool-provider.spec.ts` "API 4xx 는 mcpErrorDelta(phase=tools/call, CAFE24 코드)를 보고한다 — §8.1" 등)로 검증됨을 보여준다. 즉 §2.3 은 이번 PR 로 이미 해소된 gap 을 여전히 미해결("Planned")로 남겨 문서 내부 모순을 만든다. 이 문장은 [Cafe24 노드 spec §8.1](../4-nodes/4-integration/4-cafe24.md#81-도구-이름-매핑) 등에서 cross-reference 되므로, 외부에서 §2.3 만 보고 "Cafe24/MakeShop 은 아직 errors[] 에 안 담긴다" 고 잘못 이해할 위험이 있다.
  - 제안: §2.3 라인 81 을 §6.2 갱신 시점(2026-07-06)에 맞춰 "call-phase 실패는 `tool_result.error` + `IntegrationUsageLog`(§8.3) 뿐 아니라 `mcpDiagnostics.errors[]`(phase=`tools/call`, Cafe24/MakeShop vocabulary)로도 누적된다"로 수정하고 "Planned" 문구를 제거할 것. (§6.2 라인 365 의 "잔여(Planned)" 는 `credentials.cached_capabilities` 캐시만을 가리키므로 그대로 두되, §2.3 의 별도 "Planned" 클레임만 제거 대상.)

- **[INFO]** Cafe24/MakeShop 노드 spec 에 call-phase `errors[]` 신규 동작 미언급 (참조만 존재, 동기화 권장)
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 (call-phase errors[] 확장 서술)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/4-integration/5-makeshop.md` (양쪽 다 `mcpDiagnostics`/`errors[]` 신규 동작에 대한 직접 언급 없음 — grep 결과 `mcpDiagnostics.serverSummaries[]` skipReason 만 참조)
  - 상세: 모순은 아니다 — 11-mcp-client.md 가 이 call-phase errors[] 누적의 SoT 이고, cafe24/makeshop node spec 은 자신의 에러 코드 vocabulary(`CAFE24_AUTH_FAILED`, `MAKESHOP_404` 등)만 정의하면 되므로 필수 갱신은 아니다. 다만 두 node spec 의 에러 처리 절(§6)에 "이 코드들이 이제 AI Agent MCP 경로에서 `mcpDiagnostics.errors[]`(phase=`tools/call`)로도 표면화된다"는 한 줄 상호 참조를 추가하면 독자가 11-mcp-client.md §2.3/§6.2 를 몰라도 전체 표면화 경로를 파악하기 쉬워진다.
  - 제안: 필수 아님. 다음 spec 갱신 시 한 줄 cross-reference 추가 권장.

### 요약
target 문서(`spec/5-system/11-mcp-client.md`)는 이번 PR 의 구현 변경(connect 타임아웃 분류 정교화, MCP 전용 secret redaction, call-phase `mcpErrorDelta` 누적)을 §4.4/§6.2/§8.1/§8.2/Rationale 에 정확하고 상세하게 반영했으며, `1-data-model.md`·`0-overview.md` 등 다른 루트 레벨 spec 과의 엔티티·API 계약 충돌은 발견되지 않았다. 다만 문서 자체 내부에서 §2.3(Internal Bridge 에러 처리)이 §6.2 가 이미 서술한 "call-phase errors[] 는 Internal Bridge 도 보고" 사실과 반대로 "Planned"라고 남아 있어, 이 절을 단독으로 참조하는 다른 spec(Cafe24 노드 등)에 오래된 정보를 전파할 위험이 있는 CRITICAL 급 자기모순이 하나 확인됐다. 이는 target 문서 자체의 갱신 누락이며 타 영역 spec 수정은 필요 없다.

### 위험도
MEDIUM

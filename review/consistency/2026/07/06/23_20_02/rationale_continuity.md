### 발견사항

없음.

검토 근거:

1. **`redactMcpSecrets` 신설(에러 메시지 secret 마스킹)** — `spec/5-system/11-mcp-client.md` 본문·Rationale 어디에도 이를 금지하거나 다른 방식을 채택한 과거 결정이 없다. 인접 영역([`spec/conventions/chat-channel-adapter.md`](../../../../../spec/conventions/chat-channel-adapter.md) — "`error.message` 를 그대로 redact 해 전달하지 않는다") 은 *채널 알림 사용자 노출 문구*에 대한 결정으로, 본 변경(`mcpDiagnostics.errors[].message`/`IntegrationUsageLog`/`Integration.last_error` 저장 시점 defense-in-depth 마스킹)과는 레이어·목적이 달라 충돌이 아니다. 코드 주석 자체가 "Defense-in-depth — no known leak path" 로 새로운 결정임을 명시하고 있어 은닉 없는 정상 확장.

2. **connect-phase `TimeoutError` 판별(AbortController + `timedOut` 플래그)** — `## Rationale` "timeout 을 별도 `TimeoutError` 로 분류 (§4.4 / §8.2)" 항목이 이미 "message 문자열 매칭 없이 `instanceof` 로 timeout↔기타 실패를 구분" 원칙을 못박아 두었다. 이번 변경은 이 원칙을 connect 단계(AbortController 가 실제로 fetch 를 취소하는 경로)까지 일관되게 확장한 것으로, 과거 결정을 뒤집는 것이 아니라 그 원칙을 완성하는 변경이다. 코드 주석도 "unlike withTimeout's soft deadline, this AbortController genuinely cancels" 로 두 메커니즘의 공존 이유를 명시.

3. **call-phase `mcpDiagnostics.errors[]` 누적 (mcpErrorDelta)** — 종전 §6.2/§8.1/§8.2 는 이를 "잔여 (Planned)" 로 명시했었다. 이번 diff 는 코드 구현과 **같은 커밋 안에서 spec 본문(§6.2/§8.1/§8.2/§9) 을 함께 갱신**하고, `## Rationale` 에 "진단 스키마 분리 — `skipReason` vs `errors[].code` (§6.2)" 항목을 신설해 결정 근거(build/call phase 구분, provider 슬롯 vs 출력 shape 분리)를 남겼다. CLAUDE.md 의 "결정 번복 시 새 Rationale 동반" 요구를 충족하는 모범 사례 — Planned 항목의 정식 확정이지 무근거 번복이 아니다.

4. **client-side 실패(`INVALID_TOOL_ARGUMENTS`/`*_MISSING_FIELDS` 등)를 `errors[]` 에서 제외하는 구분** — 신규 코드(`mcp-tool-provider.ts`, `cafe24-mcp-tool-provider.ts`, `makeshop-mcp-tool-provider.ts`)와 스펙 본문이 "서버측 실패만 담고 client-side 는 제외" 라는 동일 불변식을 일관되게 유지한다(§6.2 발췌: "client-side 실패는 서버 실패가 아니므로 errors[] 에 담지 않는다"). 테스트(`mcp-tool-provider.spec.ts` 의 `client-side 실패(...)는 errors[] delta 를 보고하지 않는다`)도 이 불변식을 검증 — 암묵적 가정 충돌 없음.

5. **Internal Bridge(§2.3) 의 §8.4 "401 즉시 격하" 예외** — 이번 diff 는 §8.4 정책 자체를 건드리지 않고 errors[] 진단 표면만 확장했다. Cafe24/Makeshop provider 의 `mcpErrorDelta` 코드가 `CAFE24_AUTH_FAILED`/`MAKESHOP_*` vocabulary 를 그대로 사용해(§2.3 이 규정한 "Cafe24 vocabulary 그대로 사용") 기존 합의(§2.3, §8.4, Rationale "Internal Bridge 신설 및 자가 회복 예외")를 그대로 따른다.

### 요약
본 diff 는 `spec/5-system/11-mcp-client.md` 자체의 Rationale 원칙(TimeoutError `instanceof` 판별, build/call phase 진단 스키마 분리, client-side vs 서버측 실패 구분, Internal Bridge 예외 정책)을 위반하거나 과거 기각된 대안을 재도입하지 않는다. 오히려 종전 "잔여 (Planned)" 로 명시됐던 call-phase `errors[]` 누적을 코드·spec 본문·신규 `## Rationale` 항목을 한 커밋에서 함께 갱신하며 정식 확정한 모범적인 사례이고, 신규 `redactMcpSecrets` 도 기존 결정과 상충하지 않는 독립적 defense-in-depth 추가다. Rationale 연속성 관점에서 위반 사항 없음.

### 위험도
NONE

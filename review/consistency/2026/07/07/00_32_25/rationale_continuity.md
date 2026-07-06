# Rationale 연속성 검토 — spec/5-system/11-mcp-client.md

## 발견사항

없음. 아래는 확인 후 제외한 잠재 리스크 지점이다.

- **§4.4/§8.2 "timeout 을 별도 `TimeoutError` 로 분류"** (target `spec/5-system/11-mcp-client.md` Rationale) — diff 의 `mcp-client.service.ts` connect 타임아웃 구현(`timedOut` 플래그 + `AbortController` 만료 시 `TimeoutError` throw)은 이 Rationale 이 요구하는 "SDK/네트워크 abort 와 우리 deadline 만료를 `instanceof` 로 구분" 원칙을 정확히 구현한다. 기각된 대안(message 문자열 매칭)으로 되돌아가지 않았다.
- **§8.3 "메타 도구(`list_resources`/`read_resource`/`list_prompts`/`get_prompt`)는 usage 로그에 기록하지 않는다"** — diff 는 메타도구 실패 경로에 `mcpErrorDelta`(→ `mcpDiagnostics.errors[]`)만 추가했고 `fireUsageLog` 호출은 추가하지 않았다 (`mcp-tool-provider.ts:1051-1066` 확인). §8.3 예외 원칙은 그대로 유지된다.
- **§6.2 "call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패의 `errors[]` 누적은 별도 follow-up"** — 이 문구는 `## Rationale` 섹션이 아니라 §6.2 본문의 "구현 현황" 주석(진행상황 기록)이다. 이번 diff 는 그 follow-up 을 이행한 것이고, target 문서 §6.2 자체도 "(2026-07-06 갱신)" 으로 함께 갱신되어 있어 spec-코드 정합이 유지된다. 결정의 번복이 아니라 예고된 확장의 완성이므로 새 Rationale 항목 신설 의무는 없다.
- **§8.2 vocabulary 확장(`resources/list`/`prompts/list` phase 추가)** — 기존 `MCP_CALL_FAILED` 정의("`tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list` 실패")에 이미 5개 phase 가 명시돼 있어, diff 의 `McpErrorPhase` union 확장(`resources/list`/`prompts/list` 추가)은 기존 vocabulary 를 그대로 좁혀 구현한 것이며 신규 결정이 아니다.
- **Internal Bridge(Cafe24/Makeshop) 의 `CAFE24_*`/`MAKESHOP_*` 코드 재사용** — §6.2 "Internal Bridge 는 `CAFE24_*`/`MAKESHOP_*` vocabulary(§2.3)" 원칙과 diff 의 `codeForStatus` 재사용이 일치. §8.2 외부 MCP UPPER_SNAKE_CASE vocabulary 와 혼동 없이 분리 유지.
- **`Integration.last_error`** — §8.2 "status 전이를 유발한 에러만 기록" 원칙과 관련해, diff 는 `last_error`/`Integration.status` 갱신 로직을 건드리지 않았다 (grep 결과 무관련). 이번 변경은 `mcpDiagnostics.errors[]`/`mcpErrorDelta` 표면에 한정되어 §8.4 자동 status 전환 정책과 충돌 여지가 없다.
- **redaction 정책(§8.3, `sanitizeMcpErrorMessage`)** — diff 의 `redactMcpSecrets` 신설은 기존 Rationale "에러 message redaction 은 공용 패턴 재사용"(§8.3) 원칙을 그대로 따른다. 공용 `SECRET_LEAK_PATTERNS` 를 재사용하고 MCP 전용 패턴(URL userinfo, bare `token=`)만 로컬 추가해 SoT 파편화를 피했다 — Rationale 이 요구하는 "재사용 우선" 원칙과 정합.

## 요약

이번 diff(connect-timeout 의 `TimeoutError` 분류, call-phase `mcpErrorDelta` 신설, MCP 에러 메시지 redaction 확장)는 `spec/5-system/11-mcp-client.md` `## Rationale` 에 이미 기록된 결정들(timeout 분류 기준, redaction 공용 패턴 재사용, 메타도구 usage 로그 제외 예외, Internal Bridge 코드 vocabulary 분리)을 위반하거나 기각된 대안을 재도입하지 않았다. §6.2 의 "call-phase errors[] 는 별도 follow-up" 문구 갱신은 `## Rationale` 항목의 번복이 아니라 spec 본문에 이미 예고된 확장이 코드와 문서 양쪽에서 동시에 완성된 사례다. Rationale 연속성 관점에서 문제 없음.

## 위험도

NONE

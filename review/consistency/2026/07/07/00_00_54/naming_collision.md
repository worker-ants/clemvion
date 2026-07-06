# 신규 식별자 충돌 검토 — spec/5-system/11-mcp-client.md (impl-done)

## 발견사항

없음 (충돌 미검출)

검토한 신규/확장 식별자와 근거:

- **`mcpErrorDelta`** (`AgentToolResult.mcpErrorDelta?: McpDiagnosticError`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts:129`) — 같은 인터페이스의 기존 `ragSourcesDelta`/`ragDiagnosticsDelta` (라인 119, 121) 와 동일한 `*Delta` 누적 필드 컨벤션을 따름. 다른 provider·모듈에서 동일 이름이 다른 의미로 쓰이는 곳 없음 (`git grep` 결과 전량 MCP call-phase 누적 용도로 일관).
- **`McpErrorPhase` 유니온 확장** (`resources/list`, `prompts/list` 신규 멤버, `mcp-diagnostics.ts:60,62`) — MCP JSON-RPC 실제 메서드명(`resources/list`, `prompts/list`)과 1:1 대응. 코드베이스 전역에서 동일 문자열 리터럴이 다른 의미(예: 이벤트명·큐명)로 쓰이는 곳 없음.
- **`MCP_TIMEOUT` 의 call-phase 확장** (`mcp-error-codes.ts:22` 기존 상수, `mcp-tool-provider.ts` 에서 call-phase 로 적용 확장) — 이 코드는 기존(pre-change) build-phase 전용 상수였고, target 이 의미를 바꾸지 않고 phase 범위만 확장(§8.2 서술과 일치: "모든 단계에서 surface"). 신규 ID 발급이 아니라 기존 ID 의 scope 확장이므로 충돌 대상 아님.
- **`TimeoutError` 클래스** (`codebase/backend/src/common/utils/with-timeout.ts:17`) — 기존 클래스 재사용(신규 도입 아님). 별도 패키지 `codebase/packages/expression-engine/src/errors.ts:54` 에도 동명 `TimeoutError` 가 있으나 서로 다른 패키지·독립 namespace 이고 import 경로가 겹치지 않아(`common/utils/with-timeout` vs `expression-engine/errors`) 실질 충돌 없음 — 참고로만 기록(등급 부여 대상 아님).
- **`redactMcpSecrets` / `MCP_EXTRA_SECRET_PATTERNS`** (`mcp-error-codes.ts:47,67`) — 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts:20`) 를 새로 정의하지 않고 import 재사용하며, MCP 전용 추가 패턴만 별도 이름으로 얹음. SoT 파편화를 피한 설계로 오히려 컨벤션에 부합.
- **ENV var `MCP_ALLOW_INSECURE_URL` / `ALLOW_PRIVATE_HOST_TARGETS`** (신규 Rationale 절에서 언급) — 둘 다 사전에 존재하던 플래그(`git log` 상 `0e73f9d7a feat(mcp): MCP_ALLOW_INSECURE_URL`), 본 target 은 배경 설명만 추가했을 뿐 신규 도입이 아님.
- **파일 경로** — 이번 diff 는 기존 `spec/5-system/11-mcp-client.md`, `mcp-error-codes.ts`, `mcp-diagnostics.ts`, `mcp-tool-provider.ts` 등 기존 파일 수정 + `mcp-error-codes.spec.ts` 신규 테스트 파일 추가뿐이며, 신규 spec 파일 경로 도입은 없음. 명명 컨벤션(`mcp-*.ts`, `*.spec.ts`) 과 완전히 일치.

## 요약

target 은 `spec/5-system/11-mcp-client.md` 의 call-phase 진단 누적(`mcpErrorDelta`), 타임아웃 분류(`TimeoutError`→`MCP_TIMEOUT` 전 phase 확장), 에러 메시지 secret redaction(`redactMcpSecrets`) 을 추가하는 좁은 범위의 follow-up 이다. 새로 도입되는 식별자는 모두 `mcp` 모듈 내부에 스코프되어 있고, 기존 `*Delta` 필드 컨벤션·`UPPER_SNAKE_CASE` 에러 코드 vocabulary·MCP 프로토콜 메서드명(`resources/list`, `prompts/list`)과 일치시켜 명명했다. 공용 secret redaction 유틸(`SECRET_LEAK_PATTERNS`)을 새로 정의하지 않고 재사용한 점, 기존 `MCP_TIMEOUT` 상수를 새로 발급하지 않고 scope 만 확장한 점 모두 SoT 파편화를 피하는 방향이라 충돌 리스크가 낮다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·파일 경로 6개 관점 전부에서 기존 사용처와의 의미 충돌을 발견하지 못했다.

## 위험도

NONE

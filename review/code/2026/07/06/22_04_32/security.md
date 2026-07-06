# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `mcpDiagnostics.errors[].message` 가 사용자 대면 meta 로 원시 에러 문자열을 노출하는 표면이 확대됨. `sanitizeMcpErrorMessage` 는 제어문자 제거 + 길이 clamp(2048)만 수행하며 URL/토큰/자격증명 패턴 redaction 이 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L774 (`pushMcpDiagnosticError(ctx.mcpDiagnosticErrors, { ..., message: sanitizeMcpErrorMessage(err) })`), `codebase/backend/src/modules/mcp/mcp-error-codes.ts` L43-61 (`sanitizeMcpErrorMessage` 구현)
  - 상세: 기존에는 connect/list 실패가 `skipped(skipReason='error')` 라는 opaque 정보로만 사용자에게 노출됐으나, 본 변경으로 `errors[].message` 에 원본 에러 메시지(예: 외부 MCP 서버/네트워크 라이브러리가 던진 문자열)가 그대로 `meta.mcpDiagnostics` 를 통해 실행 결과 payload 로 흘러간다. `sanitizeMcpErrorMessage` 는 로그 인젝션 방지(개행/제어문자 제거)와 크기 제한만 하고, 자격증명·API 키·내부 호스트명·인증 헤더 값 등이 우연히 에러 메시지에 포함될 경우(예: 일부 HTTP 클라이언트가 실패한 요청 URL 전체를 에러 메시지에 포함하는 경우, query string 에 토큰이 있으면 노출)에 대한 방어(redaction)가 없다. 현재 코드 경로 상 `toConnectParams`/인증 파라미터 자체가 에러 메시지에 직접 삽입되는 곳은 발견되지 않았으나(자격증명 유출을 유발하는 명시적 코드 경로는 없음), 이는 어디까지나 "현재 SDK/네트워크 라이브러리가 그렇게 하지 않는다"는 암묵적 가정에 의존하고 있어 defense-in-depth 관점에서 취약하다.
  - 제안: 이미 이전 리뷰(`review/code/2026/07/06/21_30_25/RESOLUTION.md`)에서 `task_fa96e218` 로 후속 이관되어 트래킹 중 — 해당 스코프 유지 권장. `sanitizeMcpErrorMessage` 에 URL 쿼리스트링/`Authorization` 헤더/일반적 토큰 패턴(예: `Bearer .+`, `[A-Za-z0-9_-]{20,}` 등)에 대한 최소 redaction 추가를 검토.

- **[INFO]** `TimeoutError`/`McpBuildPhaseError` 는 라벨(`label: string`)을 그대로 메시지에 포함 (`` `${label} timed out after ${ms}ms` ``)
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts` L17-22, 호출부 `mcp-tool-provider.ts` (예: `` `connect ${integration.name}` ``, `` `tools/list ${integration.name}` ``)
  - 상세: `label` 에 integration 이름이 삽입되는데, 이는 사용자가 스스로 설정한 통합 이름으로 신뢰 경계 내부의 값이며 비밀정보가 아니다. 별도 조치 불필요.

- **[정보 없음]** 인젝션(SQL/XSS/커맨드/경로 탐색), 하드코딩된 시크릿, 인증/인가 우회, 암호화 알고리즘 관련 신규 이슈는 발견되지 않음. 변경 범위는 (1) `withTimeout` 의 reject 값을 익명 `Error` → 명명된 `TimeoutError` 서브클래스로 교체(메시지 포맷 불변, `instanceof Error` 계약 유지), (2) MCP 진단(`mcpDiagnostics`) 구조를 단일 배열에서 구조화 객체로 승격하고 build-phase 실패를 phase+code 로 분류해 `errors[]` 에 누적하는 것으로, 사용자 입력을 직접 파싱/실행하거나 인증·인가 로직을 변경하는 코드는 없음. `sanitizeMcpErrorMessage` 자체(로그 인젝션 방지용 개행 제거 + 길이 clamp)는 기존 로직 그대로 재사용.

## 요약

이번 변경은 MCP 진단 정보(`mcpDiagnostics`)를 단일 `serverSummaries[]` 배열에서 구조화된 객체(카운터 + `errors[]`)로 확장하고, 타임아웃을 견고하게 분류하기 위한 `TimeoutError` 클래스를 도입하는 리팩터링이다. 신규 인젝션·인증우회·하드코딩 시크릿·안전하지 않은 암호화 이슈는 없다. 유일하게 주목할 항목은 `errors[].message` 가 원시(sanitize-only, redaction-none) 에러 메시지를 사용자 대면 표면으로 확장 노출한다는 점으로, 현재 코드 경로 상 자격증명이 직접 유출되는 구체적 경로는 확인되지 않았으나 defense-in-depth 관점의 잠재적 리스크이며 이미 `task_fa96e218` 로 후속 이관되어 추적 중이다. 전반적으로 이 변경 자체가 새로운 공격 표면을 여는 것은 아니며, 리스크는 낮다.

## 위험도
LOW

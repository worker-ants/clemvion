# 보안(Security) 리뷰

## 리뷰 대상
- `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.spec.ts` (신규)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (buildTools 호출부 fail-fast 배선)
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` (추가 테스트)
- `plan/in-progress/ai-agent-tool-payload-budget-*.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/11-mcp-client.md`, `spec/conventions/cross-node-warning-rules.md`, `review/consistency/**` (문서/spec/리뷰 산출물 — 보안 관점 실질 코드 변경 없음)

이번 변경은 AI Agent 노드가 LLM 에 노출하는 **도구 정의(스키마) 직렬화 크기**를 예산으로 관리해, 대형 MCP 카탈로그(Cafe24 등)를 allowlist 없이 노출했을 때 발생하는 provider-timeout 무한 hang(최대 6분)을 LLM 호출 **전** fail-fast 로 방지하는 안정성/가용성(DoS 방지) 가드레일이다. 신규 인젝션 표면, 신규 시크릿 저장, 인증/인가 변경은 없다.

### 발견사항

- **[INFO]** 예산 초과 에러의 `culpritProvider` 에 통합(Integration) ID 접두 노출
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` `pickCulpritProvider` / `buildExceededMessage`, `ai-turn-executor.ts` 의 `error` 포트 output
  - 상세: `TOOL_DEFINITION_PAYLOAD_EXCEEDED` 의 `output.error.details.culpritProvider` 와 `message` 에 `mcp:<sid>` (Cafe24/Makeshop `sanitizeSid(integration.id)` = integration id 앞 16자) 가 그대로 실려 노드 실행 결과(대화/실행 로그)에 노출된다. 다만 이 `sid` 는 이미 도구 이름(`mcp_<sid>__<op>`) 형태로 매 LLM 요청마다 외부 LLM provider 에 전송되는 기존 값이라 **이번 변경으로 새로 생기는 노출 경로는 아니며**, 노드를 설정한 사용자 본인이 이미 알고 있는 자신의 workspace 소속 integration id 접두이므로 민감도가 낮다.
  - 제안: 현재 수준으로 충분. 다만 향후 이 estimator/에러 상세가 workspace 경계를 넘어 로그 집계·모니터링 등 제3자 가시 영역으로 확장될 경우, sid 대신 사용자가 UI에서 설정한 integration 이름/라벨로 대체하는 편이 더 안전.

- **[INFO]** env 기반 예산 파싱은 서버 배포 설정 전용, 사용자 입력 경로 아님
  - 위치: `tool-payload-budget.ts` `readByteBudget` (`Number(process.env[envName]) || fallback`)
  - 상세: NaN/빈 문자열/0 을 fallback 으로 방어하는 관용구로 기존 `MAX_RESPONSE_BYTES` 선례와 동형. `process.env` 는 API 로 사용자가 조작할 수 없는 배포 시점 설정값이라 인젝션·변조 위험 없음. 문제 없음, 참고용으로만 기록.

- **[INFO]** 에러 메시지에 스택트레이스·내부 경로·자격증명 노출 없음
  - 위치: `ai-turn-executor.ts` catch 블록 (`err instanceof ToolDefinitionPayloadExceededError`), `buildExceededMessage`
  - 상세: 사람이 읽는 메시지는 `totalBytes`/`budgetBytes`/`toolCount`/`culpritProvider`/해결 안내 문구로 구성된 구조화 텍스트일 뿐, raw exception, 파일 경로, 환경변수 값, DB 연결 문자열 등 민감 정보를 포함하지 않는다. `ToolDefinitionPayloadExceededError` 가 아닌 다른 예외는 `throw err`로 그대로 재전파되어 기존 에러 처리 경로(§7.3/§classifyLlmError)를 우회하지 않는다 — 좋은 관행.

- **[INFO]** 가용성 관점 개선(DoS 완화)으로 평가
  - 위치: `tool-payload-budget.ts` `enforceToolPayloadBudget`, `ai-turn-executor.ts` `buildTools`
  - 상세: 개수 cap(`AI_AGENT_TOOL_COUNT_MAX`) 만이 아니라 직렬화 bytes(`AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`) 를 1차 지표로 두어, 대형 스키마 팽창으로 인한 무제한 프롬프트 크기 증가·provider transport timeout·SDK 무한 재시도(최대 6분 hang)를 LLM 호출 전에 차단한다. 공격적으로 조작된 워크플로우 설정(대형 MCP 카탈로그 전량 노출)이 실행 스레드를 장시간 점유하는 자원 고갈 시나리오에 대한 방어 강화로, 순수 보안 관점에서 긍정적 변경이다.

- **[INFO]** JSON.stringify(tools) 재계산 비용
  - 위치: `estimateAgentToolPayload` — `buildTools` 매 호출마다 도구 배열 전체를 `JSON.stringify` 해 byte 길이 산정
  - 상세: 도구 수·크기가 매우 커질 경우 직렬화 자체가 CPU를 소모하지만, 이 비용은 하드 예산 초과 시 즉시 차단되므로 무한정 커지지 않고 기존에도 동일 배열이 LLM 요청 직렬화를 위해 어차피 stringify 되므로 추가 공격 표면은 아니다. 조치 불요.

리뷰 대상에 포함된 `plan/**`, `spec/**`, `review/consistency/**` 문서 diff 는 텍스트 명세/의사결정 기록으로, 하드코딩된 시크릿·SQL/커맨드·경로 포함 여부를 확인했으며 문제 없음(진짜 API 키·자격증명 형태 문자열 없음, 예시 ID 는 `ws-1`/`exec-1`/`i-1` 등 명백한 더미).

### 요약
이번 변경은 AI Agent 의 도구 정의 payload 크기를 사전 검증해 LLM 호출 전 fail-fast 하는 가용성/안정성 가드레일로, 새로운 인젝션 벡터·하드코딩 시크릿·인증/인가 변경·안전하지 않은 암호화가 없다. 에러 상세에 포함되는 `culpritProvider`(통합 ID 접두)는 이미 도구 이름을 통해 외부 LLM provider 에 전송되던 기존 값이라 실질적 정보 노출 증가는 없으며, catch 블록도 특정 예외만 선택적으로 가로채 나머지는 기존 에러 분류 경로로 그대로 전파해 에러 처리 무결성을 해치지 않는다. 전반적으로 보안 관점에서 우려사항이 없고, 오히려 리소스 고갈성 hang 을 줄이는 방어적 개선이다.

### 위험도
NONE

### 발견사항

- **[INFO]** `ProviderBuildCtx.mcpDiagnostics`(입력 슬롯, 배열) vs `meta.mcpDiagnostics`(출력, 객체) 이름 유사
  - target 신규 식별자: `ProviderBuildCtx.mcpDiagnostics` (= `McpServerSummary[]`), `ProviderBuildCtx.mcpDiagnosticErrors` (= `McpDiagnosticError[]`)
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md:529`, `spec/4-nodes/3-ai/0-common.md:113`, `spec/4-nodes/4-integration/4-cafe24.md:438` 의 `meta.mcpDiagnostics` (구조화 객체, AI 노드 output 표면)
  - 상세: target 문서(`spec/5-system/11-mcp-client.md:364`)가 스스로 명시하듯 provider 내부 컨텍스트 필드명 `mcpDiagnostics`(배열, build 단계 입력 슬롯)와 노드 출력 메타 필드 `meta.mcpDiagnostics`(구조화 객체)가 같은 문자열을 공유한다. 실제 코드(`ai-turn-executor.ts`, `mcp-tool-provider.ts`)에서도 동일 이름이 서로 다른 계층·shape 로 존재해 이름만으로는 배열/객체 구분이 안 된다. 다만 target 문서가 이미 "이름은 유사하나 계층·shape 가 다르다"고 명시적으로 각주 처리했고, 코드 리뷰어가 아닌 spec 독자 관점에서는 문맥(`ProviderBuildCtx.` 접두 vs `meta.` 접두)으로 구분 가능하다.
  - 제안: 현행 그대로 유지 가능(이미 문서화된 위험 각주 존재). 추가로 확실히 하려면 provider 입력 슬롯 필드명을 `mcpServerSummaries`로 rename 하는 방안을 고려할 수 있으나, 이는 코드 변경을 요구하므로 본 PR 스코프를 벗어나는 개선 제안 수준.

- **[INFO]** `errors[]` 필드명이 여러 진단 객체에서 재사용
  - target 신규 식별자: `mcpDiagnostics.errors[]` (신규로 구조화 객체에 포함된 필드, 이번 변경으로 emit 시작)
  - 기존 사용처: `spec/5-system/9-rag-search.md` 의 `ragDiagnostics.rerank.error`(단수, 문자열) — 필드명 자체는 다르므로 직접 충돌 없음. 같은 파일 내 `serverSummaries[]`의 `skipReason`과 `errors[]`의 `code`는 역할이 분리되어 있고 target 문서가 §8.2/§6.2에서 "skipReason 은 요약, errors[] 는 코드 granularity" 로 명시적으로 구분.
  - 상세: 실질적 이름 충돌은 없음. 참고용으로만 기록.
  - 제안: 변경 불필요.

- **[INFO]** `MCP_TIMEOUT` / `MCP_CONNECT_FAILED` / `MCP_LIST_FAILED` 코드는 신규 부여가 아님
  - target 신규 식별자: 해당 없음(신규 아님) — diff 확인 결과 이 세 코드는 기존 §8.2 vocabulary 테이블에 이미 정의돼 있었고(과거 "미구현/Planned" 상태), 이번 변경은 **emit 지점을 build-phase(buildTools)로 확장**한 것뿐. 새 요구사항 ID/에러코드를 새로 도입한 것이 아니다.
  - 기존 사용처: `spec/5-system/11-mcp-client.md` §8.2 (변경 전부터 존재), `codebase/backend/src/modules/mcp/mcp-error-codes.ts` (SoT)
  - 상세: 코드 재사용 자체가 target 문서의 의도이므로 충돌이 아니라 정상 확장.
  - 제안: 없음.

- **[INFO]** `phase` 필드 (`"connect"` / `"tools/list"`) 신규 도입
  - target 신규 식별자: `mcpDiagnostics.errors[].phase`
  - 기존 사용처: 검색 결과 spec 전체에서 `phase` 라는 필드명이 다른 도메인(Execution/Node 등)에서 별도 의미로 쓰이는 사례 없음. RAG/Graph RAG 진단 객체에도 `phase` 필드 없음.
  - 상세: 충돌 없음.
  - 제안: 없음.

### 요약
target 커밋(`spec/5-system/11-mcp-client.md`, mcpDiagnostics 구조화 객체 승격 + build-phase granular error code)이 도입하는 식별자 중 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·파일 경로 레벨의 CRITICAL/WARNING 충돌은 발견되지 않았다. 유일하게 주목할 점은 코드 심볼 `ProviderBuildCtx.mcpDiagnostics`(배열, 입력 슬롯)와 API 응답 필드 `meta.mcpDiagnostics`(객체, 출력)가 이름을 공유하는 것인데, target 문서가 이미 이 유사성을 인지하고 "계층·shape 가 다르다"는 각주로 스스로 소명해뒀다. `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` 는 신규 코드가 아니라 기존 vocabulary 의 emit 지점 확장이며, `errors[]`/`serverSummaries[]`/`phase` 등 새 필드명도 RAG/Graph RAG 등 인접 도메인과 겹치지 않는다.

### 위험도
NONE

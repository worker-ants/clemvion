### 발견사항

- **[INFO]** `resources/list`/`prompts/list` 의 §4.4(타임아웃 표)와 §6.2/§8.2(진단 phase 분류) 축 차이
  - target 위치: `spec/5-system/11-mcp-client.md` §4.4 타임아웃 표 ("`tools/list`, `resources/list`, `prompts/list` | 10s") vs §6.2/§8.2 ("call 단계 — `tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list`")
  - 충돌 대상: 동일 문서 내부 (cross-spec 은 아니지만 독자가 혼동할 수 있는 지점이라 보고)
  - 상세: §4.4 는 `resources/list`/`prompts/list` 를 `tools/list` 와 같은 행(10s 타임아웃)에 묶어 "build 단계 계열"처럼 보이게 하는 반면, §6.2/§8.2 는 이 두 메타도구를 "call 단계"(errors[] 의 phase 분류) 로 명시한다. 실제 구현(`mcp-tool-provider.ts` `executeMeta`)을 확인한 결과 `list_resources`/`list_prompts` 는 LLM 이 `execute()` 시점에 호출하는 메타도구이며 `LIST_TIMEOUT_MS`(10s)를 사용하되 build-phase(`buildTools`)가 아닌 call-phase(`execute`)에서 발생한다 — 즉 두 표는 서로 다른 축(타임아웃 길이 vs 진단 phase 귀속)을 기준으로 분류한 것이라 모순은 아니다. 다만 "10s 타임아웃 = build 단계" 라는 암묵적 연상을 갖고 §4.4 만 읽으면 §6.2 의 call-phase 분류와 배치되는 것처럼 오독될 소지가 있다.
  - 제안: §4.4 표에 각주 하나만 추가 — "`resources/list`/`prompts/list` 는 타임아웃 길이는 `tools/list` 와 같은 10s 이나, LLM 이 `execute()` 시점에 호출하는 call-phase 메타도구이며 실패 시 `errors[]` phase 는 `resources/list`/`prompts/list` (§6.2)". 코드 변경 불요, spec 문구만 보강.

- **[INFO]** `MCP_TIMEOUT` 확장이 다른 통합 에러 vocabulary(Cafe24/MakeShop) 코드와 이름 패턴이 다름
  - target 위치: `spec/5-system/11-mcp-client.md` §8.2 (`MCP_TIMEOUT` 이 이제 모든 phase 에서 surface)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §6 (`CAFE24_4XX`/`CAFE24_5XX`/`CAFE24_AUTH_FAILED` 등), `spec/4-nodes/4-integration/5-makeshop.md` (`MAKESHOP_4XX`/`MAKESHOP_404` 등)
  - 상세: 이번 diff 로 Internal Bridge(Cafe24/MakeShop) 의 call-phase 실패도 `mcpErrorDelta` 로 `mcpDiagnostics.errors[]` 에 함께 누적되게 되었다. 이때 `code` 필드에 담기는 값은 provider 별로 서로 다른 네임스페이스(`MCP_*` vs `CAFE24_*`/`MAKESHOP_*`)를 그대로 사용한다 — §6.2 문구("Internal Bridge 는 `CAFE24_*`/`MAKESHOP_*` vocabulary")가 이를 명시적으로 인정하고 있어 실제로는 모순이 아니라 의도된 다중 네임스페이스 설계다. 다만 `errors[].code` 하나의 배열에 서로 다른 SoT(§8.2 vs Cafe24/MakeShop §6)의 코드가 섞여 들어간다는 점은 소비자(프런트엔드 UI, 알림 등)가 `code` 값을 파싱할 때 두 vocabulary 를 모두 알아야 함을 뜻한다.
  - 제안: 현재 문구로 충분히 명시돼 있으므로 수정 강제는 아님. 다만 프런트엔드가 `mcpDiagnostics.errors[].code` 를 사람이 읽는 문구로 매핑하는 화면이 생기면, 두 vocabulary 를 하나의 룩업 테이블로 합치는 프런트 spec(예: `spec/2-navigation/4-integration.md` 또는 AI Agent 노드 결과 패널)에 이 다중 네임스페이스 사실을 교차 언급해두면 향후 drift 예방에 도움.

- **[INFO]** `IntegrationUsageLog.error.message` 의 "2KB clamp" 표현과 `mcpDiagnostics.errors[].message` 의 "2048" 상수(`MCP_ERROR_MESSAGE_MAX_LEN`) 단위 표기 차이
  - target 위치: `spec/5-system/11-mcp-client.md` §8.3 (`error | jsonb? | ... 2KB clamp`)
  - 충돌 대상: 동일 문서 §8.2 아래 `MCP_ERROR_MESSAGE_MAX_LEN = 2048` (코드 상수, `mcp-error-codes.ts`)
  - 상세: 이번 diff 의 범위는 아니며(§8.3 해당 행은 이번 PR 에서 redaction 설명만 보강되고 "2KB" 표현 자체는 기존 텍스트) 실제로는 같은 값(2048 문자 ≈ 2KB)을 가리키는 것으로 코드 확인됨 — `sanitizeMcpErrorMessage` 가 두 sink(`IntegrationUsageLog.error`, `mcpDiagnostics.errors[].message`, `Integration.last_error`) 모두에 동일하게 적용되어 실질적 충돌은 없음. 다만 "2KB" 라는 근사 표현과 "2048" 이라는 정확한 상수명이 같은 문서 안에서 병기되어 있어 사소한 표기 비일관.
  - 제안: 우선순위 낮음 — 후속 spec 편집 시 "2KB(=2048자, `MCP_ERROR_MESSAGE_MAX_LEN`)" 로 통일 표기 고려. 이번 PR 필수 수정 아님.

### 요약
이번 diff(§8.1 call-phase `mcpErrorDelta` 도입, connect 타임아웃 분류 강화, MCP 에러 메시지 redaction 확장)는 `spec/5-system/11-mcp-client.md` 자체가 코드와 함께 동일 PR 에서 갱신되어 spec-sync 가 이미 반영되어 있다. `spec/0-overview.md`(시스템 아키텍처 개요) 와 `spec/1-data-model.md`(Integration 엔티티)를 포함해 교차 검토한 결과 데이터 모델(Integration 필드·상태 전이)·API 계약·요구사항 ID·RBAC·계층 책임 어느 관점에서도 CRITICAL 또는 WARNING 급 충돌은 발견되지 않았다. Cafe24/MakeShop 노드 spec 의 기존 에러 코드 vocabulary(`CAFE24_*`/`MAKESHOP_*`)와 MCP 공용 vocabulary(`MCP_*`)가 `mcpDiagnostics.errors[]` 하나의 배열에 공존하는 점, 그리고 §4.4 타임아웃 표와 §6.2/§8.2 의 phase 분류가 서로 다른 축(타임아웃 길이 vs 진단 phase)을 사용하는 점은 문서 내부적으로는 이미 각주로 설명되어 있어 실질적 모순이 아니라 표현 명확성 차원의 INFO 사항으로만 남는다.

### 위험도
LOW

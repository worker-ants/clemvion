# Cross-Spec 일관성 검토 — `token` 계열 마스킹 패턴 확장 (impl-done, scope=spec/5-system/)

대상 diff: `sanitize-error-message.ts`(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`) ·
`websocket.service.ts`(`CREDENTIAL_KEY_PATTERN` 미러) · `mcp-error-codes.ts`
(`MCP_EXTRA_SECRET_PATTERNS` 흡수) — bare `token`을 포함한 `token` 계열 전체를
`[A-Za-z0-9_-]*token` 한 대안으로 덮도록 값/키 두 축을 확장. 동일 커밋(`45ba37792`)이
`spec/5-system/11-mcp-client.md`·`spec/5-system/14-external-interaction-api.md`·
`spec/5-system/2-api-convention.md` 를 함께 갱신했다.

## 발견사항

- **[WARNING]** `token` 계열 마스킹 커버리지가 두 SoT 사이에서 여전히 비대칭 — spec 에는 그 비대칭이 캐비엇으로 안 남아 있음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17(2026-08-17 갱신 블록,
    "모든 마스킹은 …`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`…을 재사용") ·
    `spec/5-system/11-mcp-client.md` §8.3·Rationale("전부 공용 `SECRET_LEAK_PATTERNS`")
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"(line ~259, "매칭 키:
    `apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`,
    `clientSecret`, `authorization`" 를 리터럴로 명시) · `spec/5-system/4-execution-engine.md`
    (`_resumeState`/`_resumeCheckpoint`/`_retryState` credential-strip) ·
    `spec/2-navigation/14-execution-history.md`(Config 탭 "보편 마스킹" 서술) ·
    `spec/conventions/node-output.md` · `spec/5-system/7-llm-client.md` — 이들은 모두
    `maskSensitiveFields`(`common/utils/mask-sensitive-fields.util.ts`)의
    `DEFAULT_SENSITIVE_KEYS` 를 credential-strip 의 SoT 로 인용하는데, 이 목록은 이번
    diff 가 **의도적으로 건드리지 않았다**(커밋 메시지 "#4 안 닫음").
  - 상세: 이번 diff 로 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`(값·키 두 SoT, 3개
    호출부)은 `csrf_token`/`auth_token`/`session_token`/`csrfToken` 등 접두 `token` 계열까지
    전부 마스킹하도록 넓어졌다. 반면 `maskSensitiveFields` 는 여전히 `token`/`accessToken`/
    `refreshToken` 등 **리터럴 나열**만 매칭해 위 접두 계열이 평문으로 통과한다(무수정
    프로브로 실측·커밋 메시지에 명기). 이 함수는 (a) `handler-output.adapter.ts` 를 통해
    **모든** 노드의 config echo(ingestion 경계, DB 저장 전)를, (b)
    `workflow-assistant/tools/explore-tools.service.ts` 를 통해 AI Assistant 의
    `get_workflow_executions`/`get_execution_details` 읽기 도구(사용자에게 채팅 UI 로
    렌더되는 표면)를 방어한다 — 둘 다 `spec/5-system/14-external-interaction-api.md` §R17 이
    egress 마스킹을 규정하는 것과 **같은 개념(자격증명이 최종 사용자 표면에 평문으로 도달하지
    않는다)** 을 다루는 영역이다. R17/§8.3 은 "SECRET_LEAK_PATTERNS 가 재사용되는 단일
    SoT"라는 인상을 주지만, `maskSensitiveFields` 소비자는 그 SoT 를 **재사용하지 않는
    별도 목록**이라는 사실이 두 spec 어디에도 상호 참조돼 있지 않다 — R17 이 `llmCalls`
    필드처럼 이미 알려진 예외는 캐비엇으로 명시하는 관례(예: "값 마스킹만으로는 부족하다"
    불릿)와 대비된다.
  - 이미 tracked: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    미해결(`- [ ]`) 항목 "workflow-assistant LLM 도구가 …더 약한 마스킹으로 내보낸다"가
    이 갭을 정확히 포착했고(2026-08-17 이번 diff 의 실측을 증거로 추가함), 마스킹 형태
    충돌(`****<last4>` 접미 힌트 vs `***`)이라는 **아직 열려 있는 결정**까지 문서화돼
    있다. `plan/in-progress/eia-secret-pattern-token-family.md` 도 범위 제외 근거를
    명시한다. 즉 **이번 diff 가 새로 만든 gap 이 아니고**, 은폐도 아니다 — 다만 그 결정
    근거가 `plan/`(작업 추적, 완료 시 archive 이동)에만 있고 `spec/`(영구 SoT)에는 아직
    캐비엇으로 반영되지 않아, `plan` 항목이 종결·이동되면 이 비대칭이 spec 독자에게
    보이지 않게 될 위험이 있다.
  - 제안: (a) 지금 당장 코드를 더 넓히라는 뜻은 아님 — 사용자가 이미 axis #4 를
    workflow-assistant 트래커 소유로 명시적으로 범위 밖에 뒀으므로 **그 결정을 존중**한다.
    다만 `spec/5-system/14-external-interaction-api.md` §R17 또는
    `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙" 중 한 곳에 "`maskSensitiveFields`
    소비자(node config echo·workflow-assistant explore tools)는 `SECRET_LEAK_PATTERNS`/
    `CREDENTIAL_KEY_PATTERN` 과 **다른, 더 좁은 목록**을 쓰며 접두 `token` 계열이 아직
    새어나간다"는 한 줄 캐비엇을 추가해 두면, workflow-assistant 트래커가 아직 열려 있는
    동안에도 spec 만 읽는 독자가 "token 계열은 전부 닫혔다"고 오판하지 않는다. (b)
    workflow-assistant 트래커 항목이 해소될 때 이번 diff 의 JSDoc 스타일("이 배열은 …
    이유였다")을 참고해 `mask-sensitive-fields.util.ts` 에도 SoT 파편화 방지 주석을 남기는
    것을 권장.

- **[INFO]** 자격증명 마스킹 SoT 가 3갈래로 병존 — 통합 인벤토리 부재
  - target 위치: 이번 diff 가 닫은 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`
  - 충돌 대상: `spec/5-system/12-webhook.md` §5.3(`sanitizeResponseHeaders` — 헤더 key
    substring 블랙리스트, `token` 을 substring 으로 이미 포함해 오히려 이번 diff 보다
    선제적으로 넓음) · `maskSensitiveFields`(리터럴 키 목록)
  - 상세: 제품 전체에 "자격증명이 최종 사용자에게 평문 도달하지 않는다"는 동일 목표를 향한
    최소 3개의 독립 마스킹 메커니즘(값-정규식 SoT, 키-리터럴 목록, 헤더 key substring
    블랙리스트)이 각기 다른 커버리지 강도로 병존한다. 오늘 실제로 하나(`maskSensitiveFields`)
    가 뒤처져 있다는 사실이 이번 diff 의 무수정 프로브로 드러났다 — 이는 구조적으로 예견
    가능했던 종류의 drift 다.
  - 제안: 필수는 아니나, `spec/conventions/` 에 "이 저장소의 credential-masking 메커니즘
    인벤토리"(SoT·커버리지·소비처·왜 통합하지 않았는지) 표 하나를 두면 다음에 축 하나를
    넓힐 때 형제 목록을 놓치는 재발을 줄일 수 있다. 이번 PR 이 자체적으로 잘 수행한 "자매
    전수 조사"(#1~#4 표) 과정을 문서화된 절차로 승격하는 셈이다.

## 요약

diff 는 매우 좁고 자기완결적이다 — `token` 계열 값·키 마스킹을 3개 호출부(값 SoT·키 SoT·그
미러)에서 동시에 넓히고, 같은 커밋 안에서 `spec/5-system/11-mcp-client.md`·
`spec/5-system/14-external-interaction-api.md`·`spec/5-system/2-api-convention.md` 를 정확히
동기화했다. R12(HMAC 알고리즘 출처)·§11 WS 명령 매핑 표 3중 정합 등 곁들인 문서 정정도
실측으로 뒷받침돼 기존 spec 과 모순을 만들지 않는다. 유일한 실질 발견은 CRITICAL 이 아니라
WARNING 이다 — 이번에 의도적으로 범위 밖에 둔 `maskSensitiveFields`(node config echo ·
workflow-assistant AI 도구)가 `spec/3-workflow-editor/4-ai-assistant.md` 등 다른 영역
spec 에서 "credential masking SoT" 로 인용되는데, 그 목록이 지금 R17/§8.3 이 선전하는
"token 계열 전체 커버리지"에 못 미친다는 사실이 spec 텍스트 자체에는 캐비엇으로 남아있지
않다(plan/tracker 에만 있음). 이 gap 은 이미 정확하게 tracked 돼 있고 결정이 사용자에게
달려 있어 이번 PR 을 막을 사유는 아니다.

## 위험도

LOW

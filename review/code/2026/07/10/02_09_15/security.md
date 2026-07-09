# 보안(Security) Review

## 범위 요약

본 변경 세트는 두 계층으로 구성된다.

1. **실질 코드/로직 변경 (파일 1~6)**: 멀티턴 AI 노드(Information Extractor·AI Agent)의
   resume 턴 LLM 호출이 `llm_usage_log`(비용/사용량 감사 테이블)의
   `workflow_id`/`node_execution_id` attribution 을 올바르게 채우도록 고친 것.
   - `information-extractor.handler.ts` — `MultiTurnState` 에 `workflowId`/`nodeExecutionId`
     필드 추가, `hydrateState()` 가 이를 읽어 resume `traceChat` 호출의 `llmContext` 로 전달
     (기존에는 `state.nodeId`, 즉 노드 **정의** id 를 `node_execution_id` 자리에 오적재).
   - `ai-turn-executor.ts` — `processMultiTurnMessage` 의 메인 chat 호출 2곳(초기 호출 +
     tool-call 루프 후속 호출)에 `llmContext`(`workflowId`/`executionId`/`nodeExecutionId`) 를
     3번째 인자로 전달.
   - `execution-engine.service.ts` — 주석 1줄 추가(로직 변경 없음).
   - 두 `*.spec.ts` 파일 — 신규 회귀 테스트(정의 id 가 row PK 자리에 유입되지 않는지 단언).
2. **문서/메타 산출물 (파일 7~28)**: CHANGELOG, plan 문서, spec 문서(`4-execution-engine.md`,
   `7-llm-usage.md`), 그리고 직전 리뷰 라운드(`review/code/…/01_46_28/`,
   `review/consistency/…/01_46_28/`)의 산출물 신규 커밋. 실행 코드 변경 없음 — 보안 관점에서
   점검할 표면이 없다(민감정보 포함 여부만 확인, 문제 없음).

이 값들(`workflowId`, `nodeExecutionId`)의 출처를 직접 추적했다: `ai-turn-orchestrator.service.ts`
가 `this.driver.buildRetryReentryState(...)` 로 `resumeState` 를 재구성해
`handler.processMultiTurnMessage(message, resumeState, …)` 로 전달하고, 이 `resumeState` 는
서버가 영속한 `NodeExecution`/체크포인트 데이터에서 재구성된 것이지 매 턴 클라이언트가 보내는
요청 payload 에서 직접 유입되는 값이 아니다. 따라서 이번 diff 는 로깅/attribution 목적의
내부 ID 배선 교정이며, 인증·인가·암호화·입력 검증 경계를 넘나드는 변경이 아니다. 이 결론은
직전 리뷰 라운드(`01_46_28/security.md`, NONE)의 판단과 일치하며, 이번 라운드에서 소스를 직접
재확인해 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 재구성 state 필드에 대한 무검증 타입 단언(`as string | undefined`) — 기존 관례 답습
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` `hydrateState()`(신규 `workflowId`/`nodeExecutionId` 라인), `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2599-2603`(`llmContext` 구성 시 `state.workflowId as string | undefined` / `state.nodeExecutionId as string | undefined`)
  - 상세: 두 값 모두 런타임 스키마 검증 없이 타입만 단언한다. 이 값들은 `llm_usage_log.workflow_id`/`node_execution_id` FK 컬럼에 그대로 적재되어 비용 집계(Statistics/Alerts `llm_cost` 워크플로 스코프)의 attribution 근거가 된다. `raw`/`state` 는 엔진이 재구성한 서버 소유 체크포인트에서만 오므로(직접 조회로 확인 완료) injection/변조 위험은 낮다. `information-extractor.handler.ts` 는 이미 파일 전체에서 동일한 unchecked-cast 패턴을 쓰고 있고, `ai-turn-executor.ts` 도 `processMultiTurnMessage(state: Record<string, unknown>, …)` 전체가 동일 관례라 신규 도입 리스크는 아니다.
  - 제안: 시급하지 않음. 후속으로 zod 등 스키마 검증을 도입하면 audit/비용 데이터 무결성이 한층 강화되지만(plan 문서에 이미 후속 검토 언급됨), 이번 PR 범위에서 차단 사유는 아니다.

- **[INFO]** attribution 오류(수정 전 버그)는 데이터 무결성/감사 로그 정확성 이슈였을 뿐 보안 취약점은 아니었음
  - 위치: `information-extractor.handler.ts`(수정 전 상태), `spec/data-flow/7-llm-usage.md` §Rationale
  - 상세: 수정 전 `node_execution_id` 에 노드 정의 id 가 잘못 유입돼 FK 관계가 깨졌지만, 크로스 테넌트 데이터 노출이나 권한 우회로 이어지지 않는다(같은 workspace 내 자체 실행의 잘못된 FK일 뿐이며 `workspace_id` 는 항상 `config.workspaceId` 로 정확히 채워짐). 참고용 기록.

## 점검한 항목 중 이슈 없음

- **인젝션(SQL/XSS/커맨드/LDAP/경로 탐색)**: 신규 코드는 문자열 필드를 TypeORM 엔티티(`LlmUsageLogService.record` → `repository.create/save`)로 전달할 뿐 raw SQL/문자열 결합·shell 호출·경로 조작이 없다. 표면 없음.
- **하드코딩된 시크릿**: diff 내 API 키/비밀번호/토큰/인증서 리터럴 없음(코드·spec·CHANGELOG·plan·review 산출물 전부 확인).
- **인증/인가**: 컨트롤러·가드·세션 로직 변경 없음. 값들은 이미 인가된 실행 컨텍스트 내부에서만 흐른다.
- **입력 검증**: 사용자가 직접 제어하는 API 표면(요청 body 등) 변경 없음 — 값은 서버가 재구성한 실행 메타데이터이며 provenance 를 직접 추적해 확인했다.
- **OWASP Top 10**: 접근 제어·SSRF·역직렬화·구성 오류 등 해당 표면 변경 없음.
- **암호화/평문 전송**: 관련 변경 없음.
- **에러 처리**: 에러 메시지/스택 트레이스 노출 관련 변경 없음.
- **의존성 보안**: 신규/변경 의존성 없음.

## 요약

이번 변경은 멀티턴 AI 노드 resume 턴의 `llm_usage_log` attribution(workflow/execution/node_execution FK) 오류를 바로잡는 순수 내부 로깅/데이터 정합성 수정으로, 사용자 입력 처리·인증/인가·암호화·에러 노출 경계를 건드리지 않는다. 배선되는 ID 값은 클라이언트가 직접 주입할 수 없는 서버 재구성 체크포인트(`buildRetryReentryState` → `resumeState`)에서 나오며, 이번 라운드에서 그 provenance 를 직접 소스 추적으로 재검증했다. injection 이나 크로스 테넌트 데이터 오염 같은 새로운 공격 표면은 생기지 않는다. 나머지 diff(CHANGELOG·plan·spec·직전 리뷰 산출물)는 문서/메타 변경으로 보안 표면이 없으며 민감정보 노출도 없음을 확인했다. 유일한 관찰 사항은 `hydrateState`/`processMultiTurnMessage` 의 무검증 타입 단언 패턴(기존 관례 답습, 신규 리스크 아님)이며 즉시 조치가 필요한 항목은 아니다.

## 위험도

NONE

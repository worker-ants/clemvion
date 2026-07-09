# 보안(Security) Review

## 범위 요약

본 변경은 멀티턴 AI 노드(Information Extractor·AI Agent)의 **resume 턴** LLM 호출이
`llm_usage_log`(비용/사용량 감사 테이블)의 `workflow_id`/`node_execution_id` attribution 을
올바르게 채우도록 고친 것이다. 핵심 변경은:

- `information-extractor.handler.ts` — `MultiTurnState`에 `workflowId`/`nodeExecutionId` 필드
  추가, `hydrateState`가 이를 읽어 resume `traceChat` 호출의 `llmContext`로 전달 (기존에는
  `state.nodeId`(노드 **정의** id)를 `node_execution_id` 자리에 오적재).
- `ai-turn-executor.ts` — `processMultiTurnMessage`의 메인 chat 호출 2곳에 `llmContext`
  (`workflowId`/`executionId`/`nodeExecutionId`)를 3번째 인자로 전달.
- `execution-engine.service.ts` — 주석 1줄 추가(로직 변경 없음).
- 나머지는 spec 문서(`spec/5-system/4-execution-engine.md`, `spec/data-flow/7-llm-usage.md`),
  CHANGELOG, plan 문서, 그리고 두 unit spec 파일의 회귀 테스트 추가.

이 값들(`workflowId`, `nodeExecutionId`)은 서버 측 엔진(`buildRetryReentryState`)이
`execution.workflowId` / 현재 turn 의 `NodeExecution` row PK 로부터 재구성해 `_resumeState`/
`_retryState` 체크포인트에 실어주는 값이며, 최종 사용자가 매 턴 보내는 메시지 payload
에서 직접 유입되는 값이 아니다. 따라서 이번 diff 는 로깅/attribution 목적의 내부 ID 배선
교정이며, 인증·인가·암호화·입력 검증 경계를 넘나드는 변경은 아니다.

## 발견사항

- **[INFO]** 재구성 state 필드에 대한 무검증 타입 단언(`as string | undefined`)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` `hydrateState()` (신규 `workflowId`/`nodeExecutionId` 라인 포함, 주변 필드 전부 동일 패턴)
  - 상세: `raw.workflowId as string | undefined` / `raw.nodeExecutionId as string | undefined` 는 런타임 스키마 검증 없이 타입만 단언한다. 이 값들은 `llm_usage_log.workflow_id`/`node_execution_id` FK 컬럼에 그대로 INSERT 되어 비용 집계(Statistics/Alerts `llm_cost` 워크플로 스코프)의 attribution 근거가 된다. 현재는 `raw`가 엔진이 재구성한 서버 소유 체크포인트(`_resumeState`/`_retryState`)에서만 오므로 직접적인 사용자 입력 경로는 없어 injection/변조 위험은 낮다. 다만 `hydrateState`는 이 파일 전체에서 이미 동일한 unchecked-cast 패턴을 쓰고 있어(신규 필드는 기존 관례를 그대로 따른 것뿐) 새로 도입된 리스크는 아니다.
  - 제안: 시급하지 않음. 다만 후속 강화 시 audit/비용 데이터 무결성 방어 차원에서 zod 등으로 resume-state 전체를 스키마 검증하는 편이 안전하다(plan 문서에 언급된 engine 측 `resume-state.schema` 와 동일 수준으로 handler 측도 맞추는 방향). 이번 PR 범위에서 차단 사유는 아님.

- **[INFO]** attribution 오류(과거 버그)는 데이터 무결성/감사 로그 정확성 이슈였으며 보안 취약점은 아니었음
  - 위치: `information-extractor.handler.ts` (수정 전 상태), `spec/data-flow/7-llm-usage.md` §Rationale
  - 상세: 수정 전에는 `node_execution_id`에 노드 정의 id 가 잘못 들어가 FK 관계가 깨졌지만, 이는 크로스 테넌트 데이터 노출이나 권한 우회로 이어지지 않는다(같은 workspace 내 자체 실행의 잘못된 FK일 뿐이며 `workspace_id`는 항상 `config.workspaceId`로 정확히 채워짐). 이번 fix 는 오히려 비용/사용량 감사 추적성을 개선하는 방향의 정정이다.

## 점검한 항목 중 이슈 없음

- **인젝션**: 신규 코드는 문자열 필드를 TypeORM 엔티티(`LlmUsageLogService.record` → `repository.create/save`)로 전달할 뿐 raw SQL/문자열 결합이 없다. SQL/커맨드/경로 인젝션 표면 없음.
- **하드코딩 시크릿**: diff 내 API 키/토큰/자격증명 리터럴 없음.
- **인증/인가**: 컨트롤러·가드·세션 로직 변경 없음. 값들은 이미 인가된 실행 컨텍스트 내부에서만 흐른다.
- **입력 검증**: 사용자가 직접 제어하는 API 표면(요청 body 등) 변경 없음 — 값은 엔진이 서버 측에서 재구성한 실행 메타데이터.
- **암호화/평문 전송**: 관련 변경 없음.
- **에러 처리**: 에러 메시지/스택 트레이스 관련 변경 없음.
- **의존성**: 신규/변경 의존성 없음.

## 요약

이번 변경은 멀티턴 AI 노드 resume 턴의 `llm_usage_log` attribution(workflow/execution/node_execution FK) 오류를 바로잡는 순수 내부 로깅/데이터 정합성 수정으로, 사용자 입력 처리·인증/인가·암호화·에러 노출 경계를 건드리지 않는다. 배선되는 ID 값은 클라이언트가 직접 주입할 수 없는 서버 재구성 체크포인트에서 나오므로 injection 이나 크로스 테넌트 데이터 오염 같은 새로운 공격 표면이 생기지 않는다. 유일한 관찰 사항은 `hydrateState`의 무검증 타입 단언 패턴(기존 관례 답습, 신규 리스크 아님)이며 즉시 조치가 필요한 항목은 아니다.

## 위험도

NONE

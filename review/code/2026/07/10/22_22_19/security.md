# 보안(Security) Review

## 대상

`llm_usage_log` attribution(`workflowId`/`executionId`/`nodeExecutionId`) 을 AI Agent 자동 메모리
(`summary_buffer`/`persistent`) 롤링 요약 압축 chat 호출에도 배선하는 변경. 대상 파일 9개
(backend 4개 실코드/스펙 3개, md 2개, spec/plan 문서 2개) — 실질 로직 변경은
`ai-memory-manager.ts`, `ai-turn-executor.ts`, `agent-memory-injection.ts` 3곳, 나머지는 테스트/문서.

## 발견사항

- **[INFO]** `LlmCallContext` 필드가 loosely-typed `state`/`config` 에서 캐스트로 채워짐
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`processMultiTurnMessage` 의
    `llmContext: { workflowId: state.workflowId as string | undefined, ... }`, 두 호출부)
  - 상세: `state.workflowId`/`state.nodeExecutionId` 는 `Record<string, unknown>` 성격의 재구성
    resume state(`buildRetryReentryState` 주입분)에서 `as string | undefined` 로 무검증 캐스트된다.
    이 값들은 최종적으로 `LlmUsageLogService.record()` → `this.repository.insert({...})` (TypeORM
    parameterized insert, `codebase/backend/src/modules/llm/llm-usage-log.service.ts`) 로만 소비되므로
    **SQL 인젝션 경로는 없다**. 다만 만약 이 재구성 state 가 외부에서 변조 가능한 경로(예: 조작된
    resume payload)를 거친다면, 임의 문자열이 `llm_usage_log.workflow_id`/`node_execution_id` FK 성격
    컬럼에 그대로 적재될 수 있어 — 존재 검증(참조 무결성 강제) 없이는 다른 workflow/실행에 비용을
    잘못 귀속시키는 데이터 무결성 이슈로 이어질 여지가 있다. 단, 이는 본 diff 가 새로 만든 패턴이
    아니라 기존 main-chat 소비 사이트(PR #877/#879)가 이미 쓰던 것과 동일한 `state.*` 캐스트 관용구를
    요약 압축 chat 에도 **동형으로 확장**한 것뿐이라, 이 diff 자체가 새 공격면을 추가하지는 않는다.
  - 제안: (본 PR 범위 밖, 참고용) resume state 의 신뢰 경계를 별도로 감사할 필요가 있다면
    `workflowId`/`nodeExecutionId` 가 실제로 엔진 내부(`buildRetryReentryState`)에서만 주입되고
    외부 입력으로 오염될 수 없는지 확인하는 별도 트랙에서 다루는 편이 적절하다. 이번 diff 자체에는
    조치가 불필요하다고 판단.

- **[INFO]** 테스트 fixture 의 attribution ID 값
  - 위치: `ai-agent.memory.spec.ts`, `ai-memory-manager.spec.ts`, `agent-memory-injection.spec.ts`
  - 상세: `'wf-1'`, `'exec-1'`, `'ne-row-1'`, `'wf-x'` 등은 명백한 placeholder 값이며 실제 시크릿/
    토큰/자격증명이 아니다. 하드코딩 시크릿 해당 없음.

## 관점별 요약

1. **인젝션**: 신규 데이터 흐름은 3개 ID(문자열) 를 `LlmCallContext` 로 forward 해 최종적으로
   TypeORM `repository.insert()` (parameterized) 로만 쓰인다. Raw SQL 조합·문자열 concat 없음 →
   SQL 인젝션 없음. XSS/커맨드/LDAP/경로 탐색 해당 없음(HTTP 응답·파일 시스템·쉘 호출 경로 무관).
2. **하드코딩된 시크릿**: 없음. 변경분은 ID 배선 로직 + 테스트 fixture 뿐.
3. **인증/인가**: 미변경. 이 diff 는 워크스페이스/권한 검증 로직을 건드리지 않는다. `workspaceId`
   는 여전히 `LlmConfig.workspaceId` 로부터 별도 경로로 채워지며 `llmContext` 로 전달되지 않는다
   (attribution 3필드 = workflowId/executionId/nodeExecutionId 만 forward).
4. **입력 검증**: `llmContext` 필드는 옵션(`?`)이며 최종 소비처(`LlmUsageLogService.record`)가
   `params.workflowId ?? null` 형태로 nullable 처리 — 미검증 문자열이어도 DB insert 실패/예외를
   일으키지 않는다(graceful). 위 INFO 항목 외 추가 검증 이슈 없음.
5. **OWASP Top 10**: 해당 사항 없음. 로깅/텔레메트리 배선 변경으로 OWASP 카테고리(A01~A10)와
   직접 접점 없음.
6. **암호화**: 무관. 평문/암호화 전송 경로 변경 없음.
7. **에러 처리**: `LlmUsageLogService.record()` 는 기존과 동일하게 insert 실패를 catch 해
   `logger.warn` 로만 남기고 LLM 호출 결과에 영향을 주지 않는다(diff 로 인한 신규 에러 노출 없음).
8. **의존성 보안**: 신규 의존성 추가 없음(기존 `LlmService`/`LlmCallContext` 타입 재사용).

## 요약

이번 diff 는 AI Agent 자동 메모리 롤링 요약 압축 LLM 호출에 이미 존재하는 `LlmCallContext`
(workflowId/executionId/nodeExecutionId) attribution 배선 패턴을 그대로 확장 적용하는 내부
로깅/집계용 배관(plumbing) 변경으로, 사용자 입력 처리·인증/인가·암호화·에러 노출 경로를
건드리지 않는다. 최종 소비처가 TypeORM parameterized insert 이므로 인젝션 벡터가 없고, 신규
시크릿·의존성도 없다. 유일한 참고 사항은 재구성 `state.*` 필드의 무검증 캐스트 관용구가 이번에도
반복된다는 점이나, 이는 이 PR 이전부터 존재하던 기존 패턴을 동형으로 확장한 것이라 이번 diff 가
새로 유발한 리스크는 아니다.

## 위험도

NONE

# 보안(Security) 코드 리뷰

## 대상

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts`
- `plan/in-progress/fix-resume-turn-usage-log-attribution.md`

변경 요약: AI 멀티턴 resume 턴(§7.5 rehydration)·retry-last-turn 재진입에서 `buildRetryReentryState` 재구성기가 `workflowId`/`nodeExecutionId` 를 재주입하지 않아 cafe24/makeshop/mcp provider-tool 의 `integration_usage_log` 기록 게이트(`if (ctx.nodeExecutionId && ctx.workflowId)`)가 조용히 false 로 빠지던 회귀(#501)를 수정. `opts.nodeExecutionId` 를 새 선택 필드로 추가하고 호출측(`ai-turn-orchestrator`/`retry-turn.service`)이 DB row id 를 전달, `resume-state.schema.ts` 문서 스키마와 `CREDENTIAL_CONTEXT_FIELDS` 제외 목록을 동기화. 부수로 spec 무관 테스트 파일의 out-of-scope `service` 참조 버그(`svcMetrics` 로 교체)도 수정.

### 발견사항

- **[INFO]** 재주입 값의 출처는 순수 서버측 DB 식별자 — 인젝션/신뢰 경계 위험 없음
  - 위치: `execution-engine.service.ts:4913-4914` (`workflowId: execution.workflowId`, `nodeExecutionId: opts?.nodeExecutionId`), 호출부 `ai-turn-orchestrator.service.ts:151` (`ctx.nodeExec?.id`), `retry-turn.service.ts:2631` (`spawnedRow.id`)
  - 상세: 두 값 모두 이미 로드된 `Execution`/`NodeExecution` 엔터티의 PK 이며, 해당 row 는 각각 `executionId` 소속 검증(`retryLastTurn` 1단계, `NodeExecution` lookup `where: { executionId, nodeId }`)을 통과한 뒤에만 도달한다. 사용자가 임의로 주입 가능한 문자열이 아니고, 문자열 결합으로 SQL/커맨드에 들어가지 않으며(ORM/파라미터 바인딩 경로), `logUsage` 게이트 boolean 조건 평가에만 쓰인다. 인젝션·권한우회 표면이 새로 생기지 않는다.
  - 제안: 없음 (정보 제공용).

- **[INFO]** DB 영속 checkpoint 로 유출되지 않도록 이중 방어가 유지됨
  - 위치: `utils/resume-state.schema.ts:2965`(`resumeStateSchema.nodeExecutionId`), `:3137`(`CREDENTIAL_CONTEXT_FIELDS` 추가) / `execution-engine.service.ts` `buildResumeCheckpoint` (라인 5008 부근, diff 밖)
  - 상세: `nodeExecutionId`(그리고 기존 `workflowId`)는 in-memory `_resumeState` 에만 존재하고, DB 영속 대상인 `_resumeCheckpoint`/`_retryState` 는 `buildResumeCheckpoint` 의 **명시적 allow-list**(위험 필드를 열거해서 포함하는 방식, 제외-list 아님)로 만들어지므로 두 필드는 애초에 checkpoint 산출물에 포함될 수 없다. `CREDENTIAL_CONTEXT_FIELDS` 갱신은 단위테스트 oracle(allow-list drift 검증용)일 뿐 실제 차단 로직이 아니지만, 실제 차단은 이미 allow-list 구조로 안전하게 이뤄지고 있다. 이번 변경은 이 불변식을 깨지 않는다.
  - 제안: 없음.

- **[INFO]** WebSocket emit 경로로 신규 필드가 클라이언트에 노출되지 않음
  - 위치: `ai-conversation-helpers.ts` `buildConversationMetaFromResumeState`/`buildAiMessageDebugFromResumeState` (diff 밖, 소비처 확인)
  - 상세: `_resumeState` 전체를 클라이언트로 보내는 대신, 두 헬퍼가 화이트리스트 필드(`model`/`inputTokens`/`ragSources`/`turnDebug` 등)만 선택적으로 펼쳐 emit 한다. `workflowId`/`nodeExecutionId` 는 이 화이트리스트에 없어 새로 노출되지 않는다(`nodeExecutionId` 자체는 별도로 `nodeExec?.id` 형태로 기존에도 정상적으로 emit 되던 필드이며 이번 변경과 무관).
  - 제안: 없음.

- **[INFO]** 테스트 파일 수정은 스코프 밖 참조 버그(`ReferenceError`) 정정 — 보안 관련 로직 변경 없음
  - 위치: `execution-engine.service.spec.ts:17023-17026`, 새 회귀 테스트 `:1546-1560`
  - 상세: `reentryWorkflowInput` describe 블록이 밖으로 나간 `service` 대신 로컬 인스턴스 `svcMetrics` 를 참조하도록 정정. `resumeState.workflowId`/`.nodeExecutionId` 재주입을 검증하는 신규 테스트는 실제 DB row 접근 없이 mock 컨텍스트만 사용.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/fix-resume-turn-usage-log-attribution.md` — 신규 plan 문서, 코드 로직 없음
  - 상세: root cause·수정 범위 서술 문서로 보안 영향 없음.

## 요약

이번 변경은 AI 멀티턴 resume/retry 재진입 시 사용량 로그(`integration_usage_log`) 기록 게이트에 필요한 두 내부 식별자(`workflowId`, `nodeExecutionId`)를 서버측 DB row(이미 `executionId` 소속 검증을 통과한 `Execution`/`NodeExecution`)에서 재유도해 채워 넣는 좁은 범위의 회귀 수정이다. 사용자 입력이 새로 관여하지 않고, 재주입된 값은 파라미터 바인딩/불리언 게이트 조건에만 쓰여 SQL·커맨드 인젝션 표면이 없다. DB 영속 checkpoint(`_resumeCheckpoint`/`_retryState`)는 기존과 동일하게 명시적 allow-list 구조로 두 필드를 배제하고 있어 credential-strip 정책이 유지되며, WebSocket 클라이언트 emit 경로 역시 화이트리스트 헬퍼를 그대로 통과하므로 신규 정보 노출이 없다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출, 취약 의존성 관련 이슈는 발견되지 않았다.

## 위험도

NONE

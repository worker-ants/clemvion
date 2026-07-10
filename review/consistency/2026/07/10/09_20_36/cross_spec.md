# Cross-Spec 일관성 검토 — `spec/5-system/4-execution-engine.md`

## 검토 범위

target 전체 문서(1593줄, `spec/5-system/4-execution-engine.md`) + 동시에 수정된 `spec/4-nodes/3-ai/1-ai-agent.md` · `spec/4-nodes/3-ai/3-information-extractor.md` 의 diff(`git diff main`)를 대조군으로, 다음 cross-spec 대상과 교차 검증했다: `spec/1-data-model.md`(§2.13 Execution / §2.14 NodeExecution), `spec/0-overview.md`, `spec/conventions/node-output.md`(Principle 5/7), `spec/4-nodes/1-logic/10-parallel.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/data-flow/7-llm-usage.md`(§1.3), `spec/5-system/6-websocket-protocol.md`(§4.2), `spec/5-system/3-error-handling.md`(§1.5), `spec/conventions/node-cancellation.md`(§5), `spec/5-system/14-external-interaction-api.md`(§R7), `plan/complete/exec-park-durable-resume.md`. 코드(`resume-state.schema.ts`, `graph-traversal.service.ts`)도 claim 검증용으로 대조했다.

## 발견사항

- **[WARNING]** `_selectedPort` 활성화 조건이 fan-out(`port: string[]`) 모델을 반영하지 않음
  - target 위치: §2.1 "back-edge 활성화 조건"(대략 L223-230), "`_selectedPort` 메타데이터 처리"(L240-242)
  - 충돌 대상: 같은 문서 §5.1 `NodeHandlerOutput.port` 타입 선언(본 diff 에서 `string` → `string | string[]` 로 갱신됨) · `spec/conventions/node-output.md` Principle 5 "`port` 활성화 모델"(`port: string[]` 복수 활성화, 사용 노드 `parallel`/`text_classifier`) · `spec/4-nodes/1-logic/10-parallel.md`(`port: string[]` fan-out 명시) · `spec/4-nodes/3-ai/2-text-classifier.md`(multi-label 모드 `port: string[]`)
  - 상세: §2.1 은 back-edge 활성화 판정을 "`_selectedPort`가 선택된 포트와 **일치**할 때만 활성화" 로만 서술해 `_selectedPort` 가 단일 문자열이라는 전제를 깔고 있다. 그러나 이번 diff 로 §5.1 이 `port?: string | string[]` 로 명시 확장되었고, node-output.md Principle 5 · parallel.md · text-classifier.md 는 이미 Parallel/Text Classifier 의 fan-out(`port: string[]`, 예: `_selectedPort: ['done']`)을 cross-spec 표준으로 확립해 두었다. 실제 코드(`graph-traversal.service.ts` `isPortFiltered`)도 `_selectedPort` 가 배열이면 `.includes(edgeSourcePort)` 로 판정하는 별도 분기를 이미 구현하고 있어, spec 문서만 이 분기를 설명하지 않는 상태다. 독자가 §2.1 만 보고 "back-edge 소스가 Parallel/Text Classifier(멀티라벨)일 때 배열 `_selectedPort` 가 어떻게 매칭되는가"를 판단할 수 없다.
  - 제안: §2.1 "back-edge 활성화 조건" 에 "`_selectedPort`가 배열인 경우(Principle 5 fan-out) `sourcePort`가 배열에 포함되면 활성화" 항목을 추가하고, "`_selectedPort` 메타데이터 처리" 절에도 배열 케이스를 1줄 명시. (이번 diff 범위 밖의 기존 텍스트이지만, 이번 diff 가 §5.1 타입을 명시적으로 넓히면서 인접 §2.1 과의 정합성 갭이 더 뚜렷해졌다.)

- **[INFO]** `port`/노드 타입 식별자 kebab-case → snake_case 정정은 CONVENTIONS 와의 기존 drift 해소
  - target 위치: §5.3 "Port Selector 패턴" (`if_else`, `switch`, `text_classifier`, `http_request`, `ai_agent`)
  - 충돌 대상: `spec/conventions/node-output.md` Principle 5 표 (`if_else`, `switch`, `http_request` 등 snake_case 이미 사용)
  - 상세: 이번 diff 는 종전 kebab-case(`if-else`, `switch`, `text-classifier`, `http-request`, `ai-agent`) 를 snake_case 로 정정했다. node-output.md 는 이미 snake_case 를 표준으로 써 왔으므로, 이번 변경은 두 문서 간 기존 drift 를 해소하는 방향이며 새로운 충돌을 만들지 않는다. 코드 파일명(`if-else.schema.ts` 등)은 여전히 kebab-case 이나, 이는 파일명 규약과 런타임 `nodeType` 식별자 규약이 원래 별개이므로 충돌 아님.
  - 제안: 조치 불필요 (정보성 기록).

## 확인된 정합 항목 (참고)

- `_resumeCheckpoint`/`_retryState` "두 재유도 채널"(조작 필드 vs 식별 필드) 서술은 `spec/5-system/4-execution-engine.md` §1.3/§10.3/§Rationale, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md` 세 문서 간 문구·근거(#501, PR #877/#879)가 모두 일치.
- `CREDENTIAL_CONTEXT_FIELDS`(workflowId/nodeExecutionId/workspaceId 포함) claim 은 `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` 실제 배열과 일치.
- §10.3 nodeExecutionId 설명(AI/멀티턴 핸들러의 `LlmCallContext` 경유 `llm_usage_log.node_execution_id` 기록, resume 턴은 `state` 경유 재유도)은 `spec/data-flow/7-llm-usage.md` §1.3 Caller 카탈로그 서술과 정합.
- `Execution`/`NodeExecution` 상태 enum(§1.1/§1.2)은 `spec/1-data-model.md` §2.13/§2.14 필드 정의와 정합.
- `pending_plans` 에서 `exec-park-durable-resume.md` 제거는 해당 plan 이 `plan/complete/`로 이동 완료된 상태와 일치 (`spec/4-nodes/3-ai/1-ai-agent.md` 도 동일하게 정정됨, 다른 spec 문서에 잔존 참조 없음).
- §7.5/§9.2/§9.3 의 `RESUME_*` 에러 코드·큐 이름·env 변수는 `spec/5-system/6-websocket-protocol.md` §4.2, `spec/5-system/3-error-handling.md` §1.5, `spec/5-system/14-external-interaction-api.md` §R7 과 상호 링크·서술 모두 정합.
- Information Extractor 가 provider-tool 없이 `finalize_extraction` 단일 tool 만 보유한다는 claim(§Rationale "적용 범위")은 `spec/4-nodes/3-ai/3-information-extractor.md` 본문과 일치.

## 요약

이번 draft 는 §501 회귀(resume/retry 턴 usage-log attribution 누락)를 문서화하는 그루밍성 변경으로, 이미 병합된 코드 수정(PR #877/#879)을 뒤늦게 spec 에 반영하는 성격이 강하다. `_resumeCheckpoint` 재유도 채널 서술, `port` 타입 확장, kebab→snake_case 노드 타입 표기 정정 모두 data-model·conventions/node-output·data-flow/llm-usage·ai-agent/information-extractor 스펙과 교차 검증한 결과 CRITICAL 급 모순은 없다. 유일한 실질 발견은 §2.1 back-edge 활성화 조건이 이번에 §5.1 에서 명시적으로 넓어진 `port: string[]` fan-out 모델(Parallel/Text Classifier, node-output.md Principle 5 이 SoT)을 아직 반영하지 않는 WARNING 한 건으로, 즉각적인 기능 장애를 유발하지는 않으나 back-edge·fan-out 조합을 다루는 독자에게 오해를 줄 수 있어 후속 갱신을 권장한다.

## 위험도

LOW

# 보안(Security) 리뷰 — `14_30_35`

대상: 실질 애플리케이션 코드는 `codebase/backend/src/modules/external-interaction/interaction.service.ts`
(+`.spec.ts`), `codebase/backend/src/modules/websocket/websocket.service.ts`(+`.spec.ts`),
신규 `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 5개 파일이다. `CHANGELOG.md`,
`plan/in-progress/*.md`, `review/**` 신규 파일은 계획·리뷰 산출물이라 코드 보안 분석 대상이
아니며, 하드코딩 시크릿 여부만 확인했다 — 발견 없음(`sk-RESULT-LEAK`/`AKIA-ERR-LEAK`/`SECRET
PROMPT VIA REST` 류는 전부 테스트 fixture 리터럴이지 실제 크리덴셜이 아니다).

이번 커밋(`34e32e62f`)의 핵심 변경은 직전 라운드(`10_32_27`~`12_06_20`)가 `websocket.service.ts`
의 외부 **fanout**(SSE/webhook/chat-channel)에서만 막았던 `llmCalls`(raw LLM 요청/응답 — 시스템
프롬프트·대화 이력) 중첩 누출을, 같은 `iext_*`/`itk_*` 토큰으로 접근 가능한 **REST 스냅샷**
(`InteractionService.getStatus` → `waiting_for_input` 분기의 `nodeOutput`)에도 동일 강도로
막은 것이다. 처방(`stripDeep`, 이름 기반·깊이 무관 필드 제거)을 `shared/utils/strip-external-only-fields.ts`
로 승격해 두 호출부(`websocket.service.ts`, `interaction.service.ts`)가 같은 함수를 부르게
했다. 코드를 직접 열어 다음을 확인했다.

## 발견사항

- **[WARNING]** `emitNodeEvent` 의 strip 을 "현재는 불필요한 방어심층화"라고 서술하는 주석이 실제로는 **이미 활성 경로를 보호 중**이라는 사실과 어긋난다 — 위험이 실제보다 낮게 문서화됨
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:526-527` (주석 "node 이벤트는 현재 llmCalls 를 포함하지 않으나, 미래 누출 경로를 차단하기 위해 emitExecutionEvent 와 동일하게 strip 적용 (방어심층화 — W-1/W-4)."), 코드는 바로 아래 `:528-531`(`stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` — 이번 diff 가 2-인자 호출로 바꾼 지점)
  - 상세: 코드를 따라가면 이 주석의 전제("node 이벤트는 현재 llmCalls 를 포함하지 않는다")가 사실이 아니다. `NODE_COMPLETED` 이벤트는 `execution-engine.service.ts` 의 비차단 노드 완료 분기(`nodeExecution.outputData = (output as Record<string, unknown>) ?? {}` — raw 핸들러 반환값을 그대로 대입, 약 `:5936`/`:5981`)가 만든 `nodeExecution.outputData` 를 `emitNode(..., NodeEventType.NODE_COMPLETED, { ..., output: nodeExecution.outputData, ... })` 로 **그대로 emit** 한다. 그런데 단일 턴(non-multi-turn) AI Agent 핸들러의 반환값(`src/nodes/ai/ai-agent/ai-turn-executor.ts` 의 단일 턴 종료 빌더, `meta: { ..., turnDebug: [{ turnIndex: 1, llmCalls, ... }] }, port: 'out', status: 'ended'` 형태, 약 `:1896-1935`)은 정확히 `meta.turnDebug[].llmCalls` 를 포함한다 — 즉 AI Agent 노드가 (waiting 없이) 단일 실행으로 끝나면 그 `NODE_COMPLETED` payload 는 **오늘, 가정이 아니라 실제로** raw LLM 요청/응답을 실은 채 `emitNodeEvent` 로 들어간다. 이 사실이 이 diff 가 고치는 취약점 클래스(이름 기반 vs 위치 기반 strip)와 정확히 같은 데이터(`llmCalls`)이므로 보안 리뷰 범위 안이다. 다행히 `stripExternalOnlyFields` 가 이름 기반·깊이 무관이라 이 경로도 실제로는 막고 있다(라이브 유출 아님) — 그러나 주석이 "현재는 불필요, 미래 대비용"이라고 명시해 두면, 다음 유지보수자가 "node 이벤트엔 llmCalls 가 없으니 이 strip 은 지워도 된다"고 오판해 삭제할 위험이 있다. 이 프로젝트가 반복 지적해 온 "문서한 보장이 구현보다 넓다" 패턴의 반대 방향 — 여기서는 **문서가 실제 위험을 과소평가**하고 있다.
  - 제안: 주석을 "node 이벤트(`NODE_COMPLETED`)는 단일 턴 AI Agent 등 일부 핸들러의 `meta.turnDebug[].llmCalls` 를 `output` 그대로 실어 나른다 — 이 strip 은 이미 활성 경로를 보호한다(방어심층화가 아니라 필수 방어)"는 취지로 정정한다. 회귀 테스트가 있다면(예: `NODE_COMPLETED` payload 에 `llmCalls` raw 값이 없음을 단언) 위치를 함께 남겨 이 사실이 재발견 없이 유지되게 한다.

## 확인했으나 문제 없음 (positive findings)

- **REST 스냅샷 fix 자체(`interaction.service.ts:349-355`)**: `stripExternalOnlyFields(deepRedactSecrets(nodeExec.outputData ?? {}), MAX_REDACT_DEPTH)` — `deepRedactSecrets` 가 먼저 값 마스킹 + `depth >= MAX_REDACT_DEPTH`(10) 에서 서브트리 전체를 문자열 `'***'` 로 붕괴시키므로, 그 결과물에서 실제 object 구조가 남는 최대 깊이는 9다. 이후 `stripExternalOnlyFields` 가 `maxDepth=10`(`depth > 10` 에서만 중단)으로 순회하므로 **strip 의 유효 범위가 redact 가 만든 잔여 구조보다 항상 넓다** — 경계 불일치로 인한 누락 없음(직접 재귀 규칙을 추적해 확인).
- **`execution.outputData`(terminal `result`/`error`, `interaction.service.ts:406-421`) 경로는 이번 diff 의 strip 대상이 아니지만, 대상일 필요도 없다** — 확인을 위해 `Execution.outputData` 의 실제 생성 경로(`execution-engine.service.ts` 의 `savedExecution.outputData = context.nodeOutputCache[lastNodeId]`, 여러 지점)를 추적했다. `nodeOutputCache` 는 항상 `toEngineFlatShape()`(`handler-output.adapter.ts:109-190`)를 거친 **flat 엔진 캐시**인데, 이 함수는 모든 분기에서 `NodeHandlerOutput.meta` 필드를 결과에 포함하지 않는다(구조적으로 드롭됨) — 그 결과 `meta.turnDebug.llmCalls` 는 애초에 `Execution.outputData` 에 도달하지 않는다. (대조: `NodeExecution.outputData` 는 `finalizeAiNode`(`ai-turn-orchestrator.service.ts:1449-1458`)가 `meta` 를 보존하는 `structuredOutputCache` 를 우선 사용해 저장하므로 별도 경로다 — 이번 diff 가 정확히 그 경로의 waiting 분기만 고쳤다.) 처음엔 "REST 종결 result/error 도 같은 클래스의 미수정 누출이 아닌가"를 의심해 코드를 끝까지 추적했으나, 실제 데이터 흐름상 반증됐다 — 이 판단은 근거(정확한 파일:라인)와 함께 여기 기록해 향후 같은 의심이 재조사 없이 반복되지 않게 한다.
- `strip-external-only-fields.ts` 의 `__proto__` 프로토타입 오염(CWE-1321) 방어(스프레드 `{...obj}` 로 own `__proto__` 를 이동시켜 상속 접근자를 가림 + `Object.defineProperty` 중복 방어)는 직전 세 라운드에서 발견·수정·뮤테이션 테스트로 검증 완료된 상태이며, 이번 diff 에서도 동일하게 유지되고 있음을 재확인했다 — 신규 결함 없음.
- `stripDeep`/`stripExternalOnlyFields` 깊이 상한(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`)과 경계 연산자(`>`)가 두 호출부(`websocket.service.ts`, `interaction.service.ts`) 및 각 자매 sanitizer 와 일관됨을 확인 — 리뷰어 간 결론이 갈렸던 이전 라운드의 경계 불일치(`11_02_16` CRITICAL 1)는 이미 해소된 채 유지.
- `EXTERNAL_STRIPPED_FIELDS` 는 export 된 이름 기반(위치 무관) 목록이라, 새 중첩 경로가 추가돼도 `llmCalls` 라는 이름을 쓰는 한 자동으로 보호된다 — 이번 결함(REST 스냅샷이라는 새 출구를 놓친 것)과 같은 클래스의 재발을 구조적으로 막는 설계.
- SQL/명령/경로 인젝션, XSS, 인증/인가 우회, 세션 관리와 관련된 코드 경로 변경 없음 — 순수 payload 정제 로직의 적용 범위 확장 + 테스트 추가.
- 신규/변경된 외부 의존성 없음. 에러 메시지에 민감 정보를 노출하는 신규 코드 없음.

## 요약

핵심 보안 수정(REST 스냅샷 `getStatus()` 의 `nodeOutput` 에도 fanout 과 동일한 이름 기반·깊이
무관 `llmCalls` strip 적용)은 정확하고 충분하다 — `deepRedactSecrets` 의 값 마스킹 깊이 상한과
strip 의 유효 순회 범위 사이에 누락이 없음을 재귀 규칙을 직접 추적해 확인했다. "REST 종결
result/error 경로도 같은 결함이 남아있는지" 를 의심해 `Execution.outputData` 생성 경로 전체를
추적했으나, `toEngineFlatShape` 가 구조적으로 `meta` 를 드롭하기 때문에 그 경로엔 애초에
`llmCalls` 가 도달하지 않는다는 것을 확인했다(반증, 문제 없음). 신규로 발견한 것은 코드 결함이
아니라 **문서-실제 괴리** 하나다 — `emitNodeEvent` 의 strip 을 "현재는 불필요한 방어심층화"라고
설명하는 주석이, 실제로는 단일 턴 AI Agent 의 `NODE_COMPLETED` payload 가 이미 `llmCalls` 를
싣고 있다는 사실과 어긋난다. 이 strip 자체는 살아서 그 경로를 막고 있으므로 현재 유출은 없지만,
주석의 위험 과소평가가 향후 "불필요한 코드"로 오인되어 제거될 위험을 남긴다. `__proto__` 오염
방어·깊이 경계 일관성 등 이전 라운드에서 지적된 항목은 모두 유지되고 있다. 하드코딩된 시크릿·
SQL/커맨드 인젝션·인증 우회 등 다른 OWASP Top 10 항목에서는 발견 없음.

## 위험도

LOW

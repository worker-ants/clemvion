# Cross-Spec 일관성 검토 — `spec/conventions/` (node-cancellation.md 중심)

> 참고: 이 검토에 전달된 프롬프트(`_prompts/cross_spec.md`)는 예산 초과로 target 디렉토리(`spec/conventions/`)
> 조차 일부만 전문 포함(`audit-actions.md`, `cafe24-api-catalog/` 일부)하고 나머지는 경로만 나열했다 —
> **핵심 target 문서인 `node-cancellation.md` 자체가 프롬프트에 전문 포함되지 않았다.** 관련 spec 본문도
> 116개 파일이 생략됐고 그중 `5-system/4-execution-engine.md`·`6-websocket-protocol.md`·`4-nodes/3-ai/1-ai-agent.md`
> 등 이 기능과 직접 관련된 문서가 다수 포함됐다. 이에 따라 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-signal-b4d1`)에서
> `node-cancellation.md`·`execution-context.md`·`node-output.md`·`error-codes.md`·`5-system/4-execution-engine.md`·
> `5-system/6-websocket-protocol.md`·`4-nodes/3-ai/1-ai-agent.md`·관련 plan(`plan/in-progress/node-cancellation-residual-signal-propagation.md`,
> `plan/complete/node-cancellation-infrastructure.md`)·관련 코드(`makeshop.handler.ts`, `makeshop-api.client.ts`,
> `cafe24.handler.ts`, `cafe24-api.client.ts`, `execution-engine.service.ts`)를 직접 Read/grep 해 아래 발견사항을 검증했다.

## 발견사항

### [CRITICAL] `node-cancellation.md §6` 구현 현황 표가 실제 코드·추적 plan 과 반대로 기술됨 (MakeShop / Cafe24 signal 전파)

- **target 위치**: `spec/conventions/node-cancellation.md` §6 "구현 현황 / 후속" 표 — `MakeShop 노드 signal 전파`, `Cafe24 노드 signal 전파` 행. 상단 주석 "2026-06-03 코드 대조로 갱신"도 이 시점에 멈춰 있다.
- **충돌 대상**:
  - 실제 코드: `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:247` (`signal: context.abortSignal`), `makeshop-api.client.ts:833-864`(§4 cascade 패턴), `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:260`, `cafe24-api.client.ts:1204-1235` — 둘 다 §4 cascade + AbortError rethrow(§5.1 가드)까지 이미 구현돼 있음.
  - 추적 plan: `plan/in-progress/node-cancellation-residual-signal-propagation.md` — "MakeShop 노드 signal 전파 (2026-07-25, ...) — 완료 [x]", "Cafe24 노드 signal 전파 (2026-07-25, ...) — 완료 [x]" 로 이미 체크됨.
- **상세**: `node-cancellation.md` §6 표는 두 행 모두 `— (미구현/Planned)` — "`makeshop-api.client.ts` 는 자체 timeout 용 `AbortController` 만 사용, `context.abortSignal` cascade(§4)·진입 직전 사전 체크(§2.2) 모두 없음" 이라고 명시하지만, 이는 사실이 아니다. 두 client 모두 §4 의 upstream/own-timeout cascade 패턴(`upstream.addEventListener('abort', ...)` + cleanup)을 그대로 구현했고, handler 는 `err.name === 'AbortError'` 를 그대로 re-throw 해 엔진이 §5.1 대로 `cancelled` 로 분류하도록 배선돼 있다. 즉 target 문서 자신의 SoT 표가 **이미 완료된 작업을 미구현으로 잘못 보고**하고 있으며, 그 표가 가리키는 추적 plan(`node-cancellation-residual-signal-propagation.md`) 조차 이미 완료로 체크돼 있어 target 문서와 자신이 참조하는 plan 이 서로 모순된다. 이 문서가 `pending_plans`/`status: partial` 판정의 근거(§6 미구현 항목 존재)로 쓰이므로(문서 내 명시: `status: partial` 이 "비어있지 않은 pending_plans" 가드에 의존), stale 한 §6 은 향후 spec-status-lifecycle 가드·spec-coverage 감사·다른 개발자에게 "아직 할 일"로 잘못 신호해 중복 작업이나 잘못된 완료율 집계를 유발할 수 있다.
- **제안**: §6 표의 두 행을 `✓`(구현됨)로 갱신하고 코드 근거(`makeshop.handler.ts` / `makeshop-api.client.ts`, `cafe24.handler.ts` / `cafe24-api.client.ts`)를 명시. 상단 "2026-06-03 코드 대조" 갱신 주석도 최신 날짜로 갱신. `pending_plans`/`status: partial` 유지 여부는 남은 항목(chat-channel 미구현, IE multi-turn resume 갭, workflow-timeout 노드 abort BLOCKED)만으로 재판단 — 이 셋만으로도 `partial` 유지는 타당하나 §6 본문 자체는 정정 필요.

### [WARNING] `error.code: 'AbortError'` 가 프로젝트 표준 `UPPER_SNAKE_CASE` 명명 규약과 어긋나며 `error-codes.md` 예외 레지스트리에 미등재

- **target 위치**: `spec/conventions/node-cancellation.md §5.1` (`output.error 는 표준 봉투(code: 'AbortError')로 기록`), 함께 `spec/5-system/6-websocket-protocol.md §4.1`(`execution.node.cancelled` 페이로드 `error: { code: 'AbortError', message }`) — 두 문서가 동일하게 이 값을 채택.
- **충돌 대상**: `spec/conventions/node-output.md §3.2`("`code` 는 `UPPER_SNAKE_CASE`"), `spec/conventions/error-codes.md §1`(의미 기반 명명 + UPPER_SNAKE_CASE 원칙) §3(historical-artifact 예외 레지스트리 — `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`, 초대 모듈 lowercase 코드군 등은 명시 등재돼 있으나 `AbortError` 는 등재되지 않음).
- **상세**: 실행 엔진의 다른 모든 엔진 레벨 `error.code` (`WORKER_HEARTBEAT_TIMEOUT`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `EXECUTION_QUEUE_WAIT_TIMEOUT`, `SERVER_INTERRUPTED`, `EXECUTION_ENQUEUE_FAILED`)는 모두 `UPPER_SNAKE_CASE` 를 따르는데, cancellation 경로만 JS 런타임의 raw `Error.name`(`'AbortError'`, PascalCase)을 그대로 `code` 값으로 채택했다. 코드 주석(`execution-engine.service.ts:5706-5708`)은 "node-output.md Principle 3.2 와 동형" 이라고만 적어 **shape**(={code,message}) 은 맞지만 **명명 표기**(UPPER_SNAKE_CASE)는 어긴다는 점은 인지되지 않은 채 이미 구현·테스트(`execution-engine.service.spec.ts:5397` 등)까지 굳어 있다. `error-codes.md` 는 "§1 을 따르지 않는 기존 코드는 §3 에 명시 등록" 하도록 강제하는데 `AbortError` 는 등록돼 있지 않다.
- **제안**: 다음 중 하나로 정합화 — (a) `error-codes.md §3` 에 `AbortError` 를 historical-artifact 예외로 등재하고 "왜 UPPER_SNAKE_CASE 를 안 따르는가"(예: `Error.name` 과의 1:1 판별 용이성, client 가 `error.name`/`error.code` 이중 확인 없이 판별) 근거를 남기거나, (b) 새 UPPER_SNAKE_CASE 코드(예: `NODE_CANCELLED`)를 신설해 `node-cancellation.md §5.1`·`6-websocket-protocol.md §4.1`·엔진 구현·테스트를 동시 갱신. 이미 구현·테스트가 붙어 있어 (b)는 breaking 성격이 있으므로 실무적으로는 (a) 가 저비용.

### [WARNING] `node-cancellation.md §5.1` 의 `meta.success = false` 주장이 실제 구현·같은 기능의 WS 페이로드 스펙과 불일치

- **target 위치**: `spec/conventions/node-cancellation.md §5.1` — "`output.error` 는 표준 봉투(`code: 'AbortError'`)로 기록하되 `meta.success = false`."
- **충돌 대상**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5698-5732`(AbortError catch 블록 — `nodeExecution.status`/`.error`/`.finishedAt`/`.durationMs` 만 설정, `meta`/`success` 필드는 어디에도 set 되지 않음), `spec/5-system/6-websocket-protocol.md §4.1`(`execution.node.cancelled` 페이로드 = `{ executionId, nodeId, nodeExecutionId, nodeLabel, error }` — `meta` 필드 자체가 없음).
- **상세**: `node-output.md Principle 2` 의 `meta` 는 노드가 정상 반환(`NodeHandlerOutput`)할 때의 실행 메트릭 채널이며, 표에 `meta.success` 는 **Code 노드 전용**으로만 정의돼 있다(범용 필드 아님). cancellation 경로는 핸들러가 **throw** 하는 예외 경로라 애초에 `NodeHandlerOutput` 자체가 생성되지 않고, 엔진이 `NodeExecution.error`(top-level 컬럼)만 직접 채운다 — 코드상 어디에도 `meta.success=false` 를 쓰는 지점이 없다. 같은 PR/기능의 자매 문서인 `6-websocket-protocol.md` 도 이 필드를 페이로드에 포함하지 않아, target 문서만 존재하지 않는 필드를 명시하는 형태로 다른 두 근거(코드, 인접 spec)와 어긋난다.
- **제안**: `meta.success = false` 문구를 삭제하거나(코드가 실제로 안 하는 일이므로), 만약 의도가 있었다면 엔진 구현에 `meta: { success: false }` 를 추가하고 `6-websocket-protocol.md §4.1` 페이로드 표에도 `meta` 필드를 동반 추가 — 어느 쪽이든 세 문서(코드/두 spec)가 같은 사실을 말하도록 동기화.

### [INFO] `4-nodes/3-ai/1-ai-agent.md §12.16` 이 이미 이동·완료된 plan(`node-cancellation-infrastructure`)을 여전히 가리킴

- **target 위치**: 없음(target 자체는 아니나 target 이 참조하는 인접 spec) — `spec/4-nodes/3-ai/1-ai-agent.md:1374`: "사용자 cancel signal 전파는 `node-cancellation-infrastructure` 후속으로 남지만".
- **충돌 대상**: `spec/conventions/node-cancellation.md` frontmatter `pending_plans: - plan/in-progress/node-cancellation-residual-signal-propagation.md`, 그리고 그 plan 자신의 서술("종전에는 `node-cancellation-infrastructure.md` 가 추적한다고 적혀 있었으나 그 plan 은 2026-06-28 에 완료·이동" — 즉 이 stale 포인터를 이미 알고 있고 자신을 후속으로 신설한 배경으로 서술).
- **상세**: `node-cancellation-infrastructure.md` 는 `plan/complete/` 로 이미 이동했고, IE multi-turn resume signal 갭의 실제 추적처는 `node-cancellation-residual-signal-propagation.md` 다. `ai-agent.md §12.16` 만 옛 이름을 그대로 남겨 두 문서 간 포인터가 어긋난다. 기능적 영향은 없으나(둘 다 존재하는 파일명은 아니고 하나는 `plan/complete/`, 링크는 상대 경로 미사용·텍스트 언급뿐이라 깨진 링크는 아님) 추적 일관성 관점에서 동기화 대상.
- **제안**: `ai-agent.md:1374` 의 `node-cancellation-infrastructure` 언급을 `node-cancellation-residual-signal-propagation` 으로 갱신.

## 요약

Cross-Spec 관점에서 `node-cancellation.md` 는 `execution-context.md`(ExecutionContext 필드 분류), `1-data-model.md`(NodeExecution/Execution 상태 enum·V069 migration), `5-system/4-execution-engine.md`(§1.2 cancelled 분류, §8 active-running 타임아웃과 노드 abort 미통합 상태), `5-system/6-websocket-protocol.md`(`execution.node.cancelled`/`execution.cancelled` 이벤트), `4-nodes/3-ai/1-ai-agent.md §12.16`(app-level timeout defense-in-depth) 등 대부분의 인접 영역과 **정확히 정합**하며, `POST /executions/:id/stop` 엔드포인트 계약도 `3-workflow-editor/3-execution.md`·`5-system/4-execution-engine.md`·`5-system/14-external-interaction-api.md` 전반에 걸쳐 일관되게 기술돼 있다. 다만 target 문서 자신의 §6 구현 현황 표가 같은 워크트리 안에서 **오늘(2026-07-25) 이미 완료된 MakeShop/Cafe24 signal 전파 작업을 미구현으로 잘못 보고**하고 있어 자기 자신이 가리키는 추적 plan 과 모순되는 CRITICAL 항목이 하나 있고, `error.code='AbortError'` 표기 및 `meta.success=false` 서술 두 곳은 프로젝트의 명명 규약(`error-codes.md`)·실제 구현/인접 WS 스펙과 미세하게 어긋나 정합화가 필요한 WARNING 이다. 전반적으로 구조적·설계적 충돌은 없으며, 발견된 문제는 모두 "문서 갱신 누락" 성격이라 수정 비용이 낮다.

## 위험도

MEDIUM

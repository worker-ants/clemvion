# Cross-Spec 일관성 검토 — `spec/conventions/` (impl-prep)

> **검토 범위에 대한 메모**: 프롬프트에 포함된 target 덤프는 컨텍스트 예산으로 256개 파일이 생략되어 있었다(`spec/conventions/cafe24-api-catalog/**` 대부분·makeshop 카탈로그·`node-cancellation.md` 자신 포함). 생략된 파일 중 이번 작업(`node-cancel-signal` worktree, `plan/in-progress/node-cancellation-residual-signal-propagation.md`)과 직접 관련된 `spec/conventions/node-cancellation.md`·`execution-context.md`는 파일시스템에서 직접 읽어 검토했다. 프롬프트에 실려 있던 `audit-actions.md`·`cafe24-api-catalog` 일부(application/category)는 상호 참조 대상(`5-system/1-auth.md §4.1`, `cafe24-restricted-scopes.md`)과 대조했으나 나머지 생략 파일 전수는 이번 검토 대상 밖이다.

## 발견사항

- **[CRITICAL]** Graceful shutdown 이 두 개의 경쟁하는 종결 메커니즘을 갖게 된다 — `abortSignal`(cancelled) vs `ShutdownStateService`(failed+SERVER_INTERRUPTED)
  - target 위치: `spec/conventions/node-cancellation.md` §1("WorkflowExecution graceful shutdown — 서버 종료 시 진행 중 노드의 외부 I/O 중단"), §2.3("향후 graceful shutdown — SIGTERM 수신 시 진행 중 execution 의 abort"), §5.1("`AbortError` 인 throw 는… `NodeExecution.status` 를 `failed` 가 아닌 `cancelled` 로 기록")
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §11 (Graceful Shutdown, point 4) · `spec/data-flow/3-execution.md` §3.3 표(`ShutdownStateService.onApplicationShutdown`) · 구현 `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts`(+ `.spec.ts` 로 이미 테스트 고정됨)
  - 상세: `node-cancellation.md` 는 graceful shutdown 을 `abortSignal` 인프라의 (아직 Planned 인) 소비처 중 하나로 명시하고, §5.1 은 "`AbortError` throw → `cancelled`" 를 **범용 분류 규칙**으로 못 박는다. 그러나 graceful shutdown 은 이미 **별도의, 이미 구현·단위테스트된** 메커니즘(`ShutdownStateService.registerInFlight`/`onApplicationShutdown`)을 갖고 있으며, 이 메커니즘은 `abortSignal`/`AbortController` 를 전혀 참조하지 않고(grep 0건 확인) SIGTERM 후 `SIGTERM_GRACE_MS`(기본 30초) 동안 **그저 대기**하다 미완료 노드를 `failed` + `error.code='SERVER_INTERRUPTED'` 로 atomic UPDATE 한다(§11 point 4, data-flow §3.3). 즉 SIGTERM 이라는 **동일 트리거**, NodeExecution/Execution 이라는 **동일 엔티티**에 대해 두 SoT 가 서로 다른 종결 상태(`cancelled` vs `failed`)를 규정하는 상태 전이 충돌이다. 이 gap 은 신규가 아니라 이미 완료된 `plan/complete/node-cancellation-infrastructure.md` 에서 "graceful shutdown (향후 통합 지점)" 으로만 적어두고 미해결로 남겼던 것이며, 지금 착수하려는 `node-cancellation-residual-signal-propagation.md` 의 "Workflow 단위 timeout / **graceful shutdown** 의 노드 abort 통합" 항목이 바로 이 지점을 건드린다.
  - 제안: 착수 전에 `project-planner` 가 다음 중 하나를 명시적으로 결정하고 두 문서를 동시 갱신해야 한다 — (a) graceful shutdown 트리거의 `AbortError` 는 §5.1 의 일반 규칙에서 **예외**로 취급해 `ShutdownStateService` 의 `failed`+`SERVER_INTERRUPTED` 를 그대로 우선시키거나(즉 `abortSignal` 은 in-flight I/O 를 빨리 끊는 최적화일 뿐 최종 분류는 바꾸지 않음), (b) graceful shutdown 도 `cancelled` 로 재분류하고 `SERVER_INTERRUPTED` 소비처(프론트/데이터모델 §1-data-model.md:473·`shutdown-state.service.spec.ts`)를 전부 동반 갱신. 어느 쪽이든 `node-cancellation.md` §5.2(errorPolicy 표)에 "graceful shutdown" 행을 추가해 §2.3 의 목록과 정합시켜야 한다.

- **[WARNING]** Workflow 단위 timeout(누적 active-running 한도) 이 노드 abort 로 연결될 때의 Execution 상태 귀결이 §5.2 에 없음
  - target 위치: `spec/conventions/node-cancellation.md` §2.3(3번째 생산자 "Workflow 단위 시간 한도") · §5.2(errorPolicy 표, `stop` 행이 "사용자 cancel → Execution cancelled / cancel-others-on-fail → Execution failed" 두 경우만 나열)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §8("`activeNow >= maxActiveRunningMs` → `EXECUTION_TIME_LIMIT_EXCEEDED` → **Execution.status = `failed`**" — PR2a 구현 완료)
  - 상세: §8 은 이미 "누적 시간 초과 → Execution `failed`" 를 구현·확정했다(단, 현재는 노드 경계 판정이라 abortSignal 을 타지 않는다). 잔여 plan 이 "진행 중 노드의 in-flight I/O abort 통합"을 추가하면, 그 abort 로 인한 NodeExecution 은 §5.1 규칙상 `cancelled` 가 되는데, §5.2 의 `errorPolicy==='stop'` 분기는 이 제3의 원인(workflow timeout)을 열거하지 않아 "그 abort 로 Execution 이 결국 `failed`(EXECUTION_TIME_LIMIT_EXCEEDED)로 마감된다"는 사실이 §5.2 만 보면 드러나지 않는다. (다행히 "NodeExecution cancelled + Execution failed" 조합 자체는 cancel-others-on-fail 케이스로 이미 선례가 있어 **아키텍처적으로는 무모순** — 이 항목은 CRITICAL 이 아니라 **문서 갱신 누락**에 가깝다.)
  - 제안: 노드 abort 통합 구현 시 §5.2 `stop` 행에 "Workflow timeout → Execution `failed`(`EXECUTION_TIME_LIMIT_EXCEEDED`, [execution-engine §8]) 으로 마감" 을 명시적으로 추가.

- **[INFO]** `ResumableMessageOptions.signal` 이 "현재 대개 undefined" 로 서술되어 있으나 코드상 유일한 호출부는 signal 을 아예 넘기지 않음
  - target 위치: `spec/conventions/node-cancellation.md` §2.1 표 (AI 노드 행, "`ResumableMessageOptions.signal`… 현재 대개 undefined")
  - 충돌 대상: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:596`(`handler.processMultiTurnMessage(message, resumeState, { source })` — `signal` 필드 자체가 없음)
  - 상세: "대개(mostly)" 라는 표현은 일부 경로는 값이 채워진다는 뉘앙스를 주지만, 실측상 `processMultiTurnMessage` 호출부는 이 한 곳뿐이고 여기서 `signal` 은 항상 부재한다. 사실관계 오차이며 다른 spec 영역과 직접 모순되진 않으나, 다음에 이 표현을 근거로 "일부는 이미 동작한다"고 오판할 수 있어 표기해 둔다.
  - 제안: "대개" → "현재는 항상"(또는 호출부가 늘어나면 재검토) 로 정정. 필수는 아님.

- **점검했으나 충돌 없음 (기록)**: `execution-context.md`(abortSignal 필드 분류) · `1-data-model.md` §2.14(NodeExecution.status enum) · `5-system/6-websocket-protocol.md` §4.1(`execution.node.cancelled` payload/생산자 목록) · `4-nodes/3-ai/1-ai-agent.md` §12.16(app-level timeout 범위: ai_agent 한정, text_classifier/IE 미적용) · `spec/conventions/chat-channel-adapter.md`(EIA `execution.cancelled` 레벨 이벤트, node-level abortSignal 과 별개 레이어) · `cafe24-api-metadata.md`/`makeshop-api-metadata.md`(현재 abort/timeout 관련 서술 전무 — 잔여 plan 이 신설해도 기존 서술과 충돌 없음) · `spec/conventions/audit-actions.md` ↔ `5-system/1-auth.md §4.1`(카탈로그/규약 분리 정합) — 전부 상호 참조가 정확하고 모순 없음.

## 요약

핵심 충돌은 하나다 — **graceful shutdown** 이 `node-cancellation.md` 의 `abortSignal` 인프라의 미래 소비처로 그려져 있지만, 실제로는 이미 구현·테스트된 별도 메커니즘(`ShutdownStateService` → `failed`+`SERVER_INTERRUPTED`)이 동일 트리거·동일 엔티티에 대해 다른 종결 상태를 규정하고 있다. 이는 지금 착수하려는 `node-cancellation-residual-signal-propagation.md` 의 작업 범위("Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합")에 직접 걸리므로, 착수 전 명시적 우선순위 결정이 필요하다. 부수적으로 workflow-timeout 쪽도 §5.2 표에 제3의 원인이 빠져 있어 문서 갱신이 필요하나 이쪽은 기존 "cancelled 노드 + failed Execution" 선례로 아키텍처상 무모순이라 WARNING 수준이다. 그 외 점검한 영역(ExecutionContext 필드 분류, NodeExecution enum, WS 이벤트, AI Agent 타임아웃 범위, 채널 어댑터, cafe24/makeshop 메타데이터, audit-actions)은 상호 참조가 정확하고 충돌이 없었다. 다만 컨텍스트 예산으로 생략된 256개 파일(주로 cafe24/makeshop API 카탈로그 엔티티 상세) 전수는 이번 검토에서 커버되지 않았음을 명시한다.

## 위험도
HIGH

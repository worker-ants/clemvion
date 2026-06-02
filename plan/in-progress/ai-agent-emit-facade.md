---
worktree: ai-agent-emit-facade-277556
started: 2026-06-02
owner: developer
parent: plan/complete/eia-distributed-seq-counter.md
---

# PR 2/3 — INFO-5/9: ai-agent TOOL_CALL emit facade 단일화

> PR #413 분산 seq counter `/ai-review`(08_12_43) INFO-5/9. ai-review backlog 3건 중 2번째.

## 배경

`ai-agent.handler.ts` 가 `TOOL_CALL_STARTED`/`TOOL_CALL_COMPLETED` 를 `WebsocketService.emitExecutionEvent`
**직접** 호출 — 엔진의 단일 emit sink 추상화(`ExecutionEventEmitter` facade, spec EIA §R10)를 우회.
나머지 노드 이벤트는 모두 facade(`emitExecution`/`emitNode`)를 경유하므로 일관성 불일치.

## 변경

`deps.websocketService` 는 ai-agent handler 만 사용 → `HandlerDependencies` 의 해당 필드를
`eventEmitter`(ExecutionEventEmitter)로 **교체**(dead field 없음). ExecutionEventEmitter 는 이미
execution-engine 모듈 provider 라 `NodeHandlerDependenciesProvider` 가 주입 가능.

- [x] `ai-agent.handler.ts`: 생성자 `websocketService?: WebsocketService` → `eventEmitter?: ExecutionEventEmitter`(inline import type), 2곳 `emitExecutionEvent` → `emitExecution`
- [x] `node-component.interface.ts` `HandlerDependencies`: `websocketService?` → `eventEmitter?`
- [x] `node-handler-dependencies.provider.ts`: 주입 `WebsocketService` → `ExecutionEventEmitter`, build 필드 교체
- [x] `ai-agent.component.ts`: `deps.websocketService` → `deps.eventEmitter`
- [x] `ai-agent.handler.spec.ts`: mock `emitExecutionEvent` → `emitExecution` rename (cleanup/thread spec 은 3rd arg 미전달/undefined 라 무영향)

## 검증

- [x] lint / unit(backend 5455) / build
- [x] e2e — PASS 140 (DI 배선 런타임 검증)
- [ ] /ai-review + PR

---
worktree: node-cancellation-engine-6bfcaa
started: 2026-06-03
owner: project-planner
---

# spec-draft: NodeExecution `cancelled` status (node-cancellation §2 + parallel-p2 §1)

> `node-cancellation-infrastructure.md §2` + `parallel-p2-followups.md §1` 의 공유 작업. 사용자 "CANCELLED enum" 명시 — 옵션 B(전용 status). 충돌하던 `spec-sync-audit` 머지(#440) 후 갱신된 main 위에서 재작업.

## 변경 (이미 worktree spec/ 에 적용 — 6파일)

1. **`spec/5-system/4-execution-engine.md §1.2`** — NodeExecution 다이어그램·표에 `cancelled` 추가 (abortSignal `AbortError` 분류, dispatch 사전 체크, `execution.node.cancelled` WS 발행). **Rationale §4 정합**: 기존 "cancelled 는 NodeExecution enum 에 없다 / 신설 안 택함" 문장을 번복 — cancelled enum 은 abortSignal 경로용으로 신설하되, rehydration 인프라 실패는 abort 가 아니므로 `failed` 유지(이분 정책 보존).
2. **`spec/1-data-model.md §2.14`** — NodeExecution status enum 에 `cancelled` 추가 + cross-link.
3. **`spec/conventions/node-cancellation.md §5`** — "후속 plan" → §5.1(NodeExecution `cancelled` 분류 + WS 이벤트) + §5.2(워크플로 흐름 errorPolicy + rehydration 제외 note). §6 구현현황 표에서 cancelled status·사전체크·WS 이벤트 ✓ 반영.
4. **`spec/data-flow/3-execution.md §3.2`** — Mermaid 에 `running --> cancelled` + `cancelled --> [*]`.
5. **`spec/5-system/6-websocket-protocol.md §4.4`** — `execution.node.cancelled` 이벤트 정의(2곳: 이벤트 표 + 외부 구독 매핑 표).
6. **`spec/3-workflow-editor/3-execution.md`** — WS 이벤트 목록에 `node.cancelled` + §10.6.1 서브탭에 `cancelled`(failed 동일 레이아웃).

## 설계 결정

- **옵션 B (전용 status)**: `NodeExecutionStatus.CANCELLED` + V069 migration. Execution 레벨 `cancelled` 선례와 정합. 취소·실패 의미·이력·운영 모니터링 구분.
- 기각: 옵션 A (`failed`+`AbortError` 재사용) — 이력/필터 구분 불가.
- **rehydration 실패 = `failed` 유지**: abortSignal 경로가 아닌 인프라 결함이므로 cancelled 아님 (Rationale §4).

## 구현 영향 (별 feat 커밋, developer — 같은 브랜치)

- `NodeExecutionStatus.CANCELLED` enum + V069 migration (`node_execution.status` CHECK 에 `cancelled`).
- 엔진 dispatch 직전 `context.abortSignal?.aborted` 사전 체크 → 즉시 cancelled.
- 엔진 catch: `error.name === 'AbortError'` → `NodeExecutionStatus.CANCELLED` + `execution.node.cancelled` WS emit.
- IE multi-turn `runTurnWithCollectionRetries` 에 abortSignal 전파 (`information-extractor.handler.ts:634` TODO).
- frontend: `execution.node.cancelled` 이벤트 핸들 (타임라인 terminal 처리, failed 와 유사).
- 통합 테스트 (cancel-others-on-fail → cancelled status).

## Rationale

cancelled 는 Execution 레벨에 이미 존재하는 어휘 — NodeExecution 으로 일관 확장. abort(취소)와 failure(실패)는 의미·이력·운영이 다르므로 status 로 구분. cancellation 메커니즘(abortSignal)·생산자(ParallelExecutor)·소비자(HTTP/AI/DB/Email)는 기존 구현 — 본 변경은 **결과 상태 분류 + UI surface(WS 이벤트)** 추가. rehydration 인프라 실패는 별 의미라 `failed` 로 분리 유지.

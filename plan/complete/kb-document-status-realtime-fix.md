# KB 문서 상태 자동 갱신 버그 fix

> 시작: 2026-05-11 — 원본 plan: `/Users/gehrig/.claude/plans/rag-kb-rippling-salamander.md`

## 배경

새 문서 업로드 후 백엔드 처리가 끝나도 frontend 목록은 새로고침 전까지 "처리중" 으로 남는 버그.

근본 원인 3가지가 동시 작용:
1. `WebsocketGateway.VALID_CHANNEL_PREFIXES` 에 `'kb:'` 없음 → subscribe 거부
2. `WebsocketService.emitExecutionEvent` 가 채널을 `execution:` 로 prefix → KB 이벤트가 `execution:kb:<docId>` 로 새고, frontend `kb:<docId>` subscribe 와 매칭 안 됨
3. `kb-documents` query 에 polling 없음 → WS 실패 시 fallback 부재

## 사용자 정책 (2026-05-11)

- WS 채널 권한 검증 (이전 리뷰 W6) **함께 적용**
- Polling fallback: **10s (진행 중) / 120s (완료)**

## 작업

- [x] Backend: WebsocketService.emitKbEvent / Gateway prefix + 권한 검증 / KnowledgeBaseService.verifyDocumentOwnership / EmbeddingService·GraphExtractionService emitEvent 갱신 + spec
- [x] Frontend: kb-documents refetchInterval 10s/120s + subscribe ack 로깅
- [x] 최종 lint·test·typecheck + 단일 commit (양쪽 짝맞춤이라야 동작)

## 영향 파일

- Backend: `websocket.service.ts`, `websocket.gateway.ts`, `websocket.module.ts`, `knowledge-base.service.ts`, `embedding.service.ts`, `graph-extraction.service.ts` + spec 3종
- Frontend: `(main)/knowledge-bases/[id]/page.tsx`, `lib/websocket/use-kb-events.ts`

## 후속 (범위 밖)

- WS 단일 `kb:<kbId>` 채널 구조 (이전 W13)
- LLMClient AbortSignal 전파 (이전 W3)

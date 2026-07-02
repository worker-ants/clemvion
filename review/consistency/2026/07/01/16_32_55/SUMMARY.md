# Consistency Check 통합 보고서 (impl-prep — M-7 타입 단언)

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — WARNING 3건(pending_plans stale 경로·유사 에러코드 혼용 위험·독립 버전 상수 혼동 위험), INFO 다수. Critical 없음.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 제안 |
|---|---------|------|-------------|------|
| W-1 | Plan Coherence + Convention | frontmatter `pending_plans` 에 완료 이동된 `plan/in-progress/spec-sync-execution-engine-gaps.md` 잔류 | `spec/5-system/4-execution-engine.md` frontmatter | 해당 항목 제거 (spec 변경 → **M-7 코드와 직교, planner/별건 처리**) |
| W-2 | Naming Collision | `EXECUTION_TIMEOUT`(Code 노드) vs `EXECUTION_TIME_LIMIT_EXCEEDED`(엔진 누적) 혼동 | `§8` / `3-error-handling §1.4` | 두 경로 독립 분기 유지, 통합 금지 |
| W-3 | Naming Collision | `CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION` 독립 버전 상수 혼동 | `§1.3` / `§7.5` | 각각 독립 선언, 공유 금지 |

## M-7 구현 invariant 체크리스트 (INFO에서 도출 — 반드시 반영)

- **I-1**: `NodeHandlerOutput.status` 를 `'waiting_for_input' | 'resumed' | 'ended' | 'requires_integration' | 'requires_playwright' | undefined` 유니온으로 좁히기 (spec 변경 불요).
- **I-5**: `_resumeCheckpoint`/`_retryState` 스키마 신설 시 **credential-strip allow-list** 정확히 준수 — 포함: `messages`/`turnCount`/`model`/`temperature`/`maxTokens`/`knowledgeBases`/`RAG`/`MCP`/`pendingFormToolCall`/`partialResult`/`collectionRetryCount`/`expiresAt`. **제외(credential)**: `llmConfigId`/`workspaceId`/`conditions` 등.
- **I-6 (§4.4)**: dispatch boundary 인터페이스 scope 를 "노드 config / resume-state 데이터 형태"로 한정. `WebsocketService`/`ExecutionEventEmitter` 감싸는 sink 추상화 신설 **금지**.
- **I-7**: raw config vs evaluated config 별개 타입(`Raw`/`Resolved` suffix)로 혼동 방지.
- **I-8**: `_resumeState`(in-memory only) vs `_resumeCheckpoint`(DB 영속) vs `_retryState`(DB+TTL) 라이프사이클 구분 — `stripControlFields()` 세 필드 규칙 각각 검증.
- **I-9**: `NodeTypeMetadata.kind`(정적) vs `executionMetadata.kind`(런타임) 별도 타입.
- **I-2**: `information_extractor` checkpoint allow-list(`partialResult`/`collectionRetryCount`) 타입은 `spec/4-nodes/3-ai/` IE 문서 대조 후 반영.

## 판정
M-7(behavior-preserving 타입 단언 정리)은 spec 변경 없이 착수 가능. WARNING 3건 중 W-1 은 pre-existing stale frontmatter(M-7 무관·별건), W-2/W-3 는 구현 시 통합 금지 주의사항. 위 체크리스트를 인터페이스/스키마 설계에 반영. → **진행**.

_(SUMMARY 는 main 이 workflow 반환 summary_markdown 을 idempotent persist — workflow terminal write=write_blocked.)_

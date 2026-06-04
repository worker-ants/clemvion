# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

매트릭스 19개 trigger 중 이번 변경셋에 매칭되는 trigger: 3개 (`node-schema-change`, `new-backend-ui-zod-value`, `run-debug-flow-change`). 누락 발견: 0건.

### 변경 파일 목록 (리뷰 대상)

1. `codebase/backend/migrations/V079__agent_memory_expires_at.sql` — 신규 마이그레이션
2. `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — TTL/dedup 로직 추가
3. `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` — `ttlDays`, `MemoryKind`, `ExtractedItem` 타입 추가
4. `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` — ttlDays 전달
5. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — watermark 증분 추출, `memoryTtlDays` 전달
6. `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` — **신규 필드 `memoryTtlDays` 추가**
7. `codebase/frontend/src/content/docs/02-nodes/ai.mdx` — KO docs 갱신
8. `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` — EN docs 갱신
9. `codebase/frontend/src/lib/i18n/backend-labels.ts` — LABEL_KO + HINT_KO 갱신
10. 테스트 파일 3건, plan 1건, spec 4건 (별도 분석 제외)

---

### Trigger 1: `node-schema-change` — `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`

**판정: 충족**

신규 필드 `memoryTtlDays` (`z.number().int().positive().optional()`, `ui.label: 'Memory TTL (days)'`, `ui.hint: '...'`, `ui.group: 'Memory'`) 추가.

- 동반 갱신 (a) — `codebase/frontend/src/content/docs/02-nodes/ai.mdx` FieldTable 에 `memoryTtlDays` 행 추가: **완료**
- 동반 갱신 (a) EN — `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` FieldTable 에 동일 행 추가: **완료**
- 동반 갱신 (b) — `dict/{ko,en}/<section>.ts`: 이 프로젝트에서 backend zod `ui.label/hint` 번역은 `backend-labels.ts` 경로를 사용하므로 dict 파일 갱신 불필요. 기존 memory 관련 필드(`memoryKey`, `memoryTopK`, `memoryThreshold`)도 동일하게 dict 없이 backend-labels.ts 경로 사용 중 — 일관성 확인됨.
- 동반 갱신 (c) — `codebase/frontend/src/lib/i18n/backend-labels.ts`: `LABEL_KO["Memory TTL (days)"] = "메모리 TTL(일)"` 및 `HINT_KO["Persistent memories expire after this many days. Empty = never expire."]` 추가: **완료**
- `GROUP_KO["Memory"]` — 기존 재사용 ("메모리" 이미 등록됨): **이상 없음**

---

### Trigger 2: `new-backend-ui-zod-value` — `ai-agent.schema.ts` 신규 ui.label/hint/group 값

**판정: 충족**

매트릭스 `new-backend-ui-zod-value` 행 target: "LABEL_KO / HINT_KO / GROUP_KO / ... 중 적절한 매핑에 동일 PR 안에서 한국어 등록".

- `LABEL_KO["Memory TTL (days)"]`: **등록 완료**
- `HINT_KO["Persistent memories expire after this many days. Empty = never expire."]`: **등록 완료**
- `GROUP_KO["Memory"]`: 기존에 "메모리" 로 등록돼 있어 신규 등록 불필요

---

### Trigger 3: `run-debug-flow-change` (semantic) — `ai-agent.handler.ts` 변경

**판정: 무관 판정**

`ai-agent.handler.ts` 의 변경은 `scheduleMemoryExtraction` 의 watermark 증분 로직 + `memoryTtlDays` 전달로, 이는 persistent 메모리 **추출 파이프라인** 내부 변경이다. 실행 엔진 흐름(run mode, debug 로깅, 실행 상태 전이) 자체를 바꾸지 않으므로 `codebase/frontend/src/content/docs/05-run-and-debug/` 갱신은 불필요하다.

---

## 요약

매트릭스 19개 trigger 중 glob/semantic 매칭된 trigger 3개를 검토했다. `node-schema-change` 및 `new-backend-ui-zod-value` 두 trigger 모두 동반 갱신이 누락 없이 완료됐다: `ai.mdx` + `ai.en.mdx` FieldTable 에 `memoryTtlDays` 항목이 추가됐고, `backend-labels.ts` 에 LABEL_KO/HINT_KO 한국어 번역이 등록됐다. dict/{ko,en}/ 파일 미갱신은 이 프로젝트 i18n 아키텍처(backend zod label → backend-labels.ts) 에 부합하는 정상 패턴이다. 누락 발견 0건.

## 위험도

NONE

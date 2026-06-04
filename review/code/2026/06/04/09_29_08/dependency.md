# 의존성(Dependency) 리뷰 결과

## 발견사항

### 발견사항 없음 — 신규 외부 패키지 추가 없음

이번 변경(AGM-08~11: 증분 추출, 의미 dedup, TTL, kind 분류)은 `package.json` 을 전혀 수정하지 않았다. 변경된 파일 목록(17개):

- `codebase/backend/migrations/V079__agent_memory_expires_at.sql`
- `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.processor.ts` / `.spec.ts`
- `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` / `.spec.ts`
- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` / `.memory.spec.ts` / `.schema.ts`
- `codebase/frontend/src/content/docs/02-nodes/ai.en.mdx` / `ai.mdx`
- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `plan/in-progress/ai-context-memory-followup-v2.md`
- `spec/5-system/17-agent-memory.md` / `_product-overview.md`

### 내부 의존성 — 점검 통과

- **[INFO]** `agent-memory-extraction.queue.ts` 가 `'../../../shared/conversation-thread/conversation-thread.types'` 에서 `ConversationTurn` 타입만 import — 기존 내부 타입 재사용, 신규 내부 의존 없음.
- **[INFO]** `agent-memory.service.ts` 의 Node.js 내장 `'crypto'` 모듈(`createHash`) 사용 — 표준 라이브러리 활용, 외부 패키지 불필요.
- **[INFO]** `cosineSimilarity` 함수를 직접 구현(`agent-memory.service.ts`). 기존 의존성(`pgvector`, `typeorm`, `@nestjs/bullmq`)으로 대체 불가한 in-process 계산이라 타당하다. 구현이 단순(dot product / norm)하고 테스트 커버됨.

### SQL 인젝션 위험 — 설계 수준 확인

- **[INFO]** `expiresAtSql` 문자열이 SQL 에 직접 interpolation 된다(`\`...${expiresAtSql ?? 'NULL'}\``). `ttlDays` 는 `resolveMemoryTtlDays` 에서 `Number.isFinite(n) && n > 0` + `Math.floor(n)` 으로 **정수 유효성 검증** 후 전달되므로 임의 문자열 주입 경로가 없다. 위험도: 없음. 다만 이 패턴은 향후 유지보수 시 주의가 필요하다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/persistent-enhance-32f236/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` 라인 342~344, 472, 502
  - 상세: `ttlDays` 가 노드 config → `resolveMemoryTtlDays`(정수 검증) → `saveMemories` 인자 → `expiresAtSql` 로 흐르는 경로가 정합하다. BullMQ job payload 를 통해 전달될 때도 processor 가 그대로 넘기고 service 에서 검증한다.

### 기존 의존성 활용 적합성

- **[INFO]** `pgvector` / `typeorm` / `@nestjs/bullmq` / `bullmq` — 기존 KB·RAG 인프라 재사용. 벡터 연산(cosine 검색)을 DB 레이어(`pgvector`)에서, 큐 처리를 `bullmq` 에서 수행하는 설계가 이 PR 에서도 일관되게 유지된다.
- **[INFO]** `zod` 스키마(`ai-agent.schema.ts`)에 `memoryTtlDays: z.number().int().positive().optional()` 추가 — 기존 zod 활용의 자연스러운 확장.

### 버전 고정 (기존 패키지)

- **[INFO]** 기존 의존성은 `^` (major 고정, minor/patch float). 이번 PR 에서 버전 변경 없음 — 기존 정책 유지.

## 요약

이번 변경은 신규 외부 패키지를 전혀 추가하지 않았다. 모든 신규 기능(cosineSimilarity 연산, TTL SQL 생성, kind 분류 파싱)이 Node.js 내장 모듈, 기존 pgvector/bullmq/zod 인프라, 순수 TypeScript 코드만으로 구현되었다. `expiresAtSql` SQL 인터폴레이션은 업스트림에서 정수 검증이 완료된 값만 흐르므로 실질적 SQL 인젝션 위험은 없다. 라이선스·취약점·번들 크기·내부 의존 관계 모두 이상 없음.

## 위험도

NONE

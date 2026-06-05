# 의존성(Dependency) 리뷰 결과

리뷰 일시: 2026-06-05
대상 변경: rag-rerank + agent-memory followup (spec 동기화, rerank 구현 완료 반영)

---

## 발견사항

### [INFO] 새 외부 패키지 추가 없음 — Cohere/TEI 클라이언트는 native fetch 로 직접 구현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/codebase/backend/src/modules/llm/rerank/clients/cohere-rerank.client.ts`, `tei-rerank.client.ts`
- 상세: `@cohere-ai/cohere-sdk` 등 공식 SDK 를 추가하지 않고, Node.js 22+ 내장 `fetch` + `AbortSignal.timeout()` 으로 Cohere v2 API 및 TEI `/rerank` 엔드포인트를 직접 호출한다. `codebase/backend/package.json` 에 신규 외부 의존성이 추가되지 않았음을 확인했다.
- 제안: 현재 접근이 의존성 최소화 측면에서 올바르다. 다만 `package.json` 에 `"engines": { "node": ">=22" }` 가 없어 `fetch`/`AbortSignal.timeout` 의 런타임 전제가 명시되지 않았다 — Dockerfile 에서 `node:24-alpine` 을 사용하므로 실용상 문제없으나, `engines` 필드로 하한을 명시하면 CI 차단이 가능해진다.

---

### [INFO] `undici` 의존성은 신규 추가 아님 — 기존 정의된 패키지 재사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/codebase/backend/package.json` L78
- 상세: `"undici": "^6.21.3"` 는 이번 변경 전에 이미 `package.json` 에 있던 항목이다. 새 rerank 클라이언트 코드는 `undici` 를 직접 import 하지 않고 Node 내장 `fetch` 만 사용하므로 번들 의존성 변화는 없다.
- 제안: 별도 조치 불요.

---

### [INFO] RerankConfigModule · AgentMemoryModule — 내부 모듈 간 의존 관계 정상
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-followup-864891/codebase/backend/src/app.module.ts` L49, L53, L245, L248
- 상세: `RerankConfigModule` 은 `TypeOrmModule.forFeature([RerankConfig])` 만 import 하며 신규 외부 패키지를 도입하지 않는다. `AgentMemoryModule` 은 `@nestjs/bullmq`, `typeorm`, `LlmService` 등 기존 NestJS 생태계 모듈만 사용한다. `KnowledgeBaseModule` → `RerankService` → `RerankClientFactory` → `TeiRerankClient` / `CohereRerankClient` 체인도 프로젝트 내부 모듈 경로만 참조한다.
- 제안: 별도 조치 불요.

---

### [INFO] spec 파일 변경은 코드 의존성 변화 없음 (review/consistency, spec/*.md)
- 위치: 파일 1~26 전체 (review/consistency/ + spec/ 하위 md 파일)
- 상세: 리뷰 대상 파일의 대부분이 `.md` spec 문서 및 consistency review 산출물이다. 이 파일들 자체는 런타임 의존성, 번들 크기, 라이선스에 영향을 미치지 않는다. `spec/1-data-model.md` 의 `V081`/`V082`/`V084` 마이그레이션 참조는 SQL 파일로 구현되었고(`codebase/backend/migrations/V081__rerank_config.sql` 등), 외부 라이브러리 없이 PostgreSQL 네이티브 DDL 만 사용한다.
- 제안: 별도 조치 불요.

---

### [INFO] `execution-run` BullMQ 큐 추가 — 기존 `bullmq` 패키지 재사용
- 위치: `spec/data-flow/0-overview.md`, `spec/data-flow/9-observability.md`
- 상세: spec 에 `execution-run` 큐가 정식 등록(13번째 큐)되었다. 구현은 `ExecutionRunProcessor` 로 기존 `@nestjs/bullmq` + `bullmq` 패키지를 재사용하며 신규 패키지가 없다.
- 제안: 별도 조치 불요.

---

## 요약

이번 변경에서 `package.json` 에 새로 추가된 외부 의존성은 없다. Cohere API 및 TEI rerank 엔드포인트 호출은 Node.js 22+/24 내장 `fetch` + `AbortSignal.timeout()` 로 구현했으며, 공식 SDK 도입 없이 HTTP 계층을 직접 랩핑한 방식이 의존성 최소화 원칙에 부합한다. 신규 NestJS 모듈(`RerankConfigModule`, `AgentMemoryModule`)은 프로젝트 기존 생태계(`@nestjs/bullmq`, `typeorm`, `@nestjs/common`) 안에서만 동작하고 버전 충돌·라이선스 이슈가 없다. Spec 문서 변경은 런타임 의존성에 영향이 없다. 유일한 잠재적 개선점은 `package.json` 에 `engines.node` 하한 명시가 없다는 것이나, Dockerfile 이 이미 `node:24-alpine` 을 고정하고 있어 실제 위험은 없다.

---

## 위험도

NONE

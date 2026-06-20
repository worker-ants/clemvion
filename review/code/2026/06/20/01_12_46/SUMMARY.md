# Code Review 통합 보고서

## 전체 위험도
**HIGH** — multi-turn AI Agent 에서 `embeddingModelConfigId` 가 `_resumeState` 에 영속되지 않아 turn 2+ recall 이 워크스페이스 기본 embedding config 로 폴백하는 기능 결함(spec §3 불변식 위반) 이 발견됨. 유저 가이드 MDX 구 필드명 잔존(WARNING), 테스트 인자 단언 누락(WARNING), 배포 전 확인 사항(WARNING) 포함.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `embeddingModelConfigId` 가 `multiTurnStateBase` 에 누락되어 multi-turn AI Agent 의 turn 2+ recall 이 워크스페이스 기본 embedding config 로 폴백함. `summaryModelConfigId`·`extractionModelConfigId` 는 영속되나 `embeddingModelConfigId` 만 빠짐. 회수·저장 embedding config 불일치 시 차원 불일치로 cosine 검색 실패 또는 400 에러 유발. spec §3 "회수·저장 동일 config" 불변식 위반 | `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` — `multiTurnStateBase` 구성부 (약 line 1987–2033) | `multiTurnStateBase` 에 `embeddingModelConfigId: config.embeddingModelConfigId as string \| undefined` 추가. turn 2+ `injectMemoryContext({ config: state })` 가 자동 전달 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/3-ai/1-ai-agent.md` §12.12 "후속 결정" 단락에 `chat-model-selector`, `embedding-model-selector`, "저장 형태는 모델명 문자열" 설명이 잔존. 코드는 이미 `chat-config-selector`/`embedding-config-selector`/`config.id` 로 구현됨. 코드가 옳고 spec 본문만 미갱신 | `spec/4-nodes/3-ai/1-ai-agent.md` §1295 "후속 결정" 단락 | 코드 유지 + spec 갱신. §1295 단락에 "(재번복됨 — §1297 참조)" 주석 추가. `project-planner` 위임 |
| 2 | 유저 가이드 동기화 | 노드 schema 3개 필드 rename(`embeddingModel`→`embeddingModelConfigId`, `summaryModel`→`summaryModelConfigId`, `extractionModel`→`extractionModelConfigId`)이 유저 가이드 MDX FieldTable 에 미반영. KO 6곳, EN 6곳에 구 필드명 및 구 동작 설명 잔존 | `codebase/frontend/src/content/docs/02-nodes/ai.mdx` (lines 53–55, 102, 264–265), `ai.en.mdx` (lines 42–44, 91, 253–254) | 두 MDX 파일의 AI Agent FieldTable 3행 + Information Extractor FieldTable 2행 및 산문 설명을 신 필드명·신 동작으로 갱신 |
| 3 | 테스팅 | `LlmService.resolveEmbedding` 신규 public 메서드에 단위 테스트 부재. null→undefined 변환, workspaceId 전달 정확성, 반환값 passthrough 미검증 | `codebase/backend/src/modules/llm/llm.service.ts` 신규 `resolveEmbedding` 메서드 / `llm.service.spec.ts` | `llm.service.spec.ts` 에 null/undefined/유효 id 각 케이스 단언 추가 |
| 4 | 테스팅 | `agent-memory.service.spec.ts` 에서 `resolveEmbedding` 호출 인자(`embeddingModelConfigId`, `workspaceId`) 단언 부재. `saveMemories`·`recall` 두 경로 모두 인자 미검증 | `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` | 정상 경로 케이스에 `expect(mockLlmService.resolveEmbedding).toHaveBeenCalledWith('emb-cfg-1', 'ws-1')` 추가 |
| 5 | 테스팅 | `ai-agent.memory.spec.ts` 에서 `summaryModelConfigId` 설정 시 `resolveConfig` 호출 인자 단언 누락. 결과(mock 반환값)만 검증하고 원인(인자) 미검증 | `codebase/backend/src/nodes/ai/ai-agent/ai-agent.memory.spec.ts` | `expect(mockLlmService.resolveConfig).toHaveBeenCalledWith('summary-cfg', expect.any(String))` 추가 |
| 6 | 부작용 | `EmbedConfigSource` export interface 파괴적 변경(`{ llmConfigId?, embeddingModel? }` → `{ embeddingModelConfigId? }`). diff 외부 미갱신 호출자가 있으면 silent 임베딩 폴백 발생 | `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `EmbedConfigSource` | `grep -r "EmbedConfigSource"` 로 diff 외부 사용처 전수 확인 |
| 7 | 부작용 | `AgentMemoryExtractionJob` BullMQ 큐 payload 필드 파괴적 rename. Redis 잔존 구 스키마 job dequeue 시 config id 필드 `undefined` 로 읽혀 폴백 처리 | `codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts` | 배포 직전 큐 drain 또는 in-flight job 0 확인 절차를 배포 노트에 명시 |
| 8 | 부작용 | `UiWidget` union·`WIDGET_REGISTRY` 에서 구 위젯 키(`chat-model-selector`, `embedding-model-selector`) 완전 제거. DB 저장 노드 설정에 구 widget 키 잔존 시 `UnsupportedWidget` 경로 | `codebase/frontend/src/lib/node-definitions/types.ts`, `widget-registry.ts` | DB `node_configs` / 워크플로 정의 JSON 에 구 widget 키 저장 레코드 없음을 배포 전 확인 |
| 9 | 요구사항 | multi-turn resume 시 `summaryModelConfigId` 가 `config: state` 와 명시 파라미터 두 경로로 중복 전달. 동작 오류는 아니나 코드 의도를 흐림 | `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` line 2348–2369 | `injectMemoryContext` 내부에서 config 에서 도출하도록 통일하거나 명시 파라미터 제거 |
| 10 | 문서화 | `node-component.interface.ts` 위젯 열거 주석에 구 위젯 삭제 사실 및 마이그레이션 경로 안내 부재 | `codebase/backend/src/nodes/core/node-component.interface.ts` | 주석 또는 위젯 레지스트리에 구 키 삭제 사실 + 마이그레이션 경로 한 줄 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 큐 payload `extractionModelConfigId`/`embeddingModelConfigId` 역직렬화 후 resolver 에서 `workspaceId` 소유권 검증 여부 미확인. resolver 가 workspaceId 범위 내에서만 조회하면 무해 | `agent-memory-extraction.processor.ts` L344–346 | `resolveConfig`/`resolveEmbedding` 내 workspaceId 필터 명시적 확인 |
| 2 | 보안 | 프론트엔드 테스트 픽스처 `apiKey: "***"` — 실 시크릿 아님. 백엔드 DTO 직렬화 경로에서 apiKey 마스킹 여부 별도 확인 권장 | `config-selector-widgets.test.tsx` | 백엔드 ModelConfig DTO 에서 apiKey 마스킹 여부 보안 리뷰 |
| 3 | 아키텍처 | `LlmService.resolveEmbedding` thin passthrough 추가. LlmService 가 ModelConfigService 기능 재노출 파사드 겸하게 됨. 현재 범위에서는 수용 가능 | `codebase/backend/src/modules/llm/llm.service.ts` | 임베딩 관련 기능 확장 시 별도 EmbeddingService 분리 재검토 |
| 4 | 아키텍처 | `resolveConfig(extractionModelConfigId \|\| llmConfigId \|\| undefined)` OR 폴백 패턴 — 가독성 낮음 | `agent-memory-extraction.processor.ts` +344–348 | 명시적 변수 `effectiveConfigId` 분리 권장 |
| 5 | 아키텍처 | 노드 config `as string \| undefined` 타입 단언 다수 파일 산재 — Zod infer 타입 propagation 기술 부채 | `ai-agent.handler.ts`, `information-extractor.handler.ts`, `agent-memory-injection.ts` | 노드 config 스키마에서 Zod infer 타입을 핸들러까지 전파 (기술 부채 등록) |
| 6 | 테스팅 | `EmbeddingConfigSelectorWidget` 에 stale 경고, 빈 목록 힌트, onChange 케이스 테스트 부재 | `config-selector-widgets.test.tsx` | 엣지 케이스 3건 추가 |
| 7 | 테스팅 | `WIDGET_REGISTRY` 의 `chat-config-selector`/`embedding-config-selector` 매핑 smoke 테스트 부재 | `widget-registry.ts` | widget-registry 또는 schema-form 테스트에 신규 widget 타입 렌더 smoke 1건 추가 |
| 8 | 테스팅 | `backend-labels.ts` HINT_KO 번역 파이프라인 검증 단절 — 신규 테스트가 `translateBackendHint` stub 처리 | `config-selector-widgets.test.tsx` | locale='ko' + 실제 `translateBackendHint` 사용 hint 번역 케이스 1건 추가 |
| 9 | 테스팅 | `resolveEmbedding` `NotFoundException` 전파 경로 미검증 (`saveMemories`/`recall` 에서 throw 시 동작) | `agent-memory.service.spec.ts` | resolveEmbedding reject 시 동작 케이스 추가 |
| 10 | 부작용 | `summaryModelConfigId` 설정된 모든 요약 콜에서 추가 `resolveConfig` DB lookup 발생 (신규 분기) | `ai-agent.handler.ts` — `injectMemoryContext` line 529–535 | 성능 민감 시 session-scope 메모이제이션 고려 (현 규모에서 허용 범위) |
| 11 | 부작용 | i18n `modelSelector.*` → `configSelector.*` rename — soft-typed 접근자가 있으면 구 키 런타임 fallback 가능 | `nodeConfigs.ts` (en/ko) | i18n 강타입 `Dict` 이면 컴파일 에러로 검출. soft-typed 접근자 grep 확인 |
| 12 | 부작용 | `DEFAULT_EMBEDDING_MODEL` 하드코딩 폴백 제거 → 워크스페이스 embedding config 없을 시 `resolveEmbedding` throw 또는 null 반환 (동작 변경, 명세 의도에 부합) | `agent-memory.service.ts` | `resolveEmbedding` 이 null 반환 vs throw 중 어느 쪽인지 확인해 호출부 에러 처리 점검 |
| 13 | 요구사항 | `ChatConfigSelectorWidget` — 로딩 중 `<select>` 가 빈 옵션만 노출, disabled/placeholder 없어 UX 불분명 | `config-selector-widgets.tsx` — `ConfigSelectorShell` | 차단 아님. UX 개선 후속 과제 |
| 14 | 요구사항 | `EmbeddingConfigSelectorWidget` — `dimension=0` falsy 처리로 차원 표시 미노출 (실제 dimension=0 없으므로 영향 없음) | `config-selector-widgets.tsx` line ~1928 | `!= null` 또는 `> 0` 조건으로 의도 명확화 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | multi-turn `embeddingModelConfigId` `_resumeState` 미영속 → recall 차원 불일치 (CRITICAL 1건, WARNING 2건) |
| side_effect | MEDIUM | EmbedConfigSource 파괴적 변경, BullMQ 구 스키마 잔존, 위젯 레지스트리 구 키 제거 (WARNING 4건, INFO 3건) |
| testing | MEDIUM | LlmService.resolveEmbedding 단위 테스트 부재, 인자 단언 누락 2건 (WARNING 3건, INFO 4건) |
| security | LOW | 큐 payload workspaceId 소유권 검증 미확인 (모두 INFO) |
| architecture | LOW | 타입 단언 산재 기술 부채, passthrough 파사드 확장 위험 (모두 INFO) |
| documentation | LOW | node-component.interface.ts 마이그레이션 안내 부재 (WARNING 1건) |
| user_guide_sync | WARNING | ai.mdx / ai.en.mdx FieldTable 구 필드명 6곳씩 잔존 (WARNING 1건) |
| api_contract | NONE | 외부 HTTP API 변경 없음 |
| performance | 재시도 필요 | output_file 부재 (fatal) |
| scope | 재시도 필요 | output_file 부재 (fatal) |
| maintainability | 재시도 필요 | output_file 부재 (fatal) |

---

## 발견 없는 에이전트

- **api_contract**: 외부 HTTP REST API 변경 없음 — 해당 없음

---

## 권장 조치사항

1. **[즉시 필수]** `ai-agent.handler.ts` `multiTurnStateBase` 에 `embeddingModelConfigId` 추가 — spec §3 불변식 회복, 차원 불일치 오류 방지
2. **[배포 전 필수]** BullMQ 큐 drain 또는 in-flight job 0 확인 후 롤아웃; DB `node_configs` 구 widget 키 잔존 여부 확인
3. **[테스트 보강]** `llm.service.spec.ts` `resolveEmbedding` 단위 테스트 추가; `agent-memory.service.spec.ts` 호출 인자 단언 추가; `ai-agent.memory.spec.ts` summary `resolveConfig` 인자 단언 추가
4. **[유저 가이드 갱신]** `ai.mdx` / `ai.en.mdx` FieldTable 3+2 행 신 필드명·신 설명으로 갱신
5. **[SPEC-DRIFT 처리]** `spec/4-nodes/3-ai/1-ai-agent.md` §1295 단락에 "(재번복됨 — §1297 참조)" 주석 추가 — `project-planner` 위임
6. **[부작용 확인]** `grep -r "EmbedConfigSource"` 로 diff 외부 사용처 전수 확인
7. **[문서]** `node-component.interface.ts` 주석에 구 위젯 삭제 + 마이그레이션 경로 한 줄 추가
8. **[기술 부채]** 노드 config `as string | undefined` 타입 단언 → Zod infer 타입 propagation 계획 수립

---

## 라우터 결정

라우터 실행됨 (`routing_status=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract`, `user_guide_sync`
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외** (3명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |

- **재시도 필요** (fatal — output_file 부재): `performance`, `scope`, `maintainability` (3명)
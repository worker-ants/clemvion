# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — BullMQ in-flight job 역직렬화 불일치(임베딩 차원 불변식 위반 가능)·위젯 레지스트리 구 키 제거 등 배포 전 운영 확인이 필요한 WARNING 이 존재하나, 코드 로직 자체는 안전하고 "PR #642 직후 기존 데이터 ~0" 조건이 충족되면 실질 위험은 LOW 수준임.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §6.1 단계 1.5·2.7 본문에 구 필드명(`summaryModel`/`extractionModel`) 잔존 — 코드 구현은 신 필드명 기준으로 옳음 | `spec/4-nodes/3-ai/1-ai-agent.md` line 364, 368 | spec §6.1 해당 단락 내 필드명을 `summaryModelConfigId`/`extractionModelConfigId` 로 갱신, 폴백 체인 설명도 동기화. `project-planner` 위임 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] spec §12.12 "현 결정" 단락이 구 필드명(`summaryModel`/`extractionModel`)으로 기술돼 이력 혼동 가능 — "재번복 결정" 단락이 현행 설계를 덮지만 "현 결정" 자체에 이력 보존 표시 없음 | `spec/4-nodes/3-ai/1-ai-agent.md` line 1293 | "현 결정" 단락에 이력 보존 주석("이 결정의 `summaryModel`/`extractionModel`은 이후 재번복됨 — 이력 목적 보존") 추가. `project-planner` 위임 |
| 3 | 부작용(Side Effect) / API 계약 | BullMQ `AgentMemoryExtractionJob` 페이로드 필드 rename — 배포 시 in-flight job 을 신 processor 가 읽으면 `extractionModelConfigId`/`embeddingModelConfigId` 가 `undefined` 로 처리돼 워크스페이스 기본 embedding config 로 silent 폴백, spec §3 임베딩 차원 불변식 위반 가능 | `agent-memory-extraction.queue.ts`, `agent-memory-extraction.processor.ts` | 배포 전 큐 drain(in-flight 0 확인) 또는 processor 에 구 필드 fallback alias(`extractionModelConfigId ?? (job.data as any).extractionModel`) 추가 |
| 4 | 부작용(Side Effect) | 위젯 레지스트리 구 키(`chat-model-selector`/`embedding-model-selector`) 제거 — DB 저장 노드 config 에 구 키 잔존 시 해당 필드가 `UnsupportedWidget` 폴백으로 렌더, 사용자에게 미표시 | `widget-registry.ts`, `types.ts`, `node-component.interface.ts` | 배포 전 `node_configs` 테이블에서 구 위젯 키 레코드 0건 확인 |
| 5 | 아키텍처 | `AiAgentHandler.injectMemoryContext` 내 `summaryModelConfigId` resolve 로직이 인라인으로 포함돼 단일 책임 원칙 희박 — extraction 경로(processor 처리)와 비대칭 | `ai-agent.handler.ts` line 648–656 | summary config resolve 를 별도 private 메서드(`resolveSummaryConfig`)로 추출하거나, 중기적으로 빌드 로직을 `buildSummaryBufferUpdate` 호출부로 이동 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `as string | undefined` 타입 단언 반복 — 런타임 타입 검증 없이 강제 단언, 즉각 보안 위협은 아니나 기술부채 | `ai-agent.handler.ts`, `agent-memory-injection.ts` | `z.infer<typeof aiAgentNodeConfigSchema>` 로 타입 도출해 단언 전량 제거; 단기적으로 `pickMemoryConfigIds(config)` 헬퍼로 수렴 |
| 2 | 보안 | `extractionModelConfigId \|\| llmConfigId \|\| undefined` falsy 폴백 체인 — 빈 문자열 처리 근거가 코드 수준에서 불명확 (미래 `??` 교체 시 오동작 위험) | `agent-memory-extraction.processor.ts` line ~372 | `// NOTE: 빈 문자열("")은 "노드 config 상속" 의미 — ?? 대신 \|\| 의도적` 인라인 주석 추가 |
| 3 | 보안 | `DEFAULT_EMBEDDING_MODEL` 하드코딩 폴백 제거 후 embedding config 미등록 시 `NotFoundException` 상승 — recall 은 graceful, saveMemories 는 BullMQ job 실패로 처리됨, 의도된 동작 강화 | `agent-memory.service.ts` | 운영 문서 또는 에러 메시지에 "workspace embedding config 필수" 안내 추가 |
| 4 | 보안 | BullMQ 큐 payload 에 내부 config ID 포함 — 기존과 동일 패턴, 신규 위협 아님 | `agent-memory-extraction.queue.ts` | Redis 네트워크 레벨 접근 제어 상태 확인 |
| 5 | 성능 | `resolveEmbedding` 가 recall·saveMemories 경로에서 각각 독립 DB 조회 — PK 단건 조회, 턴당 1~2회, 실질 성능 퇴보 없음 | `agent-memory.service.ts` | request-scoped 메모이제이션 또는 TTL 캐시 추가 가능; 현재 빈도 기준 우선순위 낮음 |
| 6 | 성능 | `summaryModelConfigId` 분기에서 매 임계치 도달 시 `resolveConfig` 호출 — 멀티턴 고부하 환경에서 누적 레이턴시 가능 | `ai-agent.handler.ts` `injectMemoryContext` | session-scope 메모이제이션 고려; 현재 비차단 |
| 7 | 성능 | `ConfigSelectorShell.isStale` 계산 `useMemo` 없음 — O(n) 선형 탐색, 통상 수십 건 규모라 실질 부담 없음 | `config-selector-widgets.tsx` line ~1514 | `useMemo` 로 메모이제이션 |
| 8 | 요구사항 | `EmbeddingConfigSelectorWidget` 전용 stale/no-config/onChange 테스트 케이스 부재 — `ConfigSelectorShell` 공유 로직으로 간접 커버됨 | `config-selector-widgets.test.tsx` | embedding 위젯 전용 stale·빈 목록·onChange 3건 추가 |
| 9 | 요구사항 | `resolveEmbedding` reject 시 `saveMemories`(throw) / `recall`(graceful) 경계 동작 미검증 | `agent-memory.service.spec.ts` | `mockRejectedValueOnce(new NotFoundException(...))` 후 두 경계 케이스 추가 |
| 10 | 유지보수성 | `summaryModelConfigId` 이중 전달 경로 — `config:state` + 명시 param 혼재, `embeddingModelConfigId`/`extractionModelConfigId` 는 `config` 경유 단일 전달과 비일관 | `ai-agent.handler.ts` resume 경로 | 후속 plan 에서 summary 도 `config` 경유 통일 |
| 11 | 유지보수성 | `staleTime: 30_000` 매직 넘버 중복 — 두 위젯이 각자 보유, 다음 위젯 추가 시 값 불일치 위험 | `config-selector-widgets.tsx` | `const MODEL_CONFIG_STALE_TIME_MS = 30_000` 상수 공유 |
| 12 | 유지보수성 | `BuildAgentMemorySchemaFieldsOptions.orders` 의 `summaryModelOrder` 키가 구 필드명 패턴 — 동일 파일 내 `embeddingModelConfigId`/`extractionModelConfigId` 키와 불일치 | `agent-memory-schema.ts` | 향후 breaking change 시 `summaryModelConfigIdOrder` 로 통일 |
| 13 | 문서화 | 구 hint 영문 키 3건의 codebase 잔존 grep 검증 누락 | `backend-labels.ts` | `Optional low-cost model for the rolling-summary…` 등 3건 grep 검증 |
| 14 | 문서화 | `ConfigSelectorShell` 에 JSDoc 없음 — 11개 props 의 `renderOption`·`testIdPrefix`·`isStale` 목적 설명 필요 | `config-selector-widgets.tsx` | 함수 직전 한글 주석을 `/** ... */` JSDoc 형식으로 전환 |
| 15 | 문서화 | `ai.en.mdx` 영문 문서의 `summaryModelConfigId`/`extractionModelConfigId` 행 갱신 여부 prompt 잘림으로 미검증 | `ai.en.mdx` | AI Agent 및 IE FieldTable 내 신 필드명 행 수동 확인 |
| 16 | 문서화 | plan 마이그레이션 섹션에 BullMQ drain·DB 확인 등 배포 전 필수 운영 절차 미명시 | `plan/in-progress/agent-memory-model-config.md` | "배포 전: BullMQ agent-memory-extraction 큐 drain + node_configs 구 위젯 키 레코드 0건 확인" 한 줄 추가 |
| 17 | 아키텍처 | `LlmService.resolveEmbedding` passthrough — kind 종류 증가 시 passthrough 메서드 누적 가능 | `llm.service.ts` | 현재 규모 무방; kind 증가 시 resolver 분리 또는 caller 직접 주입 재검토 |
| 18 | 아키텍처 | `AgentMemoryExtractionJob` rename 에 따른 rolling deploy 시 payload 버전 미분리 | `agent-memory-extraction.queue.ts` | 현 규모 수용 가능; 향후 payload 에 `version` 필드 도입 또는 큐 이름 분리 고려 |
| 19 | API 계약 | `EmbedConfigSource` export 인터페이스 파괴적 변경 — 내부 사용처만으로 격리 확인됨, 추가 조치 불필요 | `agent-memory.service.ts` | `/** @internal */` 표기로 재발 방지 |
| 20 | 부작용 | `summaryModelConfigId` resume 경로 이중 전달(`config:state` + 명시 param) — 동작 오류 없음, DEFER 판정 | `ai-agent.handler.ts` line 2356, 2373 | 후속 리팩터에서 summary 도 `config` 경유 통일 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 타입 단언 반복, falsy 폴백 체인 주석 부재 — 즉각 위협 없음 |
| performance | NONE | resolveEmbedding 중복 DB 조회·summaryModelConfigId 반복 resolve — 턴당 1~2회 수준, 실질 영향 없음 |
| architecture | LOW | injectMemoryContext 내 summaryModelConfigId resolve 인라인(WARNING); 전반 SOLID 준수 양호 |
| requirement | LOW | SPEC-DRIFT 2건(spec §6.1·§12.12 구 필드명 잔존 — 코드 옳음); 기능 완전성 높음 |
| scope | — | 파일 미존재(output_file 없음) — 결과 확인 불가 |
| side_effect | MEDIUM | BullMQ in-flight 역직렬화 불일치·위젯 구 키 제거 하위호환 단절 — 배포 전 운영 확인 필수 |
| maintainability | LOW | 타입 단언·`||` 주석·staleTime 상수·summaryModelOrder 명명 불일치 — 기술부채, 기능 결함 아님 |
| testing | — | 파일 미존재(output_file 없음) — 결과 확인 불가 |
| documentation | LOW | 구 hint grep 미검증, ai.en.mdx 미확인, plan 배포 노트 미명시 — 모두 INFO |
| api_contract | LOW | BullMQ payload rename(WARNING)·노드 config 스키마 rename(WARNING) — 기존 데이터 ~0 전제 |

---

## 발견 없는 에이전트

없음 (모든 실행 에이전트에서 발견사항 존재).

---

## 권장 조치사항

1. **[배포 전 즉시] BullMQ 큐 drain 확인** — `agent-memory-extraction` 큐의 in-flight job 이 0건인지 배포 직전 확인. 불가 시 processor 에 구 필드 fallback alias 추가 후 배포.
2. **[배포 전 즉시] DB 구 위젯 키 레코드 확인** — `node_configs` 테이블에서 `widget: 'chat-model-selector'` / `widget: 'embedding-model-selector'` 잔존 레코드 0건 확인.
3. **[spec 갱신 — project-planner 위임] SPEC-DRIFT 2건 해소** — `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.5·2.7 본문 구 필드명 갱신 및 §12.12 "현 결정" 단락에 이력 보존 주석 추가.
4. **[단기 코드 개선] `||` 연산자 의도 주석 추가** — `agent-memory-extraction.processor.ts` falsy 폴백 라인에 빈 문자열 의미 명시.
5. **[단기 코드 개선] `injectMemoryContext` 내 `summaryModelConfigId` resolve 분리** — 별도 private 메서드(`resolveSummaryConfig`)로 추출해 단일 책임 원칙 준수.
6. **[후속 테스트 보완]** `EmbeddingConfigSelectorWidget` 전용 stale/no-config/onChange 케이스 및 `resolveEmbedding` NotFoundException 전파 경계 케이스 추가.
7. **[후속 문서 확인]** `ai.en.mdx` 신 필드명 행 갱신 여부 수동 확인 및 구 hint 키 grep 검증.
8. **[중기] 타입 단언 제거** — `config` 타입을 `z.infer<>` 로 좁혀 `as string | undefined` 반복 단언 전량 제거.
9. **[중기] `staleTime` 상수 추출** — `MODEL_CONFIG_STALE_TIME_MS = 30_000` 공유 상수로 매직 넘버 중복 제거.

---

## 라우터 결정

라우터가 선별하여 실행 및 제외함.

**실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `api_contract` (10명)

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

**제외**: (4명)

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| user_guide_sync | 라우터 제외 |

**비고**: `scope`, `testing` 은 실행(status=success)으로 보고됐으나 output_file 이 존재하지 않아 내용 확인 불가 — 해당 reviewer 결과는 본 보고서에 미반영.
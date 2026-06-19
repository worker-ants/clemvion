# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 배포 시 BullMQ in-flight job 역직렬화 오류 및 DB 저장 노드 설정 하위호환성 단절 위험이 존재. Critical 발견 없음. Warning 5건은 모두 배포 절차 및 코드 품질 관련이며 즉시 기능 오류를 유발하지는 않으나 배포 전 확인이 필요함.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 / API 계약 | BullMQ `AgentMemoryExtractionJob` payload 필드 rename(`extractionModel`→`extractionModelConfigId`, `embeddingModel`→`embeddingModelConfigId`) — in-flight job이 신 processor에서 config id 필드를 undefined로 읽어 폴백, 차원 불일치(spec §3 불변식 위반) 가능 | `agent-memory-extraction.queue.ts`, `agent-memory-extraction.processor.ts` | 배포 전 큐 드레인 또는 processor에 구 필드명 fallback 읽기 추가(`extractionModelConfigId ?? (job.data as any).extractionModel`) |
| 2 | 부작용 | `EmbedConfigSource` export 인터페이스 파괴적 변경 — diff 外 파일에 구 필드(`llmConfigId`, `embeddingModel`) 참조 잔존 시 silent degradation(워크스페이스 기본 폴백) | `agent-memory.service.ts` — `EmbedConfigSource` export interface | 배포 전 `grep -rn "EmbedConfigSource" codebase/backend/src` 실행해 diff 外 import 0건 검증, 또는 export 제거 고려 |
| 3 | 부작용 | 위젯 레지스트리에서 구 위젯 키(`chat-model-selector`, `embedding-model-selector`) 완전 제거 — DB 저장 노드 설정의 하위호환성 단절, 구 키 저장 레코드 있으면 UnsupportedWidget 폴백 | `node-definitions/types.ts`, `widget-registry.ts` | 배포 전 `node_configs` 테이블에서 구 위젯 키 잔존 레코드 쿼리 확인 또는 마이그레이션 스크립트 준비 |
| 4 | 유지보수성 | `extractionModelConfigId || llmConfigId || undefined` 폴백 체인 — `||`가 빈 문자열을 falsy 처리하여 의도와 다른 폴백 발생 가능 | `agent-memory-extraction.processor.ts` | `??` 연산자로 교체하거나 명시적 if 블록 사용 |
| 5 | 부작용 / i18n | i18n dict `modelSelector` → `configSelector` rename — diff 外 잔존 구 키 참조 시 빈 문자열 노출 가능 | `dict/en/nodeConfigs.ts`, `dict/ko/nodeConfigs.ts` | `grep -rn "modelSelector" codebase/frontend/src`로 잔존 참조 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `as string | undefined` 타입 단언 반복 — 런타임 타입 안전성 우회, 직접적 보안 취약점은 아님 | `ai-agent.handler.ts`, `agent-memory-injection.ts` 등 | 후속에서 `z.infer<typeof schema>`로 타입화해 단언 전량 제거 |
| 2 | 아키텍처 | `LlmService.resolveEmbedding` thin passthrough — 의도된 파사드 레이어, 향후 embedding 특화 로직 확장 지점으로 적절 | `llm.service.ts` | 현 상태 유지. 추후 `ModelConfigService` 비대화 시 `EmbeddingConfigService` 분리 검토 |
| 3 | 아키텍처 | `AgentMemoryExtractionProcessor` 내 추출 config 해석 이중 조건 분기 — `resolveConfig` 결과와 `resolvedExtractionModel` 분기가 별개 조건으로 동작 | `agent-memory-extraction.processor.ts` | 폴백 체인 전체를 단일 함수(`resolveExtractionLlm`)로 추출해 조건 일원화 고려 |
| 4 | 유지보수성 | `resolvedExtractionModel` 삼항 분기 — 동일 변수(`llmConfig`)가 분기에 따라 다른 의미(전용 config / 노드 main config), 가독성 저해 | `agent-memory-extraction.processor.ts` | 삼항 대신 if/else 블록 + 분기별 주석 |
| 5 | 부작용 | `DEFAULT_EMBEDDING_MODEL` 하드코딩 폴백 제거 — embedding config 없는 워크스페이스에서 조용한 폴백이 에러로 변경됨 | `agent-memory.service.ts` | 워크스페이스 embedding config 미등록 시 사용자 안내(UI 에러 메시지, 운영 문서) 충분한지 확인 |
| 6 | 부작용 | `summaryModelConfigId` 설정 시 매 요약 콜마다 추가 DB lookup 발생 (session-scope 메모이제이션 없음) | `ai-agent.handler.ts` — `injectMemoryContext` | 성능 민감 환경에서 session-scope 메모이제이션 고려 |
| 7 | 테스트 | `agent-memory.service.spec.ts`에 `resolveEmbedding` reject 시 `saveMemories`/`recall` 동작 검증 케이스 없음 — 신규 NotFoundException 경계 미커버 | `agent-memory.service.spec.ts` | `mockRejectedValueOnce(new NotFoundException(...))` 설정 후 recall(graceful)/saveMemories(throw 허용 여부) 케이스 추가 |
| 8 | 테스트 | `EmbeddingConfigSelectorWidget` stale 경고·빈 목록 힌트·onChange 케이스 누락 | `config-selector-widgets.test.tsx` | 3건 케이스 추가 |
| 9 | 테스트 | WIDGET_REGISTRY 신규 키(`chat-config-selector`/`embedding-config-selector`) smoke 테스트 없음 | `widget-registry.ts` | registry 키 → 위젯 컴포넌트 렌더 smoke 1건 추가 |
| 10 | 테스트 | `translateBackendHint` stub 처리로 KO 번역 파이프라인 검증 단절 — 신규 3개 hint 번역 미검증 | `config-selector-widgets.test.tsx` | locale='ko' + 실제 `translateBackendHint` 사용 케이스 추가 |
| 11 | 테스트 | `extractionModelConfigId` 빈 문자열 falsy 폴백 엣지 케이스 미검증 | `agent-memory-extraction.processor.ts` | 빈 문자열 입력 시 `llmConfigId` 폴백 동작 검증 케이스 추가 |
| 12 | API 계약 | 노드 config 스키마 필드 리네임 — 이전 필드명 저장 기존 데이터는 undefined로 읽혀 폴백 처리(plan 근거상 기존 데이터 ~0으로 영향 범위 최소) | `agent-memory-schema.ts`, `ai-agent.schema.ts`, `information-extractor.schema.ts` | 인플라이트 운영 데이터 있을 경우 parseNodeConfig 계층 구 필드명 alias 또는 배포 전 실데이터 확인 |
| 13 | 유지보수성 | `as string | undefined` 타입 단언 반복 — Zod infer로 해소 가능한 기술부채 | `agent-memory-injection.ts`, `ai-agent.handler.ts` 등 | 후속에서 `args.config`를 `z.infer<typeof schema>`로 타입화 |
| 14 | 유지보수성 | `ConfigSelectorShell`에서 `useT()` i18n 훅 중복 호출(셸 + 각 외부 위젯) | `config-selector-widgets.tsx` | 셸이 훅 단독 소유, 외부 위젯은 문자열 직접 전달 구조로 리팩터 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 모델명 직접 입력 → config id 참조 전환으로 공격면 구조적 축소. 타입 단언 장기 품질 개선 여지(INFO) |
| architecture | NONE | KB와 동형 구조, 단일 해석 경로 수립, ConfigSelectorShell 공통화 등 긍정적 개선. 이중 조건 분기 가독성 INFO |
| side_effect | MEDIUM | BullMQ in-flight job 역직렬화, EmbedConfigSource 파괴적 변경, 위젯 레지스트리 구 키 제거, i18n rename 4건 WARNING |
| maintainability | LOW | `||` falsy 폴백 체인 및 삼항 분기 가독성 WARNING 2건. 네이밍·단일책임 전반 양호 |
| testing | LOW | 커버리지 갭 INFO 6건. 핵심 경로 단위 테스트 적절히 추가됨 |
| api_contract | LOW | BullMQ 페이로드 rename WARNING, 노드 config 스키마 rename INFO. HTTP API 변경 없음 |
| requirement | 재시도 필요 | output_file 미생성 |
| scope | 재시도 필요 | output_file 미생성 |
| documentation | 재시도 필요 | output_file 미생성 |

## 발견 없는 에이전트

- **security**: CRITICAL/WARNING 발견 없음 (INFO만)
- **architecture**: CRITICAL/WARNING 발견 없음 (INFO만)

## 권장 조치사항

1. **[배포 전 필수] BullMQ 큐 드레인** — 배포 전 `AgentMemoryExtractionJob` in-flight job 0건 확인 또는 processor에 구 필드명 fallback 읽기(`extractionModelConfigId ?? (job.data as any).extractionModel`) 추가
2. **[배포 전 필수] EmbedConfigSource 외부 참조 전수 검증** — `grep -rn "EmbedConfigSource" codebase/backend/src` 실행, diff 外 import 0건 확인
3. **[배포 전 권고] 구 위젯 키 DB 잔존 레코드 확인** — `node_configs` 테이블에서 `chat-model-selector`/`embedding-model-selector` 키 레코드 0건 확인
4. **[코드 수정 권고] `||` → `??` 교체** — `agent-memory-extraction.processor.ts`의 `extractionModelConfigId || llmConfigId || undefined`를 `null`/`undefined` 체크 명시화
5. **[배포 전 권고] i18n 잔존 참조 확인** — `grep -rn "modelSelector" codebase/frontend/src` 실행
6. **[테스트 보완] NotFoundException 경계 검증** — `agent-memory.service.spec.ts`에 `resolveEmbedding` reject 시 recall/saveMemories 동작 케이스 추가
7. **[재시도 필요] requirement / scope / documentation 리뷰어** — output_file 미생성 3건, 재실행 필요

## 라우터 결정

라우터 미사용 — `_retry_state.json`의 `routing_status=pending`(라우터 호출 미완료). fallback으로 전체 reviewer 실행됨. 단, workflow 호출 시 prompt 제공 manifest 기준:

- **실행(ran)**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
- **제외(skipped)**: performance, dependency, database, concurrency, user_guide_sync (5명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **실제 output_file 존재**: security, architecture, side_effect, maintainability, testing, api_contract (6명) — requirement, scope, documentation 재시도 필요
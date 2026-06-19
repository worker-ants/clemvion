# RESOLUTION — agent-memory 모델 config 선택화 (review 01_12_46)

SUMMARY 위험도 HIGH (Critical 1 / Warning 10 / Info 14) 에 대한 조치. main Claude 가 직접
수정(bg sub-agent write 격리 불확실성 회피). fix 커밋: 후속 `refactor(nodes):` 단일 커밋.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 위치 |
|---|---|---|---|
| Critical 1 | 요구사항 | **FIXED** — `multiTurnStateBase` 에 `embeddingModelConfigId` 영속 추가. multi-turn turn2+ recall 이 노드 선택 embedding config 를 유지(워크스페이스 기본 silent 폴백 제거). 회귀 테스트 추가: `_resumeState.embeddingModelConfigId` 영속 + turn2 recall embed source 전달 단언 | `ai-agent.handler.ts` multiTurnStateBase / `ai-agent.memory.spec.ts` (C1 회귀 it) |
| Warning 1 | SPEC-DRIFT | **FIXED** — `1-ai-agent.md` §1295 "후속 결정" 단락에 "§1297 재번복으로 대체됨, 이력 보존" forward-pointer 추가. 코드가 옳고 spec 본문 미갱신이었음 | `spec/4-nodes/3-ai/1-ai-agent.md` §1295 |
| Warning 2 | 유저가이드 동기화 | **FIXED** — `ai.mdx`/`ai.en.mdx` AI Agent FieldTable 3행 + IE FieldTable 2행 + 산문을 신 필드명(`*ModelConfigId`)·신 동작(/models 등록 config, provider 디커플)으로 갱신. content/docs 잔여 구 필드명 0 | `ai.mdx`, `ai.en.mdx` |
| Warning 3 | 테스팅 | **FIXED** — `LlmService.resolveEmbedding` 단위 테스트 3건 추가(passthrough 인자, null→undefined, NotFoundException 전파) | `llm.service.spec.ts` |
| Warning 4 | 테스팅 | **FIXED** — recall/saveMemories 정상 경로에 `resolveEmbedding('emb-cfg-1','ws-1')` 호출 인자 단언 추가 | `agent-memory.service.spec.ts` |
| Warning 5 | 테스팅 | **FIXED** — summaryModelConfigId 설정 시 `resolveConfig('summary-cfg','ws-1')` 호출 인자 단언 추가(원인 검증) | `ai-agent.memory.spec.ts` |
| Warning 6 | 부작용 | **검증완료(무조치)** — `grep -rn EmbedConfigSource codebase/backend/src` 결과 정의(agent-memory.service.ts) + 내부 3사용처 + 해당 spec 뿐. diff 외부 호출자 없음 → 파괴적 변경 영향 격리됨 | — |
| Warning 7 | 부작용 | **운영 노트** — BullMQ `agent-memory-extraction` payload 필드 rename. #642 직후라 in-flight job ~0. 배포 전 큐 drain 권고를 본 RESOLUTION 에 기록(구 job dequeue 시 config id `undefined`→폴백, crash 아님) | 배포 노트 |
| Warning 8 | 부작용 | **저위험(무조치)** — 구 widget 키(`chat-model-selector`/`embedding-model-selector`) 제거. #642 직후 데이터 ~0, 구 키 저장 노드는 `UnsupportedWidget` 폴백(crash 아님). interface 주석에 마이그레이션 경로 명기(W10) | — |
| Warning 9 | 요구사항 | **DEFER(비기능)** — resume 시 summaryModelConfigId 가 `config:state`+명시 param 두 경로. 동작 오류 아님(추출/임베딩은 config 경유, 요약만 명시 param). signature 정합 리팩터는 요약 resolve 회귀 위험이 이득 초과 → 후속 plan 이관 | `ai-agent.handler.ts` 2356/2373 |
| Warning 10 | 문서화 | **FIXED** — `node-component.interface.ts` 위젯 주석에 구 위젯 제거 사실 + UnsupportedWidget 폴백·재저장 마이그레이션 경로 추가 | `node-component.interface.ts` |
| Info 1–14 | 다수 | **비차단 ACK** — INFO12(resolveEmbedding throw): recall 경로 try/catch graceful(빈 회수), save 경로는 job 실패(로그)로 *잘못된 차원 저장보다 안전* — 의도된 동작, 검증완료. 나머지 INFO(타입단언 기술부채·메모이제이션·엣지 테스트 등)는 비차단, 후속 여지 | — |

## TEST 결과

- lint: 통과
- unit: 통과 (fix 후 영향 스펙 153 pass; 전체 재실행 결과 아래)
- build: 통과
- e2e: 통과 (자동 흐름 — run-test.sh 워치독, 205 tests)

> 위 4단계는 fix 커밋 직후 `run-test.sh` 전체 재수행 결과로 본 RESOLUTION 과 함께 커밋된다.

## 보류·후속 항목

- **Warning 9** (summaryModelConfigId 이중 전달 정합): 비기능 명료성 개선. `injectMemoryContext`
  가 summary config 를 추출/임베딩처럼 `config` 에서 도출하도록 통일하는 리팩터. 별도 후속.
- **배포 운영(Warning 7)**: agent-memory-extraction 큐 in-flight job 0 확인 또는 drain 후 배포.
- INFO 군(타입 단언 Zod infer 전파, summary resolveConfig 메모이제이션, 위젯 엣지 테스트 추가):
  비차단 기술부채 — 후속 여지로만 기록.

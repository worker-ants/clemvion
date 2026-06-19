# RESOLUTION — fresh ai-review (01_38_22, post-fix 검증)

> **후속 노트**: 본 ai-review(01_38_22) 의 5 Warning 에 대해서는 코드 무변경(disposition 하단).
> 단, **병렬 실행한 impl-done(01_40_08)** 이 naming_collision Critical 을 제기해 — rename 잔재
> (내부 `orders` 맵 키 `embeddingModel`/`extractionModel`, stale 테스트 `argB.extractionModel`,
> 주석) — 를 별도 후속 커밋으로 완결했다. 그 커밋을 커버하는 **최종 ai-review/impl-done** 이
> 본 RESOLUTION 뒤에 추가로 수행된다(최종본이 push 가드 권위).

01_12_46 의 Critical/Warning fix(커밋 b4d4a56b) 를 커버하는 fresh review. **위험도 MEDIUM,
Critical 0** (원 Critical=multi-turn embeddingModelConfigId 영속 해소 확인됨). 잔여 Warning 5건은
모두 *코드 결함이 아닌* 파괴적-변경의 본질적 배포/운영 특성이거나 이미 검증된 항목 → 코드
무변경, 본 RESOLUTION 으로 disposition 고정.

## 조치 항목

| # | 분류 | disposition |
|---|---|---|
| Warning 1 | BullMQ payload rename | **운영 노트** — `AgentMemoryExtractionJob` 필드 rename. #642 직후라 in-flight job ~0. 배포 전 큐 drain 권고. 구 job dequeue 시 config id `undefined`→폴백(crash 아님). 코드 fallback alias 는 일회성 마이그레이션 부채라 미도입(데이터 ~0) |
| Warning 2 | EmbedConfigSource 파괴적 변경 | **검증완료** — `grep -rn EmbedConfigSource codebase/backend/src`: 정의 + 내부 3사용처 + spec 뿐. diff 外 import 0 → 영향 격리 |
| Warning 3 | 구 위젯 키 제거 | **저위험** — #642 직후 데이터 ~0, 구 키 저장 노드는 `UnsupportedWidget` 폴백(crash 아님). interface 주석에 마이그레이션 경로 명기(01_12_46 W10) |
| Warning 4 | processor `\|\|` 폴백 | **의도적(무변경)** — `extractionModelConfigId \|\| llmConfigId \|\| undefined`. config-selector 의 빈 선택은 빈 문자열("")="노드 config 상속" 의미다. `\|\|` 는 ""(falsy)→llmConfigId 폴백으로 *정확히* 이 의미를 구현한다. 리뷰어 제안 `??` 로 바꾸면 ""(non-nullish)을 실제 config id 로 간주해 `resolveConfig("")` 를 시도 → **오히려 버그**. 폴백 의도는 processor.ts:54-56 주석에 기술됨. 변경 안 함 |
| Warning 5 | i18n modelSelector→configSelector | **검증완료** — `grep -rn modelSelector codebase/frontend/src`: 0건. 잔존 참조 없음 |
| Info 1–14 | 다수 | **비차단 ACK** — INFO5(DEFAULT_EMBEDDING_MODEL 제거→throw): 의도된 동작(잘못된 차원 저장 차단). INFO7(resolveEmbedding reject 경계 테스트): 01_12_46 W3 에서 `llm.service.spec` 에 NotFoundException 전파 테스트 추가로 부분 커버. 나머지(타입단언 Zod infer 부채·메모이제이션·위젯 엣지 테스트·`??` 가독성)는 후속 여지로만 기록 |

## TEST 결과

- lint: 통과 (커밋 b4d4a56b 시점)
- unit: 통과 (lint·unit·build·e2e 전체 재수행 — postfix-chain, 영향 스펙 153 추가 검증)
- build: 통과
- e2e: 통과 (자동 흐름, 205 tests)

> 본 fresh review 는 코드 무변경 검증이므로 b4d4a56b 의 TEST WORKFLOW 결과를 그대로 인용한다.

## 보류·후속 항목

- 배포 운영: agent-memory-extraction 큐 in-flight job 0 확인/drain 후 배포 (Warning 1).
- INFO 기술부채(Zod infer 타입 전파, summary resolveConfig 메모이제이션, 위젯 엣지 테스트,
  processor 폴백 체인 단일 함수화): 비차단 후속 여지.

# RESOLUTION — 10_47_52

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W-1 | 코드·운영 | (사전 반영) | spec/5-system/8-embedding-pipeline.md §5.4 + Rationale, spec/2-navigation/5-knowledge-base.md §2.2 에 재임베딩 경고 기술됨 |
| W-2 | 코드·운영 | (사전 반영) | 동상 — 배포 런북 재임베딩 지침 spec 에 포함 |
| W-3 | 코드 | 17ef3879 | AnthropicClient.embed(_texts?, _model?, _inputType?) 로 LLMClient 인터페이스 일치 |
| W-4 | 코드 | 17ef3879 | LlmService.embed 호출부 5곳 undefined 4번째 인자에 `/* opts */` 인라인 주석 추가 |
| W-5 | 코드 | 17ef3879 | 동상 — rag-search(x2), knowledge-base, agent-memory(x2) 전체 커버 |
| W-6 | 테스트 | 17ef3879 | google.client.spec.ts — inputType 생략 시 RETRIEVAL_DOCUMENT 독립 케이스 추가 |
| W-7 | 테스트 | 17ef3879 | anthropic.client.spec.ts — embed throw 동작 테스트 추가 |
| W-8 | SPEC-DRIFT | (draft 위임) | plan/in-progress/spec-update-llm-embed-signature.md |

## 함께 처리한 INFO 항목

| INFO # | 분류 | 조치 commit | 비고 |
|--------|------|-------------|------|
| INFO-9 | 코드 | 17ef3879 | E5_PREFIX_PATTERN 주석 — e5-base-v2 버전 suffix 포함 매칭 설명 추가 |
| INFO-20 | 코드 | 17ef3879 | LlmService.embed JSDoc 추가 |
| INFO-21 | 코드 | 17ef3879 | embedding-input-type.ts 순수함수 3종 JSDoc |
| INFO-22 | 코드 | 17ef3879 | embedding-model-recommendation.ts 참조처 plan → spec §2.2 |
| INFO-23 | 코드 | 17ef3879 | resolveGeminiTaskType — exhaustive Record 매핑으로 교체 |
| INFO-24 | 코드 | 17ef3879 | embedding-input-type.ts 헤더 이모지(⚠️) 제거 → IMPORTANT: 마커 (CLAUDE.md 규약) |
| INFO-19 | SPEC-DRIFT | (draft 위임) | spec §5.4 config 인자 순서 오류 — 위 draft 에 포함 |

## TEST 결과

- lint  : 통과 (64s)
- unit  : 통과 (40 passed, 60s)
- e2e   : 통과 (174/174, 84s)

## 보류·후속 항목

- SPEC-DRIFT W-8 / INFO-19: `plan/in-progress/spec-update-llm-embed-signature.md` — project-planner 가 spec/5-system/7-llm-client.md §8.3 에 LlmService.embed 시그니처(opts 포함) 추가 + spec/5-system/8-embedding-pipeline.md §5.4 에 config 첫 번째 인자 기술 정정 필요. ESCALATE=spec.
- INFO-8: `isKoreanRecommendedEmbeddingModel` 에 text-embedding-3 포함 여부 — 배지 텍스트 조정은 product owner 결정. ESCALATE=user-decision (defer).
- INFO-5: 백엔드/프론트엔드 embedding 패턴 파일 `packages/` 이동 — 카탈로그 확장 시 검토. ESCALATE=defer.
- INFO-12: `renderOption` useCallback 적용 — ModelSelectField memo 여부 확인 후 최적화. ESCALATE=defer.
- INFO-13/14/15/16/17/18: 추가 테스트 케이스 (LlmService query path, timeout+inputType 조합, LocalClient e5 prefix, 이중 prefix, rag-search 2차 query embed, EmbeddingModelCombobox renderOption) — 다음 테스트 강화 스프린트에서 처리 권장.

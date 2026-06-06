# Documentation Review

## 발견사항

### [INFO] `isKoreanRecommendedEmbeddingModel` 공개 함수에 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` L29–34
- 상세: 동일 파일에서 새로 추가된 `formatEmbeddingOptionLabel`(L36–46)에는 완전한 JSDoc(`@param`, `@returns`)이 있으나, 기존 공개 함수 `isKoreanRecommendedEmbeddingModel`에는 JSDoc이 없다. 모듈 수준 블록 주석이 함수의 전반적 의도를 설명하지만, 파라미터 타입 허용 범위(`string | undefined | null`)와 반환 의미를 함수 시그니처 바로 위에 JSDoc으로 명시하면 IDE 툴팁과 일관성이 높아진다.
- 제안: `formatEmbeddingOptionLabel` 수준의 JSDoc을 `isKoreanRecommendedEmbeddingModel`에도 추가.

### [INFO] 테스트 파일 내 `embed` 호출 시그니처 설명 주석의 파라미터 순서 일부 암묵적
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` L36–45 (추가된 expect 블록)
- 상세: 추가된 `expect(mockLlmService.embed).toHaveBeenCalledWith(...)` 블록의 인라인 주석(`// graph 모드 query 임베딩…`)은 계약을 명확히 설명한다. 다만 positional arguments(`expect.anything()`, `['query']`, `'text-embedding-3-small'`, `undefined`, `'query'`)가 어떤 파라미터에 대응하는지 주석이 없어 처음 읽는 독자가 `LlmService.embed` 시그니처를 별도로 확인해야 한다.
- 제안: 호출부 한 줄 위에 `// embed(config, texts, model, opts, inputType)` 형태의 시그니처 힌트를 추가하거나, vector 경로 테스트(L158–164)처럼 named 변수로 재구성하면 가독성이 높아진다. 단, 기존 vector 경로 테스트에도 동일한 패턴이 이미 사용되고 있어 일관성 면에서 큰 문제는 아니다.

### [INFO] `embedding-input-type.spec.ts` 멱등성 테스트 주석 — 설계 이유 문서화 양호, 비멱등 설계 선택의 리스크 언급 부재
- 위치: `codebase/backend/src/modules/llm/embedding-input-type.spec.ts` L855–877
- 상세: 추가된 멱등성 없음 테스트는 "호출자가 단 한 번만 호출하는 책임을 진다"는 계약을 매우 명확히 서술한다. 우수한 인라인 문서화다. 보완 관점에서, 비멱등 설계가 왜 의도적인지(dedup 로직 추가 시 패턴 매칭 오작동 방지 등)의 근거를 `embedding-input-type.ts` 모듈 상단 주석에도 1줄 정도 추가하면 소스 파일과 테스트가 상호 참조 가능해진다. 현재는 테스트에만 근거가 있다.
- 제안: `embedding-input-type.ts` 내 `applyEmbeddingInputPrefix` JSDoc에 `@remarks 멱등 아님 — 이중 적용 금지. 호출자가 단 한 번만 호출할 책임.` 한 줄 추가.

### [INFO] `spec/4-nodes/3-ai/3-information-extractor.md` — recall inputType 배선 설명 추가 양호, 대응 임베딩 파이프라인 spec 단방향 참조
- 위치: `spec/4-nodes/3-ai/3-information-extractor.md` L2340
- 상세: 추가된 줄이 `[§17 agent-memory §4]` 링크와 함께 `inputType:'query'` 배선의 이유를 명확히 설명한다. 그러나 `spec/5-system/8-embedding-pipeline.md §5.4`나 `spec/5-system/17-agent-memory.md #4`에서 역방향 참조(information-extractor 가 query 로 호출한다는 명시)가 있는지 확인이 필요하다. 현재 변경은 한 방향에서만 링크가 추가됐다.
- 제안: 해당 역방향 spec 문서에도 "information-extractor recall 경로도 inputType='query' 적용" 언급이 없다면 추가를 권장한다. 단, 이 PR 범위 밖일 수 있으므로 INFO로 분류.

### [INFO] `local.client.spec.ts` 신규 파일 — 모듈 수준 주석 충분, `@ts-expect-error` 이유 문서화 적절
- 위치: `codebase/backend/src/modules/llm/clients/local.client.spec.ts` 전체
- 상세: 파일 상단의 블록 주석이 테스트의 목적(LocalClient 상속 경로 회귀 가드)을 명확히 설명하고, `@ts-expect-error — 내부 SDK client 를 embeddings stub 으로 교체.` 인라인 주석도 의도를 잘 전달한다. 문서화 관점에서 추가 조치 불필요.

### [INFO] `embedding-model-combobox.tsx` useCallback 주석 — 목적 설명 양호하나 주의사항 중복
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` L1721–1728
- 상세: `// 추천 배지 라벨 생성을 순수함수에 위임하고 t 안정성에 묶어 useCallback 으로 메모. 현재 ModelSelectField 는 memo 가 아니라 리렌더 절감 효과는 없으나, 향후 memo 화 대비 + 매 렌더 람다 재생성 노이즈 제거 목적의 방어적 안정화.` 코드 변경 인라인 주석과 완전히 동일한 주석이 소스 파일에도 그대로 남아 있다. 이는 diff 에서 추가된 주석이 소스 파일에 정착한 것이므로 정상이다. 내용은 충분히 설명적이다.

### [INFO] `spec/2-navigation/5-knowledge-base.md` — text-embedding-3 배지 제외 결정 명시, 근거 문서 참조 없음
- 위치: `spec/2-navigation/5-knowledge-base.md` §2.2 임베딩 모델 행
- 상세: `text-embedding-3 는 한국어 검색 벤치마크 하위라 배지 대상에서 제외한다` 결정이 spec에 반영됐다. 그러나 "한국어 검색 벤치마크 하위"의 출처(벤치마크 이름, 측정 결과 링크 등)가 spec 어디에도 없다. 현재 Rationale 섹션은 select-only 결정만 다루고 추천 모델 선정 근거는 없다.
- 제안: spec §Rationale 또는 §2.2 아래에 "추천 모델 선정 기준" 소항목을 추가하고 벤치마크 근거를 1–2줄로 기술하면 향후 패턴 변경 시 의사결정 맥락이 보존된다. 필수가 아닌 권고 수준.

## 요약

이번 변경 세트는 전반적으로 문서화 품질이 높다. `formatEmbeddingOptionLabel` 신규 공개 함수에 완전한 JSDoc이 달렸고, `embedding-input-type.ts`의 모든 공개 함수에도 JSDoc이 유지되고 있다. 테스트 파일의 인라인 주석은 계약 의도(비대칭 임베딩 query/document 분리, 멱등성 정책, graph 경로 inputType 배선)를 명확하게 문서화한다. Spec 변경(`5-knowledge-base.md`, `3-information-extractor.md`)도 기능 변경과 정합하게 갱신됐다. 지적 사항은 모두 INFO 수준으로, `isKoreanRecommendedEmbeddingModel` JSDoc 부재와 비멱등 설계 근거가 테스트에만 존재하는 점이 사소한 개선 여지다.

## 위험도

NONE

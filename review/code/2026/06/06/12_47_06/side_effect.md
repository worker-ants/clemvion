# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `embedding-model-recommendation.ts` — `KOREAN_RECOMMENDED_PATTERNS` 모듈 레벨 상수 변경(배열 축소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` L6–L10
- 상세: `KOREAN_RECOMMENDED_PATTERNS` 배열에서 `/text-embedding-3/i` 패턴을 제거했다. 이 상수는 모듈 스코프 `const`로 선언돼 있으므로 런타임 변형(mutate)은 없다. 그러나 동일 프로세스에서 이 모듈을 공유하는 모든 호출자가 동일 변경된 목록을 참조하게 된다. 다른 프론트엔드 컴포넌트나 유틸리티가 `isKoreanRecommendedEmbeddingModel`을 import해 `text-embedding-3-small`/`text-embedding-3-large`를 추천 모델로 기대하고 있었다면, 해당 호출 결과가 `false`로 바뀐다.
- 제안: 현재 코드베이스 내 `isKoreanRecommendedEmbeddingModel` 의 모든 호출처(특히 다른 컴포넌트나 서버사이드 경로)를 확인해 `text-embedding-3` 패턴 제거로 인한 영향 범위를 최종 검증한다. diff 상으로는 `embedding-model-combobox.tsx`가 유일한 직접 소비처로 보이며, `formatEmbeddingOptionLabel`로 위임이 완료됐으므로 이 변경 자체는 의도된 정책 변경이다.

### [INFO] `isKoreanRecommendedEmbeddingModel` 공개 API — 시맨틱 변경(반환값 변화), 시그니처 무변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts`
- 상세: 함수 시그니처 자체는 변경되지 않았으나, `text-embedding-3-small`/`text-embedding-3-large` 입력에 대해 기존 `true` → `false`로 반환값이 바뀐다. 이는 공개 export이므로 모듈 외부 소비자(다른 패키지, 통합 테스트, 미래 기능)에 행동 변경 부작용이 있다.
- 제안: 함수 이름은 그대로지만 동작이 변경됐으므로 변경 이유가 JSDoc 또는 인라인 주석에 명확히 기술되어야 한다. 이미 파일 내 코드 주석(`// text-embedding-3 는 한국어 검색 벤치마크 하위라...`)으로 이유가 명시돼 있어 적절하다.

### [INFO] `formatEmbeddingOptionLabel` — 신규 공개 export 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` L32–L57
- 상세: 기존에 `embedding-model-combobox.tsx` 내 인라인 람다에 있던 라벨 생성 로직이 순수함수로 추출돼 `export`됐다. 새 공개 API가 생긴 셈으로, 인터페이스 표면이 넓어진다. 함수 자체는 순수함수(입력→출력, 외부 상태 없음)이며 i18n 문자열을 호출자에서 주입받아 스스로 i18n 상태를 건드리지 않는다. 부작용 없음.
- 제안: 특이사항 없음.

### [INFO] `embedding-model-combobox.tsx` — `isKoreanRecommendedEmbeddingModel` import 제거, `formatEmbeddingOptionLabel` import 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` L15–L16
- 상세: import 교체다. `isKoreanRecommendedEmbeddingModel`은 더 이상 직접 소비되지 않으며 `formatEmbeddingOptionLabel`를 통해 간접 사용된다. `renderOption`이 `useCallback`으로 메모이제이션된다. `t` 함수가 `useCallback` 의존성 배열에 포함돼 있어 번역 변경 시 올바르게 재생성된다. 부작용 없음.
- 제안: 특이사항 없음.

### [INFO] `rag-search.service.spec.ts` — 기존 테스트 케이스에 `embed` 호출 assertion 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` L39–L45
- 상세: 기존 graph 모드 테스트 케이스(`routes graph KB through searchGraphKb`)에 `expect(mockLlmService.embed).toHaveBeenCalledWith(...)` assertion이 추가됐다. 이는 테스트 파일만의 변경으로 프로덕션 상태에 영향 없다. `mockLlmService.embed`는 `beforeEach`에서 `jest.fn()`으로 교체되므로 격리 보장.
- 제안: 특이사항 없음.

### [INFO] `llm.service.spec.ts` — 새 테스트 케이스 추가(inputType 배치 전달 검증)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/backend/src/modules/llm/llm.service.spec.ts` L1027–L1087
- 상세: 순수 테스트 추가. 프로덕션 코드 변경 없음. 각 테스트는 독립 `mockClient`를 사용해 격리됨. 외부 서비스 호출 없음.
- 제안: 특이사항 없음.

### [INFO] `local.client.spec.ts` — 신규 테스트 파일 생성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/backend/src/modules/llm/clients/local.client.spec.ts`
- 상세: 신규 파일이다. `@ts-expect-error`로 `client.client`(내부 OpenAI SDK 인스턴스)를 직접 교체한다. 이 방식은 `protected` 필드를 런타임에 patch하는 것으로, `OpenAIClient`의 내부 구현(`client` 필드명)이 변경되면 테스트가 런타임 에러 없이 조용히 깨질 수 있다(타입 에러만 `@ts-expect-error`로 억제됨). 단, 프로덕션 코드 상태에는 영향 없음.
- 제안: 테스트 유지보수성 측면에서 `protected client` 필드명 변경 시 테스트가 조용히 실패할 수 있다는 점을 팀이 인지하면 충분하다. 현재 `OpenAIClient`가 `protected client: OpenAI`로 선언돼 있으므로 인스턴스 교체 자체는 기술적으로 유효하다.

### [INFO] `embedding-input-type.spec.ts` — 비멱등성 정책 테스트 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/codebase/backend/src/modules/llm/embedding-input-type.spec.ts` L855–L878
- 상세: `applyEmbeddingInputPrefix`가 멱등하지 않음을 명시적으로 문서화하는 테스트다. 이 자체가 부작용을 유발하지 않는다. 오히려 호출자가 이중 호출로 인한 prefix 누적을 방지하도록 강제하는 계약 문서로 기능한다. 프로덕션 코드 변경 없음.
- 제안: 특이사항 없음.

### [INFO] spec 문서 변경 — 런타임 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/spec/2-navigation/5-knowledge-base.md`, `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/spec/5-system/8-embedding-pipeline.md`, `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/spec/4-nodes/3-ai/3-information-extractor.md`, `/Volumes/project/private/clemvion/.claude/worktrees/embedding-followup-c09eb2/spec/5-system/17-agent-memory.md`
- 상세: 문서 변경은 런타임 상태·API·이벤트에 영향 없다. spec 텍스트 정합성 유지 목적이며 부작용 없음.
- 제안: 특이사항 없음.

---

## 요약

이번 변경 세트는 주로 테스트 파일 추가와 프론트엔드 순수함수 추출, spec 문서 갱신으로 구성된다. 프로덕션 코드의 실질 변경은 `embedding-model-recommendation.ts` 두 가지로 한정된다: (1) `KOREAN_RECOMMENDED_PATTERNS`에서 `text-embedding-3` 패턴 제거와 (2) `formatEmbeddingOptionLabel` 신규 export 추가. 전자는 `isKoreanRecommendedEmbeddingModel`의 반환값을 일부 모델에 대해 변경하는 시맨틱 변경이지만, 현재 코드베이스 내 직접 소비처는 `embedding-model-combobox.tsx` 하나이며 해당 컴포넌트는 이번 변경에서 `formatEmbeddingOptionLabel`로 위임이 완료됐다. 전역 변수 도입, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 없다. 파일시스템 부작용도 없다. 모든 변경은 격리된 테스트 환경(jest mock/vitest mock)에서 수행되며 공유 상태를 오염시키지 않는다.

---

## 위험도

LOW

# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] spec §3.3 LLMClient.embed 시그니처 vs LlmService.embed 시그니처 — 서비스 opts 파라미터 기술 누락
- 위치: `spec/5-system/7-llm-client.md §3.3` (워크트리 내 갱신본)
- 상세: spec §3.3 코드 블록은 `embed(texts, model?, inputType?)` 로 기술되어 있으나, 실제 `LlmService.embed` 서비스 시그니처는 `(config, texts, model?, opts?, inputType?)` 이다. `opts`(`timeoutMs/disableInnerRetry`) 파라미터가 spec 에 기술되지 않았다. 이는 `LLMClient` 인터페이스(외부 계약)와 `LlmService`(내부 서비스 래퍼) 시그니처가 의도적으로 다른 것이며, 코드 버그는 아니다.
- 제안: 코드 변경 없음. spec `7-llm-client.md §3.3` 또는 서비스 레이어 절에 `LlmService.embed(config, texts, model?, opts?: {timeoutMs?, disableInnerRetry?}, inputType?)` 기술 추가.

### [WARNING] [SPEC-DRIFT] spec `7-llm-client.md §3.3` 의 LlmService embed 시그니처가 `opts` 파라미터를 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/spec/5-system/7-llm-client.md §3.3` 및 `llm.service.ts` diff
- 상세: spec §3.3 은 `embed(texts, model?, inputType?: 'query'|'document')` 로만 기술되어 있으나 코드상 `LlmService.embed` 는 `(config, texts, model?, opts?, inputType = 'document')` 다. `opts` 위치 인자는 기존에도 존재했지만 spec 에 반영되지 않았다. 이는 코드가 의도적으로 내부 서비스 옵션을 포함한 것이며 되돌릴 이유가 없다. 코드가 옳고 spec 기술이 낡았다.
- 제안: 코드 유지 + spec 반영. 대상: `spec/5-system/7-llm-client.md §3.3` 또는 서비스 계층 기술 절.

### [INFO] 재임베딩 없는 기존 e5/Gemini KB 의 비대칭 품질저하 — 런타임 경고 UI 미포함(Phase C 범위)
- 위치: `embedding-input-type.ts` 주석(⚠️ 정합성), `spec/5-system/8-embedding-pipeline.md §5.4 정합성`
- 상세: 기존에 e5/Gemini 모델로 무접두사 색인된 KB 는 이번 변경 이후 query 에만 접두사가 붙어 silent 품질저하가 발생한다. 코드 주석과 spec §5.4 에 "재임베딩 필요" 경고는 기술되어 있으나, 런타임 사용자 경고 UI(Phase C)는 이번 변경에 포함되지 않았다. plan 에 Phase C 로 명시된 의도적 미완성 범위다.
- 제안: Phase C 작업에서 재임베딩 권고 경고 UI 추가 시 완결. 코드 변경 없음.

### [INFO] `isKoreanRecommendedEmbeddingModel` 에 `text-embedding-3` 패턴 포함 — 한국어 성능 순위 대비 노출 범위
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts`
- 상세: plan §D5 리더보드(`KURE / arctic-ko > BGE-M3 > multilingual-e5 > text-embedding-3`)에서 text-embedding-3 는 가장 낮은 순위지만 "한국어 추천" 배지가 표시된다. 배지가 비강제 표시라는 설계 의도상 기능 버그는 아니지만, 사용자가 배지를 최선 모델로 오해할 가능성이 있다.
- 제안: 기능 변경 없음. 필요 시 배지 텍스트를 "한국어 지원"으로 조정하거나 리더보드 순위 반영 검토. 결정은 product owner.

### [INFO] `E5_PREFIX_PATTERN` 의 `e5-base-v2` 매칭이 주석에 명시되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/codebase/backend/src/modules/llm/embedding-input-type.ts` (`E5_PREFIX_PATTERN`)
- 상세: 테스트에서 `intfloat/e5-base-v2` 가 `e5-prefix` 로 매칭됨을 확인하나, 이는 `e5-base` 패턴이 `e5-base-v2` suffix 를 포함 매칭하는 덕분이다. 주석에 명시되지 않아 이후 패턴 수정 시 놓칠 수 있다.
- 제안: 코드 주석에 "e5-base-v2, e5-large-v2 등 버전 suffix 는 기본 패턴으로 포함 매칭됨" 한 줄 추가. 기능 변경 없음.

---

## 요약

이번 변경은 임베딩 비대칭 입력(e5 prefix / Gemini taskType) 배선과 프론트엔드 한국어 추천 배지 추가라는 두 기능을 완전하게 구현하고 있다. `EmbedInputType`('query'/'document') 분기, e5 패턴 화이트리스트(instruct 제외·경계 매칭), Gemini taskType 매핑, `LLMClient.embed` 인터페이스 확장, 7개 호출부 inputType 명시(`document`/`query` 정확 분류), `LlmService.embed` 패스스루, 프론트엔드 recommendation 로직과 i18n 배지가 모두 구현되어 있으며 단위테스트로 검증된다. spec 4종(7-llm-client §3.3, 8-embedding-pipeline §5.4+Rationale, 17-agent-memory §4, 5-knowledge-base §2.2) 갱신도 워크트리 내에서 완료되어 있다. 주요 엣지케이스(null/undefined model, 빈 배열, instruct 변형 제외, 대소문자 무관)가 테스트로 커버된다. `LlmService.embed` 의 `opts` 파라미터가 spec §3.3 에 기술되지 않은 SPEC-DRIFT 가 있으나 이는 코드 버그가 아닌 spec 업데이트 누락이다. 기존 e5/Gemini KB 의 재임베딩 경고 UI(Phase C)는 의도적으로 미포함이다.

## 위험도

LOW

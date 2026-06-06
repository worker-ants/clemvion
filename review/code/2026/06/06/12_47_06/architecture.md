# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 비멱등 계약(non-idempotent contract)의 명시적 문서화
- 위치: `codebase/backend/src/modules/llm/embedding-input-type.spec.ts` 라인 861-877
- 상세: `applyEmbeddingInputPrefix` 의 비멱등성을 테스트로 "정책 고정" 한 접근은 호출자 계약을 명시해 이중 적용 버그를 사전 차단한다. 단, 비멱등 함수를 public API 로 유지하면 호출자가 늘어날수록 "단 한 번 호출" 불변식을 외부에서 보장해야 하는 부담이 누적된다.
- 제안: 현재 수준에서는 수용 가능하나, 향후 호출 경로가 2개 이상으로 증가할 경우 함수 내부에서 이미 prefix가 붙은 텍스트를 감지해 skip하거나(멱등화), 아니면 internal-only로 visibility를 제한하는 것을 고려한다. 지금은 INFO 수준.

### [INFO] `LocalClient` 테스트의 내부 private 필드 직접 교체
- 위치: `codebase/backend/src/modules/llm/clients/local.client.spec.ts` 라인 734
- 상세: `@ts-expect-error` 를 사용해 `client.client` 내부 SDK 필드를 stub으로 교체하는 방식은 구현 세부에 결합된 화이트박스 테스트다. `LocalClient`가 OpenAI SDK 내부 구조를 바꾸거나, 부모 클래스 `OpenAIClient`의 필드명이 리팩터링되면 이 테스트가 조용히 무효화된다.
- 제안: `LocalClient` 또는 상위 클래스에 protected/package-scoped factory 메서드나 injection 포인트를 두어 테스트가 내부 필드를 직접 교체하지 않아도 되게 하는 것이 장기적으로 바람직하다. 현재 규모에서는 INFO 수준이며 즉각 수정이 필수는 아니다.

### [INFO] `embedding-model-recommendation.ts` 의 프론트엔드-전용 책임 경계가 명시적으로 선언됨
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` 라인 (주석 블록)
- 상세: 파일 주석에 "이 파일은 UI 표시용 힌트만, 백엔드 `embedding-input-type.ts` 는 런타임 입력 변형만 — 의도적 분리(공유 안 함)"를 명시한 것은 긍정적이다. 유사한 "한국어 추천" 판단 로직이 백엔드에도 존재할 경우 동기화 부담이 생길 수 있으나, 두 책임(UI badge vs 런타임 prefix)은 실제로 다른 도메인이므로 의도적 분리는 올바른 결정이다.
- 제안: 이 경계가 깨지지 않도록 추후 패턴 목록 변경 시 양쪽 파일을 함께 갱신하는 lint 또는 테스트 가이드를 문서화하는 것을 고려한다.

### [INFO] `formatEmbeddingOptionLabel` 의 i18n 결합 제거 — 의존성 역전 적용됨
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` 라인 2009-2020, `embedding-model-combobox.tsx` 라인 1726-1728
- 상세: i18n 텍스트를 함수 내부에서 `useT()`로 직접 참조하지 않고, 이미 번역된 문자열을 인자(`recommendedBadge`)로 주입받는 방식은 의존성 역전 원칙을 올바르게 적용했다. 순수함수화로 단위 테스트도 i18n mock 없이 작성 가능해졌다. 이 변경은 아키텍처적으로 긍정적이다.

### [INFO] `useCallback` 방어적 안정화 — 현시점 효과 없음
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 라인 1724-1728
- 상세: 주석에 명시된 대로 `ModelSelectField`가 현재 `memo`로 감싸져 있지 않아 `useCallback`의 실제 최적화 효과는 없다. 미래 대비 방어적 안정화라는 의도는 이해되나, 효과 없는 최적화는 코드 복잡도를 올리는 비용이 있다. 현재는 INFO.
- 제안: `ModelSelectField`를 `React.memo`로 감쌀 계획이 없다면 `useCallback` 제거를 고려한다. 계획이 있다면 이 시점에서 함께 처리하는 것이 일관성 있다.

### [INFO] `spec/4-nodes/3-ai/3-information-extractor.md` 및 `spec/5-system/17-agent-memory.md` — `inputType:'query'` 배선 결정의 spec 문서화
- 위치: `spec/4-nodes/3-ai/3-information-extractor.md` 라인 2340, `spec/5-system/17-agent-memory.md` 라인 2366-2370
- 상세: 비대칭 임베딩 inputType 배선 및 agent memory의 일괄 재임베딩 미지원 결정이 spec에 정합하게 기록됐다. 아키텍처적으로 중요한 결정(재임베딩 경로 부재 / TTL+dedup 자연 수렴)의 근거가 명시됐다는 점에서 긍정적이다.

---

## 요약

이번 변경은 임베딩 `inputType`(query/document) 배선을 graph 모드 RAG 검색 및 LLM 서비스 배치 경로 전반으로 확장하고, 프론트엔드의 한국어 추천 배지 로직을 순수함수(`formatEmbeddingOptionLabel`)로 추출한 두 가지 축으로 구성된다. 아키텍처 관점에서 레이어 책임 분리(UI hint vs 런타임 변환), 의존성 역전(i18n 텍스트 주입), 모듈 경계 명시(프론트/백엔드 의도적 비공유)가 모두 올바르게 적용됐다. 비멱등 계약의 테스트 고정, 내부 필드 직접 교체 테스트, 효과 없는 `useCallback` 방어 패턴은 각각 INFO 수준의 개선 여지가 있으나 즉각적인 구조적 위험은 없다. 순환 의존성이나 레이어 역방향 참조는 발견되지 않았다.

## 위험도

NONE

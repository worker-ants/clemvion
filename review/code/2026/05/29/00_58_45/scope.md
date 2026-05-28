# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] use-base-model-loader.ts 신규 파일: 리팩토링이지만 작업 의도에 부합
- 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts` (파일 16, 신규)
- 상세: `useModelLoader`와 `useEmbeddingModelLoader`의 공통 상태 기계(render-phase reset, stale-closure guard, error sanitization)를 추출하여 `useBaseModelLoader`로 분리했다. 이는 요청 범위인 "error code 기반 메시지 매핑" 변경 시 두 훅에 동일한 `errorMessagesByCode` 파라미터를 추가해야 하는 상황에서 자연스럽게 수반되는 DRY 리팩토링이다. 두 훅에 중복 적용할 대안과 비교할 때 단일 진입점 변경이 더 안전하므로 현 작업 범위 내 합리적인 선택이다.
- 제안: 수용 가능. 단, 이 파일은 요청된 기능 변경(에러 코드 매핑)을 추가하는 과정에서 중복 제거를 겸한 것이므로 커밋 메시지에 명시하면 향후 추적이 쉬워진다.

### [INFO] useDefaultLlmConfigId 신규 훅: custom-node의 per-node useQuery 제거와 직접 연결
- 위치: `codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` (파일 17, 신규)
- 상세: 기존 `embedding-model-combobox.tsx`의 인라인 `useQuery(["llm-configs"])` 로직을 훅으로 추출했다. `custom-node.tsx`의 per-node `useQuery` 제거(파일 3) 및 `has-default-llm-config-context`(파일 4) 도입과 함께 "llm-configs 쿼리 중복 구독 제거"라는 공통 목적을 가진다. 범위 이탈이 아니라 같은 목표의 두 측면이다.
- 제안: 수용 가능.

### [INFO] has-default-llm-config-context.ts 신규 파일: custom-node per-node 쿼리 제거의 핵심
- 위치: `codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts` (파일 4, 신규)
- 상세: Canvas 레벨에서 `hasDefaultLlmConfig` boolean 을 한 번 계산해 Context로 내려주는 패턴이다. 기존 `custom-node.tsx`의 `useQuery(["llm-configs"])` 구독을 N개 노드 각각이 수행하는 문제를 해결한다. 이는 작업 범위로 보이는 "model select 관련 llm-configs 쿼리 중복 제거·리팩토링"의 일환이다.
- 제안: 수용 가능.

### [WARNING] sanitize-loader-error.ts: 기존 동작을 완전히 교체하는 변경
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` (파일 15)
- 상세: 기존 함수는 `response.data.message`(문자열·배열)를 최대 200자로 잘라 반환했다. 변경 후에는 `response.data.error.code`를 키로 `messagesByCode` 맵에서 조회하고, 없으면 항상 `fallback`을 반환한다. 즉 "truncate server message" → "never surface raw server message, map by code only"로 전략이 바뀐 것이다. 이 변경은 보안 관련 판단(엔드포인트 노출 방지)에 근거하며 이전 리뷰 SUMMARY #10을 참조하고 있으므로, 요청된 후속 리팩토링 범위 안에 있다. 다만 기존 테스트 케이스 5개(truncate, array join, empty message 등)가 삭제되고 새 시나리오로 교체된다 — 이는 의도적 행동 변경이므로 아래 파일들과의 정합이 중요하다.
- 제안: 변경 의도가 명확하고 테스트도 갱신되었으므로 범위 이탈은 아니다. 단, 이 함수를 호출하는 모든 경로(use-base-model-loader → use-model-loader / use-embedding-model-loader → model-combobox / embedding-model-combobox)가 `errorMessagesByCode`를 주입하지 않으면 항상 fallback이 반환됨을 확인해야 한다. 파일 13(`loader-error-messages.ts`)을 통해 파일 14, 7에서 주입하고 있으므로 현재 연결은 완성되어 있다. `useBaseModelLoader`를 직접 사용하는 다른 미래 호출자는 `errorMessagesByCode` 없이 사용하면 silently fallback만 반환되는 점을 주의해야 한다.

### [INFO] 테스트 파일들: 구현 변경에 대응하는 정상적 갱신
- 위치: 파일 1, 2, 6, 8, 9, 10, 11, 12 (테스트 파일)
- 상세: 모든 테스트 변경은 구현 변경(에러 봉투 형식 교체, context 도입, 훅 추출)에 직접 대응한다. 테스트 명칭도 기존 동작(server message truncation)에서 새 동작(code-mapped localized message)으로 정확하게 갱신되었다.
- 제안: 수용 가능.

### [INFO] i18n 딕셔너리 추가: 필요한 번역 키 추가
- 위치: 파일 20, 21 (`en/llmConfigs.ts`, `ko/llmConfigs.ts`)
- 상세: `errorCredentialsRequired`, `errorConfigInvalid` 두 키 추가. `loader-error-messages.ts`에서 참조하는 키들이며 범위 내 필수 변경이다.
- 제안: 수용 가능.

### [INFO] workflow-canvas.tsx: HasDefaultLlmConfigProvider 래핑 추가
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (파일 5)
- 상세: 기존에 이미 `llmConfigs` 쿼리와 `defaultLlmConfigId`를 계산하던 컴포넌트에 Provider 래핑만 추가했다. 로직 추가가 아니라 이미 존재하는 계산 결과를 Context로 전파하는 것이다.
- 제안: 수용 가능.

### [INFO] embedding-model-combobox.tsx: LLM_CONFIGS_QUERY_KEY mock 추가
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx` (파일 6) 의 mock 내 `LLM_CONFIGS_QUERY_KEY: ["llm-configs"]` 추가
- 상세: `useDefaultLlmConfigId`가 `LLM_CONFIGS_QUERY_KEY`를 named import로 가져오므로, 해당 심볼이 mock에도 노출되어야 한다. 필수적인 mock 보완이다.
- 제안: 수용 가능.

## 요약

21개 파일 변경 전체가 "LLM 모델 선택 관련 (1) per-node useQuery 중복 제거, (2) 서버 에러 메시지 raw 노출 방지 → error code 기반 로컬라이즈드 매핑"이라는 하나의 후속 리팩토링 목표에 수렴한다. `use-base-model-loader.ts` 추출이 요청 범위보다 한 단계 더 나아가는 DRY 리팩토링이나, 두 훅에 동일 파라미터를 병렬로 추가할 때 생기는 중복을 제거하는 자연스러운 선택으로 현 작업 의도를 지원한다. 무관한 파일 수정, 불필요한 포맷팅 변경, 요청되지 않은 기능 추가는 발견되지 않는다. 단, `sanitize-loader-error.ts`의 전략 교체(truncate → code-map only)는 기존 동작과의 호환성이 완전히 단절되는 변경임을 인지해야 하며, 현재 모든 호출 경로에 `errorMessagesByCode`가 주입되어 있음을 확인했다.

## 위험도

LOW

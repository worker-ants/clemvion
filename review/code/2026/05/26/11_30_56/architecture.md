# Architecture Review

검토 대상: LLM 설정 / 임베딩 모델 선택 — select-only 전환 (llm-model-select)

---

## 발견사항

### [WARNING] `EmbeddingModelCombobox` 가 `useModelLoader` 를 재사용하지 않고 동일 로직을 인라인으로 중복 구현

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 전체
- 상세: `ModelCombobox` 는 `useModelLoader` hook 에 mutation, stale-closure guard, error sanitization, reset-on-prop-change 를 모두 위임하고 있다. 반면 `EmbeddingModelCombobox` 는 동일 관심사(useMutation, onMutate/onSuccess/onError 에러 파싱, prevResetKey 패턴)를 컴포넌트 내부에 인라인으로 다시 구현했다. 유일한 차이점은 (a) 로더 경로가 `llmConfigsApi.listModels(..., { type: "embedding" })` 한 가지 고정이라는 점과 (b) 로더 진입 조건이 `effectiveConfigId` 의 존재 여부라는 점이다. 이는 DRY 위반이자 단일 책임 원칙(SRP) 관점에서 "모델 불러오기 로직" 이라는 관심사가 두 컴포넌트에 분산되어 있음을 의미한다. 향후 에러 파싱 방식이나 stale guard 전략이 변경될 때 두 곳을 동시에 수정해야 하는 결합도 문제가 발생한다.
- 제안: `useModelLoader` 의 `mutationFn` 을 외부에서 주입 받거나, `useEmbeddingModelLoader` 같은 별도 hook 을 만들어 `EmbeddingModelCombobox` 도 hook 으로 로직을 위임하도록 리팩터링한다. 가장 단순한 방법은 `useModelLoader` 에 `configId` 기반 단순 경로(apiKey 없이 llmConfigId + type 파라미터만 사용)를 처리하는 overload 또는 별도 hook 을 추출하는 것이다.

---

### [WARNING] `EmbeddingModelCombobox` 내부의 API 응답 정규화 로직이 컴포넌트 레이어에 혼재

- 위치: `embedding-model-combobox.tsx` 46~52행
- 상세: `configsRes` 를 `{ data?: LlmConfigData[] }` 래퍼와 직접 배열 두 가지 형태를 모두 처리하는 분기 코드가 컴포넌트 내부에 존재한다. 이는 API 응답의 불일치(`TransformInterceptor` 래핑 여부)를 프레젠테이션 레이어에서 직접 처리하는 것으로, 데이터 레이어 책임이 컴포넌트에 누출된 형태다. `ModelCombobox` 는 `useModelLoader` hook 을 통해 이 처리를 격리하고 있는데, `EmbeddingModelCombobox` 는 같은 처리를 직접 수행한다.
- 제안: `llmConfigsApi.getAll()` 의 반환 타입을 정규화하거나(`LlmConfigData[]` 를 항상 반환하도록), 또는 response shape 정규화를 담당하는 selector/adapter 레이어를 `@/lib/api/llm-configs` 내부로 이동시킨다. 이렇게 하면 컴포넌트는 정규화된 배열만 받으면 된다.

---

### [INFO] `ModelCombobox` 컴포넌트 명칭이 변경된 역할을 반영하지 못함

- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` 컴포넌트 명칭 및 파일명
- 상세: 컴포넌트가 `<Input list="datalist">` 기반 combobox 에서 `<NativeSelect>` 기반 select-only 위젯으로 변경되었지만, 컴포넌트명과 파일명은 `ModelCombobox` / `model-combobox` 로 유지되었다. plan 에서 "호출자 영향 최소화" 를 위해 명칭을 유지한다고 명시했으므로 의도적 결정이며, 단기적으로는 합리적이다. 그러나 중장기적으로 `Combobox` 라는 명칭이 free-text input + dropdown 선택 두 가지를 모두 지원하는 위젯을 연상시키므로, 유지보수 시 혼란의 여지가 있다.
- 제안: 즉각적인 변경을 강제하지는 않으나, 다음 major refactor 시점에 `ModelSelect` 로 rename 하는 것을 고려한다. 현재는 파일 상단 주석에 "select-only 로 변경됨" 을 명시하는 것만으로도 충분하다.

---

### [INFO] 상태 초기화 패턴(`prevResetKey`) 이 두 컴포넌트에서 각각 사용되나 추상화 레벨이 다름

- 위치: `embedding-model-combobox.tsx` 62~68행, `use-model-loader.ts` 72~77행
- 상세: `useModelLoader` 는 `resetKey = \`${provider}|${configId ?? ""}\`` 조합으로 초기화 트리거를 계산하고, `EmbeddingModelCombobox` 는 `effectiveConfigId ?? ""` 단일 값으로 같은 패턴을 구현한다. 두 구현 모두 React 권장 "render-phase state update on prop change" 패턴을 올바르게 따르고 있다. 이는 기술적으로 문제가 없으나, `EmbeddingModelCombobox` 가 hook 으로 로직을 위임할 경우(위 WARNING 참고) 이 패턴도 자연스럽게 hook 내부로 통합된다.
- 제안: 독립 변경 항목은 아니며, [WARNING] #1 이 해결되면 자동으로 해소된다.

---

### [INFO] `EmbeddingModelCombobox` 가 `llmConfigsApi.getAll()` 을 독립적으로 구독

- 위치: `embedding-model-combobox.tsx` 41~55행
- 상세: `["llm-configs"]` 쿼리 키로 `llmConfigsApi.getAll()` 을 컴포넌트 내부에서 직접 구독한다. 이 자체는 문제가 없으나(React Query 는 동일 쿼리 키를 캐시에서 공유함), 컴포넌트가 "default config ID 를 찾기 위해 전체 config 목록을 가져온다" 는 부수적 데이터 의존성을 가진다. 이는 컴포넌트의 책임 범위가 "모델 선택 UI" 를 넘어 "워크스페이스 LLM 설정 조회" 까지 포함하게 만든다.
- 제안: 호출 계층에서 `effectiveLlmConfigId` 를 resolve 하여 prop 으로 전달하거나, 이 조회 로직을 별도 hook(`useDefaultLlmConfigId`)으로 분리해 컴포넌트의 관심사를 좁힌다. 다만 현재 `llmConfigId?: string` prop 이 optional 이므로 컴포넌트가 fallback 을 스스로 처리해야 하는 설계상 필요이기도 하다. 인터페이스를 `llmConfigId: string` (required) 로 변경하고 fallback resolve 를 상위로 위임하는 것이 더 명확한 모듈 경계를 만든다.

---

## 요약

이번 변경은 자유 입력(datalist combobox) 에서 select-only 위젯으로의 전환이라는 명확한 목적을 가지며, `ModelCombobox` 의 경우 `useModelLoader` hook 을 통한 관심사 분리가 잘 되어 있다. 핵심 아키텍처 문제는 `EmbeddingModelCombobox` 가 `useModelLoader` 와 동일한 mutation/error-handling/stale-guard 로직을 인라인으로 중복 구현했다는 점이다. 두 컴포넌트가 같은 패턴을 공유하지 않아 향후 로더 전략 변경 시 두 파일을 동시 수정해야 하는 결합도가 생겼다. 또한 `EmbeddingModelCombobox` 내부의 API 응답 정규화 코드가 프레젠테이션 레이어에 데이터 레이어 책임을 일부 혼재시키고 있다. 그 외 `NativeSelect` UI 컴포넌트 자체는 단일 책임·높은 응집도를 잘 지키고 있으며, i18n 키 추가도 en/ko parity 가 유지되었다. 순환 의존성은 발견되지 않았다.

---

## 위험도

LOW

중복 구현으로 인한 장기 유지보수 부담은 있으나 현재 동작 정확성에는 영향이 없다. API 응답 정규화 코드의 레이어 혼재도 현재 런타임 오동작 위험은 낮다. 즉각적인 블로킹 결함은 없으며, 다음 관련 변경 시 리팩터링을 권장하는 수준이다.

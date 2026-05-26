# 요구사항(Requirement) 리뷰 결과

리뷰 대상: LLM 설정·임베딩 모델 선택 UI 의 `<Input list>` → `<NativeSelect>` 전환 (select-only)  
관련 plan: `plan/in-progress/llm-model-select-only.md`  
관련 spec: `spec/2-navigation/6-config.md §B.2`, `spec/2-navigation/5-knowledge-base.md §2.2`

---

## 발견사항

### [WARNING] `use-model-loader.ts` onError 에서 기존 모델 목록을 보존하는 동작이 새 테스트에서 미검증

- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` line 107 주석 + 삭제된 테스트 케이스 "keeps previously loaded models visible when a retry fails"
- 상세: `use-model-loader.ts` 의 `onError` 핸들러는 의도적으로 `setModels([])` 를 호출하지 않아 재시도 실패 시 이전에 로드된 목록을 UI 에 유지한다 (line 107 주석: "재시도 실패 시 이전에 로드된 모델 목록은 유지"). 그러나 이 동작을 검증했던 `model-combobox.test.tsx` 의 "keeps previously loaded models visible when a retry fails" 케이스는 새 테스트 스위트에서 삭제됐다. 새 테스트 파일에는 초기 실패(모델 미로드 상태) 케이스만 있고, "로드 성공 후 재시도 실패" 경로는 검증되지 않는다.
- 제안: `use-model-loader.test.tsx` 또는 `model-combobox.test.tsx` 에 "기존 목록 로드 성공 후 재시도 실패 → 이전 목록 유지 + 에러 메시지 표시" 케이스를 추가.

---

### [WARNING] `embedding-model-combobox.tsx` 의 `embeddingModels` 이중 필터링 — 중복 로직

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` line 606-607 (`embeddingModels = models.filter(m => m.type === "embedding")`) 와 `loadMutation.mutationFn` 의 API 호출 (`{ type: "embedding" }` 파라미터)
- 상세: `llmConfigsApi.listModels(snapshot, { type: "embedding" })` 를 호출할 때 이미 서버 측에서 `embedding` 타입만 걸러 반환하도록 요청하고 있다. 그럼에도 클라이언트에서 `models.filter(m => m.type === "embedding")` 를 한 번 더 수행한다. 이중 필터 자체는 결과에 영향을 주지 않으나, `models` 의 원소 전부가 `type === "embedding"` 이어야 한다는 불변식이 코드에서 명시적으로 드러나지 않아 유지보수 시 혼란을 줄 수 있다. 또한 listModels API 가 서버에서 타입 필터를 지원하지 않는 경우 방어 역할을 하므로 완전히 불필요하다고 보기도 어렵다.
- 제안: 주석으로 "서버 파라미터가 빠진 경우 방어 필터" 임을 명시하거나, 서버 필터를 신뢰한다면 클라이언트 필터를 제거해 의도를 단일화.

---

### [WARNING] `model-combobox.test.tsx` 에서 삭제된 "trims apiKey/baseUrl" 케이스가 새 테스트에 미커버

- 위치: 삭제된 테스트 "trims apiKey and baseUrl before calling preview endpoint"
- 상세: `use-model-loader.ts` 의 `mutationFn` 은 `apiKey.trim()` / `baseUrl?.trim()` 을 명시적으로 수행한다 (line 78-79). 이 동작을 검증했던 케이스가 리팩토링 과정에서 `model-combobox.test.tsx` 에서 삭제됐으며, `use-model-loader.test.tsx` 에서 대체되었는지 확인이 필요하다.
- 제안: `use-model-loader.test.tsx` 에 trim 케이스가 포함돼 있는지 확인. 없다면 해당 훅 단위 테스트에 추가.

---

### [WARNING] `embedding-model-combobox.tsx` — `loadMutation.isSuccess` 가 `llmConfigId` 변경 시 stale 상태로 남을 수 있음

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` line 410 (`isEmpty` 계산식)
- 상세: `llmConfigId` prop 변경 시 render-phase reset 패턴으로 `models` / `errorMessage` 는 초기화된다. 그러나 `loadMutation` 자체(`useMutation` 인스턴스)의 `isSuccess` / `isPending` 상태는 리셋되지 않는다. `isEmpty` 는 `!errorMessage && loadMutation.isSuccess && embeddingModels.length === 0` 으로 계산하는데, `llmConfigId` 변경 직후 `loadMutation.isSuccess === true` 이고 새로 초기화된 `models === []` 이면 "사용 가능한 모델이 없어요" 메시지가 잘못 표시된다.
- 제안: `isEmpty` 계산 시 `models.length === 0` 대신 `hasLoadedModels` 에 의존하거나, `resetKey` 변경 시 `loadMutation.reset()` 을 함께 호출하는 방안 검토. `embedding-model-combobox.test.tsx` 의 "clears loaded models and resets select when llmConfigId changes" 케이스가 `isEmpty` 메시지까지 검증하도록 보강 권장.

---

### [INFO] `model-combobox.tsx` — `savedValueMissingFromLoaded` 조건이 모델 미로드 상태에서도 항상 `true`

- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` line 1467-1468
- 상세: `chatModels` 가 빈 배열인 모델 미로드 상태에서 `value !== ""` 이면 `savedValueMissingFromLoaded === true` 가 된다. 결과적으로 편집 플로우에서 기존 저장값이 있을 때 모델 미로드 상태에서도 placeholder option 이 노출된다. 이는 spec §B.2 수정 플로우 "기존에 저장된 모델 ID 가 새로 불러온 목록에 없을 경우 placeholder option 노출" 의도에 부합하며 동작에는 문제 없다. 단, `model-combobox.test.tsx` 의 "preserves a previously saved model id as a placeholder option when not in the loaded list" 케이스가 로드 전 상태를 `getSelect().value === 'claude-sonnet-old-id'` 로 검증하고 있어 이 동작이 테스트로 커버됨을 확인함.

---

### [INFO] `embedding-model-combobox.test.tsx` — `DEFAULT_CONFIG` 모킹에 `isDefault: true` 가 있으나 타입 불일치 가능성

- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx` line 67-70
- 상세: `DEFAULT_CONFIG = { id: "default-cfg", isDefault: true }` 로 최소 모킹 객체를 정의하고, `llmConfigsApi.getAll` 의 반환값을 `{ data: [DEFAULT_CONFIG] }` 로 설정한다. `LlmConfigData` 타입에 필수 필드가 더 있을 경우 TypeScript 는 이를 타입 에러로 잡겠지만, 테스트는 `vi.fn()` 이라 런타임 에러로 이어지지 않는다. 기능 동작에는 문제가 없으나 테스트 픽스처 타입 완전성이 낮다.
- 제안: `Partial<LlmConfigData>` 또는 최소한 `as LlmConfigData` 캐스팅을 명시하거나, 필수 필드를 픽스처에 포함.

---

### [INFO] Spec fidelity — `spec/2-navigation/6-config.md §B.2` 와 코드 구현 일치 확인

- 위치: `spec/2-navigation/6-config.md` §B.2 "기본 모델 선택 UX" (commit `0c3f40a8` 에서 갱신됨)
- 상세: spec 변경과 구현 변경이 분리 커밋으로 처리됐으며, spec 내용과 구현이 아래와 같이 line-level 로 일치함을 확인:
  - "모델을 한 번도 불러오지 않은 상태에서는 select 가 비활성" → `selectDisabled = disabled || !hasLoadedModels` 구현 일치
  - "조회 실패 시 select 는 비활성, 에러 메시지만 표시" → `onError` 에서 `setErrorMessage` 호출, `selectDisabled` 유지 일치
  - "저장된 모델 ID 가 새로 불러온 목록에 없을 경우 placeholder option 노출" → `savedValueMissingFromLoaded` 조건 일치
  - "type === 'chat' 모델만 노출" → `chatModels = models.filter(m => m.type === 'chat')` 일치
  - "생성 플로우 preview 엔드포인트 / 수정 플로우 listModels 엔드포인트" → `use-model-loader.ts` `useSavedConfig` 분기 일치

---

### [INFO] Spec fidelity — `spec/2-navigation/5-knowledge-base.md §2.2` 와 코드 구현 일치 확인

- 위치: `spec/2-navigation/5-knowledge-base.md` §2.2 (commit `0c3f40a8` 에서 갱신됨)
- 상세: "지정된 LLMConfig (미지정 시 워크스페이스 default) 의 임베딩 모델 목록을 '모델 불러오기' 버튼으로 조회한 뒤 select 로 선택. 자유 텍스트 입력은 허용하지 않는다. 미로드/조회 실패 시 select 비활성, 에러 메시지만 표시" — 구현과 일치 확인.
  - `llmConfigId ?? defaultConfigId` fallback 구현 일치
  - `loadMutation.mutate()` 버튼 트리거 패턴 일치
  - spec Rationale R-1 의 "LLMConfig 변경 시 select 의 현재 값은 초기화" → `resetKey` 변경 시 `setModels([])` 일치
  - spec Rationale R-1 의 "명시적 버튼 트리거, 자동 prefetch 없음" → `useQuery` 제거 후 `useMutation` 전환 일치

---

### [INFO] `llmConfigs.loadModelsHint` 변경 — 텍스트가 동어 반복

- 위치: `codebase/frontend/src/lib/i18n/dict/en/llmConfigs.ts` `loadModelsHint` 키
- 상세: `loadModelsHint: "Click \"Load models\" to pick from the provider's model list"` 는 모델 로드 성공 후에만 표시되는 hint 텍스트인데, 이 시점에 사용자는 이미 모델을 로드한 상태이므로 "Click Load models" 안내가 redundant 하다. 기능에 영향은 없으나 메시지 정확성 관점에서 "Pick a model from the list above" 등 로드 완료 후 상태에 맞는 표현이 더 적합할 수 있다.

---

## 요약

핵심 요구사항인 "자유 텍스트 입력 제거 → select-only 전환"은 `ModelCombobox`, `EmbeddingModelCombobox` 두 컴포넌트 모두에서 완전히 구현되었으며, spec `§B.2` 및 `§2.2` 와 line-level 로 일치한다. 편집 플로우에서의 저장값 호환(placeholder option), 에러 시 비활성 유지, LLMConfig 변경 시 목록 초기화, 워크스페이스 default fallback 등 요구된 엣지 케이스도 빠짐 없이 처리됐다. 단, `embedding-model-combobox.tsx` 에서 `llmConfigId` prop 변경 시 `loadMutation.isSuccess` 가 리셋되지 않아 "빈 목록" 메시지가 잘못 표시될 수 있는 경계 케이스(WARNING)와, 재시도 실패 시 기존 모델 목록 보존 동작에 대한 테스트 커버리지 누락(Warning)이 확인됐다. 두 항목은 별도 수정이 필요하며, 나머지는 INFO/개선 권고 수준이다.

## 위험도

MEDIUM

`EmbeddingModelCombobox` 에서 `llmConfigId` 변경 직후 stale `isSuccess` 플래그로 인해 "사용 가능한 모델이 없어요" 메시지가 잘못 표시될 수 있는 시나리오는 사용자가 LLMConfig 를 전환하는 실 사용 흐름에서 재현 가능하다. 표시 오류이므로 데이터 손상으로 이어지지 않으나, select-only 강제라는 본 변경의 핵심 의도(잘못된 모델 저장 차단)를 교란하는 혼란을 초래할 수 있다.

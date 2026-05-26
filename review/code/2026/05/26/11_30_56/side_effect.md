# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `ModelCombobox`: `placeholder` prop 은 더 이상 `<input>` 에 전달되지 않고 비어있는 경우의 disabled option 텍스트로만 사용됨 — 호출자 인터페이스 의미 변화

- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` line 75, `codebase/frontend/src/app/(main)/llm-configs/page.tsx` line 278
- 상세: 변경 전 `placeholder` 는 `<Input>` 의 HTML placeholder 속성으로 전달되어 빈 입력 필드에 안내 텍스트를 표시했다. 변경 후에는 `value === ""` 일 때 `<option value="" disabled>` 의 텍스트로만 사용된다. 호출자(`page.tsx`)는 `placeholder={t("llmConfigs.modelPlaceholder")}` 를 그대로 전달하고 있어 런타임 오류는 없으나, prop의 시각적·의미론적 역할이 바뀌었다. `value !== ""` 인 편집 모드에서는 이 option 자체가 렌더링되지 않으므로 placeholder 는 완전히 숨겨진다.
- 제안: prop JSDoc 에 "value 가 빈 문자열일 때 disabled option 의 label 로 사용" 임을 명시하거나, 이름을 `emptyLabel` / `selectPlaceholder` 로 변경해 의미를 명확히 한다. 현재로서는 기능상 문제 없음.

---

### [WARNING] `EmbeddingModelCombobox`: render 단계 setState 연쇄 (React 권장 패턴이나 loadMutation 상태 초기화 누락)

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` lines 358-364 (전체 컨텍스트 기준)
- 상세: `prevResetKey !== resetKey` 분기에서 `setModels([])`, `setErrorMessage(null)` 을 렌더 중에 호출한다. React 공식 "reset state on prop change" 패턴이므로 동작은 올바르지만, `loadMutation` 자체의 상태(isPending, isSuccess, isError)는 초기화되지 않는다. 예를 들어 사용자가 llmConfigId=A 로 모델을 로드한 뒤 llmConfigId=B 로 바꾸면 `models` 와 `errorMessage` 는 초기화되지만 `loadMutation.isSuccess === true` 가 그대로 남는다. `isEmpty` 계산에 `loadMutation.isSuccess` 가 포함되어 있어 B 에서 아직 로드하지 않은 상태임에도 `isEmpty = true` 가 성립될 가능성이 있다(`embeddingModels.length === 0` 조건 충족 + `!errorMessage` 조건 충족 + `isSuccess` 잔류). 이 경우 "No models available" 힌트가 버튼 클릭 전에 깜빡 보일 수 있다.
- 제안: `resetKey` 변경 시 `loadMutation.reset()` 도 함께 호출하여 mutation 상태를 초기화한다. 단, `useMutation` 의 `reset` 은 렌더 중 호출이 안전하지 않으므로 `useEffect`(의존성: `resetKey`) 로 분리하거나, `isEmpty` 계산에 별도 `hasAttemptedLoad` state 를 두는 방식으로 해결한다. 동일 패턴이 `useModelLoader` 에도 있으나 거기서는 `isSuccess` 가 외부에 직접 노출되어 `ModelCombobox` 가 `isEmpty` 계산에 사용하므로 동일 위험이 존재한다.

---

### [WARNING] `useModelLoader`: `onError` 콜백이 재시도 실패 시 이전 로드 모델 목록을 유지하지만, 변경된 동작이 테스트에 반영되지 않음

- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` lines 106-118, `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 이전 코드에는 "keeps previously loaded models visible when a retry fails" 테스트가 있었다 — 첫 번째 로드 성공 후 두 번째 로드 실패 시 기존 모델이 datalist 에 유지되는 것을 검증했다. 이 테스트가 새 코드에서 삭제되었다. `useModelLoader.onError` 는 여전히 `setModels` 를 호출하지 않아 재시도 실패 시 기존 모델을 유지하는 의도가 코드에 남아 있으나, 동작이 검증되지 않는 상태가 되었다. `ModelCombobox` 는 이제 `NativeSelect` 기반이라 재시도 실패 시 기존 select option 이 유지되는지 확인하는 테스트가 없다.
- 제안: "재시도 실패 시 기존 로드 옵션이 select 에 유지되는지" 테스트 케이스를 새 select 기반으로 복원한다.

---

### [INFO] `EmbeddingModelCombobox` 에서 `axios` 를 직접 import — 기존 컴포넌트와 다른 패턴

- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` line 309 (전체 컨텍스트)
- 상세: `useModelLoader` 는 이미 axios isAxiosError 체크를 내부에 캡슐화하고 있다. `EmbeddingModelCombobox` 는 자체 `useMutation` 을 유지하므로 직접 `axios` 를 import 하는 것은 자연스럽지만, `useModelLoader` 와 동일한 에러 sanitization 로직이 두 곳에 중복되어 있다(lines 390-399 vs use-model-loader.ts lines 107-118). 향후 에러 처리 변경 시 한 곳만 수정되는 drift 위험이 있다.
- 제안: `EmbeddingModelCombobox` 의 mutation 로직을 별도 custom hook(예: `useEmbeddingModelLoader`)으로 추출하거나, 에러 sanitize 유틸 함수를 공유하는 방식을 고려한다. 현재 동작에는 문제 없음.

---

### [INFO] `ModelCombobox` `savedValueMissingFromLoaded` 조건: 모델 미로드 상태에서도 항상 `true` 가 됨

- 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` lines 66-67
- 상세: `savedValueMissingFromLoaded = value !== "" && !chatModels.some((m) => m.id === value)`. 편집 모드에서 `value` 에 기존 저장 모델 ID 가 있고 아직 "모델 불러오기" 를 누르지 않은 상태라면 `chatModels === []` 이므로 조건이 `true` 가 되어 placeholder option("현재 저장값: <id>")이 렌더링된다. 이는 `selectDisabled = true` 이지만 option 은 노출되는 상태다. 기능상 의도된 동작(저장값을 선택 전에 미리 보여줌)이며, 테스트 `"preserves a previously saved model id as a placeholder option when not in the loaded list"` 에서도 동일하게 검증하고 있다. 그러나 이 로직이 "로드 전"과 "로드 후 목록에 없음"을 구분하지 않아, 사용자가 보는 label("현재 저장값: xxx")이 두 경우 모두 동일하게 표시된다. "로드 전"에는 다른 안내 문구가 더 명확할 수 있다.
- 제안: 기능 문제는 아니나, `isSuccess` 상태와 결합하여 "로드 전 저장값 표시"와 "로드 후 목록 부재 저장값 유지"를 레이블 수준에서 구분하는 것을 고려할 수 있다.

---

### [INFO] i18n 딕셔너리 — `ko/knowledgeBases.ts` 의 새 키에 `embeddingModelSavedFallback` 패턴 변수 `{{model}}` 이 올바르게 포함되어 있는지 타입 검사에서 보장되지 않음

- 위치: `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts` line 1690
- 상세: `embeddingModelSavedFallback: "현재 저장값: {{model}}"` 은 `en` 대응 키와 동일하게 `{{model}}` 보간 변수를 포함하고 있어 런타임에는 올바르다. `ko/llmConfigs.ts` 의 `modelSavedFallback: "현재 저장값: {{model}}"` 도 동일. 부작용 관점에서는 보간 변수 누락 시 `{{model}}` 리터럴이 그대로 노출되는 것이 유일한 위험이며, 현재 코드는 올바르게 작성됨.
- 제안: 별도 조치 필요 없음.

---

## 요약

이번 변경은 `<Input list="datalist">` 기반 자유 입력 combobox 를 `<NativeSelect>` 기반 select-only 로 전환하는 UX 리팩터링이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 변경, 의도치 않은 네트워크 호출은 없다. 컴포넌트 공개 인터페이스(`ModelComboboxProps`, `EmbeddingModelComboboxProps`)는 prop 이름이 유지되고 호출자(`page.tsx`, `kb-form-body.tsx`)가 전달하는 prop 도 그대로이므로 Breaking Change는 없다. 주요 부작용 위험은 두 가지다: (1) `EmbeddingModelCombobox` 에서 `llmConfigId` 변경 시 `loadMutation` 의 `isSuccess` 상태가 초기화되지 않아 `isEmpty` 조건이 일시적으로 오판될 수 있고, (2) `useModelLoader` 의 재시도-실패-시-모델-유지 동작을 검증하던 테스트가 제거되어 동작 보장이 약해졌다. `placeholder` prop 의 의미 변화는 기존 호출자에게 실질적 영향이 없으나 문서화가 권장된다.

---

## 위험도

LOW

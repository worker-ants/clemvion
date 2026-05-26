# 문서화(Documentation) 리뷰 결과

리뷰 대상: LLM 설정 / 임베딩 모델 선택 select-only 전환 (llm-model-select)
리뷰 일시: 2026-05-26

---

## 발견사항

### [INFO] `embedding-model-combobox.tsx` — 모듈 수준 주석이 이전 동작을 일부 잔류 참조
- 위치: `/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 상단 모듈 주석 (라인 531-533)
- 상세: 모듈 주석은 변경된 동작("모델 불러오기 버튼 클릭 시점에만 조회")을 정확히 반영하고 있으며, 자유 입력 제거 이유를 spec R-1 링크로 명시하고 있다. 그러나 `use-model-loader.ts` 의 라인 64-67 인라인 주석(`datalist 에 남아 autocomplete 가 잘못된 모델을 제안하지 않도록`)이 `datalist`/autocomplete 관련 언어를 그대로 유지하고 있다. 이 훅은 `ModelCombobox` 에서만 사용되며, 해당 컴포넌트는 `<datalist>` 를 완전히 제거하고 `<NativeSelect>` 로 교체됐다. 주석 내 "datalist" / "autocomplete" 표현이 코드 현실과 불일치한다.
- 제안: `/codebase/frontend/src/components/llm-config/use-model-loader.ts` 라인 64-67 주석을 "이전 provider 의 모델 목록이 select 에 잔류하지 않도록 render 단계에서 초기화" 등으로 수정.

---

### [INFO] `NativeSelect` 컴포넌트 — JSDoc 없음
- 위치: `/codebase/frontend/src/components/ui/native-select.tsx`
- 상세: `NativeSelect` 는 이번 변경으로 `ModelCombobox` 와 `EmbeddingModelCombobox` 두 공개 컴포넌트에서 의존하게 된 UI 원자 컴포넌트다. 현재 파일에 JSDoc/주석이 전혀 없다. `Input`, `Button` 등 다른 `ui/` 컴포넌트들과의 일관성 측면에서 최소한 컴포넌트 목적, 사용 시나리오(select-only 강제 목적), 접근성 관련 참고사항 정도의 문서가 있으면 유지보수에 유용하다. 다만 `forwardRef` 래퍼가 표준 `<select>` 를 그대로 노출하는 단순 thin wrapper 이므로 문서 부재가 기능 이해를 크게 해치지는 않는다.
- 제안: 컴포넌트 선언 앞에 짧은 JSDoc 블록 추가.
  ```tsx
  /**
   * Thin styled wrapper around <select>. Use when a model picker must be
   * select-only (no free-form text entry). Forwards all native select attributes.
   */
  ```

---

### [INFO] `EmbeddingModelCombobox` — `placeholder` prop 의 실제 사용 범위가 기존과 달라졌으나 JSDoc 미갱신
- 위치: `/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` `EmbeddingModelComboboxProps` 인터페이스
- 상세: `placeholder` prop 의 JSDoc 이 없다. 이전 구현(자유 입력 `<Input>`)에서는 `<Input placeholder={...}>` 에 직접 전달됐으나, 변경 후에는 `<option value="" disabled>` 의 텍스트로만 사용된다. 이 의미 변화가 `EmbeddingModelComboboxProps` 인터페이스에 문서화되어 있지 않다. `ModelComboboxProps` 의 `placeholder` 도 동일 상황이나, 해당 컴포넌트는 `llmConfigId` 에 JSDoc 이 있으므로 인터페이스 자체에 문서 작성 의지가 있음을 보여준다.
- 제안: `EmbeddingModelComboboxProps.placeholder` 에 JSDoc 추가: `/** 모델 미선택 상태일 때 select 의 비활성 placeholder 옵션 텍스트. */`

---

### [INFO] `plan/in-progress/llm-model-select-only.md` — REVIEW 계획 항목이 현재 진행 중인 상태를 반영하지 않음
- 위치: `/plan/in-progress/llm-model-select-only.md` 마지막 섹션 `## REVIEW 계획`
- 상세: `## REVIEW 계획` 에 `/ai-review 호출 후 SUMMARY 처리` 만 기재되어 있다. Plan 파일은 현재 리뷰가 진행 중임을 나타내는 상태나, 완료된 consistency check 결과 경로(`review/consistency/2026/05/26/10_59_37/`)에 대한 참조가 없다. 이는 plan lifecycle 상 사소한 누락이지만, 추후 다른 작업자가 파일을 참조할 때 리뷰 상태를 추적하기 어렵게 만든다. Plan lifecycle 문서(`.claude/docs/plan-lifecycle.md`)에 따르면 완료 후 `plan/complete/` 로 이동이 필요하므로 이 항목은 완료 이동 전 점검 대상이다.
- 제안: 리뷰 완료 후 plan 파일에 완료된 review 산출물 경로를 기록하거나, 해당 내용을 포함해 `plan/complete/` 로 이동.

---

### [INFO] i18n 사전 — 새로 추가된 키에 대한 번역 키 목록 문서가 없음
- 위치: `/codebase/frontend/src/lib/i18n/dict/en/llmConfigs.ts`, `/codebase/frontend/src/lib/i18n/dict/ko/llmConfigs.ts`, 동일 `knowledgeBases.ts`
- 상세: 이번 변경으로 새 i18n 키 6개가 추가됐다 (`modelLoadRequired`, `modelSavedFallback`, `loadModelsHint` 수정, `embeddingModelLoadRequired`, `embeddingModelLoadFailed`, `embeddingModelSavedFallback`). 새 키들은 en/ko 양쪽에 일관되게 추가되어 parity 는 맞다. 그러나 프로젝트 어딘가에 "지원 언어 목록" 이나 "신규 키 추가 체크리스트" 같은 i18n 가이드가 있다면 해당 문서 갱신이 필요할 수 있다. 현재 파일 내 주석이나 상위 README 에 언어 확장 안내가 없는 것을 포함해, i18n 추가 절차 문서화가 없는 것은 참고할 만한 개선점이다. 단, 이는 이번 변경 범위를 벗어나는 구조적 문제다.
- 제안: 즉각 조치 불필요. 향후 i18n 가이드 문서 작성 시 신규 키 추가 절차를 포함할 것을 권장.

---

### [INFO] `use-model-loader.ts` — 재시도 실패 시 모델 목록 유지 동작이 주석에 잔류하나, `ModelCombobox` 에서의 실제 UX 변경 사실을 반영하지 않음
- 위치: `/codebase/frontend/src/components/llm-config/use-model-loader.ts` 라인 107
- 상세: `onError` 핸들러 위의 주석 "재시도 실패 시 이전에 로드된 모델 목록은 유지해 사용자 선택 컨텍스트를 보존"은 기술적으로 정확하나, 이번 변경으로 `ModelCombobox` 는 모델 목록 미로드 시 select disabled 정책을 채택했다. "keeps previously loaded models visible when a retry fails" 테스트 케이스는 이번 변경에서 삭제됐고, 해당 동작을 검증하는 테스트가 더 이상 존재하지 않는다. 주석은 남아 있으나 그 동작이 계속 보장되는지 검증 경로가 없다. 단, `use-model-loader.ts` 의 `onError` 는 `setModels([])` 를 호출하지 않으므로 이전 목록 유지 자체는 여전히 작동한다. 테스트 커버리지 관점의 문서 불일치다.
- 제안: 주석을 유지하거나, 해당 동작을 검증하는 테스트를 `use-model-loader.test.tsx` 에 추가. 현재 상태는 실제 동작과 다르지 않으므로 낮은 우선순위.

---

## 요약

이번 변경은 `<Input list="datalist">` 기반 자유 입력을 `<NativeSelect>` 기반 select-only 로 전환하는 작업이다. 문서화 측면에서 전반적으로 양호하다. `spec/2-navigation/6-config.md` 와 `5-knowledge-base.md` 에 `## Rationale` 섹션 및 R-1 결정 근거가 신설되어 있고, `EmbeddingModelComboboxProps.llmConfigId` 와 `UseModelLoaderArgs` 인터페이스에 JSDoc 이 작성되어 있으며, 모듈 수준 주석도 변경 의도를 명확히 기술하고 있다. 발견된 이슈는 모두 INFO 등급이며, 주요 사항은 `use-model-loader.ts` 내 `datalist`/`autocomplete` 언어가 실제 `<datalist>` 를 제거한 코드 현실과 불일치한다는 점과, 신규 도입된 `NativeSelect` 컴포넌트에 JSDoc 이 없다는 점이다. 어느 것도 기능 이해를 크게 해치지 않으며, 즉시 블로킹 처리가 필요한 CRITICAL/WARNING 발견사항은 없다.

---

## 위험도

LOW

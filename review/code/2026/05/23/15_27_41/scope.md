# 변경 범위(Scope) 리뷰 — render-form-options-and-state-fix

## 변경 의도 확인

`plan/in-progress/render-form-options-and-state-fix.md` 에 따르면 이 PR 의 의도된 범위는 다음 7가지 문제를 한 PR 로 해결하는 것이다 (사용자 결정: "한개의 pr로 전부 진행해"):

1. `option.value` collision (핵심 원인 — backend backfill)
2. DynamicFormUI state remount (key prop 안정화)
3. `number` 빈 입력 → 0 자동 강제 제거
4. `select`/`radio` type drift (String coerce)
5. `defaultValue` 재진입 stale → `initialValueFor` 추출
6. `file` 타입 미구현
7. 테스트 신규 작성 (backend + frontend)

## 발견사항

### [INFO] 파일 1: render-tool-provider.spec.ts — 의도된 범위 내

- 위치: 전체 추가 블록 (line 43–309)
- 상세: `backfillFormOptionValues` 단위 테스트 + execute() 통합 테스트. plan (C) 에서 명시적으로 요구한 테스트 선작성에 해당. non-op 케이스, empty string 처리, 보존 케이스, null/undefined, 타입 드리프트, 필드 간 인덱스 구분, options 없는 필드, 조기 반환 최적화, 비정형 입력 — 모두 plan 에서 요구된 커버리지 범위 내. 범위 초과 없음.
- 제안: 없음.

### [INFO] 파일 2: render-tool-provider.ts — 의도된 범위 내

- 위치: `backfillFormOptionValues` 함수 추가 (line 333–397), `execute()` 안 합성 변경 (line 406–422)
- 상세: plan (C) 에서 명시한 `backfillFormOptionValues` 헬퍼 신설 및 `backfillButtonUuids` 와 동일 위치 합성이 그대로 구현됨. JSDoc 주석은 결정 배경·근거를 담아 spec Rationale 과 직접 연결되는 내용으로 과도한 설명이 아니다. plan 이 언급한 `form.schema.ts` 의 zod default 변경은 이 파일 변경에 포함되지 않았으나 — backfill 이 일원화 역할을 하므로 schema 변경 없이도 동작하며 plan 에서도 "검토"로 표시된 선택 사항이었다. 범위 초과 없음.
- 제안: 없음.

### [INFO] 파일 3: page.tsx — 의도된 범위 내

- 위치: `<DynamicFormUI>` 에 `key={waitingNodeId ?? "form"}` 추가 (line 451–455) + 주석 5줄 추가
- 상세: plan (A1) 의 "호출 측 (`page.tsx`, `result-detail.tsx`) 에서 `<DynamicFormUI key={waitingNodeId} ... />`" 와 정확히 대응. 주석은 동작 근거를 기록하는 적절한 수준. 그 외 파일 변경 없음. 범위 초과 없음.
- 제안: 없음.

### [INFO] 파일 4: dynamic-form-ui.test.tsx — 신규 파일, 의도된 범위 내

- 위치: 전체 신규 파일 (309 lines)
- 상세: plan 테스트 요구사항 — field type 매트릭스 / select option value 충돌 / number 빈 입력 보존 — 을 모두 포함한다. `file` 케이스 테스트 3건 + `defaultValue` 매트릭스 + radio coerce 는 plan (A4) 의 "field type 매트릭스: text / textarea / number / email / date / select / radio / checkbox / file" 에 대응. 범위 초과 없음.
- 제안: 없음.

### [WARNING] 파일 5: dynamic-form-ui.tsx — 범위 내이나 변경량이 크다

- 위치: 전체 diff (약 120줄 순증가)
- 상세: plan (A1)~(A4) 에서 명시한 네 항목이 모두 포함됨. 그러나 단일 파일에서 다음 변경들이 함께 일어난다:
  1. `FormField` 인터페이스 확장 (`allowedMimeTypes`, `maxFiles` 추가, `value` 타입 `unknown` 으로 완화)
  2. `FilePickMetadata` 인터페이스 + `toFileMetadata` 헬퍼 신설
  3. `fieldInputId` 헬퍼 신설 — 모든 field 에 `htmlFor`/`id` 연결 (label 접근성 개선)
  4. `renderField` 시그니처 변경 (`idx` 파라미터 추가)
  5. `number` onChange 수정, `select`/`radio` key + value coerce 수정
  6. `file` case 추가
  7. `initialValueFor` 헬퍼 신설 (기존 인라인 로직 추출)
  8. checkbox 외부 Label 조건부 제거 (`field.type !== "checkbox"` 분기)
  9. `.map(...)` → `.map(...) { return ... }` 구문 변경 (lambda body 필요로 인한 블록 구문)

  항목 3 (`fieldInputId` 및 모든 필드에 `id`/`htmlFor` 연결) 은 접근성 개선으로, plan 에 명시적으로 포함되지 않은 부가 수정이다. 단, `file` case 추가 시 `<input type="file">` 에 `id` 를 부여하고 label 과 연결하지 않으면 `getByLabelText("첨부")` 테스트가 통과하지 못하므로 사실상 (A4) 구현의 필수 부산물이다. 또한 `id` 연결은 다른 필드 타입에도 일관성을 위해 확장됐다. plan 범위를 벗어난 기능 추가라기보다 구현상 필연적으로 수반된 일관성 적용으로 볼 수 있다.

  항목 8 (checkbox 외부 Label 조건부 제거) 은 이중 label 문제 수정으로 plan 에 명시되지 않았으나, checkbox 필드의 label 구조 오류를 함께 수정한 것이다. 소규모 버그 수정에 해당하며 범위 이탈 수준은 낮다.

- 제안: `fieldInputId` 도입과 모든 필드 `id` 연결은 (A4) file case 의 `getByLabelText` 접근성 요구에서 파생된 것임을 주석 또는 커밋 메시지에서 명시하면 추후 리뷰어의 혼동을 줄일 수 있다.

### [INFO] 파일 6: result-detail.tsx — 의도된 범위 내

- 위치: `<DynamicFormUI key={result.nodeId} ... />` 추가 (3줄) + 주석 3줄
- 상세: plan (A1) 에서 "호출 측 (`page.tsx`, `result-detail.tsx`)" 을 명시적으로 언급했으므로 의도된 변경. 범위 초과 없음.
- 제안: 없음.

### [INFO] 파일 7: plan/in-progress/render-form-options-and-state-fix.md — 의도된 범위 내

- 위치: 신규 파일 (94 lines)
- 상세: 프로젝트 규약에 따라 진행 중 작업은 `plan/in-progress/` 에 기록해야 하며 해당 frontmatter (`worktree`, `started`, `owner`) 도 갖춤. plan-lifecycle 정책 준수. 범위 초과 없음.
- 제안: 없음.

### [INFO] 파일 8–13: review/ 하위 일관성 검토 산출물 — 의도된 범위 내

- 위치: `review/consistency/2026/05/23/14_58_44/` 하위 6개 파일
- 상세: 프로젝트 규약 상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 을 의무적으로 실행해야 하며, 그 산출물이 `review/consistency/` 에 저장된다. `_retry_state.json`, `meta.json`, `convention_compliance.md`, `cross_spec.md`, `naming_collision.md`, `plan_coherence.md` 는 모두 해당 워크플로 산출물이다. 범위 초과 없음.
- 제안: 없음.

## 요약

이 PR 은 사용자가 직접 "한개의 pr로 전부 진행해" 라고 결정한 7가지 form 관련 버그를 한꺼번에 수정한 것으로, plan 파일에 S/A/C 3축으로 명시된 변경 범위와 전체적으로 잘 부합한다. `dynamic-form-ui.tsx` 에서 plan 에 명시되지 않은 접근성 개선(`fieldInputId`, `htmlFor`/`id` 연결)과 checkbox 이중 label 제거가 포함됐으나, 전자는 (A4) file case 테스트 통과를 위한 구현상 필수 부산물이고 후자는 소규모 버그 수정이다. 의도된 범위를 크게 이탈하는 무관한 리팩토링이나 기능 확장은 발견되지 않았다.

## 위험도

LOW

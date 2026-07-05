# 부작용(Side Effect) Review

## 리뷰 대상

- `CHANGELOG.md` (문서 추가)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/switch-config.test.tsx` (신규 테스트)
- `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx` (`SwitchConfig` 에 `required={mode === "value"}` 1줄 추가)

## 분석

- `ExpressionInput` 의 `required` prop 은 `expression-input.tsx:360-364` 에서 `{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}` 형태로만 소비된다. HTML native `required` 속성, `aria-required`, blur/submit validation, disabled 처리 등 어떤 동작 로직과도 연결되어 있지 않다 — 순수 조건부 렌더링(asterisk span)이다. `aria-hidden="true"` 라 스크린리더 시맨틱에도 영향이 없다.
- `mode` 는 기존 코드에 이미 있던 로컬 변수(`const mode = (config.mode as string) ?? "value";`, line 552)로 이번 diff 로 새로 도입되지 않았다. `switchValue` 의 `required` 계산이 이 기존 파생값을 재사용할 뿐, 새 상태·새 파생 로직을 추가하지 않는다.
- `config` 객체 자체(`onChange` 호출 인자)는 변경되지 않는다 — `required` 는 `onChange` 콜백에 전달되는 `{ ...config, switchValue: v }` 페이로드와 무관한 순수 표시(prop)용 값이라 저장되는 워크플로 config JSON 에는 영향이 없다.
- `SwitchConfig` 내 다른 필드(`cases`, `hasDefault` 등)의 렌더링·핸들러(`addCase`, `removeCase`, `updateCase`)는 변경되지 않았고, 이 diff 는 단일 JSX prop 추가에 그친다. 같은 파일 내 `IfElseConfig`, `LoopConfig`, `VariableDeclarationConfig` 등 다른 export 함수들도 무변경.
- `SwitchConfig` 의 함수 시그니처(`{ config, onChange }: { config: Config; onChange: OnChange }`)는 변경되지 않았다. 공개 API·호출자 계약에 영향 없음.
- 신규 테스트 파일은 `useLocaleStore.setState({ locale: "en" })` 로 전역 zustand store 상태를 `beforeEach` 에서 설정하지만, 이는 통상적인 테스트 격리 패턴이며 `cleanup()` 과 함께 각 테스트 전 초기화되므로 다른 테스트 스위트로 누수될 부작용은 없다(단, 이 스토어가 전역 싱글톤이라 병렬 실행 시 이론적 간섭 가능성은 이 프로젝트의 다른 기존 테스트들과 동일한 기존 패턴이며 이번 diff 가 새로 도입한 문제는 아니다).
- 파일시스템·환경 변수·네트워크 호출·이벤트/콜백 시그니처 변경 없음. `CHANGELOG.md` 추가는 문서 전용이며 빌드/런타임에 영향 없음.

## 발견사항

없음 — 검토 관점 8개 항목 모두에서 실질적 부작용을 확인하지 못했다.

## 요약

`required={mode === "value"}` 는 `ExpressionInput` 내부에서 asterisk `<span>` 렌더 여부만 토글하는 순수 시각적 prop 전달로, HTML validation·config 페이로드·다른 필드 로직·컴포넌트 시그니처·전역 상태 어디에도 부수효과를 만들지 않는다. `mode` 는 기존에 이미 존재하던 파생 변수를 재사용했을 뿐 새로 도입되지 않았고, 런타임 필수값 검증은 변경 전과 동일하게 `NodeHandler.validate()` 가 담당한다. 신규 테스트 파일의 `beforeEach` 전역 스토어 설정도 표준 격리 패턴으로 안전하다.

## 위험도

NONE

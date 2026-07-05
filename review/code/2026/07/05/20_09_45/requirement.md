# 요구사항(Requirement) Review — V-12 switchValue required asterisk

## 발견사항

- **[INFO]** `mode` 미지정(undefined) 케이스도 화이트리스트 조건에 정확히 포함됨
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx:553,606`
  - 상세: `const mode = (config.mode as string) ?? "value";` 로 기본값을 먼저 `"value"` 로 확정한 뒤 `required={mode === "value"}` 를 평가하므로, `config.mode` 가 `undefined`(신규 노드 생성 직후 등)여도 asterisk 가 노출된다. `spec/4-nodes/1-logic/2-switch.md` §1 표의 `mode` 기본값(`value`, schema `.default('value')`)과 §8.1 whitelist(`equals: ['value']`)의 조합과 line-level 로 일치 — mode 미설정 시 backend schema 가 parse 시점에 `'value'` 로 채워 넣는 것과 동일한 유효값을 UI 가 선반영한 것. 테스트(`switch-config.test.tsx` 2번째 case)도 이 경로를 커버.
  - 상세: 회색지대 아님 — spec §1 이 `mode` 기본값을 명시하므로 code 가 spec 을 정확히 재현. 기록 목적의 INFO.

- **[INFO]** `mode === "expression"` 일 때 asterisk 미노출 확인, `mode` 가 예기치 못한 임의 문자열(예: 오염된 config)인 경우도 안전하게 처리됨
  - 위치: `logic-configs.tsx:606`
  - 상세: `required={mode === "value"}` 는 `mode` 가 `"value"`/`"expression"` 외의 임의 값(예: 과거 마이그레이션 잔존 값, 수기 편집 JSON)이어도 엄격 동등 비교로 인해 `false` 로 안전하게 fallback — throw 하거나 undefined 렌더링되는 경로 없음. 순수 시각 표시이므로 잘못된 값이 들어와도 크래시 없이 "asterisk 없음"으로 수렴, 실제 검증(§6 표 `handler.validate`)은 별도로 backend 가 수행하므로 이중 안전.
  - 제안: 없음(현행 유지 타당).

- **[INFO]** 런타임 검증과의 관계 — asterisk 는 순수 시각 표시이며 강제하지 않음
  - 위치: `logic-configs.tsx:429-432` 주석, CHANGELOG.md 항목
  - 상세: `required` prop 은 `ExpressionInput` 내부에서 asterisk 렌더링에만 쓰이고(`expression-input.tsx:360-364`), 폼 제출 차단·onBlur validation 등 실제 강제 로직이 전혀 없음(grep 결과 `required` 사용처는 label 렌더 조건뿐). CHANGELOG 도 "순수 시각 표시이며 런타임 검증은 NodeHandler.validate() 가 그대로 담당" 이라고 정확히 명시 — 의도와 구현 간 괴리 없음, 과장된 기능 주장도 없음.

## 검증 근거

1. **spec §8.1 line-level 일치**: `spec/4-nodes/1-logic/2-switch.md` §1 표(`mode` 기본값 `value`, `switchValue` "mode=value 시 ✓") 및 §8.1 Rationale(`requiredWhen: { field: 'mode', equals: ['value'] }` 화이트리스트, 블랙리스트 회피 이유)과 `codebase/backend/src/nodes/logic/switch/switch.schema.ts:70-88`(`mode.default('value')`, `switchValue.meta.ui.requiredWhen: { field: 'mode', equals: ['value'] }`)가 정확히 일치. 프런트 override(`logic-configs.tsx:553,606`, `mode ?? "value"` + `required={mode === "value"}`)가 이 whitelist 를 override-track 에서 재현 — 함수 시그니처·필드명·기본값·검증 규칙 모두 spec/backend schema 와 line-level 정합.
2. **ExpressionInput asterisk 렌더 경로 검증**: `codebase/frontend/src/components/editor/expression/expression-input.tsx:360-364` — `required` true 이고 `bare` 아닐 때만 `<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>` 렌더. `switchValue` 필드는 `bare` prop 없이 (non-bare) 사용되므로 label wrapper 경로를 정상적으로 탄다. 신규 테스트가 기대하는 `span.text-red-500` textContent `"*"` 와 정확히 일치.
3. **테스트 실행 확인**: `npx vitest run .../switch-config.test.tsx` → 3/3 passed 확인 완료(mode=value, mode 미지정, mode=expression 3가지 분기 모두 커버).
4. **와이어링 확인**: `SwitchConfig` 는 `override-registry.ts:56` (`switch: SwitchConfig`)로 정상 등록돼 있어 실제 설정 패널에서 이 override 가 switch 노드 타입에 대해 렌더링됨을 확인.
5. **회귀 범위**: `SwitchConfig` 의 유일한 소비처는 override-registry 이며, 다른 컴포넌트가 `required` prop 부재를 가정해 이 필드를 재사용하는 곳 없음(grep 결과 직접 참조 없음). 사이드이펙트 없음.
6. **엣지 케이스**: `config` 가 완전히 빈 객체(`{}`)인 신규 노드 생성 직후에도 `mode` 기본값 경로로 `"value"` 가 되어 asterisk 노출 — 사용자가 즉시 "필수" 신호를 받는 올바른 UX. `config.mode` 가 예상 밖 값이어도 안전하게 `false` 로 수렴(크래시 없음).
7. **TODO/FIXME**: 없음. 주석은 모두 spec §8.1 참조를 명시하는 설명 주석뿐, 미완성 표식 없음.
8. **에러 시나리오**: 시각 표시 전용 변경이라 별도 에러 경로 없음 — 기존 `NodeHandler.validate()`/`warningRule`(§6 표) 가 실제 검증을 그대로 담당하며 이 변경으로 인한 회귀 없음.

## 요약

CHANGELOG 서술, 신규 유닛 테스트, 실제 구현(`logic-configs.tsx`) 세 가지가 `spec/4-nodes/1-logic/2-switch.md` §8.1(및 §1 표, backend `switch.schema.ts` §requiredWhen whitelist)과 line-level 로 정확히 일치한다. `mode` 기본값 처리(`?? "value"` → `required={mode === "value"}`)가 backend schema 의 `default('value')` + `requiredWhen.equals: ['value']` 조합을 정확히 재현하며, mode=value/미지정/expression 3가지 분기 모두 신규 vitest 로 커버되고 실제 실행에서 3/3 pass 확인했다. asterisk 는 순수 시각 표시이고 실제 검증은 기존 `NodeHandler.validate()` 가 그대로 수행한다는 CHANGELOG 주장도 코드와 일치(런타임 강제 로직 부재 확인). CRITICAL/WARNING 급 발견사항 없음 — 매우 작고 잘 스코핑된 override-track 정합화 패치.

## 위험도

NONE

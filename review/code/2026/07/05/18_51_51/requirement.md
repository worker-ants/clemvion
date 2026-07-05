# 요구사항(Requirement) Review — V-14 재조정 effect + coerceInput boolean 분기 (FOCUS)

대상: `codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx`,
`CHANGELOG.md`, `plan/in-progress/spec-code-cross-audit-2026-06-10.md`,
`review/code/2026/07/05/18_37_10/{RESOLUTION,SUMMARY,requirement,...}.md`

SoT: `spec/5-system/13-replay-rerun.md §10.2` (+ `spec/4-nodes/7-trigger/0-common.md §1` for
`TriggerParameterDefinition` shape, `4-execution-engine.md §6.1.1` for trigger 파라미터
seeding, backend `coerce-type.ts`/`resolve-trigger-parameters.ts` for coercion contract).

FOCUS: 18_37_10 라운드 RESOLUTION #1 로 추가된 재조정(re-coerce) `useEffect`
(`rerun-modal.tsx:266-281`) 와 `coerceInput` 의 신규 `boolean` 분기
(`:142`, `raw === "true"`)가 순수 additive robustness fix 인지, §10.2 의 typed
form / ID 링크 / submit `inputOverride` 정상 동작을 회귀시키지 않는지 검증.

## 검증 절차

1. `coerceInput` 호출부 전수 확인: `rerun-modal.tsx:273`(재조정 effect, 모든
   필드 타입 순회) 과 `:397`(text/number/object onChange). boolean 위젯은
   checkbox 라 `onChange`가 `e.target.checked` 를 직접 `setParam` 에 넘기므로
   (`:376`) `coerceInput` 의 신규 boolean 분기는 **재조정 effect 전용 경로**로만
   실행된다 — 사용자가 체크박스를 클릭하는 정상 편집 경로에는 개입하지 않는다.
2. 재조정 effect 의 가드 3중 확인: (a) `typeof v !== "string"` 이면 skip —
   원본 실행값이 이미 native(boolean/number/object) 이면(테스트
   `inputData.parameters: { count: 3, flag: true }` 케이스) 그대로 보존.
   (b) `coerced !== v` 인 필드만 갱신, 전부 미변경이면 `next===prev` 참조를
   반환해 React 가 리렌더를 스킵(무한루프 방지, 아래 상세 참고).
   (c) `[fields]` 의존성이라 타이핑 중(`paramValues` 변경)에는 재실행되지 않음
   — 활성 편집을 덮어쓰지 않는다는 주석과 실제 의존성 배열이 일치.
3. `npx vitest run rerun-modal.test.tsx` 재실행 — 16/16 통과 확인(로컬
   재실행, 기존 13 + 신규 3: ID 링크, number/boolean typed 렌더, boolean 토글
   native 전송; 18_37_10 RESOLUTION 이 추가한 object/array JSON 왕복 +
   useOriginalInput typed-checkbox-disable 2건 포함해 총 16건).
4. `handleSubmit`/`inputOverride` 조립 로직(`:283-306`) 이 이번 diff 로 전혀
   손대지 않았음을 `git diff 4b9a3abac~1 4b9a3abac` 로 확인 — §10.2 "재실행"
   버튼 행(권한 가드 → POST → 새 실행 라우팅)의 flow 회귀 없음.
5. ID 새 탭 링크(`:322-330`, `target="_blank" rel="noopener noreferrer"`)와
   typed 필드 렌더링 JSX(`:361-407`)는 이번 FOCUS 대상 diff(재조정 effect +
   boolean 분기) 와 겹치지 않는 별도 라인 — 해당 라운드에서 손대지 않았음을
   라인 대조로 확인.
6. backend `coerce-type.ts`/`resolve-trigger-parameters.ts` 교차 확인 — boolean
   타입은 `typeof value === 'boolean'` 이면 그대로, `'true'`/`'false'` 문자열도
   서버에서 안전하게 이중 처리(`coerceToType` L17-22). 즉 프론트 재조정
   effect 가 없어도(가정) 서버가 잔류 문자열 `"false"`/`"true"` 를 방어적으로
   재변환하므로 **데이터 정합성은 서버가 최종 보증** — 프론트 재조정은 추가
   방어층(제출 페이로드의 native-typed 정확성, 그리고 재조정 *이전*에 화면에
   noise-string 이 typed 위젯으로 잘못 렌더되는 것을 막는 UX 보정)이다.

## 발견사항

- **[INFO]** `coerceInput` 함수 JSDoc 이 신규 `boolean` 분기를 언급하지 않음
  - 위치: `rerun-modal.tsx:135-140` (JSDoc) vs `:142` (`if (type === "boolean") return raw === "true";`)
  - 상세: 주석은 "text/number input 의 raw 문자열을 coerce" 라고만 서술하고
    number/object/array 분기만 설명한다. boolean 분기는 실제로는 checkbox
    `onChange` 경로에서 호출되지 않고(그 경로는 `e.target.checked` 를 직접
    사용), 오직 재조정 effect(`:273`)가 fallback 구간에서 string 값으로
    남아있는 legacy boolean(예: `"true"`)을 native `true` 로 되돌릴 때만
    호출된다. 함수가 실제로 하는 일(모든 5종 `ParamType` 처리)과 JSDoc 이
    설명하는 범위(text/number 한정) 사이에 괴리가 있다 — 기능 결함은 아니고
    문서 정확도 문제.
  - 제안: JSDoc 에 "재조정 effect 가 legacy string boolean(`'true'`/`'false'`)을
    native 로 되돌릴 때도 사용" 한 줄 추가하면 다음 유지보수자가 왜 boolean
    분기가 필요한지 바로 이해할 수 있다. 비차단.

- **[INFO]** 재조정 effect 의 legacy string-boolean 왕복 시나리오가 테스트로
  직접 커버되지 않음
  - 위치: `rerun-modal.tsx:266-281` (effect), `__tests__/rerun-modal.test.tsx`
    전체(신규 4건: ID 링크, number/boolean typed 렌더, boolean 토글 native
    전송, object JSON 왕복, useOriginalInput typed-disable)
  - 상세: RESOLUTION #1 이 도입한 재조정 effect 자체의 핵심 시나리오
    — "스키마 로드 전 fallback 구간에서 `flag` 를 텍스트로 `"true"` 라고
    입력해두면, 스키마 로드 후 checkbox 로 전환되면서 `true` 로 재조정되어
    checked 상태로 보이고 제출도 native boolean 으로 나간다" — 을 직접
    구동하는 테스트는 없다. 기존 신규 테스트들은 모두 원본 `inputData` 가
    이미 native 타입(`{ count: 3, flag: true }`, `{ flag: false }`)인
    케이스만 다뤄 재조정 effect 의 `typeof v !== "string"` skip 경로만
    검증하고, `coerced !== v` 갱신 경로(실제 재조정이 발생하는 경우)는
    코드 정독으로만 확인됨(위 검증 절차 2, 6). 로직 자체는 정확하나 회귀
    방지 관점에서 이 경로를 직접 구동하는 테스트가 없다는 점은 향후 리팩터
    시 조용히 깨질 여지를 남긴다.
  - 제안: fallback 단계(스키마 응답 지연)에서 텍스트 input 에 `"true"` 를
    입력한 뒤 스키마가 로드되면 checkbox 로 전환 + checked=true + 제출 시
    `inputOverride: { flag: true }` 를 확인하는 테스트 1건 추가 권장(비차단,
    후속 가능).

## 확인된 사항 (회귀 없음)

- **boolean 체크박스 정상 편집 경로 불변**: `checked={value === true || value === "true"}`
  (`:374`)와 `onChange={(e) => setParam(field.name, e.target.checked)}`
  (`:376`)는 재조정 effect 도입 전후로 동일 — `coerceInput` 의 신규 boolean
  분기가 이 경로에 개입하지 않는다.
- **object/array JSON 위젯·number 위젯 정상 편집 경로 불변**: `onChange`
  (`:396-398`)가 `coerceInput(field.type, e.target.value)` 를 그대로 호출하는
  구조는 이전 라운드부터 동일, 재조정 effect 는 별도 `useEffect` 로 추가된
  것일 뿐 이 경로의 로직을 바꾸지 않음.
- **ID 새 탭 링크**: `<a href="/workflows/{workflowId}/executions/{id}" target="_blank" rel="noopener noreferrer">`
  (`:323-330`) — §10.2 필드표 "원본 실행 헤더 ... ID 클릭 시 새 탭으로 원본
  상세 페이지" 그대로, 이번 FOCUS diff 로 손대지 않음.
- **submit `inputOverride`**: `handleSubmit`(`:283-306`)의
  `...(useOriginalInput ? {} : { inputOverride: paramValues })` 조립은 이번
  diff 로 변경되지 않음 — 재조정 effect 가 `paramValues` state 를 업데이트할
  뿐 submit 조립 로직 자체는 그대로.
- **무한 렌더 루프 없음**: `fields` useMemo 가 `workflowNodes` 쿼리 로딩
  단계(fallback `[]`)에서 매 렌더 새 배열 참조를 만들어 effect 가 반복
  트리거되더라도, `changed` 가 `false` 인 한 `setParamValues` 콜백이 `prev`
  참조를 그대로 반환해 React 가 상태 변경 없음으로 판단하고 리렌더를
  스킵한다 — 이는 실제로 코드 흐름을 추적해 확인했으며, `changed` 가
  `true` 로 바뀌는 것은 fields 가 진짜로(스키마 로드 후) 바뀌고 실제 잔류
  string 값이 있을 때 1회뿐이다.
- **Spec §10.2 line-level 일치**: `TriggerParameterDefinition` shape 은
  `spec/4-nodes/7-trigger/0-common.md §1` TypeScript 선언과 완전 동일.
  typed 위젯 매핑(string→text, number→number, boolean→checkbox,
  object/array→JSON)과 스키마 부재 시 원본 키 text fallback 도 §10.2 필드표
  "입력 데이터 폼" 행과 정확히 일치. 이번 FOCUS 변경(재조정 effect +
  boolean 분기)은 이 매핑 자체를 바꾸지 않고 그 위에 방어층만 추가.

## TODO/FIXME

없음.

## 테스트

`npx vitest run src/components/executions/__tests__/rerun-modal.test.tsx`
재실행 — 16/16 통과 확인 (18_37_10 RESOLUTION 이 추가한 object/array·
useOriginalInput-disable 2건 포함). `npx tsc --noEmit` 관련 오류 없음.

## 요약

18_37_10 라운드 RESOLUTION #1 로 추가된 재조정 `useEffect`와 `coerceInput`
boolean 분기는 순수 additive robustness 로 확인된다 — boolean 체크박스의
정상 편집 경로(`e.target.checked` 직접 사용), text/number/object 위젯의
`coerceInput` onChange 경로, ID 새 탭 링크, `handleSubmit`의 `inputOverride`
조립 로직 모두 이번 변경으로 손대지 않았고 라인 대조·테스트 재실행(16/16)
으로 회귀가 없음을 확인했다. 재조정 effect 는 3중 가드(`typeof v !== "string"`
skip, `coerced !== v` 만 갱신, `prev` 참조 반환으로 무변경 시 리렌더 스킵)로
무한 루프 위험이 없으며 `[fields]` 의존성이라 활성 타이핑을 덮어쓰지 않는다.
Backend `coerceToType`/`resolveTriggerParameters` 는 native 값과 stringified
`"true"/"false"` 값을 모두 안전하게 처리하므로 프론트 재조정이 없더라도
데이터 정합성 자체는 서버가 최종 보증하지만, 재조정 effect 는 화면에 typed
위젯이 오염된 원시 문자열을 잘못 표시하는 UX 문제까지 막는 추가 방어층으로
타당하다. §10.2 명시 항목(ID 링크, typed 폼, fallback, submit)의 line-level
일치는 이전 라운드 검증대로 유지되며 이번 FOCUS 변경으로 훼손되지 않았다.
발견 사항은 모두 INFO 수준(coerceInput JSDoc 이 boolean 분기 미언급, 재조정
effect 의 legacy string-boolean 왕복 시나리오를 직접 구동하는 테스트 부재)
으로 비차단.

## 위험도

NONE

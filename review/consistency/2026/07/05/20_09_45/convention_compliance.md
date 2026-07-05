# 정식 규약 준수 검토 — switch-value-asterisk (V-12)

검토 대상: `git diff origin/main...HEAD` (SwitchConfig `switchValue` required asterisk + unit test), scope=`spec/4-nodes/1-logic/`, diff-base=`origin/main`.

## 발견사항

없음 (CRITICAL/WARNING/INFO 대상 발견되지 않음).

### 확인한 규약 준수 근거

1. **명명 규약**
   - 신규 테스트 파일 `codebase/frontend/src/components/editor/settings-panel/node-configs/__tests__/switch-config.test.tsx` 는 동일 디렉터리의 기존 `<name>-config.test.tsx` 패턴(`parallel-config.test.tsx`, `cafe24-config.test.tsx` 등)과 일치.
   - `ExpressionInput` 의 `required?: boolean` prop 은 이미 `expression-input.tsx:28`에 선언되어 있고, `shared.tsx` 의 다른 필드 컴포넌트(`FieldGroup`)들도 동일한 `required` prop 명명·`aria-required` 패턴을 사용 — 신규 도입이 아니라 기존 명명 컨벤션 재사용.
   - `required={mode === "value"}` 표현식은 spec §8.1 의 `requiredWhen: { field: 'mode', equals: ['value'] }` whitelist 의미를 정확히 재현 (blacklist `notEquals` 형태가 아님 — §8.1 각주가 명시적으로 경고하는 안티패턴을 피함).

2. **출력 포맷 규약 (node-output.md)**
   - 이번 변경은 `config`/`output`/`meta`/`port`/`status` 5필드 envelope 를 건드리지 않는 순수 UI 렌더링(override-track bespoke config 컴포넌트의 asterisk 표시)이라 Principle 7(config echo) 등 출력 포맷 규약과 무관. 런타임 검증은 기존대로 `NodeHandler.validate()` 가 담당한다고 diff 자체 주석과 CHANGELOG 에 명시됨 — spec 이 요구하는 "시각 표시 vs 런타임 검증 분리" 원칙과 정합.

3. **문서 구조 규약**
   - `spec/4-nodes/1-logic/2-switch.md` 본문은 변경되지 않음(스펙이 이미 §8.1 에 정확히 명시하고 있었으므로 spec 변경 불요라는 CHANGELOG 판단이 코드와 일치). 문서 3섹션 구조에 영향 없음.
   - `CHANGELOG.md` 엔트리는 기존 `## Unreleased — <제목> (<ID>)` + `### 변경 사항` + SoT 인용 포맷을 그대로 따름 (선행 V-14/V-10/V-05 항목들과 동일 스타일).

4. **API 문서 규약**
   - 해당 없음 (프런트엔드 전용 변경, OpenAPI/Swagger DTO 관련 없음).

5. **금지 항목**
   - `visibleWhen`/`requiredWhen` DSL 분리에 대한 §8.1 각주("범위 한정: 본 정준화는 requiredWhen DSL 한정")를 위반하지 않음 — 이번 변경은 `requiredWhen` 대상 필드(`switchValue`)만 다루고 `visibleWhen` 블랙리스트 패턴에 손대지 않음.
   - `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 체크박스 갱신은 실제 완료 근거(브랜치명·PR·구현 요약)를 포함해 "체크박스 = 실제 상태" 원칙을 충족.

## 요약

이번 diff(SwitchConfig `switchValue` required asterisk 추가 + 대응 unit 테스트 3건 + CHANGELOG/plan 체크박스 갱신)는 spec `2-switch.md §8.1` 이 이미 명시한 `requiredWhen` whitelist 정책을 override-track(bespoke) UI 컴포넌트에서 재현하는 순수 시각적 변경으로, 기존 `ExpressionInput.required` prop·`<name>-config.test.tsx` 테스트 명명·`CHANGELOG.md` 엔트리 포맷·plan 체크박스 갱신 규칙 등 모든 관련 정식 규약과 정합한다. 신규 API·이벤트 페이로드·에러 코드·DTO 변경이 없어 출력 포맷/API 문서 규약 검토 대상도 아니며, spec 본문 변경 없이 코드만 정합화한 처리도 "이미 명시된 요구사항의 code-side 정합화" 케이스로 적절하다. 정식 규약 위반 사항을 발견하지 못했다.

## 위험도

NONE

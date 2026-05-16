# Convention Compliance Review — Cafe24Config Phase 3 Frontend Rewrite

**Session**: `review/consistency/2026/05/16/13_09_46/convention_compliance/`
**Target files**:
- `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
- `frontend/src/components/editor/settings-panel/node-configs/shared.tsx`
- `frontend/src/lib/i18n/dict/ko.ts` & `en.ts`
- `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx`
- `plan/in-progress/cafe24-node-resource-operation-ux.md`

---

## 발견사항

### 발견사항 1
- **[WARNING]** Plan frontmatter `worktree` 필드가 다중 워크트리 슬래시 표기를 사용
  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` L2
  - 위반 규약: `CLAUDE.md` §"PLAN 문서 라이프사이클" — frontmatter `worktree:` 는 "이 plan 이 살아있는 worktree 디렉토리 이름" 단수 값이어야 한다
  - 상세: 현재 값은 `cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)` 로, 슬래시로 이어진 두 개의 옛 워크트리 이름과 주석이 혼재한다. Phase 3 의 실제 작업 워크트리는 `cafe24-node-ux-frontend-f5a3b8` 인데 frontmatter 에 반영되지 않았다. `plan_coherence` checker 가 이 필드를 `glob .claude/worktrees/<value>/` 경로로 대조할 때 매칭 실패할 수 있다.
  - 제안: Phase 3 착수 시점에 `worktree: cafe24-node-ux-frontend-f5a3b8` 로 덮어썼어야 한다. 복수 Phase 이력을 보존하려면 `worktree:` 는 단수 최신 값으로 유지하고 이전 Phase 기록은 본문에 서술한다.

---

### 발견사항 2
- **[WARNING]** `readFieldValues` JSDoc 이 `export` 를 선언하나 실제 함수는 unexported
  - target 위치: `integration-configs.tsx` L320–322
  - 위반 규약: 명시적 규약 없음 (코드 정확성 문제). 단, `spec/conventions/cafe24-api-metadata.md` §4 와 plan Phase 3 체크리스트는 "단위 테스트에서 직접 행사 가능"임을 전제로 기술되어 있다.
  - 상세: JSDoc 주석 L320에 `"Exported so the conversion can be exercised directly by unit tests."` 라고 기술되어 있으나, L322 함수 선언은 `export` 키워드 없이 `function readFieldValues(...)` 다. 실제 테스트(`cafe24-config.test.tsx`)는 이 함수를 직접 import 하지 않고 컴포넌트를 통해 간접 검증한다. 주석이 의도를 반영하지 못하거나(주석 오류), 아니면 export 가 빠진 것(구현 오류)이다.
  - 제안: (a) 실제 export 를 추가하고 테스트에서 직접 unit-test 하거나, (b) JSDoc 에서 "Exported so…" 문구를 삭제하고 "Tested indirectly via Cafe24Config" 로 수정한다.

---

### 발견사항 3
- **[INFO]** i18n 키 12개 신규 / 4개 삭제 — ko.ts 와 en.ts 완전 패리티 확인됨 (이슈 없음, 기록용)
  - target 위치: `frontend/src/lib/i18n/dict/ko.ts` L1100–1121, `en.ts` L1105–1126
  - 위반 규약: 없음
  - 상세: 12개 신규 키(`cafe24OperationSelectPlaceholder` 외 11개) 가 ko.ts 와 en.ts 양쪽에 각 1회 존재하고, 삭제된 4개 키(`cafe24OperationPlaceholder`, `cafe24OperationHint`, `cafe24FieldsKeyPlaceholder`, `cafe24FieldsValuePlaceholder`) 가 양쪽 모두에서 없음이 확인되었다. 패리티 완전 준수.
  - 제안: 없음.

---

### 발견사항 4
- **[INFO]** `ExpressionInput bare` 사용 패턴 — 기존 컴포넌트와 일관됨 (이슈 없음, 기록용)
  - target 위치: `integration-configs.tsx` L416, L57–63
  - 위반 규약: 없음
  - 상세: `Cafe24FieldRow` 및 `RecipientList` 내부의 `ExpressionInput bare` 패턴은 `HttpRequestConfig`(full, L113–119) 및 `SendEmailConfig`(multiline, L673–694) 와 구분되는 "인라인 내장" 용도로 사용되며, 이 구분은 프로젝트 내 기존 override 패턴과 일치한다.
  - 제안: 없음.

---

### 발견사항 5
- **[INFO]** 테스트 파일 vitest + RTL 관용구 — 기존 테스트와 일관됨 (이슈 없음, 기록용)
  - target 위치: `cafe24-config.test.tsx` L7–8
  - 위반 규약: 없음
  - 상세: `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"` + `import { render, screen, fireEvent } from "@testing-library/react"` 는 동일 디렉토리의 `integration-selector.test.tsx` / `trigger-configs.test.tsx` 와 동일한 import 스타일이다. `userEvent` 대신 `fireEvent` 사용도 기존 파일과 일치한다. 14개 케이스가 plan Phase 3 체크리스트 14 케이스와 1:1 대응한다.
  - 제안: 없음.

---

### 발견사항 6
- **[INFO]** SelectField.options[].disabled? 추가 — 하위 호환적 확장 (이슈 없음, 기록용)
  - target 위치: `shared.tsx` L69
  - 위반 규약: 없음
  - 상세: 기존 `options: { value: string; label: string }[]` 에 선택적 필드 `disabled?: boolean` 을 추가했다. 기존 호출부(`HttpRequestConfig`, `DatabaseQueryConfig`, `SendEmailConfig`)는 `disabled` 를 전달하지 않으므로 하위 호환이 유지된다. JSDoc 이 Cafe24 용도를 명확히 기술한다.
  - 제안: 없음.

---

### 발견사항 7
- **[INFO]** 금지 항목 — 위반 없음 (기록용)
  - target 위치: 전체 변경 파일
  - 위반 규약: `CLAUDE.md` §"외부 LLM 호출 정책"
  - 상세: `claude -p`, `subprocess.run(["claude"...])`, `anthropic.Anthropic().messages.create(...)` 호출 없음. `prd/`, `memory/`, `user_memo/` 경로 참조 없음. 소스 파일에 emoji 없음.
  - 제안: 없음.

---

### 발견사항 8
- **[INFO]** React 관용구 — useEffect 없음, 모든 파생 상태는 render-time 직접 계산 (이슈 없음, 기록용)
  - target 위치: `integration-configs.tsx` L421–638 (`Cafe24Config`)
  - 위반 규약: 없음
  - 상세: `Cafe24Config` 는 `useEffect` 를 전혀 사용하지 않는다. `extras`, `resource`, `operation`, `supportedOp`, `plannedOp`, `fieldValues`, `resourceOptions`, `operationOptions`, `coverageHint`, `requiredFields`, `optionalFields` 모두 render 함수 내 동기 계산이다. `useT` 가 최상위에서 한 번 호출되고 조건부 분기 내에서 재호출되지 않아 hooks 규칙 준수. `Cafe24FieldRow` 는 `t` 를 prop 으로 주입받아 자체 hook 호출 없음 (별도 컴포넌트로 선언됐으나 hooks 규칙 상 허용).
  - 제안: 없음.

---

## 요약

Phase 3 변경 세트는 프로젝트 정식 규약을 전반적으로 잘 준수하고 있다. i18n 키 패리티 완전, 금지 항목 없음, 테스트 관용구 일관, React hooks 규칙 준수, SelectField 확장 하위 호환. 두 건의 WARNING 이 발견되었다: 하나는 plan frontmatter 의 `worktree` 필드가 Phase 3 실제 워크트리(`cafe24-node-ux-frontend-f5a3b8`)를 반영하지 않아 `plan_coherence` checker 의 경로 매칭이 실패할 수 있는 점이고, 다른 하나는 `readFieldValues` JSDoc 에 "Exported so…" 라고 기술되어 있으나 실제 `export` 키워드가 없는 문서-구현 불일치다. 두 건 모두 런타임 동작에는 영향이 없으나 유지보수 혼란을 초래할 수 있어 수정을 권장한다.

## 위험도

LOW

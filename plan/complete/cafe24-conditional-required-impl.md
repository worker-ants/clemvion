---
worktree: .claude/worktrees/cafe24-conditional-required-audit-28fb28
started: 2026-05-22
owner: developer
type: implementation
parent_spec: spec/conventions/cafe24-api-metadata.md §2 "constraints 의 의미" + §Rationale "Cafe24 API 조건부 필수 — `constraints` 신설 (2026-05-22)"
parent_consistency_check: review/consistency/2026/05/22/12_43_01/SUMMARY.md (BLOCK: NO, W-2 follow-up plan)
---

# Cafe24 조건부 필수 (`constraints`) — backend 구현

## 출처

`spec/conventions/cafe24-api-metadata.md` 2026-05-22 갱신에서 `Cafe24OperationMetadata.constraints?: Cafe24FieldConstraint[]` 신설 결정 (kind 3종: `oneOf` / `allOrNone` / `implies`). consistency-check 세션 `review/consistency/2026/05/22/12_43_01/` 의 W-2 finding — "constraints 기능의 backend 구현 4종에 대응하는 follow-up plan 이 어느 in-progress 문서에도 등록되어 있지 않음" — 의 해소.

본 plan 은 spec 만 갱신되고 구현이 누락된 상태가 무기한 지속되는 것을 막기 위해 4종 backend 구현을 체크박스로 추적한다.

---

## §1. Type 정의 — `Cafe24FieldConstraint` + `Cafe24OperationMetadata.constraints?`

- **파일**: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`
- **변경**:
  - `Cafe24FieldConstraint` discriminated union 신설 (kind 3종 — `oneOf` / `allOrNone` / `implies`).
  - `Cafe24OperationMetadata.constraints?: Cafe24FieldConstraint[]` 옵셔널 필드 추가.
- **TSDoc**: spec §2 의 의미·invariant 를 한 줄씩 참조.
- **체크박스**: `[x]` (commit d932cff9)

## §2. `metadata.spec.ts` invariant 추가

- **파일**: `codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts`
- **검증 규칙** (모든 supported operation 에 대해):
  1. `constraints[*].fields` (그리고 `implies.if`, `implies.then`) 의 모든 필드명이 `fields` 키 부분집합.
  2. `oneOf.fields` / `allOrNone.fields` 길이 ≥ 2.
  3. `implies.then` 길이 ≥ 1.
- **체크박스**: `[x]` (commit d932cff9)

## §3. 노드 핸들러 runtime 검증 — `cafe24.handler.ts execute()`

- **파일**: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts`
- **변경**:
  - 기존 `requiredFields` 누락 검사 (현재 `:157-168`) **직후**에 `constraints` 검증 헬퍼 호출.
  - 위반 시 `IntegrationError('CAFE24_MISSING_FIELDS', message)` throw. 메시지에 어떤 constraint kind 가 어떤 fields 에서 위반됐는지 명시 (예: `"constraint violated: oneOf [member_id, group_no, since] requires at least one of"`).
  - 헬퍼는 별도 함수로 분리 (`validateCafe24Constraints(operation, fields): string | null` — null = OK, string = violation message). 같은 헬퍼를 §4 MCP 경로도 import.
- **테스트**: `cafe24.handler.spec.ts` 에 3종 kind × (위반/만족) 6개 케이스 추가.
- **체크박스**: `[x]` (commit d932cff9)

## §4. MCP 경로 runtime 검증 + JSON Schema `anyOf` 변환 — `cafe24-mcp-tool-provider.ts`

- **파일**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts`
- **변경**:
  - **runtime 검증**: `execute()` 안 기존 `requiredFields` missing 체크 직후 (`:407-424`) `validateCafe24Constraints` 호출 (§3 헬퍼 공유). 위반 시 동일 `CAFE24_MISSING_FIELDS` 코드 에러 envelope 반환.
  - **JSON Schema 변환**: `buildJsonSchema()` 가 `oneOf` kind 를 `anyOf: [{required:[a]}, ...]` 로 변환. 기존 `required: op.requiredFields` 와 결합 시 top-level 을 `allOf: [{required: [...requiredFields]}, {anyOf: ...}]` 로 래핑. `oneOf` 가 N 개면 N 개의 `anyOf` 가 `allOf` 안에 합류.
  - **description suffix builder**: `buildTools()` 안에서 `(Cafe24 ${method} ${path} — via Internal Bridge: ${name})` 다음에 `op.constraints?.map(constraintToSuffixLine)` 의 0..N 줄을 삽입하고 그 뒤에 `CAFE24_TIMEZONE_SUFFIX`. `constraintToSuffixLine` 헬퍼는 kind 별 한 줄 문구를 spec §2 의 표대로 생성.
- **테스트**: `cafe24-mcp-tool-provider.spec.ts`:
  - `buildJsonSchema` 가 `oneOf` 단일 / 다중 / `requiredFields` 와 결합 / `allOrNone`·`implies` 미변환 (만 description 에만) 케이스 출력 비교.
  - `buildTools` description 끝 부분에 constraint suffix · timezone suffix 가 올바른 순서로 들어가는지 확인.
  - `execute()` 가 `constraints` 위반 args 에 대해 `CAFE24_MISSING_FIELDS` 에러 envelope 반환.
- **체크박스**: `[x]` (commit d932cff9)

---

## 검증 (개발 완료 정의)

- `npm test --workspace backend -- cafe24` 전 케이스 통과.
- `/ai-review` 1회 통과 (또는 ESCALATE 처리).
- 본 plan 의 §1–§4 체크박스 모두 `[x]`.
- 처리 완료 시 `git mv plan/in-progress/cafe24-conditional-required-impl.md plan/complete/`.

## 비포함 (별 plan / out-of-scope)

- **Cafe24 docs audit (Phase C)**: 18 resource 의 cafe24 docs 페이지를 직접 읽고 `constraints` row 채우기. 본 plan 은 infra (§1–§4) 만 담당. audit 결과 적용은 `cafe24-backlog-residual.md` 또는 별도 batch plan 에서.
- **frontend UI**: 캔버스 Cafe24 노드 form 에 conditional-required 힌트 표시. 현재 spec 은 backend dispatcher + MCP tool-provider 두 경로만 정의 — UI 힌트는 후속 결정.

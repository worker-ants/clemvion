# Rationale 연속성 검토 — Cafe24 노드 UX Phase 3

검토 대상: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` `Cafe24Config` 재작성 (Phase 3)
기준 spec: `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.1, §9.9 및 Rationale 전체

---

## 발견사항

### 1. [INFO] §9.9 내부 버퍼 분리 결정 — 적용 범위 변화, Rationale 갱신 권장

- **target 위치**: `integration-configs.tsx` 내 `Cafe24Config` 전체 — 특히 `readFieldValues()` / `handleFieldChange()` / `pruneFieldsToOperation()`
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 "Fields 편집 UI 의 내부 버퍼 분리" (옵션 B 채택)
- **상세**: §9.9 는 `Array<{key, value}>` 내부 버퍼를 채택한 핵심 이유로 "빈 key 행이 object 변환 시 즉시 제거되어 '추가' 버튼이 행을 보여주지 못한다"를 든다 — 이 문제는 KeyValueEditor 에서 사용자가 수동으로 행을 추가하는 UX를 전제한다. Phase 3 의 typed 동적 폼은 Fields 행을 메타데이터로 고정 렌더링하므로 "빈 key 행 추가" 시나리오가 구조적으로 존재하지 않는다. 그 결과 §9.9 가 채택한 `Array<{key, value}>` 버퍼 대신 `Record<string, string>` (`readFieldValues` 반환값) 를 편집 상태로 직접 사용한다. 이는 §9.9 의 문자 그대로의 패턴(배열 버퍼)을 따르지 않지만, §9.9 **적용 범위** 단서("object-shaped backend contract 를 가진 통합 노드에 한정")는 여전히 적합하다 — 바뀐 것은 버퍼 *형태*이지 `Record<string, unknown>` 외부 직렬화 계약이 아니다. 기술적 충돌은 아니나, §9.9 가 묘사하는 "배열 버퍼 → onChange 시 변환" 패턴과 새 구현의 "Record 직접 사용" 패턴 간에 독자가 혼란을 느낄 수 있다.
- **제안**: Phase 3 PR merge 후 `project-planner` 에 §9.9 보강을 위임한다. 구체적으로 "typed 동적 폼(필드가 메타데이터로 고정)에서는 빈 key 행 시나리오가 없으므로 `Record<string, string>` 직접 편집이 허용된다. 배열 버퍼 패턴은 KeyValueEditor 기반 자유 추가/삭제 UX에만 필요하다"는 설명을 적용 범위 단서에 추가한다. spec 수정 전까지 §9.9 의 핵심 invariant — **외부 직렬화 형식은 `Record<string, unknown>` 불변** — 는 Phase 3 구현이 완전히 준수한다.

---

### 2. [INFO] Operation 자유 텍스트 → select 전환 — 옛 임시 결정의 공식 해소, Rationale 갱신 필요 없음 (단, 확인 메모 권장)

- **target 위치**: `integration-configs.tsx` L535–547 (`SelectField` for Operation) vs 과거 구현 (`ExpressionInput` for Operation)
- **과거 결정 출처**: `git show 52103cd9` (Phase 8-10 커밋 메시지) — "A richer Operation select that loads metadata from the backend stays a follow-up — the metadata table lives in backend code today"
- **상세**: Phase 8-10 커밋은 Operation 을 `ExpressionInput` (자유 텍스트) 로 구현하면서, 이를 임시 조치이며 metadata 기반 select 는 follow-up 이라고 명시했다. 이 임시 결정은 `spec/4-nodes/4-integration/4-cafe24.md §9 Rationale` 어디에도 정식 항목으로 기록되지 않았다 — 즉 **spec Rationale 이 자유 텍스트를 "채택된 대안"으로 승인한 적이 없다**. §2 UI mock 은 최초 spec 작성일(2026-05-13)부터 "Operation: [Search products dropdown]" 으로 select 를 명세했다. Phase 3 는 spec 이 처음부터 의도한 형태를 구현한 것으로, Rationale 번복이 아닌 Rationale 이행이다. 단, "자유 텍스트가 임시 운용됐다"는 사실이 문서 어디에도 남지 않으므로, 향후 독자가 "왜 이전에 ExpressionInput 이었나?"를 알 수 없다.
- **제안**: §9.3 또는 CHANGELOG 에 한 줄 — "Phase 3(2026-05-16) 에서 Operation ExpressionInput(임시, 커밋 52103cd9) 을 catalog extras 기반 select 로 전환. 이로써 §2 spec 의 원래 의도가 완전히 구현됨" — 을 추가할 것을 권장한다 (project-planner 위임, 이 PR 에서 불필요).

---

## 요약

Phase 3 구현은 spec/4-nodes/4-integration/4-cafe24.md Rationale 의 어떤 항목도 직접 위반하거나 명시적으로 기각된 대안을 재도입하지 않는다. 가장 유의할 점은 §9.9 다 — 배열 버퍼 패턴의 적용 범위가 "typed 동적 폼" 시나리오에서 자연스럽게 달라졌으나, §9.9 의 핵심 invariant(외부 직렬화 = `Record<string, unknown>`)는 완전히 준수된다. 표현식(`{{ }}`) 지원 결정(2026-05-16 확정)도 모든 필드 행에 `ExpressionInput` 을 사용함으로써 충실히 이행된다. §2 UI mock 과의 정합성도 완전하다 — Resource/Operation select, Required/Optional 그룹, 조건부 Pagination 이 모두 spec 그대로 구현되어 있다. 발견사항 2건은 모두 INFO 수준의 문서 보완 권장이며, 구현 차단 사유가 없다.

## 위험도

LOW

# Convention Compliance — spec-draft-backend-msg-i18n.md

> 검토 모드: spec draft (--spec)
> 검토 대상: `plan/in-progress/spec-draft-backend-msg-i18n.md` (인라인 제공)
> 검토 기준: `spec/conventions/i18n-userguide.md`, `spec/conventions/cross-node-warning-rules.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### [WARNING] 문서 저장 위치 — plan 이 아닌 spec 으로 가야 하는 내용

- target 위치: 문서 헤더 — `plan/in-progress/spec-draft-backend-msg-i18n.md`
- 위반 규약: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" 표 — "기술 명세: `spec/<영역>/*.md` 본문"
- 상세: 본 문서는 §3 에서 `spec/conventions/i18n-userguide.md` 와 `spec/conventions/cross-node-warning-rules.md` 의 실질적 개정안을 확정적으로 서술하고 있다. "spec draft" 라는 제목이지만 내용은 정식 규약 변경안 (Principle 3-C 신설, `GraphWarningRuleResult` 타입 확장 등)이다. CLAUDE.md 에 따르면 정식 규약은 `spec/conventions/<name>.md` 에 직접 작성하거나, spec draft 를 plan 에 두는 경우라도 최종 채택 시 즉시 target spec 으로 옮겨야 한다. 현재 구조는 정책 확정 내용이 plan 에 영구 거주하는 형태가 될 위험이 있다.
- 제안: §3 의 내용을 plan 의 draft 임시 공간으로 사용하되, 채택 확정 시 `spec/conventions/i18n-userguide.md` 와 `spec/conventions/cross-node-warning-rules.md` 에 직접 반영하고 본 plan 파일은 작업 추적용 메타데이터(phase 목록·worktree 등)만 남긴다. 현재 형태 자체는 draft 용 plan 으로는 허용 가능하지만 "확정 내용이 plan 에 계속 남는" 패턴으로 굳어지지 않도록 주의.

---

### [WARNING] `Principle 3-C` 신설 후 기존 Principle 3 자동 가드 표 갱신 누락 언급

- target 위치: §3-1, "자동 가드 요약" 갱신 관련 서술
- 위반 규약: `spec/conventions/i18n-userguide.md` — "자동 가드 요약" 표 (Principle vs 가드 위치 vs 가드 종류)
- 상세: §3-1 에서 Principle 3-C 를 `i18n-userguide.md` 에 승격한다고 서술하지만, 동 문서의 "자동 가드 요약" 표에 G-1 (graphWarning parity) 와 G-2 (ERROR_KO 등재 코드 parity) 를 추가해야 한다는 명시가 없다. 자동 가드 표는 규약의 enforcement 가시성을 위한 필수 요소이며, spec 문서에 Principle 이 추가되면 동일 문서 내 표도 갱신돼야 한다.
- 제안: §3-1 반영안에 "자동 가드 요약 표에 G-1·G-2 row 추가" 를 명시적으로 포함한다.

---

### [WARNING] `GraphWarningRuleResult` 타입 확장이 `cross-node-warning-rules.md §3` 타입 블록과 직접 충돌 가능성

- target 위치: §3-2 — `GraphWarningRuleResult` 에 `params?` 추가 서술
- 위반 규약: `spec/conventions/cross-node-warning-rules.md §3` — `GraphWarningRuleResult` 타입 정의 (`ruleId`, `severity`, `nodeId`, `message` 4개 필드)
- 상세: 현재 `cross-node-warning-rules.md §3` 의 `GraphWarningRuleResult` 코드 블록은 `params?` 없이 4개 필드만 정의한다. spec draft 가 이 타입에 `params?` 를 추가한다고 서술하면서, 기존 spec 의 타입 블록을 정합하게 수정하는 구체적 절차가 명시되지 않았다. spec 을 읽는 후속 작업자가 현행 `cross-node-warning-rules.md §3` 의 코드 블록과 draft 의 의도 사이에서 혼선을 겪을 수 있다.
- 제안: §3-2 에 "§3 타입 코드 블록의 `GraphWarningRuleResult` 에 `params?: Record<string, string | number>` 줄 추가" 를 직접 diff 형태로 명시, 최종 spec 갱신 시 해당 코드 블록도 포함됨을 확인.

---

### [INFO] `Principle 3-C` 명명 — 기존 Principle 3-B 와의 번호 체계 일관성

- target 위치: §3-1 — "Principle 3-C — 코드/동적 backend 메시지 localization"
- 위반 규약: `spec/conventions/i18n-userguide.md` — Principle 3 → Principle 3-B 의 기존 번호 체계
- 상세: 기존 `i18n-userguide.md` 에는 Principle 3 (메인) 와 Principle 3-B (backend zod ui.label 등) 두 레벨이 있다. 신규로 Principle 3-C 를 추가하는 것은 번호 체계상 자연스럽고, 서브-Principle 알파벳 진행도 일관적이다. 특이 사항 없음. 단, `i18n-userguide.md` 본문 내 "errorCode 의 처리 (현재 갭)" 절 (`§76-80`) 의 "후속 plan:" 문구 전체를 삭제하고 Principle 3-C 로 교체할 때, 해당 절의 제목도 "Principle 3-C — ..." 로 통일하는지 draft 에 명시해두면 좋다.
- 제안: draft §3-1 에 기존 절 제목 변경 여부를 한 줄 명시.

---

### [INFO] `별 plan` 참조 표현 — 사용자 가이드가 아닌 plan 문서 내부이므로 규약 적용 외

- target 위치: §5 — "별 plan `plan/in-progress/backend-msg-i18n-impl.md` 로 이관 예정"
- 위반 규약: `spec/conventions/i18n-userguide.md §Principle 6-B` — 사용자 가이드에서 내부 SoT 노출 금지 ("별 plan `<name>`" 같은 표현)
- 상세: Principle 6-B 의 금지는 "사용자 가이드 (`codebase/frontend/src/content/docs/**`)" surface 에 적용된다. 본 문서는 `plan/` 하위 내부 작업 문서이므로 이 표현이 금지 범주에 해당하지 않는다. 지적 대상에서 제외하며 참고 기록만 남긴다.
- 제안: 없음 (규약 적용 범위 외).

---

### [INFO] `spec/conventions/node-output.md` side-effect 언급 — cross-ref 만이므로 미반영 위험

- target 위치: §4 — "side-effect 점검 대상" 중 `spec/conventions/node-output.md §3.2`
- 위반 규약: 없음 (명시 위반 없음). CLAUDE.md "Rationale 섹션에 근거" 권장.
- 상세: §4 에서 `node-output.md §3.2` 에 "한 줄 cross-ref" 를 추가한다고 서술하지만, §3 의 공식 spec 반영안에는 이 항목이 포함되지 않았다. spec 반영안(§3)과 side-effect 점검(§4)이 분리되어 있어, 구현자가 §4 를 누락할 수 있다.
- 제안: §3 에 "3-3. `spec/conventions/node-output.md` §3.2 — 한 줄 cross-ref 추가" 항목을 명시적으로 포함시켜 §3 과 §4 의 정합을 보장.

---

## 요약

`plan/in-progress/spec-draft-backend-msg-i18n.md` 는 정식 규약(`i18n-userguide.md`, `cross-node-warning-rules.md`) 을 직접 위반하는 항목은 없으며, 제안하는 설계 결정(ERROR_KO, GRAPH_WARNING_KO, translateBackendError/translateGraphWarning, params 계약)은 기존 Principle 3 의 "영문 SoT + frontend 매핑" 원칙을 유지하고 기존 보간 컨벤션(`{{name}}` + `interpolate`)을 재사용하는 방향으로 규약과 정합적이다. 다만 자동 가드 표 갱신 누락 언급, `GraphWarningRuleResult` 타입 블록과의 직접 정합 절차 미명시, `node-output.md` side-effect 가 §3 공식 반영안에서 누락된 세 가지 WARNING 수준 갭이 있다. CRITICAL 위반은 없다.

## 위험도

LOW

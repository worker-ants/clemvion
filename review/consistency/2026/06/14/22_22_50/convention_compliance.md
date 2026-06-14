# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`
대상: `spec/4-nodes/6-presentation/` (구현 착수 전)

---

## 발견사항

### 발견사항 1
- **[INFO]** `0-common.md` 섹션 번호 결락 — §9 없이 §8 → §10 점프
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` 섹션 헤딩 순서 (`## 8. 출력 구조 색인` 다음이 `## 10. AI Tool 모드`)
  - 위반 규약: 정식 명시 규약이 아니라 내부 일관성 문제 (CLAUDE.md "문서 구조 규약" — 본문 섹션 순서 일관성)
  - 상세: `## 9.` 섹션이 존재하지 않아 번호 연속성이 깨진다. 또한 `## 4.6 Conversation Thread opt-out` 이 `## 5.` 전에 삽입돼 있어 섹션 번호 체계가 이중으로 불일치한다. 이 자체가 spec 내용 오류는 아니나 교차 참조(`§9`, `§10.x`) 시 예측 가능성이 낮아진다.
  - 제안: `## 4.6` 을 `## 4.6` 그대로 두되 `## 9` 를 문서에 추가하거나, 아니면 AI Tool 모드를 `## 9` 로 번호를 맞춰 조정한다. 둘 중 하나의 결정을 규약 갱신 없이도 처리할 수 있는 단순 정리 사항.

---

### 발견사항 2
- **[INFO]** `4-form.md` · `1-carousel.md` 은 `## Rationale` 섹션 보유; `2-table.md` · `3-chart.md` 는 미보유
  - target 위치: `spec/4-nodes/6-presentation/2-table.md`, `spec/4-nodes/6-presentation/3-chart.md`
  - 위반 규약: CLAUDE.md §"문서 구조 규약" — "Overview / 본문 / Rationale 3섹션 권장" (권장 사항)
  - 상세: CLAUDE.md 는 3섹션을 "권장"으로 명시한다. `0-common.md` · `4-form.md` · `5-template.md` 는 `## Rationale` 를 보유하나, `2-table.md` · `3-chart.md` 는 없다. 구현 착수 전 spec 완결성 측면에서 결정 근거가 없으면 구현자가 선택 배경을 알 수 없다.
  - 제안: `2-table.md` 와 `3-chart.md` 에 `## Rationale` 섹션을 추가하고, 주요 설계 결정(예: output.rendered 폐기 결정, static vs dynamic 모드 분기 정책, sortBy null 처리 규칙 등)의 근거를 기술한다.

---

### 발견사항 3
- **[WARNING]** `4-form.md` §6.2 에 `validation.min`/`max`·`pattern` 검증이 "Planned"로 표시되어 있으나 `status: partial` + 해당 항목들이 `validationRuleSchema` 에 이미 정의된 필드로 spec 과 schema 사이 구현 완료 여부 신호가 불일치
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §6.2 (line ~329) 및 §1 ValidationRule 구조 표 (line ~57-61)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `partial` 상태는 `pending_plans` 의무. 더 나아가 §2.1 "status: partial → 일부 구현됨" 정의. `node-output.md Principle 3.1` — pre-flight vs runtime 에러 분류 정확성
  - 상세: `validation.min`/`max`/`pattern` 필드는 `validationRuleSchema` 에 **이미 존재**하고(`form.schema.ts:20-29` — §1 ⚠ 주석 참조) spec 자체에도 ValidationRule 구조 표에 정의된 퍼스트클래스 필드다. 그러나 §6.2 의 검증 실패 처리 표에는 이 필드들에 대한 서버측 검증이 "Planned"로 기재돼 있다. 즉, 필드 선언(schema)은 구현돼 있고 validator 적용은 미구현인 상태인데, spec 이 이 구분을 §1 ⚠ 주석에서만 간접 언급하고 §6.2 표에는 직접 명시하지 않아 구현자가 "어느 레이어까지 구현하면 되는가"를 §1·§6.2·Rationale 세 곳을 교차해야만 이해할 수 있다.
  - 제안: §6.2 에 "검증 지점 (구현)" 비고 주석처럼 "현재 구현된 검증 범위"와 "Planned 범위"를 분리하는 표 행 또는 주석을 추가하거나, §1 의 ValidationRule 구조 표 `min`/`max`/`pattern` 행에 "(서버 검증 Planned)" 를 인라인으로 명시한다. 이 방식이 구현자에게 가장 빠른 신호가 된다.

---

### 발견사항 4
- **[INFO]** `4-form.md` §4 "실행 로직" 에서 검증 실패 흐름이 "§5 Blocking Mode 흐름의 form 변형" 으로만 참조되나 §5 에는 "form 변형" 이라는 명시 항목이 없음
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §4 (line ~212), "서버가 [공통 §3](./0-common.md#3-blocking-mode-실행-흐름) Blocking Mode 흐름의 form 변형으로 유효성 검증" 문구
  - 위반 규약: CLAUDE.md 문서 구조 규약 — 본문 내 참조의 정확성 (해당 anchor 에 "form 변형" 개념이 없음)
  - 상세: `공통 §3` (Blocking Mode 실행 흐름)은 ButtonDef 기반 흐름을 정의하며 Form 노드의 field 검증 흐름은 별도다. "form 변형" 이라는 용어가 공통 §3 내에 명시적 subsection 없이 사용되어 구현자가 어디서 form-specific 로직을 찾아야 할지 불명확하다.
  - 제안: §4 참조를 "서버가 §6.2 의 form 입력 검증을 수행한다 (공통 §3 Blocking Mode 흐름의 form 특화 변형)" 으로 재서술하거나, 공통 §3 에 "Form 노드 변형 (ButtonDef 아닌 FormField 기반)" 항목을 추가한다.

---

### 발견사항 5
- **[INFO]** `0-common.md` §4.3 (Waiting 상태 output) 과 `node-output.md` §4.3 의 Table `{ rows }` vs `{ rows, totalRows }` 정의 불일치
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` §7 표 — `output` 칸의 Table 행 설명 "Table `rows`, Chart `data`" (§4 참조 표현). `spec/conventions/node-output.md` §4.3 표 — `table (static)` = `{ rows }`, `table (dynamic)` = `{ rows, totalRows }`
  - 위반 규약: `spec/conventions/node-output.md §4.3` — Waiting 상태 `output` 상세
  - 상세: `0-common.md §7` (5필드 공통 규약 표) 의 `output` 칸은 "Carousel `items` (dynamic), Table `rows`, Chart `data`" 로 단순 기술한다. `node-output.md §4.3` 은 `table (dynamic)` = `{ rows, totalRows }`, `table (static)` = `{ rows }` 로 구분한다. `2-table.md §5.1` 도 `output.totalRows` 를 포함한다. `0-common.md §7` 의 단순화된 기술이 `totalRows` 를 누락하여 공통 규약 문서와 상세 spec 이 불일치한다.
  - 제안: `0-common.md §7` 의 `output` 설명에 "Table `rows` + `totalRows` (dynamic)" 등 `totalRows` 를 포함하거나, "노드별 상세는 §8 출력 구조 색인 참조"로 단순화 위임 처리를 명시한다.

---

### 발견사항 6
- **[INFO]** `2-table.md` 본문에 `output.rendered` 폐기 언급 ("D5, 2026-05-17 — backend HTML snapshot 폐기") 이 있으나 frontmatter `status: implemented` 와 정합 확인 필요
  - target 위치: `spec/4-nodes/6-presentation/2-table.md` §4 실행 로직 step 8 주석 (line ~1238), frontmatter `status: implemented`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `implemented` = "모든 약속 구현 완료"
  - 상세: `2-table.md` 는 `status: implemented` 이고 `pending_plans` 없다. `§4 step 8` 에 "D5, 2026-05-17 — backend HTML snapshot 폐기" 가 명시돼 있으나, 이것이 이미 merge 된 변경인지(PR 머지 완료 = `implemented` 정합) 아직 적용 중인지 spec 문서에서 바로 판단하기 어렵다. worktree 에서 확인하면 `output.rendered` 폐기가 §5.1 출력 예시에도 반영돼 있으므로 spec 자체는 일관적이다.
  - 제안: 폐기 결정이 PR merge 완료라면 현 `status: implemented` 가 맞다. 향후 spec 갱신 시 "D5" 같은 임시 설계 결정 식별자는 완료 후 `Rationale` 로 이동하거나 제거하는 패턴을 권장한다 (구현 완료 후 임시 레이블이 본문에 남아 있으면 독자가 "아직 진행 중인가?"로 혼동할 수 있음).

---

## 요약

`spec/4-nodes/6-presentation/` 의 문서들은 전반적으로 정식 규약(`spec/conventions/`)을 준수하고 있다. frontmatter `id`/`status`/`code`/`pending_plans` 필드 의무를 지키고, `node-output.md` 의 5필드 invariant (`{ config, output, meta?, port?, status? }`) 및 Principle 1.1(config/output 직교), Principle 4.5(`interaction.data` 규격), Principle 6(동적 포트 명명), Principle 7(config echo) 을 일관되게 따른다. 에러 코드 명명(`VALIDATION_ERROR`)은 `error-codes.md §1` 의 시스템 전역 공용 코드 예외에 해당해 정합한다. 구현 착수를 차단할 CRITICAL 위반은 없다. 발견된 사항은 모두 INFO/WARNING 수준의 문서 일관성 개선 제안으로, 구현 전 spec 을 보강하면 구현자가 더 명확한 신호를 받을 수 있다. 특히 `4-form.md §6.2` 의 "Planned 검증 범위 vs 구현된 검증 범위" 경계 명확화(발견사항 3, WARNING)는 `validation.min`/`max`/`pattern` 구현 착수 시 혼선 방지를 위해 먼저 정리하는 것이 권장된다.

## 위험도

LOW

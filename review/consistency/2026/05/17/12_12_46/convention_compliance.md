# 정식 규약 준수 검토 결과

대상 문서: `plan/in-progress/spec-draft-cafe24-restricted-scopes.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. 신규 파일 명명 규약 — 완전 준수

- **[INFO]** `spec/conventions/cafe24-restricted-scopes.md` 신규 파일명 준수
  - target 위치: D1 섹션 / frontmatter `target_specs`
  - 위반 규약: `spec/conventions/*.md` — "평문" 패턴 (CLAUDE.md 명명 컨벤션 표)
  - 상세: 신규 컨벤션 파일 `cafe24-restricted-scopes.md` 는 `spec/conventions/` 하위 평문 파일명 패턴을 올바르게 따르고 있다. 숫자 prefix 없이 평문명으로 두는 것이 해당 위치의 정식 규약이며 일치한다.
  - 제안: 변경 없음.

---

### 2. D1 문서 내부 구조 — `## CHANGELOG` 섹션 포함, `## Rationale` 없음

- **[WARNING]** 신규 컨벤션 파일에 `## Rationale` 섹션 없음
  - target 위치: D1 `spec/conventions/cafe24-restricted-scopes.md` 전체 구조
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의) / 2. 본문 (스펙) / 3. Rationale — 결정의 배경·근거·폐기된 대안"
  - 상세: D1 초안 문서는 §1 ~ §7 본문 + `## 7. CHANGELOG` 로 구성되어 있으나 `## Rationale` 섹션이 없다. 기각된 대안(차단 정책 / 신규 에러 코드 / status enum 확장 등)은 D7 의 "기각된 대안" 항목에만 열거되어 있으며, 컨벤션 파일 본문 내부 Rationale 섹션으로 끌어들이지 않았다. 규약은 "권장"이지만, 같은 draft 내 `spec/2-navigation/4-integration.md` (D5.6) 와 `spec/4-nodes/4-integration/4-cafe24.md` (D6.4) 는 모두 Rationale 섹션 추가를 명시하고 있어 일관성 차이가 발생한다.
  - 제안: D1 초안 `## 6. 참고 링크` 뒤에 `## Rationale` 섹션을 추가하고, D7 의 기각 대안(차단 정책, 신규 에러 코드, status enum 확장)과 trade-off 내용을 이곳으로 옮기는 것을 권장한다. `## 7. CHANGELOG` 는 Rationale 뒤에 위치시킨다.

---

### 3. catalog `_overview.md` 내부 구조 — `_` prefix 파일이 아닌 디렉토리 내 `_overview.md`

- **[WARNING]** `spec/conventions/cafe24-api-catalog/_overview.md` 파일명이 CLAUDE.md 컨벤션과 부분 불일치
  - target 위치: D3 섹션 / frontmatter `target_specs`의 `spec/conventions/cafe24-api-catalog/_overview.md`
  - 위반 규약: CLAUDE.md 명명 컨벤션 표 — `spec/<영역>/_product-overview.md` (언더스코어 prefix = "영역의 제품 정의") / `spec/<영역>/0-overview.md` (`0-` prefix = "영역 안의 기술 아키텍처 개요"). 평문 conventions 파일은 `spec/conventions/*.md`
  - 상세: `spec/conventions/cafe24-api-catalog/_overview.md` 의 `_overview.md` 라는 파일명은 CLAUDE.md 의 컨벤션 표에 정의된 어느 패턴과도 정확히 일치하지 않는다. `_product-overview.md` 는 "영역의 제품 정의" 전용이며, 아키텍처 개요라면 `0-overview.md` 가 옳다. `_overview.md` 는 기존 실제 파일(`spec/conventions/cafe24-api-catalog/_overview.md`)로 이미 존재하며 본 draft 는 해당 파일을 수정하는 것이므로, 이 이슈는 이번 draft 가 만든 것이 아니라 기존 파일 문제임을 명시한다. draft 자체는 기존 규약에 따라 해당 파일을 참조·수정하고 있다.
  - 제안: 이번 draft 범위 내에서는 수정 불필요. 단, 향후 conventions 파일 housekeeping 시 `_overview.md` → `0-overview.md` 로 rename 을 고려할 것을 INFO 수준으로 기록한다. 규약 자체를 `_overview.md` 를 허용하는 패턴으로 명문화하는 것도 대안.

---

### 4. `spec/conventions/cafe24-api-catalog/_overview.md` — `_` prefix 파일 기존 존재 확인 (INFO)

- **[INFO]** 이미 존재하는 파일 패턴이며, draft 는 이를 변경하지 않음
  - target 위치: D3, D3.1 ~ D3.3
  - 위반 규약: 위 §3 참고
  - 상세: draft 가 `_overview.md` 를 새로 만드는 것이 아니라 기존 파일을 편집하는 것이므로 이 draft 의 직접 위반은 아님. 기록용.
  - 제안: 변경 없음.

---

### 5. D2 — `spec/conventions/cafe24-api-metadata.md` §8 CHANGELOG 참조

- **[INFO]** 실제 파일의 CHANGELOG 섹션 번호 확인 필요
  - target 위치: D2.3 "§8 CHANGELOG 추가"
  - 위반 규약: 출력 포맷 규약 — 정식 문서 내 섹션 번호 일치 (spec/conventions/cafe24-api-metadata.md 의 실제 섹션 구조와 대조)
  - 상세: draft 는 `cafe24-api-metadata.md` 의 "§8 CHANGELOG" 에 항목을 추가한다고 명시하나, 해당 파일의 실제 CHANGELOG 섹션 번호가 §8 인지 확인이 필요하다. 현재 열람된 파일 범위(§1~§4 일부)에서는 §8 의 존재를 확인할 수 없었다. 만약 실제 섹션 번호가 다르면 위치 지정 오류.
  - 제안: `spec/conventions/cafe24-api-metadata.md` 전체를 열람해 CHANGELOG 의 실제 섹션 번호를 확인하고 D2.3 의 §8 표기를 실제 번호로 정정할 것.

---

### 6. plan 문서 frontmatter — `type` 필드

- **[INFO]** frontmatter 에 비표준 `type` 필드 사용
  - target 위치: plan 문서 frontmatter `type: spec-draft`
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — frontmatter 는 `worktree`, `started`, `owner` 세 필드를 표준으로 정의
  - 상세: frontmatter 에 `type: spec-draft` 필드가 추가되어 있다. 이 필드는 CLAUDE.md 가 정의한 표준 frontmatter 에 없는 확장 필드다. 금지된 것은 아니며, 추가 메타데이터로 유용할 수 있으나, 표준화되지 않은 필드임을 기록한다.
  - 제안: 현 상태 유지 가능. 필요하다면 CLAUDE.md 의 frontmatter 정의에 `type` 선택 필드를 추가해 명문화하는 것을 권장.

---

### 7. 금지 경로 — 위반 없음

- **[INFO]** 옛 `prd/`, `memory/`, `user_memo/` 경로 사용 없음
  - target 위치: 전체 draft
  - 위반 규약: CLAUDE.md — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12)으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: draft 내 모든 파일 경로는 `spec/`, `plan/in-progress/` 를 사용하며 금지된 옛 경로는 사용하지 않는다.
  - 제안: 변경 없음.

---

### 8. API 에러 응답 필드 명명 — `details.requiresCafe24Approval`

- **[INFO]** 에러 응답 보강 필드 명명 스타일 확인
  - target 위치: D5.4, D4.3의 `details.requiresCafe24Approval: string[]`
  - 위반 규약: `spec/conventions/node-output.md` (에러 응답 형식) — 해당 컨벤션 파일 내용을 직접 열람하지 않았으나, camelCase 필드 명명은 기존 `details.missingScopes: string[]` 과 일관된 패턴을 따름
  - 상세: `details.requiresCafe24Approval` 는 camelCase 로 기존 `details.missingScopes` 와 동일 스타일이다. 기존 패턴과 일치하므로 출력 포맷 규약 위반 가능성은 낮다.
  - 제안: `spec/conventions/node-output.md` 를 열람해 `details.*` 필드 명명 규칙을 명시적으로 확인할 것을 권장하나, 현재 범위 내 이슈로 분류하지 않음.

---

### 9. Rationale 배치 — D5 / D6 는 올바름

- **[INFO]** D5.6 / D6.4 Rationale 신설 항목은 규약 준수
  - target 위치: D5.6 `## Rationale` 끝 추가 / D6.4 `## 9. Rationale` 끝 추가
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — spec 문서 끝의 `## Rationale` 섹션 권장
  - 상세: 기존 spec 파일에 Rationale 섹션이 있음을 전제하고 해당 섹션 끝에 신규 항목을 추가하는 방식은 규약에 부합한다.
  - 제안: 변경 없음.

---

### 10. `_overview.md` 내 §4 동기 정책 신규 규칙 번호

- **[INFO]** D3.2 에서 추가하는 규칙 번호 8번이 기존 7번 규칙과 연속 — 확인 권장
  - target 위치: D3.2 `기존 검증 규칙 7번 뒤에 8번 추가`
  - 위반 규약: spec/conventions/cafe24-api-catalog/_overview.md §4 동기 정책
  - 상세: 현재 정식 파일에 실제로 7개의 검증 규칙이 있는지 확인됐다 (읽은 범위: 규칙 1~7 명시). 8번 추가는 올바른 연번이다. 이슈 없음.
  - 제안: 변경 없음.

---

## 요약

본 spec draft 는 전반적으로 정식 규약을 준수하고 있다. 금지된 경로(prd/, memory/, user_memo/) 사용 없음, plan 문서 frontmatter 핵심 3 필드(worktree/started/owner) 모두 포함, 신규 컨벤션 파일은 `spec/conventions/` 평문 패턴 준수, 영향 spec 파일들은 기존 Rationale 섹션에 의사결정 근거를 추가하는 방식으로 규약에 부합한다. 주요 주의 사항은 두 가지다: (1) 신규 컨벤션 파일 `cafe24-restricted-scopes.md` 자체에 `## Rationale` 섹션이 없어 권장 3섹션 구성에서 이탈하고 있으며(WARNING), (2) `spec/conventions/cafe24-api-catalog/_overview.md` 의 `_overview.md` 파일명이 CLAUDE.md 가 정의한 명명 패턴 어디에도 정확히 해당하지 않는 기존 파일 문제가 있다(WARNING, 이번 draft 가 만든 것은 아님). `cafe24-api-metadata.md` 의 실제 CHANGELOG 섹션 번호도 확인 후 D2.3 의 §8 표기를 정정할 필요가 있다(INFO).

## 위험도

LOW

# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-cafe24-private-followup.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-16

---

## 발견사항

### 1. 문서 구조 규약

- **[INFO]** plan 문서 frontmatter 형식은 정합
  - target 위치: 문서 최상단 frontmatter (worktree / started / owner)
  - 위반 규약: 해당 없음
  - 상세: `worktree`, `started`, `owner` 세 필드 모두 존재하며 CLAUDE.md 명세와 일치한다. `plan/in-progress/` 에 위치한 것도 적절하다.
  - 제안: 없음.

- **[INFO]** plan 문서 자체는 `spec/` 문서가 아니므로 3섹션(Overview / 본문 / Rationale) 규약 적용 대상이 아님
  - target 위치: 문서 전체 구조
  - 위반 규약: 해당 없음
  - 상세: CLAUDE.md 의 3섹션 권장 규칙은 `spec/<영역>/N-name.md` 형식의 spec 본문 문서에 적용되며, plan 추적 문서(`plan/in-progress/*.md`)에는 적용되지 않는다. 본 target 문서는 plan 문서이므로 구조 규약 위반 없음.
  - 제안: 없음.

### 2. 금지 항목 — 구 flat 경로 참조 (변경 3 에서 스스로 식별·교정 예정)

- **[WARNING]** 변경 3 의 교정 대상 경로가 plan 본문 안에 구 flat 형식으로 인용되어 있음
  - target 위치: `## 변경 3 — 구 flat 경로 참조 교정` 섹션, `line 903` 기재 표현 `(참고: review/consistency/2026-05-14_18-23-55)`
  - 위반 규약: CLAUDE.md "명명 컨벤션" 표의 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 규칙; 옛 flat 경로(`review/<timestamp>/`, `review/consistency/<timestamp>/`) 사용 금지
  - 상세: 이 경로는 plan 문서가 _교정 대상으로 인용_한 것이어서 실제 새 경로를 생성하는 것이 아니나, plan 문서 본문 안에 구 flat 경로가 인용 형태로 노출되어 있다. 이 섹션은 해당 경로를 `spec/2-navigation/4-integration.md` 안에서 nested 형식으로 바꾸는 작업을 기술하고 있어 의도적인 before/after 비교이므로 단순 오류는 아니다. 단, plan 문서 자체에 구 경로를 기재하는 것이 혼동을 줄 수 있다.
  - 제안: 변경 3 설명 본문에 `(옛 flat 경로 → nested ISO 로 교정)` 라는 명시적 레이블을 붙여 "이것이 교정 전 상태" 임을 분명히 한다. 또는 인용 표기를 `` `review/consistency/2026-05-14_18-23-55` → `review/consistency/2026/05/14/18_23_55` `` 형식의 before→after 표기로 바꾼다.

### 3. 명명 규약 — plan 문서 파일명

- **[INFO]** 파일명 `spec-draft-cafe24-private-followup.md` 는 평문(plain) 형식으로 규약 준수
  - target 위치: 파일 경로 `plan/in-progress/spec-draft-cafe24-private-followup.md`
  - 위반 규약: 해당 없음
  - 상세: CLAUDE.md 는 `plan/in-progress/<name>.md` 를 "평문" 으로 정의하며 별도 prefix 규칙이 없다. kebab-case 사용도 문제 없다.
  - 제안: 없음.

### 4. 변경 1 — API 응답 shape 및 출력 포맷 규약 검토

- **[INFO]** `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: string[] }` 응답 shape 은 node-output.md 의 `output` 직교 규칙 대상이 아님
  - target 위치: `## 변경 1` 섹션, "분기 ② — Cafe24 Private" 응답 shape 기술
  - 위반 규약: 해당 없음
  - 상세: `spec/conventions/node-output.md` (Principle 0~Principle 8) 는 워크플로우 노드 핸들러의 `output` 필드 규칙이다. 변경 1 에서 기술된 응답 shape 은 backend REST API 의 응답 DTO 이며, node-output 규약의 직접 적용 범위 밖이다. swagger.md 의 응답 DTO 규약(`dto/responses/*-response.dto.ts` 위치·래퍼 패턴)은 spec 문서가 아닌 구현 파일에 적용되므로, plan 문서에서 API shape 을 기술하는 데 추가 규약 위반은 없다.
  - 제안: 없음.

- **[INFO]** `scopesAdded: string[]` 필드명이 camelCase 로 일관 사용됨
  - target 위치: `## 변경 1`, 분기 ② 응답 shape 및 UI 설명 내 `scopesAdded` 사용
  - 위반 규약: 해당 없음
  - 상세: cafe24-api-metadata.md 는 Cafe24 Admin API 메타데이터 형식을 정의하며 API 응답 필드명을 직접 규제하지 않는다. `scopesAdded` 는 backend 가 정의하는 자체 응답 필드이므로 별도 컨벤션 위반 없음.
  - 제안: 없음.

### 5. 변경 2 — Rationale 섹션 보강 방식

- **[INFO]** Rationale 항 보강 계획이 CLAUDE.md 의 정보 저장 위치 원칙과 일치
  - target 위치: `## 변경 2` 전체
  - 위반 규약: 해당 없음
  - 상세: CLAUDE.md 는 "아키텍처 결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale` 섹션" 으로 명시한다. 변경 2 는 `spec/2-navigation/4-integration.md` 의 Rationale 섹션을 보강하는 작업으로 이 원칙과 정합하다.
  - 제안: 없음.

### 6. 변경 3 — review 경로 참조 교정

- **[INFO]** 교정 방향(nested ISO 형식)이 CLAUDE.md 명명 컨벤션과 일치
  - target 위치: `## 변경 3` 전체
  - 위반 규약: 해당 없음
  - 상세: `review/consistency/2026/05/14/18_23_55` 형식은 CLAUDE.md 의 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 규칙과 정확히 일치한다. 교정 방향 자체는 올바르다.
  - 제안: 없음.

### 7. 영향 범위 섹션 — prd/ / memory/ 금지 경로 사용 여부

- **[INFO]** 금지 경로(`prd/`, `memory/`, `user_memo/`) 참조 없음
  - target 위치: 문서 전체
  - 위반 규약: 해당 없음
  - 상세: 문서 전체를 검토한 결과 옛 `prd/`, `memory/`, `user_memo/` 경로를 참조하거나 신규 생성하는 내용이 없다.
  - 제안: 없음.

### 8. 체크리스트 — consistency-check 호출 순서

- **[INFO]** `consistency-check --spec` 호출이 체크리스트에 포함되어 있고 현재 미완료 상태로 plan 에 기재됨
  - target 위치: `## 체크리스트`, `[ ] consistency-check --spec 호출` 항목
  - 위반 규약: 해당 없음
  - 상세: CLAUDE.md 는 "project-planner 는 spec/ 에 쓰기 직전에 consistency-checker --spec 을 의무 호출" 로 정의하며, 본 체크리스트에 해당 단계가 명시되어 있어 절차를 정확히 따르고 있다.
  - 제안: 없음.

---

## 요약

대상 plan 문서(`plan/in-progress/spec-draft-cafe24-private-followup.md`)는 정식 규약(`spec/conventions/**` 및 CLAUDE.md)을 전반적으로 잘 준수하고 있다. frontmatter 구성, 파일 위치, spec 문서 Rationale 보강 방향, consistency-check 절차 명시, nested ISO 경로 교정 방향 모두 규약과 일치한다. 다만 `## 변경 3` 섹션에서 교정 전 구 flat 경로(`review/consistency/2026-05-14_18-23-55`)가 plan 본문 안에 맥락 설명 없이 노출되어 있어, "이것이 before(교정 대상)" 임을 명확히 표기하지 않으면 다른 검토자가 혼동할 수 있다. CRITICAL 수준의 규약 직접 위반은 발견되지 않았다.

---

## 위험도

LOW

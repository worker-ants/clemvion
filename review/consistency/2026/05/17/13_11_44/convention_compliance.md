# Convention Compliance Check

대상 문서: `plan/in-progress/spec-draft-2-navigation-hygiene.md`

---

### 발견사항

- **[INFO]** Plan 문서 파일명이 "spec-draft-" prefix 로 시작
  - target 위치: 파일명 `spec-draft-2-navigation-hygiene.md`
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 표 — `plan/in-progress/<name>.md` 는 "평문" 패턴으로, 파일명에 별도 형식 제약은 없음. 위반이라기보다 관찰 사항.
  - 상세: `plan/in-progress/` 아래 파일명은 자유 평문이므로 `spec-draft-` prefix 자체는 규약 위반이 아니다. 다만 "spec draft" 개념은 plan 문서가 아닌 실제 spec 파일(`spec/<영역>/N-name.md`)의 임시 상태를 가리킬 수 있어 혼동 여지가 있다. 이 파일은 plan 문서(작업 추적)이지 spec 파일 자체가 아니므로 현재 위치와 명명은 적절하다.
  - 제안: 현재 상태 유지 가능. 의도가 명확하다면 변경 불필요.

- **[INFO]** §3.2 의 cross-ref 링크 경로가 상대 경로 기준으로 불명확
  - target 위치: §3.2 After 블록, `[Spec 통합 화면 §9.1](./2-navigation/4-integration.md#91-목록crud)`
  - 위반 규약: 직접 규약 조항은 없으나, plan 문서 내 spec 파일 참조 시 `spec/` root 기준 절대 경로를 명시하는 것이 다른 plan 문서들의 관례이다.
  - 상세: 이 링크는 `spec/1-data-model.md` 의 패치 After 내용 안에 삽입되는 텍스트다. `spec/1-data-model.md` 기준의 상대 경로로 `./2-navigation/4-integration.md` 는 `spec/2-navigation/4-integration.md` 를 가리키므로 내용상 올바르다. plan 문서 자체의 참조 링크가 아니라 패치 내용 인용이므로 규약 위반으로 보기 어렵다.
  - 제안: 현재 상태 유지 가능. 혼동을 줄이려면 plan 문서 본문에서 별도로 `spec/2-navigation/4-integration.md §9.1` 으로 병기할 수 있다.

- **[INFO]** 문서 제목의 "Spec Draft:" 접두어가 plan 문서 권장 구조와 미세한 거리감
  - target 위치: 문서 1번째 제목 `# Spec Draft: 14-execution-history 자기 참조 제거 + 1-data-model §2.10 에 autoRefresh derived 주석`
  - 위반 규약: CLAUDE.md — plan 문서는 `## Overview / 본문 / Rationale` 3섹션 권장 대상이 아니다 (spec 문서 권장 사항). plan 문서 헤딩 형식에 대한 명시적 규약은 없다.
  - 상세: "Spec Draft:" 가 제목에 들어간 것은 이 plan 이 spec 변경 드래프트임을 명시하는 것으로 의도가 명확하다. 규약 위반이 아님.
  - 제안: 현재 상태 유지 가능.

- **[INFO]** §2 "범위 밖" 표의 `위임처` 열에 기재된 권고 plan 경로가 본문과 중복
  - target 위치: §2 범위 밖 표 바로 아래 blockquote, `plan/in-progress/spec-update-2-navigation-hygiene-followup.md`
  - 위반 규약: 해당 없음 (단순 내부 중복).
  - 상세: §5 "후속" 절에도 동일 경로가 반복된다. 규약 위반은 아니나 단일 진실 원칙(중복 기술 최소화) 관점에서 한 곳만 두는 것이 깔끔하다.
  - 제안: §2 의 blockquote 또는 §5 후속 중 하나만 유지.

---

### 요약

`plan/in-progress/spec-draft-2-navigation-hygiene.md` 는 CLAUDE.md 의 plan 문서 규약을 전반적으로 잘 준수하고 있다. frontmatter(`worktree`, `started`, `owner`) 가 모두 명시되어 있고, 미완료 체크박스가 존재하므로 `in-progress/` 위치가 적절하다. 옛 `prd/`, `memory/` 경로를 답습하는 패턴도 없으며, 금지 항목 위반 사항도 발견되지 않는다. `node-output.md` 나 `swagger.md` 같은 구현 규약은 본 plan 문서의 점검 대상이 아니며(plan 문서는 spec 패치 기획 추적 목적), 해당 규약들은 실제 spec 및 코드 변경 시 점검 대상이다. 발견된 항목은 모두 INFO 수준의 경미한 형식 제안으로, 정식 규약 위반은 없다.

### 위험도

NONE

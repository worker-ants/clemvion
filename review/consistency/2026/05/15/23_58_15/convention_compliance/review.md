# Convention Compliance Review

**대상**: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-05-15

---

### 발견사항

- **[INFO]** `memory/` 경로 참조 제거 계획이 명시되어 있으나 제거 전 draft 상태
  - target 위치: `## Rationale 보강` 섹션 — "폐기된 `memory/kb-embedding-model-selection.md` 경로 참조 1줄 제거"
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — "옛 `prd/`, `memory/`, `user_memo/` 폴더는 docs-consolidation(2026-05-12) 으로 모두 `spec/` 또는 `plan/complete/archive/` 로 흡수되었다. 신규 문서를 옛 경로 컨벤션으로 만들지 않는다."
  - 상세: target 문서 자체가 spec 본문이 아니라 spec 개정 전 plan/draft 이므로, `memory/` 경로 참조가 "제거 예정"으로 기술되어 있는 것은 문서의 목적에 부합한다. 그러나 spec 본문(`8-embedding-pipeline.md §Rationale`)에 해당 참조가 아직 남아있다면, spec 반영 단계에서 즉시 제거되어야 한다.
  - 제안: 본 draft 자체에서는 조치 불필요. spec 반영 시 해당 `memory/` 참조 1줄이 실제로 삭제되었는지 확인 체크리스트에 포함 (이미 "조치" 항목에 명시되어 있음 — 이행 여부만 확인).

- **[INFO]** `review/2026-05-02_13-18-24/` 옛 flat 경로 참조 제거 계획
  - target 위치: `## Rationale 보강` 섹션 — "옛 flat review 경로 `review/2026-05-02_13-18-24/` 참조 1줄 제거"
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` nested ISO 형식을 신규 세션부터 강제. 기존 flat 경로 데이터는 사용자가 일괄 이동 예정이며, 기존 데이터는 역사 기록으로 그대로 두는 것이 허용됨.
  - 상세: 옛 flat 경로를 spec Rationale 에서 참조하는 것은 역사 기록의 연결로서 이해 가능하지만, 새 spec 의 최신 상태 기술 원칙과 어긋난다. 제거하는 것이 맞으며 draft 에 이미 제거 계획이 포함되어 있다.
  - 제안: spec 반영 시 실제 제거 이행 여부 확인. 역사 참조가 필요하다면 날짜만 텍스트로 남기고 경로 링크를 제거하는 것도 대안.

- **[INFO]** plan draft 문서가 `## Overview` / 본문 / `## Rationale` 3섹션 권장 구조를 따르지 않음
  - target 위치: 문서 전체 구조 — `## 배경`, `## 권위 결정`, `## 변경 대상 spec 문서`, `## Rationale 보강`, `## 후속 plan`, `## 검토 후 단계` 섹션 구성
  - 위반 규약: `CLAUDE.md` 프로젝트 스펙 문서 섹션 — "각 spec 문서는 권장 3섹션 구성을 따른다: 1. Overview (제품 정의), 2. 본문 (스펙), 3. Rationale"
  - 상세: 이 3섹션 구조 권장은 `spec/` 문서에 대한 규약이다. `plan/in-progress/` 문서는 해당 규약의 적용 대상이 아니며, plan 문서 고유의 섹션 구성(배경·변경 대상·검토 단계 등)이 더 적합하다. 따라서 실질적 위반이 아니나, 혼동을 방지하기 위해 INFO 로 기록한다.
  - 제안: 조치 불필요. plan/in-progress 문서에는 spec 3섹션 구조 권장이 적용되지 않음을 확인.

- **[INFO]** `plan/in-progress/` 문서 frontmatter 준수 확인
  - target 위치: 문서 상단 frontmatter
  - 위반 규약: `CLAUDE.md` PLAN 문서 라이프사이클 — frontmatter 에 `worktree`, `started`, `owner` 3필드 필수
  - 상세: target 문서의 frontmatter는 `worktree: spec-pipeline-consistency-4c9e1f`, `started: 2026-05-15`, `owner: project-planner` 세 필드를 모두 포함하고 있다. 규약을 완전히 준수한다.
  - 제안: 해당 없음 — 완전 준수.

---

### 요약

target 문서(`plan/in-progress/spec-draft-embedding-pipeline-consistency.md`)는 정식 규약 전반에 걸쳐 양호한 준수 상태를 보인다. frontmatter 3필드(`worktree`, `started`, `owner`)가 올바르게 기재되어 있고, `plan/in-progress/` 경로 배치, `plan/complete/archive/from-*/` 신규 생성 금지 원칙 위배 없음, 금지된 `prd/`·`memory/`·`user_memo/` 경로로의 신규 문서 생성 시도 없음 등 핵심 규약을 준수한다. 발견된 사항은 모두 INFO 등급으로, `memory/` 경로 및 옛 flat review 경로 참조가 spec 본문(8-embedding-pipeline.md §Rationale)에 남아있을 수 있다는 점이다. 그러나 draft 자체에 두 항목 모두 제거 계획이 명시되어 있어 spec 반영 시 처리가 예정되어 있다. CRITICAL 또는 WARNING 등급 위반은 없다.

### 위험도

LOW

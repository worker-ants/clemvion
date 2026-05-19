# 정식 규약 준수 검토 — plan/in-progress/button-cap-spec-validator.md

## 발견사항

- **[INFO]** plan frontmatter 형식은 규약과 완전히 일치
  - target 위치: 파일 상단 frontmatter (lines 1–5)
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 frontmatter 항목
  - 상세: `worktree`, `started`, `owner` 세 필드 모두 규약대로 존재하며, worktree 값(`button-cap-spec-validator`)이 실제 worktree 디렉토리 이름과 일치한다. 이상 없음 — INFO 로 기록.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/` 위치 및 파일명 형식 준수
  - target 위치: 파일 경로 `plan/in-progress/button-cap-spec-validator.md`
  - 위반 규약: CLAUDE.md §명명 컨벤션 — `plan/in-progress/<name>.md` 평문 형식
  - 상세: 평문 kebab-case 파일명이며 `plan/in-progress/` 아래에 위치. 규약과 일치. INFO 로 기록.
  - 제안: 없음.

- **[INFO]** 작업 항목 내 `git mv` 계획이 미체크(`[ ]`)로 남아 있어 `complete/` 이동이 적절히 보류 중
  - target 위치: `## 작업 항목` — 마지막 두 `git mv` 항목
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — "모든 항목 완료 전까지 `in-progress/` 에 있어야 한다"
  - 상세: `git mv` 항목이 `[ ]` 로 미완료 상태이므로 현재 `in-progress/` 에 있는 것이 올바르다. 규약 준수.
  - 제안: 없음.

- **[WARNING]** `presentation-button-render-investigation.md` 이동 계획이 "본 PR 머지 시점" 이라는 조건부 기술로만 표현됨
  - target 위치: `## 작업 항목` — `git mv plan/in-progress/presentation-button-render-investigation.md plan/complete/` 행
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — "이동은 마지막 작업 PR 안에서 처리" + "plan 이동만 담은 별 PR 로 분리하지 않는다"
  - 상세: 규약은 같은 PR 내 commit 으로 `git mv` 를 수행하도록 요구하는데, 해당 항목이 "본 PR 머지 시점에" 라는 코멘트로만 처리 시점을 지정하고 있다. 의도는 올바르나, 이 항목이 체크리스트 기준 동일 PR 에 포함되는 별도 commit 인지 별도 PR 인지 모호하다. 별도 plan 이동 PR 로 분리될 경우 규약 위반.
  - 제안: 주석을 "본 PR 의 마지막 commit 에서 함께 `git mv`" 로 명확화하거나, 체크박스 설명에 "(동일 PR 내 chore commit)" 을 명시해 규약 의도를 명확히 한다.

- **[INFO]** `spec/conventions/` 정식 규약 파일(node-output.md, swagger.md 등)은 plan 문서에서 직접 참조되지 않음
  - target 위치: `## 관련 문서` 섹션
  - 위반 규약: 해당 없음 (plan 문서가 conventions 를 직접 참조할 의무는 없음)
  - 상세: plan 문서가 spec 변경(`0-common.md` §1.1 등)을 기술하고 있으나, 변경 내용이 node-output.md Principle 등에 영향을 주는지를 plan 단에서 언급하지 않는다. plan 문서의 역할 범위(구현 추적) 를 벗어나는 요구이므로 INFO 로만 기록.
  - 제안: spec 변경이 output convention 에 영향을 줄 경우 `## 관련 문서` 에 해당 convention 을 병기하면 reviewer 가 의존성을 추적하기 좋다.

- **[INFO]** `## 배경` · `## 결정` · `## 현 cap 인벤토리` · `## 작업 항목` · `## 관련 문서` 구성 — spec 문서 권장 3섹션(Overview/본문/Rationale) 과 대조
  - target 위치: 전체 문서 구조
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션은 **spec 문서**에 해당. plan 문서에는 적용 의무 없음.
  - 상세: plan 문서는 spec 문서가 아니므로 3섹션 구조 의무가 없다. 현 구조(배경/결정/인벤토리/작업항목/관련문서)는 plan 용도에 적합하고 규약 위반이 아님.
  - 제안: 없음.

## 요약

`plan/in-progress/button-cap-spec-validator.md` 는 CLAUDE.md 의 plan 문서 규약(frontmatter 형식, 파일 위치·명명, `in-progress/` 상태 관리, `complete/` 이동 타이밍)을 전반적으로 잘 준수하고 있다. `spec/conventions/` 정식 규약(node-output.md, swagger.md 등)은 plan 문서가 직접 따를 대상이 아니며, cafe24-api-catalog 규약도 본 plan 의 변경 범위(presentation 노드 버튼 cap) 와 무관하다. 유일한 지적 사항은 `presentation-button-render-investigation.md` 의 `git mv` 시점이 "본 PR 머지 시점" 이라는 표현으로 모호하게 기술된 점으로, 동일 PR 내 chore commit 임을 명시하면 규약 위반 가능성을 차단할 수 있다.

## 위험도

LOW

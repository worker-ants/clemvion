# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/node-config-required-defaults-sweep.md`
**검토 모드**: plan draft 검토 (--plan)
**검토 일시**: 2026-05-18

---

### 발견사항

- **[INFO]** frontmatter `worktree` 필드값에 slug 미포함
  - target 위치: frontmatter (라인 2) — `worktree: node-config-required-defaults-sweep`
  - 위반 규약: `CLAUDE.md §Worktree 기반 작업 정책 > 명명 규칙` 및 `§PLAN 문서 라이프사이클 > frontmatter 메타데이터`
  - 상세: CLAUDE.md 는 worktree 이름을 `<task_name>-<slug>` 형식으로 규정하고(예: `node-config-required-defaults-sweep-c41f58`), plan frontmatter 의 `worktree` 필드에도 이 전체 이름을 기재하도록 지정한다. 현재 값 `node-config-required-defaults-sweep` 은 slug 부분이 빠져 있어 consistency-checker 의 `plan_coherence` 체커가 대응 worktree 디렉토리를 조회할 때 불일치가 생길 수 있다. 실제 worktree 디렉토리명이 `node-config-required-defaults-sweep` (슬러그 없음)인 경우라면 이 지적은 해소되지만, 컨벤션 형식 자체는 slug 를 포함한 이름을 요구한다.
  - 제안: worktree 디렉토리의 실제 basename 을 확인한 후 `worktree: node-config-required-defaults-sweep-<slug>` 형식으로 갱신한다.

- **[INFO]** `## 배경` 섹션이 Overview / 본문 / Rationale 3섹션 권장 구조와 상이
  - target 위치: 섹션 구성 전체
  - 위반 규약: `CLAUDE.md §프로젝트 스펙 문서` — 각 spec 문서는 Overview / 본문 / Rationale 3섹션 권장
  - 상세: 이 권장 구조는 spec 문서(`spec/**`)에 대한 것이며, plan 문서(`plan/**`)에는 별도의 필수 형식이 명시되어 있지 않다. 따라서 plan 문서가 배경·방침·체크리스트·후속 follow-up 구조를 따르는 것은 위반이 아니다. 다만 현재 문서에 포함된 `## 배경` + `## 방침` 섹션은 spec 문서의 Rationale 에 해당하는 내용이고, 향후 이 내용이 spec 로 승격될 경우 3섹션 구조로 재편이 필요하다는 점을 알림 차원에서 기재한다.
  - 제안: plan 문서이므로 현재 구조 유지 가능. spec 문서 작성 시에는 3섹션 구조 준수.

- **[INFO]** `## 관련 문서` 섹션의 링크가 절대 경로 없이 상대 경로로 표기
  - target 위치: `## 관련 문서` 섹션 (마지막 항목) — `[presentation-button-render-investigation](./presentation-button-render-investigation.md)`
  - 위반 규약: `spec/conventions/` 에 명시적 링크 형식 규약 없음 (INFO 수준)
  - 상세: `spec/conventions/` 에는 파일 간 링크 형식 정식 규약이 없다. 그러나 상대 경로 링크는 문서가 이동(`git mv`) 될 때 깨질 수 있다. plan 문서는 `in-progress/ → complete/` 이동이 예정되어 있으므로 이 경우 `./presentation-button-render-investigation.md` 링크가 동작을 유지하므로 큰 문제는 없다(같은 디렉토리 내 이동 가정).
  - 제안: 현재 형태 유지 가능. plan 이동 시 링크 유효성 재확인.

---

### 요약

`plan/in-progress/node-config-required-defaults-sweep.md` 는 정식 규약(`spec/conventions/**`)의 직접 위반 사항 없이 작성되어 있다. conventions 파일들(node-output.md, swagger.md, migrations.md, cafe24-api-metadata.md 등)은 모두 코드 구현 또는 Cafe24 API 관련 정식 규약이며 plan 문서 자체와 교차 위반 관계가 없다. CLAUDE.md 의 plan 문서 운영 규약(frontmatter 형식, 체크리스트 라이프사이클, `git mv` 절차 등)과의 관계에서도 체크리스트 구성·frontmatter 키(`worktree`, `started`, `owner`) 존재·후속 follow-up 분리 방침 모두 규약을 따르고 있다. 단, frontmatter 의 `worktree` 필드값이 slug 를 포함한 완전한 worktree 이름인지 실제 디렉토리명과 대조 확인이 필요하다(INFO).

### 위험도

LOW

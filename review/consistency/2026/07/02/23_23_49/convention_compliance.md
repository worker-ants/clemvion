# 정식 규약 준수 검토 — spec-draft-c2-atomic-claim.md

## 발견사항

- **[INFO] SQL 코드펜스가 대상 spec 파일의 기존 관례와 다른 언어 태그**
  - target 위치: "개정 방향 (Option A — DB 원자 claim)" 섹션의 ```sql 블록 (라인 42–46)
  - 위반 규약: 명시적 conventions 문서 규칙은 없음 — `spec/5-system/4-execution-engine.md` 자체의 기존 코드펜스 관례(전부 ` ```ts `/` ```typescript `, sql 펜스 전례 없음)와의 국소 일관성 문제
  - 상세: 대상 spec 파일은 그동안 로직 예시를 전부 TypeScript 의사코드로 표현해왔다(`§1.3`·`§7.5` 등 기존 라인 참조). 이번 draft 가 최초로 raw SQL(`UPDATE … RETURNING`)을 그대로 노출한다. 정식 규약 위반은 아니며(`spec/conventions/` 에 코드펜스 언어를 규정한 문서 없음), 구현 상세(SQL 방언·ORM 어댑터)를 spec 이 어디까지 규정할지의 스타일 선택 문제.
  - 제안: 그대로 두어도 무방(draft 자체가 "구현은 developer 재량, spec 은 계약·불변식·전이만 규정" 이라고 명시했으므로 SQL 은 예시일 뿐 규범적 의사코드 취급). 다만 최종 spec 반영 시 `§1.3 _retryState` 나 다른 조건부 UPDATE 예시와 동일하게 TS 의사코드(`UPDATE ... WHERE ...` 를 표현하는 자연어/슈도코드)로 통일할지 developer 구현 착수 시 재검토 권장.

- **[INFO] 파일명·frontmatter 컨벤션은 정확히 준수**
  - target 위치: 문서 전체 frontmatter (라인 23–27), 파일 경로 `plan/in-progress/spec-draft-c2-atomic-claim.md`
  - 위반 규약: 해당 없음(준수 확인 사항)
  - 상세: `.claude/skills/project-planner/SKILL.md` §"draft 작성"이 규정한 `plan/in-progress/spec-draft-<name>.md` 패턴, `.claude/docs/plan-lifecycle.md §4` 의 top-level in-progress 필수 3필드(`worktree`/`started`/`owner`)를 모두 만족한다. `worktree: refactor-06-c2-atomic-claim` 은 sentinel 도 아니고 실제 값으로 기재돼 §4 sentinel 규칙도 위반 없음. 본문 끝 `## Rationale (draft 자체)` 섹션도 SKILL.md 지시("본문 끝에 `## Rationale` 로 결정 근거 명시")를 준수.
  - 제안: 없음(현행 유지).

- **[INFO] 인용하는 에러 코드·enum 값이 기존 카탈로그와 완전 일치**
  - target 위치: "변경 1"·"변경 4"·"side-effect 점검 대상" 의 `RESUME_CHECKPOINT_MISSING`/`RESUME_FAILED`/`RESUME_INCOMPATIBLE_STATE`, `node_execution.status` enum 값(`waiting_for_input`/`running`/`completed`/`failed`)
  - 위반 규약: 해당 없음(준수 확인 사항)
  - 상세: `spec/conventions/error-codes.md` §1 의미 기반 명명 원칙에 따라 신규 에러 코드를 만들지 않고 기존 3종 `RESUME_*` 코드(`spec/5-system/3-error-handling.md` L111–113, `spec/5-system/4-execution-engine.md` L980–982 에 정의된 카탈로그)를 그대로 재사용한다 — §2 "rename 대신 신설" 원칙과도 정합(의미가 갈라지지 않았으므로 새 코드 불필요). `node_execution.status` enum 값도 신규 값 없이 기존 값만 재사용한다고 draft 스스로 명시("§3 side-effect 점검 대상 — `1-data-model.md §3`: 새 컬럼·enum 없음. 전이만 추가").
  - 제안: 없음(현행 유지). 최종 반영 시 developer 트랙에서 실제 코드가 이 세 코드 외 신규 코드를 발행하지 않는지만 재확인 권장.

## 요약

`spec-draft-c2-atomic-claim.md` 는 `spec/conventions/` 의 정식 규약을 위반하는 지점이 발견되지 않았다. 파일 위치·이름(`plan/in-progress/spec-draft-<name>.md`)과 frontmatter(`worktree`/`started`/`owner`)는 `project-planner` SKILL·`plan-lifecycle.md §4` 를 정확히 따르고, 문서 끝 `## Rationale` 섹션 구성도 지시대로다. 내용상으로도 `error-codes.md` 의 "의미 기반 명명 / rename 대신 신설" 원칙을 준수해 신규 에러 코드를 도입하지 않고 기존 `RESUME_*` 3종을 재사용하며, `node_execution.status` enum 도 새 값 없이 기존 값의 전이만 추가한다고 명시적으로 자기 점검했다(§side-effect 점검 대상). 유일한 관찰 사항은 SQL 코드펜스가 대상 spec 문서의 기존 TS 의사코드 관례와 다르다는 점인데, 이는 정식 규약이 아닌 국소 스타일 일관성 문제로 INFO 등급에 그친다.

## 위험도

NONE

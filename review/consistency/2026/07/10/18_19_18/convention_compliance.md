# 정식 규약 준수 검토 — `plan/in-progress/table-label-eval-vars.md`

## 검토 범위

- target: `plan/in-progress/table-label-eval-vars.md` (spec draft, `--spec` 모드)
- 대조 규약: `spec/conventions/**` 전체 + (점검관점 3 이 명시하는) CLAUDE.md/SKILL.md 문서구조·명명 컨벤션
- 관련 확인 문서: `spec/4-nodes/6-presentation/2-table.md`(수정 대상), `spec/5-system/5-expression-language.md`(§4.1/§7.1, cross-ref 무결성 확인), `spec/conventions/execution-context.md`, `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`, `.claude/skills/project-planner/SKILL.md`, `.claude/skills/consistency-checker/SKILL.md`

## 발견사항

- **[WARNING]** draft plan 명명·구조가 project-planner/consistency-checker 워크플로 문서와 어긋남
  - target 위치: 파일 전체 (`plan/in-progress/table-label-eval-vars.md`), frontmatter + 본문 구성
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업 워크플로 3번("draft 작성: `plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. 본문 끝에 `## Rationale` 로 결정 근거 명시") 및 `.claude/skills/consistency-checker/SKILL.md` §호출자 워크플로("project-planner: 1. spec 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 작성")
  - 상세: 두 SKILL.md 는 spec 변경안 draft 파일명을 `spec-draft-<name>.md` 로 못박고 본문 끝에 명시적 `## Rationale` 섹션을 요구한다. target 은 `table-label-eval-vars.md`(prefix 없음)이며 본문 끝에도 `## Rationale` 이 아니라 `## 워크플로 (project-planner)` / `## 범위 밖` 으로 마무리돼 결정 근거 섹션이 명시적으로 라벨링되어 있지 않다(“코드 ground truth” 절이 사실상 근거 역할을 하지만 표제가 다름). **단, build guard 는 이 prefix/heading 을 강제하지 않으며**(`plan-frontmatter.test.ts` 는 `worktree`/`started`/`owner` 만 검사), 최근 유사 사례(`84dbcd4cf` 커밋이 건드린 `plan/in-progress/spec-sync-canvas-gaps.md`)도 동일하게 `spec-draft-` prefix 없이 `## Rationale` 없는 구조를 쓰고 있어 — 이 SKILL.md 문구 자체가 실제 운영 관행에서 이미 광범위하게 이탈된 상태로 보인다.
  - 제안: (a) target 을 당장 리네임할 필요는 낮지만, 만약 엄격 준수를 원한다면 `spec-draft-table-label-eval-vars.md` 로 리네임 + 마지막 절을 `## Rationale` 로 표제 변경. (b) 더 근본적으로는 SKILL.md 두 곳의 `spec-draft-<name>.md` 문구가 stale 하므로, 실제 관행(설명적 slug 이름 + worktree 이름과 1:1)에 맞춰 규약 자체를 갱신하는 편이 낫다 — 반복적으로 이탈되는 규약은 규약 갱신 대상이라는 WARNING 등급 기준에 정확히 해당.

- **[INFO]** 신규 "가용" 컬럼의 볼드체 표기 불일치
  - target 위치: `## 변경 — spec/4-nodes/6-presentation/2-table.md` 절, §1 표 변경안 (`가용` 열)
  - 위반 규약: 명시적 규약은 없음 (스타일 일관성 제안)
  - 상세: 제안된 표에서 `$dataSource` 행의 "가용" 값은 `셀·라벨`(plain) 인데 `$sourceItem`/`$sourceItemIndex` 행은 `**셀만**`(bold) 으로 강조돼 있다. 가용 범위가 두 값(전체 vs 제한)뿐이라면 어느 한쪽만 강조하는 것이 일관적이며, 지금처럼 "제한된 값만 bold" 로 하면 의도된 강조(가독성)로 볼 수도 있으나 표 전체 스타일 통일 관점에서 사소한 개선 여지가 있다.
  - 제안: 세 행 모두 plain 으로 통일하거나, "셀만" 두 곳처럼 제한 케이스만 bold 유지하는 현재 방식을 명시적으로 의도했다고 밝히는 정도로 충분 — 실제 spec 반영 시 판단.

## 컨벤션 대비 정합성이 확인된 항목 (참고, 위반 아님)

- **plan frontmatter**: `worktree`/`started`/`owner` 3필드 모두 존재해 `plan-frontmatter.test.ts` (SoT: `plan-lifecycle.md §4`) 요건을 충족. `spec_impact:` 를 in-progress 단계에서 이미 리스트 형태(`- spec/4-nodes/6-presentation/2-table.md`)로 선언한 것은 Gate C(`spec-plan-completion.test.ts`) 의무 시점(완료 시)보다 이르지만 금지되지 않으며, 완료 시 재확인만 하면 되는 바람직한 선제 조치.
- **명명 규약**: 제안 diff 가 재사용하는 `$dataSource`/`$sourceItem`/`$sourceItemIndex` 는 기존 `table.md`/`5-expression-language.md`/`table.handler.ts` 에서 이미 쓰이는 이름을 그대로 인용할 뿐 신규 명명을 도입하지 않는다. 이 변수들은 `spec/conventions/execution-context.md` 가 규율하는 `ExecutionContext` 최상위 필드(`_`/`__` prefix 네임스페이스)와는 다른 레이어(표현식 언어의 `$`-prefixed 참조 변수)이므로 해당 컨벤션 위반 소지가 없다.
- **출력 포맷 규약**: 변경 대상은 `2-table.md` §1(config 스키마 문서화)이며, `spec/conventions/node-output.md` Principle 11(출력 예시 문서화 규칙)이 규율하는 §5 `output`/JSON 예시 섹션은 이번 diff 범위 밖이라 저촉되지 않는다.
- **cross-ref 무결성**: `spec/5-system/5-expression-language.md §7.1`(줄 408)은 이미 "런타임 가용 범위(`field` vs `label` 평가 차이 포함)는 Table 노드 §1·§4 를 따른다" 로 위임해 두었다 — target 의 "범위 밖" 절이 주장하는 `#888 §7.1 note` 위임 서술과 실제 spec 본문이 정확히 일치함을 확인. 이번 §1 정정이 반영되면 이 위임 관계가 정확해진다는 target 의 주장도 grounds 있음.
- **문서 구조 규약(3섹션)**: `2-table.md` 자체는 명시적 `## Overview`/`## Rationale` 헤딩이 없는 node-spec 고유 템플릿(§1 설정~§7 캔버스 요약)을 따르는데, 이는 presentation 카테고리 노드 문서 전반의 기존 확립된 패턴이며 이번 plan 이 새로 도입/훼손하는 사안이 아니다. target diff 는 §1 표 안에 열 하나를 추가하는 국소 변경이라 문서 구조 자체에는 영향이 없다.

## 요약

target plan 은 실제로 강제되는 build guard(plan frontmatter 3필드, Gate C `spec_impact` 리스트 형식) 를 모두 충족하고, 변경 내용(§1 표에 "가용" 열 추가)도 `spec/conventions/node-output.md`·`execution-context.md` 등이 규율하는 출력 포맷·필드 네이밍 레이어를 건드리지 않아 정식 규약 위반은 없다. 유일한 실질 이슈는 project-planner/consistency-checker SKILL.md 가 문서화한 `spec-draft-<name>.md` 파일명 + 말미 `## Rationale` 헤딩 관행에서 벗어난다는 점인데, 이는 이 target 만의 문제가 아니라 최근 유사 plan(`spec-sync-canvas-gaps.md` 등) 다수가 공유하는 반복적 이탈이라 target 개별 수정보다 SKILL.md 문구 갱신이 더 적절할 수 있다. 그 외에는 표 강조 스타일 정도의 INFO 성 사소한 제안뿐이다.

## 위험도

LOW

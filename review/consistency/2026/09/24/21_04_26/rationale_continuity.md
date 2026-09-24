# Rationale 연속성 검토 — docs-guard-trigger (--impl-prep, scope=spec/conventions)

## 사전 확인 사항 (분석 전제)

- worktree 의 `git status`/`git diff` 를 확인한 결과 `spec/**` 에 대한 변경은 **없다** (untracked: `plan/in-progress/docs-guard-trigger.md`, `review/consistency/**` 뿐). plan frontmatter 도 `spec_impact: none` 을 명시한다.
- 본 요청의 "target 문서" 로 전달된 내용은 `spec/conventions/spec-impl-evidence.md` **전문**이지만, 이는 저장소에 이미 커밋돼 있는 **미변경 원문**이다 (diff 0). 즉 이번 --impl-prep 호출에서 target 은 "새로 도입되는 결정" 이 아니라, 앞으로 건드릴 CI 워크플로(`spec-link-checks.yml`)가 실행하는 가드들의 근거 spec 을 사전 열람시킨 배경 자료다.
- 실제 구현 계획(`plan/in-progress/docs-guard-trigger.md`)이 다루는 변경은 `.github/workflows/spec-link-checks.yml` 의 pathspec 확장(`plan/**` 추가) + 잡 안에서 도는 vitest 스코프를 파일 열거에서 디렉터리 전체 실행으로 넓히는 것이다. `spec/**`·`plan/**` 문서 본문에는 아무 수정도 가해지지 않는다.
- "관련 Rationale 발췌" 로 번들된 내용은 `spec/0-overview.md`(S3 키·Flyway·Redis 큐·Inline Alert 등) · `spec/1-data-model.md`(FK 인덱스·웹훅 경로 예약·User 컬럼 보호 등) · `spec/2-navigation/{1-workflow-list,2-trigger-list,3-schedule}.md` 이며, 나머지 78개 spec 파일은 "컨텍스트 예산 초과로 생략" 표시만 있다. 열람 가능했던 범위 전부가 CI 워크플로·pathspec·잡 스코프·docs 가드 트리거 방식과 **도메인이 겹치지 않는다** (DB 스키마, UI 정책, 웹훅 보안 등).

## 발견사항

없음.

- target(spec-impl-evidence.md) 자체는 이번 변경으로 수정되지 않으므로, 그 문서의 §Rationale(R-1~R-11)에 이미 기록된 결정(글로브 허용, TTL 90일, `backlog` enum, `archived` 명명, `pending_plans` 역방향 링크, Gate C/D 등)을 이번 계획이 다시 뒤집거나 재도입하는 지점이 없다.
- 계획서 §B 는 트래커가 제안했던 대안 (a) "`frontend-checks.yml` pathspec 에 `plan/**`·`spec/**` 추가" 를 채택하지 **않고**, 이미 존재하는 (b) 성격의 `spec-link-checks.yml` 을 넓히는 쪽을 선택했다 — 이는 과거에 spec Rationale 에서 명시적으로 기각된 대안을 재도입하는 사례가 아니라, 아직 spec Rationale 화되지 않은 트래커 레벨의 설계 선택(운영상 더 가벼운 기존 경로 재사용)이다. 본 검토 범위인 "spec 의 `## Rationale`" 과 충돌하는 지점이 없다.
- `spec-impl-evidence.md §4.2` 표의 `spec-link-integrity.test.ts` 관련 서술("`frontend-checks` 는 `next build`(무거움)까지 도므로 … lightweight 대체 트리거")과 계획서가 인용한 동일 문구가 정합적으로 일치해, 계획이 그 설계 취지를 정확히 따르고 있음을 확인했다(합의 원칙 위반 없음).
- 계획서가 "잡 이름(`spec-link-integrity`)은 유지한다" 고 못박은 근거(`#1106`, required check 등록을 위한 잡 이름 고정)는 이번 번들에 포함된 Rationale 범위 밖(harness/워크플로 설계이지 spec 본문 Rationale 이 아님)이라 본 checker 의 검증 대상이 아니다. 다만 해당 근거가 실제로 유지되는지는 구현 단계에서 `test_workflow_yaml_structure.py` 하네스 가드로 재확인할 사안이다(별도 검토자 소관).

## 요약

target 으로 전달된 `spec-impl-evidence.md` 는 이번 작업에서 실제로 변경되지 않으며(`spec_impact: none`, `git diff` 0), 계획서(`docs-guard-trigger.md`)가 다루는 변경은 CI 워크플로(`spec-link-checks.yml`)의 pathspec·실행 스코프 확장에 그친다. 번들된 관련 Rationale(0-overview·1-data-model·일부 2-navigation 문서)은 도메인이 전혀 겹치지 않아 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 항목도 관측되지 않았다. Rationale 연속성 관점에서 이번 --impl-prep 호출은 차단 사유가 없다.

## 위험도

NONE

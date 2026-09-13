# Plan 정합성 검토

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- 실제 코드 델타 (target 문서 자체 아님, `code_areas`): `CHANGELOG.md`, `PROJECT.md`,
  `codebase/frontend/src/lib/docs/__tests__/{guide-error-code-existence.test.ts,
  guide-error-code-scan.ts}` (삭제) → `{guide-identifier-existence.test.ts,
  guide-identifier-scan.ts}` (신규), `guide-sanitized-message-parity.test.ts` (주석 수정),
  `plan/in-progress/guide-identifier-existence.md` (신규 plan), `plan/in-progress/
  spec-draft-nullable-notation-followups.md` (트래커 갱신).
- `spec/conventions/**` 자체는 이 브랜치에서 변경되지 않음 (스코프 델타 0, plan 의
  `spec_impact: none` 과 일치 — 정상).

## 발견사항

검토 관점 1(미해결 결정과의 충돌)·2(선행 plan 미해소)·3(후속 항목 누락) 세 축 모두에서
차단 사유를 찾지 못했다. 근거:

- **주도 plan 자체가 이미 impl-prep coherence 검토를 거쳤다** — `plan/in-progress/
  guide-identifier-existence.md` §D 는 `--impl-prep`(`review/consistency/2026/09/13/12_33_41`,
  BLOCK:NO·Critical 0·WARNING 4)의 지적 4건을 전부 처분했고, 그 처분이 실제로 이번 diff 에
  반영되어 있음을 실측으로 확인:
  - `spec/conventions/user-guide-evidence.md §2` 미등재 문제(지적 #1·#2) → `spec/conventions/
    user-guide-evidence.md` 를 직접 grep 한 결과 실제로 `guide-identifier-existence`/
    `guide-error-code-existence` 어느 이름도 §2 표에 없음을 확인(plan 의 주장과 일치).
    이 gap 은 developer 권한 밖(`spec/**`)이므로 직접 고치지 않고 `plan/in-progress/
    spec-draft-nullable-notation-followups.md:3247` 의 기존 planner 항목("§2.1 관계표에 새
    가드 2건이 빠져 있다")을 **리네임 반영 + Rationale 요구사항 추가**로 갱신했다 — 새 planner
    항목을 중복 생성하지 않고 기존 항목 한 곳에 합류시켰다(요구된 "한 planner 턴" 원칙과 일치).
  - frontmatter `spec_impact` 누락(지적 #3) → `guide-identifier-existence.md` frontmatter 에
    `spec_impact: none` 및 그 의미를 좁히는 주석이 실제로 존재함을 확인.
  - `cafe24-api-metadata.md §4` Principle 7/0 오인용(지적 #4, 이 PR 과 무관한 선재 결함) →
    같은 트래커 파일에 신규 planner 항목으로 단 1회만 등재됨(중복 없음, `grep` 로 확인).
- **리네임 참조 정합성** — `guide-error-code-*` → `guide-identifier-*` 리네임 후 저장소
  전체에서 `guide-error-code` 문자열이 남아있는 곳은 `plan/in-progress/
  spec-draft-nullable-notation-followups.md`(5곳, 전부 `#1331 리네임` 각주 동반)와
  `plan/in-progress/guide-identifier-existence.md`(역사 서술) 뿐이며, 다른 in-progress
  plan·`PROJECT.md`에 orphan 참조 없음(전수 grep 확인). `plan/complete/
  guide-error-code-truth.md` 는 완료 plan(그 시점 기록이라 정정 대상 아님).
- **인접 plan 과의 충돌 없음** — `pending_plans`(`chat-channel-adapter.md`)·`허용목록` 키워드로
  다른 in-progress plan(`update-returning-tuple-shape.md`·`backend-lint-gate-broken-on-main.md`)을
  교차 확인했으나 이번 PR 의 `GUIDE_EXTERNAL_VOCABULARY` 허용목록 결정과는 서로 다른 가드
  계열이라 충돌 없음.
- 남은 미완료 항목(plan 체크리스트의 `run-test-all.sh`·`/ai-review + --impl-done` 미체크)은
  워크플로 진행 중 상태를 반영할 뿐 정합성 결함이 아니다(이 리뷰 자체가 그 단계 중 하나).

## 요약

target 코드 diff(`guide-identifier-existence` 가드 리네임/확장)는 이를 주도한 plan 이 자체
impl-prep 검토에서 짚힌 SoT 미등재·frontmatter 누락·선재 결함 3건을 모두 적절히 처분했고,
developer 권한 밖(`spec/**`) 항목은 새 planner 항목을 중복 생성하지 않고 기존 트래커 항목 한
곳(`spec-draft-nullable-notation-followups.md:3247`)에 리네임·Rationale 요구를 병합해
갱신했다. 리네임 전방 참조 5곳은 전부 각주 처리되어 orphan 이 없으며, 다른 in-progress plan
의 미해결 결정과 충돌하거나 선행 조건을 건드리는 지점도 발견되지 않았다.

## 위험도
NONE

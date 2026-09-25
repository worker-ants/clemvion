# 변경 범위(Scope) 리뷰 — harness-probe-isolation (`10_45_12`)

## 대상 개요

리뷰 대상 32개 파일을 실제 성격별로 나누면:

- **핵심 코드/테스트 변경(6)**: `.claude/tests/README.md`, `.claude/tests/_harness.py`,
  `.claude/tests/test_consistency_bundle_priority.py`,
  `.claude/tests/test_consistency_spec_draft_snapshot.py`,
  `.claude/tests/test_consistency_target_validation.py`,
  `.claude/tests/test_router_decision_trust.py` — 전부 "하네스 테스트가 병렬 실행 시 실제
  저장소 트리에 프로브를 남긴다" 는 단일 결함을 고치는 데 정확히 묶여 있다.
- **변경 기록(1)**: `CHANGELOG.md` — 위 수정 요약, 수치(97→0, 5/6→0/6)가 plan 과 교차 일치.
- **작업 추적 문서(3)**: `plan/in-progress/harness-probe-isolation.md`(신규, 이번 작업의 plan
  본체), `plan/in-progress/harness-review-gate-followups.md`(관련 백로그 항목에 상호참조 각주
  1개 추가), `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 항목 체크
  해제→완료 + 종결 메모 + 리뷰에서 나온 후속 백로그 항목 1개 신설).
- **리뷰/검토 산출물(22)**: `review/code/2026/09/25/10_27_27/**`(1라운드 `/ai-review` 산출물 +
  RESOLUTION), `review/consistency/2026/09/25/09_56_00/**`(구현 착수 전 `--plan` consistency
  check 산출물). 전부 신규 파일(전체가 `+`)이며 CLAUDE.md 가 지정한 경로(`review/code/**`,
  `review/consistency/**`)에 정확히 위치한다.

## 발견사항

- **[INFO]** 파일 수(32)가 커 보이지만 실질 로직 변경은 6개 파일에 국한되고, 나머지 26개는
  프로젝트 자체 워크플로(사전 `--plan` consistency-check, `/ai-review` 라운드 + RESOLUTION,
  CHANGELOG, plan 문서)가 강제하는 기록물이다. CLAUDE.md "정보 저장 위치" 표와 "review 산출물은
  시점 스냅샷" 관례(메모리 `feedback_review_fix_stale_loop`, `project_review_prompt_line_anchors`
  계열)에 부합하며, 코드 리뷰 관점의 "의도 이상의 변경"으로 볼 근거는 없다.
  - 위치: `review/code/2026/09/25/10_27_27/`, `review/consistency/2026/09/25/09_56_00/` (디렉터리 전체)
  - 제안: 조치 불요. 다만 이후 세션이 "리뷰 산출물도 diff 에 포함되니 스코프가 넓다" 로 오독하지
    않도록, 코드 리뷰 시 산출물 디렉터리는 첫 훑음에서 "생성물" 로 분류하고 실 코드 diff 만 정밀
    분석하는 편이 낫다(이번에도 그렇게 처리함).

- **[INFO]** `plan/in-progress/harness-review-gate-followups.md` 와
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 편집이 이번 작업의 소스 파일이
  아닌 **다른 두 트래커 plan**을 건드린다.
  - 위치: `plan/in-progress/harness-review-gate-followups.md`(§13 인접 항목에 인용문 3줄 추가),
    `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크박스 전환 1개 + 종결 인용문
    + 신규 백로그 항목 1개)
  - 상세: 두 편집 모두 **이번 작업이 닫거나 참조하는 바로 그 백로그 항목**에 대한 것이고
    (`spec-draft-nullable-notation-followups.md` 의 "하네스 테스트 둘이 실제 저장소 트리에
    프로브를 쓴다" 항목이 이 plan 의 등재 근거 자체), 각주/체크박스/신규 항목 추가로 범위가
    한정돼 있어 무관한 리팩토링이나 다른 이슈 끼워넣기가 아니다. `harness-review-gate-followups.md`
    쪽 각주도 "같은 테스트 클래스를 건드릴 때 새 헬퍼를 쓰라" 는 순수 상호참조다.
  - 제안: 조치 불요 — plan 라이프사이클 관례(체크와 이동은 한 동작, 리뷰에서 나온 후속 항목은
    그 턴에 등재)를 정확히 따른 형태다.

- **[INFO]** `test_consistency_bundle_priority.py` 의 순위 단언이 `assertLess(rank, tier0_size)`
  → `assertEqual(rank, 0)` 로 더 엄격해졌다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` — `test_an_uncommitted_edit_reaches_the_top_tier`,
    `test_collect_context_puts_the_edited_document_first`
  - 상세: 얼핏 "테스트 격리 작업"의 범위를 넘어 "단언 강화"라는 별도 개선처럼 보이지만, 사본
    fixture 의 계약(`origin/main == HEAD` → 변경 집합이 프로브 하나) 이 필연적으로 `tier0_size == 1`
    을 만들기 때문에 나온 자연스러운 귀결이며, PR 자체(plan §C "판별력이 약해지지 않는가")와 커밋
    메시지가 그 근거를 명시한다. 격리 방식을 바꾸는 이 작업과 분리할 수 없는 변경이다.
  - 제안: 조치 불요.

- **[INFO]** `test_router_decision_trust.py` 에서 `import os` 제거는 로직 변경(`os.path.relpath`
  호출 삭제)에 직접 종속된 정리이지 별도 임포트 정돈이 아니다.
  - 위치: `.claude/tests/test_router_decision_trust.py` — `test_long_source_list_is_truncated_with_an_accurate_remainder`
  - 제안: 조치 불요.

- **[INFO]** `spec/**` 는 이번 diff 에 전혀 포함되지 않았고 plan frontmatter 도 `spec_impact: none`
  이다 — developer 역할의 쓰기 경계(코드베이스/harness/plan/review) 를 정확히 지켰다.
  - 위치: `plan/in-progress/harness-probe-isolation.md:6`
  - 제안: 조치 불요.

## 요약

이번 diff 의 핵심 로직 변경은 `.claude/tests/` 하네스 6개 파일에 정확히 국한되어 있고, 모두
"병렬 pytest 실행이 실제 저장소 트리에 프로브를 남긴다" 는 단일 결함 해소에 직결된다.
`CHANGELOG.md`·plan 문서·리뷰 산출물 등 나머지 26개 파일은 전부 프로젝트가 표준으로 강제하는
기록물(사전 consistency-check, `/ai-review` 라운드 + RESOLUTION, plan 라이프사이클)이며 임의의
기능 확장·무관한 리팩토링·설정 변경은 발견되지 않았다. 순위 단언 강화나 import 정리처럼 언뜻
부수적으로 보이는 변경도 격리 설계 변경에 필연적으로 종속된 것으로 확인되어 범위 이탈이 아니다.

## 위험도
NONE

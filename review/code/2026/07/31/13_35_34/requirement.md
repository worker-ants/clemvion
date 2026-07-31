# Requirement Review — harness-review-gate-fixes (1R/2R/3R 누적)

## 발견사항

- **[CRITICAL]** 미배선(orphaned) 상태의 1,304줄 stale 스크립트가 "3R 픽스" 커밋에 부수적으로 섞여 들어감
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py` (파일 전체, 커밋 `d19e0188006f` "fix(harness): 3R 리뷰 반영")
  - 상세: 이 파일은 `code_review_orchestrator.py`의 거의 완전한 복제본이지만, 이번 PR 이 고쳤다고 주장하는
    세 라운드의 수정이 **전혀 반영되지 않은 옛 스냅샷**이다 — 1R(`_default_branch_ref`/
    `warn_if_committed_work_is_missing`, 커밋된 브랜치 작업 누락 경고), 2R(`_omitted_content_note`,
    생략 파일 안내), 3R(예산 초과 시 `_aggregate_omission_note` 로 집계 폴백) 이 모두 빠져 있다
    (직접 diff 로 확인: `diff _probe_main.py code_review_orchestrator.py`). 그런데도:
    - 커밋 메시지 어디에도 이 파일이 언급되지 않는다 (`git show --stat d19e0188…` 확인).
    - 저장소 전체에서 이 파일을 참조하는 곳이 **하나도 없다** — SKILL.md, 테스트, 워크플로,
      `.gitignore` 어디에도 `_probe_main` 문자열이 등장하지 않는다(review 세션 산출물 제외, grep 확인).
    - `if __name__ == "__main__": main()` 을 갖춘 완전한 독립 실행 스크립트이며 `py_compile` 통과.
      `__pycache__/_probe_main.cpython-311.pyc` 가 로컬에 남아 있어 실제로 한 번 이상 직접
      실행됐음을 시사한다 — 커밋 메시지가 인용하는 "실측(n=200/600/1200/3000)" 수치를 재현하려고
      만든 스크래치/probe 스크립트가 그대로 `git add` 에 쓸려 들어간 정황과 일치한다. 이 프로젝트
      메모리에 이미 기록된 반복 실패 패턴("`git add -A` 오염 → explicit path 커밋")과 정확히 같은
      클래스다.
  - 제안: 이 파일을 `git rm` 하거나, 의도된 개발 보조 도구라면 (a) 실행 경로 밖으로 옮기고
    (b) 어디서도 실 orchestrator 로 오인되지 않도록 이름/주석으로 명확히 표시하고 (c) 사용 후
    삭제하거나 `.gitignore` 에 등재할 것. 방치하면 이후 아무도 갱신하지 않는 채로 diverge 하다가,
    (fuzzy path 매칭·오타·"orchestrator" 검색으로) 실수로 이 파일이 호출될 경우 이번 PR 이 고친
    모든 결함(예산 초과, 생략 안내 누락, 커밋 누락 경고 부재)을 조용히 되살린다.

- **[WARNING]** `test_prompt_omission_notice.py::test_many_files_collapse_to_one_notice_and_still_fit` 의 내부 30초 타임아웃이 n=1200 fixture 에 대해 여유가 거의 없다
  - 위치: `.claude/tests/test_prompt_omission_notice.py` 의 `run_in_orchestrator`(`timeout=30.0`) +
    `test_many_files_collapse_to_one_notice_and_still_fit`
  - 상세: 무부하 단독 측정에서 `change_info` 1,200개 생성만으로 약 29.4초가 걸렸다(`build_files_section`
    자체는 0.1초 미만). 전체 스위트(700 tests)를 병렬 부하 상태에서 두 번 돌린 결과 이 테스트가
    `subprocess.TimeoutExpired` 로 두 차례 실패했다(assertion 실패가 아니라 타임아웃) — 실제 로직
    결함이 아니라 여유 시간 부족으로 보이지만, CI 환경이 이 샌드박스보다 느리면 **회귀와 무관하게
    간헐적으로 RED** 가 되어 "mutation 3종 RED" 로 지키려는 회귀 가드 자체의 신뢰도를 깎는다.
  - 제안: 이 fixture 전용으로 timeout 을 늘리거나(예: 60~90초), `change_info` 생성 비용을 별도로
    측정해 fixture 크기(n=1200)를 줄이면서 "1.36배 초과" 라는 핵심 조건은 유지하는 대안 검토.

- **[INFO]** 이번 변경은 `spec/` 문서로 정의된 요구사항이 아니다 — spec fidelity 항목은 해당 없음(N/A)
  - 위치: 변경 파일 17개 전부 `.claude/**` / `plan/**` (CLAUDE.md 상 "harness" 영역)
  - 상세: CLAUDE.md 의 정보 저장 위치 규약상 `spec/` 는 제품 정의·기술 명세 전용이고, `.claude/**`
    하네스 동작은 SKILL.md·agents/*.md·`.claude/docs/*.md` 자체가 SoT 다. 이번 diff 는 `spec/` 를
    전혀 건드리지 않았고, 참조되는 `subagent-call-contract.md` 에도 `evaluate_review`/`in_flight_ok`/
    생략-안내 관련 서술이 없어 모순도 없다. line-level 대조 대상 spec 본문이 존재하지 않으므로
    이 리뷰 관점은 발견사항 없이 N/A 로 닫는다.
  - 제안: (조치 불필요) — 참고용 기록.

- **[INFO]** 알려진, 이미 문서화된 잔여 한계 — 새 결함 아님
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` `build_files_section`
    의 diff-only 오버플로 분기(`base_size >= max_total_size` 분기) + `plan/in-progress/
    harness-review-gate-ci-backstop.md` "신규 후속 3건(defer)" 항목 1·3·4
  - 상세: (a) diff-only 분기는 안내문 길이를 `cut` 계상에 반영하지 않아 여전히 상한을 넘을 수
    있음(테스트가 의도적으로 상한 assertion 을 생략하고 그 이유를 주석에 남김), (b) 예산 전략
    3개(무예산/헤더+diff 초과/콘텐츠 할당)가 각자 같은 불변식을 재구현하는 구조적 중복, (c) 파일
    수가 극단적으로 많으면(n=3000) 헤더만으로도 상한 초과. 세 항목 모두 plan 문서에 원인·재현
    수치·defer 사유가 이미 명시돼 있고 origin/main 에서도 동일하게 존재하던 한계라 이번 변경이
    새로 만들거나 악화시키지 않았다.
  - 제안: (조치 불필요, 이미 추적 중) — 별도 후속 PR 에서 다룰 것.

## 기능 완전성 검증 요약 (참고)

plan 문서(`harness-consistency-summary-downgrade-rule.md`, `harness-review-gate-ci-backstop.md`)가
"완료"로 표시한 항목을 실제 코드와 대조했다 — 전부 일치를 확인했다:

- 번들 4계층 우선순위(`prioritize_bundle_files`, 브랜치-변경 → plan-언급 → 나머지 → 카탈로그 강등)가
  `collect_context` 의 scope/`related_specs`/`conventions` 세 지점에 실제로 배선됨. `plan_in_progress`
  번들은 의도적으로 범위 밖(plan 문서에 열린 후속으로 명시).
- `evaluate_review(cwd=None, *, in_flight_ok=False)` — push 가드(`guard_review_before_push.py`)는
  위치 인자만 넘겨 opt-in 하지 않고, Stop 가드만 `in_flight_ok=True` 를 명시적으로 넘긴다. 양방향
  모두 seam 단언(실제 kwarg 값을 파일에 기록)으로 고정돼 있어 "결정 객체가 동일해 보여 통과하는"
  vacuous 세팅이 아니다.
- `warn_if_committed_work_is_missing` — 기본 `--prepare` 경로에서만 호출되고 `--staged`/`--commit`/
  `--range`/`--branch` 는 명시 스코프로 면제(SKILL.md 옵션 설명과 일치).
  `--staged` 면제는 이번 3R 라운드에서 추가된 수정이며 테스트로 고정됨.
  `_default_branch_ref` 는 `_git`(예외 비흡수 wrapper) 호출을 자체 try/except 로 감싸 git 부재/타임
  아웃이 default `--prepare` 를 크래시시키지 않도록 함(advisory 는 실패해도 리뷰 자체는 진행).
- `build_files_section` 의 생략-안내 3중 방어(파일별 안내 → 예산 부족 시 집계 안내 → 그마저 없으면
  헤딩만이라도) 및 예산 선반영(reserve)/환불(refund) 로직을 실제로 추적해 확인했다. 로컬 환경에서
  다른 병렬 reviewer 세션이 이 파일에 대해 mutation-테스트 성격의 임시 수정(`if True: return body`)을
  적용했다가 되돌리는 것을 리뷰 도중 일시적으로 관측했으나, `git status`/`git diff HEAD` 로 최종
  확인한 현재 커밋 상태는 clean 하고 로직은 올바르며, 관련 테스트 7건 전부 통과한다 — 코드 결함
  아님, 참고로만 기록.
- `.claude/agents/consistency-summary.md` §요약 지침 3·4(하향 금지 + planner 인계) 와
  `.claude/skills/consistency-checker/SKILL.md` §4(동일 정책의 호출자 관점 서술)가 서로 모순 없이
  일치. `harness 스위트 700 tests` 전량 실행 결과 OK(위 타임아웃 1건은 재현 시 assertion 실패가
  아니라 subprocess 타임아웃이었음 — 별도 WARNING 으로 기재).

TODO/FIXME/HACK/XXX 계열 마커는 diff 추가분에서 발견되지 않았다.

## 요약

핵심 로직(consistency 번들 우선순위, 코드-리뷰 생략-안내, 커밋 누락 changeset 경고, Stop-전용
in-flight 완화, Critical 하향 금지+planner 인계)은 plan 문서가 주장하는 범위와 line-level 로 정확히
일치하며, 각 항목이 대응하는 회귀 테스트와 mutation 커버리지까지 갖춰 기능적으로 완결돼 있다.
다만 이번 3R 커밋에 **아무 설명 없이 1,304줄짜리 미배선 stale 스크립트(`_probe_main.py`)**가 함께
커밋됐다 — 실행 가능하고 이번 PR 이 고친 모든 결함을 그대로 보존한 옛 스냅샷이라, 향후 실수로
호출되면 고쳐진 문제를 조용히 되살릴 수 있는 잠재 위험이다. 이 한 건을 제외하면 요구사항 충족도는
높다.

## 위험도

HIGH

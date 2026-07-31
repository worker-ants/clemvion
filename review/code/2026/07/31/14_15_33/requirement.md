# Requirement Review — harness-review-gate-fixes-1bd6aa (5R)

## 컨텍스트

이 변경은 `.claude/` harness(리뷰/일관성 게이트 도구) 코드이며, 이미 4라운드 리뷰+수정을 거쳤다
(git log: 1R~4R 커밋). 직전 라운드(`review/code/2026/07/31/13_35_34`)는 CRITICAL 3건 +
WARNING 2건을 냈고, 커밋 `0aa68aec4`("4R 리뷰 반영")가 이를 처리했다고 주장한다. 본 라운드에서는
프롬프트에 실린 파일(2/5/7 — `review_guard.py`/`code_review_orchestrator.py`/
`consistency_orchestrator.py`)이 크기 제한으로 전혀 실리지 않아 지시대로 `Read` 로 직접 전문을
읽었고, `git diff origin/main...HEAD`, `git log -S`/`git show`, 전체 테스트 스위트 실행으로
직전 라운드 주장을 전부 재검증했다.

## 발견사항

- **[INFO]** 직전 라운드(13_35_34) CRITICAL 3건이 커밋 `0aa68aec4` 에서 실제로 해소됨을 독립
  재검증.
  - 위치: `.claude/skills/code-review-agents/scripts/_probe_main.py`(삭제 확인, `find` 0건),
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:594`
    (`plan_files = _prioritized(plan_files)`), `.claude/tests/test_prompt_omission_notice.py`
    프리앰블(`orch.get_git_diff_content = lambda path: ""` 스텁).
  - 상세: (1) 결함이 고치는 대상 코드의 pre-fix 스냅샷이었던 `_probe_main.py`(1,304줄, blob
    해시 `8aedb8eb8f...`)는 더 이상 저장소에 없다. (2) `other_spec_files`/`convention_files`
    는 `_prioritized()`를 거치는데 `plan_files`만 빠졌던 결함 — 현재 코드는 587·588·594행에서
    세 번들 모두 동일하게 `_prioritized()`를 거친다(`plan_coherence`의 유일 corpus라 가장
    중요했던 지점). (3) `change_info()` 픽스처가 `diff_content=""`(falsy)로 매 파일마다 실제
    `git` subprocess 2회를 유발해 n=1,200 테스트가 30초 타임아웃을 내던 결함 — 스텁 확인.
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 직접 재실행 결과
    **702 tests, OK, 66.7초**(타임아웃 없음, 커밋 로그의 "702 tests OK"와 일치).
  - 제안: 조치 불요 — 검증 완료 기록.

- **[INFO]** 직전 라운드 WARNING 2건(문서 부정확)도 해소 확인.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:248`
    (`_CATALOG_BULK_RE = re.compile(r"(^|/)[^/]*-api-catalog/[^/]+/")`),
    `plan/in-progress/harness-review-gate-ci-backstop.md:27`.
  - 상세: (1) 이전 정규식이 R-7 보다 넓어 최상위 카탈로그 인덱스(`<resource>.md`, 정식 spec)까지
    강등시키던 결함 — `spec/conventions/spec-impl-evidence.md:232-236`(R-7 본문)과 line-level
    로 직접 대조한 결과, 현재 정규식(`[^/]+/` 트레일링 슬래시로 "카탈로그 디렉토리 뒤 세그먼트가
    하나 이상"만 매칭)과 코드 주석이 R-7 규칙을 정확히 반영한다 — nested 매칭 O, 최상위 인덱스
    비매칭 확인(`test_catalog_top_level_index_is_not_demoted`). (2) plan 배너의 "신규 후속
    3건" 표기가 실제 7건+1건과 불일치했던 문제 — 현재 27행은 "7건 + 기본 브랜치 해석 중복 1건"
    으로 정확히 일치, 저장소 전체에 잔존 "3건" 문자열 0건(grep 확인).
  - 제안: 조치 불요.

- **[INFO]** `evaluate_review(cwd=None, *, in_flight_ok=False)`(`.claude/hooks/_lib/review_guard.py:862`)
  — push/Stop 두 가드가 공유하는 in-flight 완화 로직을 opt-in 파라미터로 스코프 축소한 핵심
  변경이 기능·에러 시나리오·하위호환 세 축 모두에서 일관됨을 확인.
  - push 가드(`guard_review_before_push.py`, 이번 diff 밖 — 호출부 무변경)는 `evaluate(target)`
    형태로 위치인자만 넘겨 `in_flight_ok=False` 기본값 유지; Stop 가드만
    `guard_review_before_stop.py:344`에서 `in_flight_ok=True` 명시.
  - 이번 diff 밖의 기존 호출부(`test_review_guard.py:246,284,385` 등, positional-only)도
    새 키워드 전용 파라미터에 영향받지 않아 하위호환 확인 — 전체 스위트 재실행으로 회귀 없음
    검증.
  - 근본 결함(주석·docstring이 "push guard still hard-gates"라 적어놓고 실제로는 억제가
    무조건이라 push 게이트까지 TTL 30분간 열어주던 상태)과 수정 방향이 정확히 일치.
  - 제안: 조치 불요.

- **[INFO]** `build_files_section`(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:587`)의
  예산 계상·생략 안내 로직을 엣지 케이스 관점에서 직접 추적: 빈 `change_infos`, 전량 diff-only
  (전체 콘텐츠 없음), 예산 완전 초과(헤더+diff만으로도 초과), 대량 파일(n=1,200) 4개 시나리오
  모두 크래시 없이 처리되고, 예산 산술에 의존하지 않는 **실제 렌더 결과 길이 재확인**
  (`len(body) <= max_total_size` 후 필요 시 `_aggregate_omission_note`로 폴백,
  `code_review_orchestrator.py:752-771`)이 belt-and-suspenders로 최종 안전판 역할을 함을
  확인. 본 리뷰 세션 자체의 프롬프트(`review/code/2026/07/31/14_15_33/_prompts/requirement.md`
  파일 2/5/7/8 섹션)가 정확히 `_omitted_content_note`의 산출 문구
  (`⚠️ 프롬프트 크기 제한으로 이 파일의 내용이 **전혀 실리지 않았습니다**...`)를 담고 있어,
  프로덕션 조건에서 기능이 의도대로 동작함을 자기실증적으로 재확인.
  - 제안: 조치 불요.

- **[INFO]** 잔존 후속 과제는 전부 plan 문서에 정확히·정직하게 추적되고 있으며, 이번 PR 이
  "닫았다"고 주장하는 범위와 실제 코드 상태 사이에 괴리가 없다(과장된 "완료" 서술 없음).
  - `prioritize_bundle_files`의 동일 tier 내부 정렬은 여전히 순수 사전순(natural sort 미적용)
    — `test_ties_stay_alphabetical`이 현재 동작으로 고정, 대상 파일이 브랜치 변경도 안 됐고
    plan 에도 언급되지 않은 세션에서는 8회 재발했던 원래 패턴이 여전히 가능함을
    `harness-consistency-summary-downgrade-rule.md`(2026-07-31 종결 배너)가 스스로 명시.
  - `build_files_section`의 diff-only 오버플로 분기(헤더+diff만으로 예산 초과 시)는 절단 노트
    길이를 `cut`에 계상하지 않아 여전히 상한을 소폭 초과할 수 있음 — 이번 PR 이전부터 있던
    결함이고 이번 변경이 악화시키지 않았음을 `test_prompt_omission_notice.py`의
    `test_diff_only_overflow_branch_also_announces` 주석이 실측치(origin/main 1,681자 vs
    이 브랜치 1,678자)로 명시. `harness-review-gate-ci-backstop.md` 신규 후속 1번에 등재.
  - CI-독립 백스톱(리뷰 게이트가 오검토/미검토 세션을 "신선함"만으로 통과시키는 근본 취약점의
    완전한 해소)은 설계 결정이 선행이라 이번 PR 스코프 밖 — `harness-review-gate-ci-backstop.md`
    §결정이 필요한 지점에 명시적으로 미착수 상태로 남아 있고, 배너도 "CI 백스톱 본체 —
    미착수"라고 정확히 서술한다. `warn_if_committed_work_is_missing`(신규, advisory-only)는
    이 중 "기본 changeset 이 커밋된 브랜치 작업을 놓친다"는 **한 가지 관측 사례**만 완화하며,
    push 하드게이트는 여전히 "리뷰된 파일 집합이 실제 변경 집합과 일치하는지"가 아니라
    "SUMMARY 가 코드보다 최신인지"만 본다 — 이 구조적 갭은 plan 문서 스스로 인지하고 있으며
    이번 PR 의 claimed scope 에 포함되지 않는다.
  - 제안: 각 항목은 이미 별도 plan 항목으로 추적 중이므로 본 PR 을 막을 사유 아님. 다음 라운드
    우선순위 검토 시 참고.

## TODO/FIXME/HACK/XXX

변경된 14개 코드/문서 파일 전체에서 검색 결과 0건.

## 요약

리뷰 대상은 이미 4라운드의 AI 리뷰-수정 사이클을 거친 harness 코드로, 직전 라운드(13_35_34)가
낸 CRITICAL 3건(orphan pre-fix 스냅샷 파일 커밋, `plan_in_progress` 번들 우선순위 미적용,
n=1,200 테스트 타임아웃)과 WARNING 2건(카탈로그 강등 정규식이 spec R-7 보다 과다 매칭, plan
배너의 후속 건수 오기재)을 코드 직접 대조·`spec/conventions/spec-impl-evidence.md` line-level
대조·테스트 스위트 재실행(702 tests, OK, 66.7초, 타임아웃 없음)으로 전수 재검증한 결과 전부
해소돼 있음을 확인했다. 핵심 기능 변경(`evaluate_review`의 `in_flight_ok` opt-in화, 코드
리뷰/일관성 체크 양쪽의 4-tier 번들 우선순위, 코드 리뷰 프롬프트의 예산 초과 생략 안내)은
기능 완전성·엣지 케이스(빈 컬렉션·전량 초과·대량 파일)·에러 시나리오(git 실패 시 침묵)·
하위호환(기존 위치인자 호출부 불변) 모든 축에서 자체 검증됐고, 본 리뷰 세션의 프롬프트 자체가
생략 안내 기능의 자기실증 증거가 됐다. TODO/FIXME 류 미완성 표식은 없으며, spec/ 문서와
line-level 로 대조 가능한 유일 지점(R-7 카탈로그 규칙)은 정확히 일치한다(SPEC-DRIFT 아님).
잔존 항목(동일 tier natural sort 미적용, diff-only 오버플로의 사전 존재 결함, CI-독립 백스톱
미착수)은 모두 plan 문서에 정직하게 "미완료"로 기록돼 있어 이번 PR 의 주장 범위와 실제 구현
사이에 괴리가 없다. 요구사항 충족 관점에서 신규 CRITICAL/WARNING 을 발견하지 못했다.

## 위험도

LOW

# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** plan 문서의 테스트 개수 서술이 실제 diff 와 어긋나며, 격차가 이전 리뷰 시점보다 더 벌어짐
  - 위치: `plan/in-progress/harness-session-anchor-guards.md` — ①번 항목 "구현 결과" 문단
    ("테스트는 `.claude/tests/test_reap_merged_worktrees.py` 에 **8건** 추가")
  - 상세: `git diff origin/main...HEAD -- .claude/tests/test_reap_merged_worktrees.py | grep -cE '^\+ *def test_'` 로 실측하면 신규 `def test_` 정의가 **10건**이다. 최초 구현 커밋(`9c7818c06`)에서 9건, 이후 WARNING #2 조치 커밋(`8783d7b12`, `test_keep_is_repeatable_and_protects_every_named_worktree` 추가)에서 1건이 더해졌다. 이 "8건" 서술은 2026-07-17 17:09:10 리뷰 세션에서 이미 INFO 로 지적됐고(그 시점 실측 9건, RESOLUTION.md INFO #17 "미반영 — 이번 세션 범위 밖으로 유보") 이후 어느 커밋에서도 교정되지 않았다. 즉 새로 발견된 문제가 아니라 **기존에 알려진 채 의식적으로 보류된 항목**이며, 후속 커밋이 서술을 갱신하지 않은 채 실제 건수만 한 번 더 늘려 괴리가 8→9→10 으로 벌어졌다.
  - 제안: "8건" 을 "10건(그중 8건이 `--keep`/앵커 가드 관련, 1건은 기존 unknown-arg 파서 회귀 보호 동반 테스트, 1건은 후속 WARNING #2 조치로 추가된 `--keep` 반복 지정 커버리지)" 처럼 명확히 하거나, 커밋마다 rot 하는 하드코딩된 숫자 대신 "관련 테스트 일체 추가"처럼 개수에 의존하지 않는 표현으로 바꾼다. plan 은 `plan/complete/` 이동 후 diff 없이 근거 자료로 재독되므로 문자 그대로의 정확성이 특히 중요하다.

- **[INFO]** 테스트 docstring 이 파일 밖에서만 정의된 레이블("B-case")을 자기완결적 설명 없이 인용 — 마찬가지로 기존에 지적된 채 미반영
  - 위치: `.claude/tests/test_push_detection.py` — `test_quoted_pipe_is_not_a_segment_separator` 의 docstring `"""The B-case root cause, pinned directly."""`
  - 상세: "A–E" 케이스 문자 체계는 `plan/in-progress/harness-session-anchor-guards.md` (②번 "증상" 표)에서만 정의되며, 이 테스트 파일 자체에는 그 레이블 정의가 없다. plan 이 나중에 archive 로 옮겨진 뒤 이 테스트 파일만 단독으로 읽는 독자는 "B-case" 가 무엇인지 파일 내부 정보만으로 알 수 없다. 17_09_10 리뷰 세션에서 이미 INFO 로 지적됐고(RESOLUTION.md INFO #18 "미반영, 선택 사항") 이후 손대지 않았다 — 현재도 동일 문구 그대로다.
  - 제안: `"""The quoted-pipe bug (plan's case B), pinned directly."""` 처럼 무엇을 가리키는지 한 구절을 덧붙여 plan 참조 없이도 자립하게 한다. 우선순위 낮음(선택 사항으로 이미 합의됨).

- **[INFO]** `test_reap_merged_worktrees.py` 가 `.claude/tests/README.md` "What's covered" 표에 여전히 없음 — 같은 PR 이 자매 파일(`test_push_detection.py`)엔 행을 추가하면서 이 파일은 건너뜀
  - 위치: `.claude/tests/README.md` (표 21–33행대)
  - 상세: `.claude/tests/test_*.py` 7개 중 `test_reap_merged_worktrees.py` 를 포함해 총 7개가 이 표에 없다(레포 전역 pre-existing 상태, 이번 PR 이 만든 문제는 아님). 다만 이번 diff 는 `test_push_detection.py`(신설) 는 정확한 설명과 함께 표에 추가했고, `test_reap_merged_worktrees.py` 는 143줄 증가 + 신규 `def test_` 10건(주로 `--keep`/부트스트랩 앵커 커버리지)이라는 **이 파일 자체보다 더 큰 폭의 변경**을 받고도 표에는 반영되지 않았다. 17_09_10 세션에서 testing 리뷰어가 동일 갭을 지적했고(SUMMARY #14, RESOLUTION.md INFO #14) "이번 PR 범위에서 이 파일 행 추가는 선택, 전체 7파일 감사는 별도 후속"으로 정리된 바 있다 — 그 권고대로 전체 감사를 요구하는 것은 아니지만, 이 PR 이 자매 파일에 대해 이미 증명한 동일 패턴(한 줄 표 추가)을 이 파일에도 적용하면 비대칭이 해소된다.
  - 제안(선택, 비차단): `test_push_detection.py` 행과 같은 형식으로 한 줄 추가.
    예: `| \`test_reap_merged_worktrees.py\` | \`reap-merged-worktrees.sh\`(+ \`bootstrap-session.sh\` 의 앵커 전달) 통합 테스트 — merged/clean 워크트리 제거, dirty/미머지 보존, gh 부재 시 fail-safe, dangling branch 정리, 그리고 \`--keep\`(세션 앵커 보호, cwd skip 과 별개 경로, 반복 지정, prefix 오매칭 방지)와 부트스트랩 end-to-end 배선. |`

- **[정보/강점]** (결함 아님) 최신 커밋 `f4489d314` 는 모범적인 "주석 정확성" 자기 교정
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_segment_boundary` docstring, `.claude/tests/test_push_detection.py` 신규 테스트 `test_quoted_pure_punctuation_is_read_as_a_boundary_and_that_is_safe`
  - 상세: 직전 리뷰(17_09_10)의 `resolution-applier` 가 남긴 docstring 은 "Quoted content never reaches here as a punctuation run" 이라 단언했으나, 실측 결과 거짓이었다(posix `shlex` 는 따옴표를 벗기므로 `git commit -m "&&"` 는 순수 구두점 토큰 `&&` 로 도달해 경계로 판정됨 — 단 그래도 최종 서브커맨드는 `commit` 으로 해소돼 안전 방향은 유지). 새 docstring 은 실측대로 정정하고, "인용이 보호한다고 되돌리지 말 것"을 명시하며, 새 테스트로 회귀를 고정했다. 코드 자체의 동작 변경은 없다(순수 문서 정정 + 테스트 추가). 이런 자기 교정은 이 프로젝트가 이미 겪은 `#963`(summary agent 의 반증된 "terminal" 메커니즘 서술) 과 같은 계열의 부채를 선제적으로 막는 좋은 관행이다.
  - 참고(선택, 비차단): `plan/in-progress/harness-session-anchor-guards.md` 의 "review 후속 수정" 표·체크리스트는 Critical #1–4 와 WARNING #2·#3 까지만 다루고 이 최신 자기 교정은 언급하지 않는다. 커밋 메시지 자체가 충분히 설명적이라 필수는 아니지만, plan 이 이 작업의 표준 기록(SoR)이라는 점을 감안하면 한 줄 addendum(무엇을 왜 고쳤는지)을 남기면 이후 `git log` 없이 plan 만 읽는 독자에게도 완결성이 유지된다.

## 강점 (참고)

- 신규/변경 함수(`_tokenize`, `_git_subcommand`, `_is_git_push`, `_is_segment_boundary`, `is_kept`)마다 "무엇을·왜"를 설명하는 docstring/주석이 있고, 임의 표본으로 재현 검증한 결과 모두 실제 코드와 일치했다(`_tokenize` 의 `punctuation_chars`/`whitespace`/`commenters` 서술, `_git_subcommand` 의 fail-closed 서술 등).
- `reap-merged-worktrees.sh --keep` 는 스크립트 자체 헤더 주석·`worktree-policy.md §7`·plan 문서 세 곳에 일관되게 반영돼 있고, `bash .claude/tools/reap-merged-worktrees.sh --help` 를 직접 실행해 헤더 주석이 그대로 출력되며 `--keep` 설명이 포함됨을 확인했다.
- `worktree-policy.md §7` 의 불변식 갱신은 단순 문구 추가가 아니라, 기존 서술("현재 세션 worktree 제외")이 실제로는 대리 지표(셸 cwd)만 가리키던 부정확함을 코드 변경(cwd·앵커 두 축 분리)에 맞춰 근본적으로 정정했다.
- `plan/in-progress/harness-session-anchor-guards.md` 가 버그 진단에 인용한 원본 코드 줄 번호(`reap-merged-worktrees.sh:75`, `:171-172`, `:53-63`, `guard_review_before_push.py:55`)를 `origin/main` 커밋에서 직접 대조한 결과 전부 정확했다 — 사후 재구성이 아니라 실측 기반 진단임을 뒷받침한다.
- 이번 브랜치는 `.claude/**` + `plan/**` 스코프로 `codebase/`·`spec/` 를 건드리지 않는다. `CHANGELOG.md`(제품 변경 전용, 전량 `spec/` SoT 참조)와 `doc-sync-matrix.json`(제품 코드↔spec↔유저가이드 매핑) 미갱신은 갭이 아니라 컨벤션상 정상 — grep 으로 두 파일 모두 harness 관련 트리거가 없음을 확인.
- plan 의 Rationale 에 "진단 정정 기록"(②를 처음엔 "substring 매칭"으로 오진단했다가 재현 후 "무제한 거리 정규식"으로 정정한 이력)을 남겨, 이 프로젝트가 요구하는 "기각된 대안/오판은 실제 이력으로 남긴다" 관례를 충실히 따른다.

## 요약

문서화 관점에서 이번 변경(특히 최신 커밋 `f4489d314`)은 여전히 표본적으로 우수하다. 새/변경 함수마다 근거를 실측 기반으로 설명하는 docstring 이 있고, `--keep` 플래그는 스크립트 헤더·`--help` 출력·정책 문서·plan 네 곳이 서로 어긋남 없이 동기화됐으며, 반증된 mechanism 서술("인용이 보호한다")을 발견 즉시 자기 교정하고 회귀 테스트로 고정한 점은 이 리뷰가 특히 높이 평가할 만한 관행이다. 다만 3건의 INFO 는 모두 **직전 리뷰 세션(17_09_10)에서 이미 발견되어 의식적으로 낮은 우선순위로 유보된 항목**이 이번 diff 시점까지 그대로 남아 있는 것으로, 새로운 결함이 아니다(다만 plan 의 테스트 개수 서술은 후속 커밋으로 실제 격차가 더 벌어졌다). 셋 다 병합을 막을 사안이 아니며, 가독성·완결성 개선 권고 수준이다.

## 위험도

LOW

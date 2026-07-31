# 테스트(Testing) Review — 2026/07/31 11_58_11

## 검증 방법

`.claude/tests/` 전체를 실제로 실행해 회귀 여부를 확인했다.

```
python3 -m unittest discover -s .claude/tests -p 'test_*.py'
→ Ran 693 tests in 76.759s ... FAILED (failures=1)
```

실패 1건을 격리 재현하고, `git worktree add --detach <tmp> origin/main` 으로 PR 반영 전
베이스라인을 만들어 **같은 커밋 · 오케스트레이터 코드만 교체**하는 A/B 비교로 원인을 이 diff 로
직접 귀속시켰다(아래 CRITICAL 항목 참조). 그 외 지점은 diff 판독 + 실제 호출부 grep 전수
검색으로 "어떤 테스트가 이 경로를 실제로 검증하는가" 를 추적했다.

## 발견사항

- **[CRITICAL]** `_omitted_content_note` 자신의 바이트 비용이 `max_total_size` 예산 계산에서
  빠져 있어, 하네스 자신의 회귀 테스트가 **지금 이 브랜치에서 실제로 FAIL 한다**
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `build_files_section`(587행) — 예산 계산은 672~694행(`remaining_budget`,
    `content_wrapper_overhead`)에서 끝나고, 701~705행의 `elif fp["full_content"]:` 분기가
    `_omitted_content_note(...)`(정의 561행, 호출 703행)를 **그 예산 계산 밖에서 무조건 추가**한다.
    검증에 쓰인 회귀 테스트: `.claude/tests/test_line_anchors.py` 의
    `PromptPayloadIntegrationTest.test_prompt_stays_within_the_size_cap`(약 490~512행, 이번 diff
    대상 아님 — 사전 존재하는 테스트).
  - 상세: 재현 절차와 실측.
    1. 현재 브랜치 HEAD 에서 단독 재실행: `cd .claude/tests && python3 -m unittest
       test_line_anchors.PromptPayloadIntegrationTest.test_prompt_stays_within_the_size_cap -v`
       → **FAIL**: `AssertionError: 143620 not less than or equal to 143605 : _router.md: 143620
       chars exceeds the 141557-char cap`. 두 번 재실행해 결정적임을 확인(флаky 아님).
    2. 이 테스트가 쓰는 `pick_commit_fixture()` 는 최근 40개 커밋 중 첫 번째로
       `changed>=80줄` 조건을 만족하는 커밋을 고르는데, 지금 그 커밋은 **바로 이 PR 자신의 마지막
       커밋** `0279f4333`("docs(review): 1R RESOLUTION…", 19개 파일/1307줄 순수 추가)이다.
    3. `git worktree add --detach <tmp> origin/main` 으로 PR 반영 전 베이스라인을 만들어 같은
       테스트를 실행하면 **PASS**(다른 커밋을 고르므로 완전히 통제된 비교는 아님).
    4. 통제 비교로 원인을 직접 귀속: 베이스라인(PR 반영 전) 오케스트레이터 코드로 **같은 커밋**
       `0279f4333` 을 `--prepare --commit`으로 조립하면 `_router.md` = **141,578자, 생략 안내
       0건**(원 cap 141,557 은 살짝 넘지만 +2048 슬랙 안). 이 브랜치의 현재 오케스트레이터 코드로
       **같은 커밋**을 조립하면 `_router.md` = **143,620자, 생략 안내 14건** → cap+슬랙(143,605)을
       15자 초과. 차이 143,620−141,578 = 2,042자는 생략 안내 14건 × 약 146자와 정확히 들어맞는다
       (`_omitted_content_note`를 직접 호출해 실측: 한 건 142~150자).
    5. 같은 파일의 자매 함수 `truncate_file_bundle`(`consistency_orchestrator.py:642`)은 **이미
       이 정확한 실패 형태를 겪고 고친 전례**가 있다 — 주석: "The notice grows as more files are
       dropped, so the fit has to be re-checked after each one rather than reserved for up
       front — the naive version overshoots exactly when it drops the most."(671~673행) 이
       함수는 안내문 자체의 길이를 **매 반복마다 다시 측정해 예산에 포함**한다
       (`len(head) + sum(len(c) for c in kept) + len(notice) <= budget`, 676행). `_omitted_content_note`
       의 docstring(566~578행)은 "Mirrors the same fix already made on the consistency side"라고
       명시하지만, 실제로는 "생략을 알린다" 절반만 이식했고 "안내문 자신도 예산에 넣는다" 절반은
       빠졌다 — 바로 그 누락이 이번 실패의 원인이다.
    6. 이번 PR 이 신설한 `.claude/tests/test_prompt_omission_notice.py` 는 `SMALL`/`BIG`/`BIGGER`
       3개 파일과 `max_total=2000`(전체 아님, 개별 파일 배정 예산) 픽스처만 쓰고, 어떤 케이스도
       "생략 안내 여러 건이 누적돼 `max_total_size` 자체를 넘는지" 를 단언하지 않는다 — 그래서 이
       회귀를 이 신규 테스트 파일이 못 잡았고, 관계 없어 보이는 사전 존재 테스트
       (`test_line_anchors.py`)가 이 PR 자신의 커밋 모양(생략 대상 파일이 많은 문서 전용 커밋)
       때문에 우연히 걸린 것이다.
  - 제안: `build_files_section` 의 생략-안내 분기에서도 `truncate_file_bundle` 과 동일하게
    안내문 길이를 예산 차감에 포함시키거나(예: 안내문이 필요한 파일 수를 먼저 추정해
    `remaining_budget`에서 선반영), 최소한 최종 조립 후 `len(result) > max_total_size` 이면 안내문
    목록을 압축(파일별 나열 대신 개수+목록)하는 안전판을 둘 것. 회귀 테스트로
    `test_prompt_omission_notice.py`에 "생략 대상 파일 N개(N 은 안내문 누적만으로 예산을 넘기기에
    충분한 수)를 넣었을 때 최종 섹션 길이가 `max_total_size` 를 넘지 않는다" 는 케이스를 추가.

- **[WARNING]** `build_files_section` 의 "diff만으로도 예산 초과" 분기는 **전체 파일에 대해**
  생략 안내를 아예 내지 않는다 — 이번에 고친 것과 같은 결함 클래스가 다른 분기에 남아 있고
  테스트도 없다
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `build_files_section` 의 `if base_size >= max_total_size:` 분기(644~670행) — 이 분기는
    `sections = [fp["header"] + fp["diff"] for fp in file_parts]` 만 반환하고(669행), 어떤
    `file_parts[i]["full_content"]` 도, 어떤 생략 안내도 렌더링하지 않는다.
  - 상세: 직접 프로브로 확인(코드 판독 + 실행 둘 다 근거) — 두 change_info 모두 `full_content` 를
    갖고 있고 diff 만으로 이미 `max_total_size`(=200)를 넘는 입력으로
    `build_files_section([ci1, ci2], 10_000_000, 200)` 을 호출하면 결과에 `FULL_CONTEXT_HEADING`
    도 "전혀 실리지 않았습니다" 안내도 **0건** 이었다. 즉 이번 PR 의 동기("리뷰어가 빈 섹션을
    실제로 검토한 것처럼 판정한다")가 그대로 재현되는 두 번째 분기이며, 이번 diff 는 그 중
    remaining_budget 분기(696~707행)만 고쳤다. `grep -rln "build_files_section" .claude/tests/*.py`
    결과 `test_prompt_omission_notice.py` 단 하나뿐이고, 그 파일의 모든 케이스는
    `base_size < max_total_size` 가 되도록 작은 diff 만 쓰는 픽스처(`SMALL`/`BIG`/`BIGGER`,
    diff_content="")라 이 분기를 밟지 않는다.
  - 제안: 이 분기에서도(diff 절단 후) 여유가 있으면 `_omitted_content_note` 를 붙이거나, 최소한
    "diff 도 절단됐고 원본 내용도 전혀 없다" 는 사실을 알리는 별도 안내를 추가. 테스트는 diff 가
    큰 다중 파일(각각 `full_file_content` 보유)로 `base_size >= max_total_size` 를 강제하는
    케이스를 `test_prompt_omission_notice.py` 에 추가해 "생략된 파일이 있으면 반드시 안내가
    붙는다" 불변식을 diff-전용 분기까지 확장.

- **[INFO]** plan 문서 2곳의 "테스트 N건" 실측 기재가 실제 `def test_` 개수와 다르다(누적 drift)
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md`("테스트
    `test_review_changeset_warning.py` 9건") / `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
    ("테스트 `test_consistency_bundle_priority.py` 10건")
  - 상세: `grep -c "    def test_" .claude/tests/test_review_changeset_warning.py` = **11**(9 아님),
    같은 파일 `test_consistency_bundle_priority.py` = **13**(10 아님). 직전 라운드
    (`review/code/2026/07/31/11_07_48/testing.md`)가 이미 `test_review_changeset_warning.py`
    "9건→실제 10건" 을 INFO 로 지적했고 비차단으로 무조치 처리됐는데, 이번 라운드에서 두 파일 모두
    (1R 픽스로 각각 1건씩 테스트가 더 추가되며) 실제 개수와의 격차가 더 벌어졌다. 이 프로젝트가
    반복적으로 강조해 온 "실측 문구의 정확성" 원칙에 비추면 사소하지만 누적되는 결이다.
  - 제안: 차단 사유는 아니나 다음 편집 때 두 곳 모두 정정 권장(11건 / 13건).

## 강점 (참고)

- 직전 라운드(11_07_48) WARNING 2건이 이번 라운드에서 실제로 해소됐다: (1) push 쪽
  `evaluate_review(cwd=None, *, in_flight_ok=False)` 시그니처를 그대로 미러링한 stub 을 두고
  `test_push_never_opts_into_the_in_flight_concession`(`test_guard_review_before_push_main.py`)가
  실제 서브프로세스로 훅을 띄워 seam 파일에 기록된 값이 `{"False"}` 뿐임을 단언 — Stop 쪽
  `test_stop_passes_in_flight_opt_in`(`test_stop_guard_failopen.py`)과 대칭. (2)
  `prioritize_bundle_files` 의 `related_specs`/`conventions` 호출부도
  `test_related_specs_uses_the_ranked_order`/`test_conventions_uses_the_ranked_order`
  (`test_consistency_bundle_priority.py`)로 `collect_context` 종단 검증이 추가됐다 — 자신이 이미
  기록해 둔 "호출 횟수만 세면 pass-through 뮤턴트에 뚫린다" 교훈을 그대로 적용해 스텁이 반환하는
  sentinel 정렬(역알파벳)이 실제 렌더 결과에 반영되는지를 단언한다.
- `EvaluateInFlightShortCircuitTest`(`test_review_guard_hardening.py`)가
  `test_push_path_still_blocks_while_in_flight`/`test_stop_path_opts_in_and_is_allowed` 양방향을
  모두 pin 해, 이번 CRITICAL 수정(`in_flight_ok` 기본값 False)이 어느 방향으로 되돌아가도 즉시
  RED 가 되도록 잠갔다.
- 신규/수정 테스트 전반이 mock 시그니처를 실제 시그니처와 맞추려는 흔적이 뚜렷하다(예:
  `_REVIEW_STUB.evaluate_review(cwd=None, *, in_flight_ok=False)`, `_CLEAN_REVIEW` 동일 패턴) —
  파라미터 없는 stub 이었다면 실제 호출부가 실수로 `in_flight_ok=True` 를 넘겨도 `TypeError`가
  광범위 `except Exception`에 삼켜져 fail-open 이 원인불명으로 발생했을 것.
- 격리가 일관적이다: `tempfile.mkdtemp()+addCleanup`, `_lib` 네임스페이스 충돌을 피하는
  fresh-interpreter 서브프로세스 실행, `CLAUDE_PROJECT_DIR` 임시 디렉터리 리다이렉트, 그리고
  `SuiteLeavesNoRealStateTest` 가 스위트 실행이 실제 저장소에 fail-open 상태 파일을 남기지
  않는지까지 별도로 감시한다.

## 요약

이번 diff 는 하네스 리뷰 게이트 자체의 결함 수정 3건(in-flight 억제 스코프, consistency 번들
우선순위, changeset 누락 경고)과 그 회귀 테스트, 그리고 직전 라운드 CRITICAL 로 지적된 "예산
초과 파일 무표시 누락"에 대한 부분 수정을 담고 있다. 실행 검증 결과 693건 중 **1건이 실제로
FAIL** 했고, 원인을 직접 이 diff 로 귀속시켰다: 새로 추가된 생략-안내(`_omitted_content_note`)가
스스로의 바이트 비용을 예산 계산에서 빠뜨려, 안내문이 여러 개 쌓이면(이번엔 14건) 조립된 프롬프트가
자기 자신의 예산 상한을 실제로 넘는다 — 같은 파일의 consistency 쪽 자매 함수가 이미 겪고 고친 바로
그 실패 형태이고, 그 수정의 "안내문도 예산에 넣는다" 절반만 빠진 채 이식됐다. 또한 diff 만으로
예산을 넘기는 분기는 이번 수정이 아예 닿지 않아 같은 무표시 누락이 여전히 재현된다(직접 프로브로
확인). 두 항목 모두 신규 테스트 파일(`test_prompt_omission_notice.py`)이 작은 픽스처만 써서 놓친
지점이다. 반면 직전 라운드에서 지적된 대칭성 결여(push 쪽 seam 테스트, `related_specs`/
`conventions` 종단 검증)는 이번 라운드에서 실제로 해소됐고, 그 수정 방식(효과를 단언, 호출
횟수가 아니라) 자체는 이 팀의 테스트 설계 성숙도를 보여준다.

## 위험도
CRITICAL

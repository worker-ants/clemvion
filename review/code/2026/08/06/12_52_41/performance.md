# 성능(Performance) 리뷰 결과 — round 8

## 검토 범위 메모

이번 세션(prompt 기준 11개 파일)의 실제 diff 는 작다 — `.claude/hooks/_lib/review_guard.py` 는
`_run_git` 의 `.strip()` → `.rstrip()` 정정(porcelain 선행 공백 보존) 한 줄, 나머지는 그 회귀를
고정하는 테스트(`test_review_guard_hardening.py` +60, `test_review_gate_ci.py` +90,
`test_workflow_yaml_structure.py` +21/-)와 문서 갱신이다. 다만 이번 라운드는 **직전 라운드
(`review/code/2026/08/06/12_09_13/performance.md`) 가 명시적으로 범위 밖으로 뺐던
`review_guard.py` 전체 파일이 처음으로 리뷰 대상에 들어왔다** — 그 리뷰는 "이번 changeset 에
포함돼 있지 않아 알고리즘 복잡도는 평가 대상에서 제외" 라고 적어 뒀다. 이번엔 전체 파일이 프롬프트에
실렸으므로 그 본체의 알고리즘 복잡도를 처음으로 들여다봤고, 실측으로 확인되는 실질적인 발견이
나왔다 — 아래 첫 항목이 이번 라운드의 핵심 발견이다.

이 코드의 실행 맥락을 짚어 둔다: `review_guard.evaluate_review()` 는 CI 워크플로(PR 당 1회)뿐
아니라 **로컬 `guard_review_before_push`(매 `git push`) 와 `guard_review_before_stop`(매 턴
종료)** 에서도 호출된다 — 즉 이 파일의 hot path 는 CI 5분 예산이 아니라 **개발자의 매 턴마다
동기적으로 도는 인터랙티브 루프**다. 아래 실측은 전부 이 저장소(현재 워크트리) 자체를 대상으로
`review_guard` 를 직접 import 해 실행한 결과다.

## 발견사항

- **[WARNING]** `evaluate_review()` 의 Gate 1 이 커밋된 리뷰 세션 **전체**(현재 807개)를 매 호출마다
  파일 I/O 를 동반해 선형 스캔한다 — 캐싱·조기 종료 없음
  - 위치: `.claude/hooks/_lib/review_guard.py:555` (`_newest_resolved_review_mtime`),
    `:420` (`_iter_summaries` — `os.walk(review/code)` 전체 순회),
    `:475` (`_summary_is_resolved` — 세션마다 `_retry_state.json` open+parse,
    `RESOLUTION.md` stat, 필요시 `SUMMARY.md` open+parse)
  - 상세: `_newest_resolved_review_mtime` 은 "가장 최근의 **해결된** 리뷰 시각" 하나만 필요한데,
    세션 디렉터리 이름이 이미 시간순으로 정렬 가능한 문자열(`<Y>/<m>/<d>/<H>_<M>_<S>`)임에도
    `os.walk` 로 발견되는 순서 그대로, 조기 종료 없이 **모든** `SUMMARY.md` 를 방문해
    `_summary_is_resolved()`(파일 I/O 1~2회)를 호출한 뒤 `max()` 를 취한다. 실측(이 저장소,
    2026-08-06 기준 `review/code` 아래 커밋된 `SUMMARY.md` 807개):
    ```
    $ python3 -c "
    import sys, time, os
    sys.path.insert(0, '.claude/hooks/_lib')
    import review_guard as rg
    root = os.path.abspath('.')
    dirty = rg._dirty_set(root)
    t0 = time.time(); best = rg._newest_resolved_review_mtime(root, dirty); t1 = time.time()
    print(f'{t1-t0:.4f}s for {len(rg._iter_summaries(root))} summaries')
    "
    0.1777s for 807 summaries
    ```
    Gate 2(`_newest_resolved_impl_done_mtime`, `:777`)는 spec-linked 변경이 있을 때만 도는데
    같은 패턴으로 `review/consistency` 738개 세션을 스캔해 **0.2272s** 를 추가로 쓴다(실측 위
    스크립트와 동일 방식). 두 게이트가 다 걸리면 한 번의 `evaluate_review()` 호출에서만 **~0.4초**의
    파일 I/O 가 발생한다.
    이 스캔은 **push 시도마다, 그리고 (Stop 훅 경유로) 사실상 매 턴 종료마다** 코드베이스에 미해결
    변경이 있는 한 무조건 실행된다(아래 `evaluate_review` 977~1004행 순서 참조) — CI 의 PR 당
    1회가 아니라 인터랙티브 개발 루프의 매 스텝이다.
  - 상세2: 저장소는 리뷰 산출물을 PR 에 커밋하는 문화를 스스로 강제하고(`review-gate.yml` 도입
    근거), 이 브랜치 자신도 라운드마다 `review/code/2026/08/06/**` 세션을 새로 커밋하고 있다 —
    즉 `n`(세션 수)은 매 PR 마다 계속 늘어나기만 하고 줄지 않는다. 지금 807개에서 0.18초인 이
    스캔은 시간이 지날수록, 그리고 정확히 이 백스톱이 성공해 채택률이 올라갈수록(리뷰 산출물이
    더 많이 커밋될수록) 더 느려진다 — 자기 성공이 자기 비용을 키우는 구조다.
  - 제안: 세션 디렉터리 이름이 이미 정렬 가능한 타임스탬프이므로, 각 레벨(`Y`→`m`→`d`→`H_M_S`)을
    `os.scandir` + 내림차순 정렬로 순회하며 "해결됨 AND 코드보다 최신"을 만족하는 **첫** 세션에서
    멈추면 최선의 경우(리뷰가 이미 통과해 반복 중인 흔한 흐름) O(1)~O(작은 상수) 로 끝난다.
    최악의 경우(해결된 리뷰가 아예 없음)는 여전히 전체 스캔이 필요하지만, 그 경로는 이미 차단
    메시지를 내는 느린 실패 경로이므로 지금 스캔 비용이 몰려도 상대적으로 덜 아프다 — 정확히
    반복적으로 통과하는 "정상" 흐름을 빠르게 만드는 쪽이 이득이 크다.

- **[INFO]** Stop 훅 한 번에 `review/code` 트리를 최대 3번 독립적으로 재순회 — 서로 결과를 공유하지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:993` (`evaluate_review` 안 `_code_review_in_flight`
    호출, `:822` 정의 — `os.walk` 1회) → `:1004` (`_newest_resolved_review_mtime` → `_iter_summaries`,
    `os.walk` 2회째) → (차단된 경우) `.claude/hooks/guard_review_before_stop.py:267-276`
    (`_review_was_performed` → `_iter_summaries` 재호출, `os.walk` 3회째) 와 `:249-264`
    (`_suppress_for_resolution` → `_resolution_in_flight`, `review_guard.py:900` — `os.walk` 4회째,
    이건 별도 목적이라 완전히 중복은 아님).
  - 상세: `_review_was_performed()` 는 "리뷰가 한 번이라도 돌았는가"(`bool(_iter_summaries(...))`)
    만 알고 싶어 하는데, 그 정보는 몇 줄 전 `evaluate_review()` 내부의 `_newest_resolved_review_mtime`
    가 이미 `_iter_summaries()` 를 호출해 전량을 순회하며 얻은 것과 동일한 원천 데이터다. 그런데
    `ReviewDecision` 에는 그 사실을 실어 나르는 필드가 없어서, 호출자(Stop 훅)가 **처음부터 다시**
    `os.walk(review/code)` 를 돈다. 실측(`_iter_summaries` 단독 호출, walk-only, 파일 내용은 안 읽음):
    `0.0223s`(807개 세션) — 개별로는 작지만, "차단됨"(리뷰 미완료) 은 이 저장소 워크플로에서 아주
    흔한 상태(구현 직후, 리뷰/fix 전)이므로 그 경로에서 매번 공짜로 아낄 수 있는 왕복이다.
  - 제안: `ReviewDecision` 에 `review_ever_ran: bool` (또는 `newest_review > 0` 을 그대로) 필드를
    추가해 `evaluate_review()` 가 이미 계산한 값을 실어 보내면, 훅 쪽의 `_review_was_performed()`
    재순회를 제거할 수 있다. 급한 문제는 아니다(walk-only 라 20ms 급) — 위 첫 항목(파일 I/O 포함
    스캔)을 먼저 손대는 편이 이득이 크다.

- **[INFO]** `_dirty_set` 과 `_uncommitted_code_changes` 가 겹치는 정보를 위해 `git status
  --porcelain` 을 별도로 두 번 호출
  - 위치: `.claude/hooks/_lib/review_guard.py:274` (`_uncommitted_code_changes` —
    `git status --porcelain -- codebase/`), `:306` (`_dirty_set` — `git status --porcelain`,
    경로 필터 없음), 둘 다 `evaluate_review()`(`:981`, `:1000`)에서 매 호출마다 실행됨.
  - 상세: `_dirty_set` 은 전체 저장소의 미커밋 경로 집합이 필요하고(리뷰 산출물 쪽 신선도 판정에도
    쓰임), `_uncommitted_code_changes` 는 그중 `codebase/` 하위만 필요하다 — 후자는 전자의 부분집합
    (path 필터만 다름)이라, 한 번의 `git status --porcelain`(무필터) 결과를 Python 에서
    `codebase/` 접두어로 필터링하면 두 번째 subprocess 스폰을 없앨 수 있다. 실측(이 저장소, git
    status 가 느린 편인 대형 모노레포):
    ```
    _uncommitted_code_changes: 0.0390s
    _dirty_set:                0.1062s
    ```
    subprocess 스폰 자체의 고정비가 크므로, 합치면 이 부분만 최대 ~0.04초 절약된다 — 위 세션-스캔
    항목보다는 작지만 공짜로 없앨 수 있는 왕복이라 함께 적어 둔다.
  - 제안: `evaluate_review()` 에서 `dirty = _dirty_set(repo_root)` 를 먼저 구하고,
    `_uncommitted_code_changes` 는 별도 git 호출 대신 `dirty` 를 `CODE_PREFIX` 로 필터링하는
    순수 함수로 바꾼다(단, `_dirty_set` 은 전체 저장소 기준, `_uncommitted_code_changes` 는
    `-- codebase/` pathspec 기준이라 이론적으로 결과가 100% 동일함을 별도로 확인해야 한다 —
    `git status --porcelain -- <pathspec>` 과 무필터 결과를 Python 에서 필터링한 것이 정확히
    같은 집합인지는 rename/copy 표기 등 엣지케이스가 있어 회귀 테스트로 고정한 뒤 통합할 것).

- **[INFO]** Gate 2 의 spec glob 파싱이 spec-linked 변경 유무와 무관하게 매번 `spec/**` 전체를 재파싱
  - 위치: `.claude/hooks/_lib/review_guard.py:701` (`_spec_code_patterns` — `spec/` 전체
    `os.walk` + 파일마다 frontmatter 파싱), `:723-734` (`_spec_linked_changes` 가 매 호출 시
    캐시 없이 `_spec_code_patterns` 를 새로 부름).
  - 상세: 실측 383개 spec 파일에 대해 `0.0352s`. 결과가 같은 프로세스 내에서 재사용되지 않고(모듈
    전역 캐시 없음), 정적 검사 관점에서는 spec/ 이 그 사이 바뀌지 않는 한 매번 같은 패턴 목록을
    다시 계산한다. 절대 비용은 작아 차단 사유는 아니다.
  - 제안: 지금 당장 조치 불필요. spec 파일 수가 계속 느는 추세(현재 383)라면 프로세스 생존 기간
    동안(각 훅 호출은 별도 프로세스라 프로세스 내 캐싱은 의미가 제한적) 보다는, mtime 기반의
    작은 디스크 캐시(예: `spec/` 최신 mtime 을 키로 패턴 목록을 캐시) 를 고려할 수 있다 — 우선순위
    낮음.

- **[INFO]** (직전 라운드에서 이미 관측·기록됨, 재확인만) 테스트 인프라 쪽 반복 I/O — 변경 없음
  - `test_review_gate_ci.py` 의 `ReviewGateCliTest.setUp`(`shutil.copytree` 매 테스트),
    `test_stop_guard_failopen.py` 의 `StopGuardFailOpenTest.setUp`(동일 패턴),
    `test_workflow_yaml_structure.py` 의 워크플로 YAML 매 테스트 메서드 재파싱 — 전부
    `review/code/2026/08/06/12_09_13/performance.md` 가 LOW 로 이미 기록한 항목이고 이번 라운드
    diff 는 이 패턴을 바꾸지 않았다(새 테스트 메서드가 같은 `setUp`/`self.files` 를 재사용하는
    형태로 추가됐을 뿐). 재진단하지 않고 존재만 확인한다 — CI 5분 예산 대비 여전히 무해.

## 요약

이번 라운드의 실질 diff(포치 문자 하나 `.strip()`→`.rstrip()` + 회귀 테스트)는 성능에 영향이
없다. 그러나 `review_guard.py` 전체가 처음으로 리뷰 범위에 들어오면서, 이 게이트의 핵심 경로
(`evaluate_review` → Gate 1 커버리지 판정)가 **커밋된 리뷰 세션 전체를 조기 종료 없이 선형 스캔**하고
있음을 실측으로 확인했다 — 현재 807개 세션에서 ~0.18초, spec-linked 변경이 겹치면 Gate 2 의
738개 컨시스턴시 세션 스캔까지 더해 ~0.4초. 이 스캔은 CI 전용이 아니라 **로컬 push 훅과 Stop 훅을
통해 사실상 매 턴 종료마다** 도는 코드이고, 저장소가 리뷰 산출물을 계속 커밋하는 방향으로 굳어지고
있어(이 브랜치 자신도 라운드마다 새 세션을 커밋 중) 그 비용은 시간이 지날수록, 그리고 이 CI 백스톱이
성공적으로 채택률을 끌어올릴수록 커진다. 세션 디렉터리 이름이 이미 정렬 가능한 시계이므로 최신
순으로 훑어 첫 적합 세션에서 멈추는 조기 종료만으로 흔한 "이미 리뷰 통과" 흐름을 크게 단축할 수
있다. 부수적으로 Stop 훅 한 번에 같은 디렉터리를 최대 3~4번 독립 재순회하는 점, `git status
--porcelain` 을 필터만 다르게 두 번 호출하는 점도 관측했다 — 둘 다 개별로는 작지만 같은 클래스의
낭비다. 알고리즘이 틀렸거나 발산하는 것은 아니고(선형 스캔은 정확하다), 조기 종료·결과 공유가 빠진
"정확하지만 게으르지 않은" 코드라 CRITICAL 은 아니지만, hot path 빈도와 데이터가 단조 증가한다는
구조적 특성상 방치하면 개발자 체감 지연으로 누적될 수 있어 WARNING 으로 기록한다.

## 위험도

MEDIUM

# Security Review — 2026/08/01 08_11_19 (Round 8)

검증 방법: 프롬프트가 잘라낸 5개 파일(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`, `test_block_integrity.py`) 은
`Read` 로 직접 원문을 열어 검토했다(아래 위치의 줄 번호는 모두 원본 파일 실측 줄 번호). 7R 이
"검사(inspection)만으로는 놓친다" 고 지적한 두 항목 — (a) `block_integrity` 검증 regex의
O(n²), (b) `_evaluate_over_targets` 의 advisory 유실 — 은 이번 라운드에서 **직접 벤치마크 +
harness 자체 테스트 753건 전체 실행**으로 재검증했다. 그 다음 같은 방법론(측정, 눈검사 아님)을
이번 번들의 다른 정규식 hot path 에 적용해 **기존에 보고된 적 없는 신규 ReDoS 결함**을 하나
찾았다.

## 발견사항

- **[CRITICAL]** `_glob_to_regex()` 가 spec `code:` glob 을 다중 `*` 로 작성하면 **catastrophic
  backtracking(ReDoS)** 을 일으키고, 이 함수의 결과가 `evaluate_review()` — 즉 매 `git push`
  (`guard_review_before_push.py`)·매 턴종료(`guard_review_before_stop.py`) 게이트 — 안에서
  실행된다.
  - 위치: `.claude/hooks/_lib/review_guard.py:573-599` (`_glob_to_regex`, 단일 `*` → `[^/]*`
    변환은 593줄), 호출 경로 `_spec_code_patterns:653-672`(컴파일 호출 669줄) →
    `_spec_linked_changes:675-686`(매칭 684줄: `if any(p.match(posix) for p in patterns):`) →
    `evaluate_review:976`(`spec_linked = _spec_linked_changes(repo_root, changed)`).
  - 상세: `_glob_to_regex` 는 glob 의 각 단일 `*` 를 독립된 `[^/]*` 로, 그것도 세그먼트
    구분자(`/`) 없이 그대로 이어붙인다. glob 안에 서로 다른 리터럴로 구분되지 않는 `*` 가
    여러 개 연쇄되면(예: `a*a*a*a*...`), 실패하는 입력에 대해 정규식 엔진이 각 `[^/]*` 의
    경계를 지수적으로 많은 방식으로 재배치해보는 고전적 ReDoS 패턴이 된다. 이 함수가 만드는
    패턴은 `spec/**/*.md` 의 frontmatter `code:` 필드에서 그대로 가져오므로(파서:
    `_parse_frontmatter_code`, 길이·와일드카드 개수 제한 없음), **spec 문서에 쓰기 권한이
    있는 누구나(개발자 turn 의 spec drift, 외부 기여자의 PR 등)** 이런 glob 을 심을 수 있고,
    이후 그 리터럴 문자와 충돌하는 경로를 가진 파일이 **어느 브랜치의 어느 push 에서든** 변경
    목록에 들어오면 게이트가 멈춘다. `spec/` 에 한 번 병합되면 그 세션만이 아니라 **그 spec
    파일을 체크아웃한 모든 사람의 이후 모든 push/턴종료**가 영향권에 든다 — 이 저장소가
    `_GIT_PUSH`/`_BLOCK_AT_LINE_START` ReDoS 를 몇 라운드에 걸쳐 CRITICAL 로 다룬 것과 동일한
    근거("이 훅은 모든 Bash 호출을 동기적으로 게이트하므로, 느린 스캔은 곧 멈춘 세션이고,
    타임아웃에 걸리면 그 gate 자체가 fail-open 으로 우회된다")가 그대로 적용된다.
  - **직접 측정** (`_glob_to_regex("a*"*reps + "!")` 를 길이 `2*reps` 인 실패 후보 문자열에
    매칭, 컴파일/모듈 임포트 시간 제외 순수 매치 시간만):

    | `*` 개수(reps) | 패턴 길이 | 후보 길이 | 매치 시간 |
    |---|---|---|---|
    | 8  | 17 | 16 | 0.0002s |
    | 10 | 21 | 20 | 0.0025s |
    | 12 | 25 | 24 | 0.0432s |
    | 14 | 29 | 28 | 0.6906s |
    | 16 | 33 | 32 | 10.4791s |

    reps 를 하나 늘릴 때마다 시간이 ~4배씩 뛴다(측정치가 지수 성장과 정확히 일치). 이
    추세로 reps=20(37자짜리 glob, 40자 안팎의 실제 파일 경로) 이면 대략 40분 이상, reps=24
    면 며칠 단위로 폭증한다 — 사람이 코드리뷰에서 "이상해 보인다"고 알아채기 전에 심을 수
    있는 규모의 glob 문자열로 실서비스 훅을 영구히 멈출 수 있음을 실측으로 확인했다.
    (참고로 같은 방법론으로 `block_integrity._BLOCK_AT_LINE_START/_END` 와
    `guard_review_before_push._GIT_PUSH`/`_MESSAGE_ARG`/heredoc 스캔은 별도로 벤치마크했고
    모두 입력 크기에 선형으로 확인됨 — 7R 이 고친 두 결함은 실측으로 재확인했다. 아래
    "검증 완료 항목" 참고.)
  - 이 경로에는 `test_review_guard.py`/`test_review_guard_hardening.py` 어디에도 ReDoS/
    backtracking 관련 테스트가 없다(`grep -rn "_glob_to_regex" .claude/tests/` 로 확인 —
    기존 3개 테스트는 전부 `**/` 세그먼트 경계 정합성만 검증, 적대적 입력에 대한 시간 상한은
    없음). `_GIT_PUSH` 계열이 받은 것과 같은 수준의 검증이 이 함수에는 전혀 없었다.
  - 제안: (1) 단일 glob 안에서 허용하는 `*`/`?` 총 개수에 상한을 두고 초과 시 그 패턴을
    스킵 + stderr 경고(이 파일이 `_MAX_REDACTION_INPUT` 에서 이미 쓰는 "손으로 짠 스캔은
    입력 규모를 캡으로 막는다" 관례와 동일선상 — 측정상 8개 이하는 어떤 후보에도 안전).
    (2) `VerdictParserStaysLinearTest` 와 동일한 패턴(서브프로세스 + 하드 타임아웃)으로
    `_glob_to_regex`/`_spec_linked_changes` 회귀 테스트 추가. (3) 근본적으로는 세그먼트 내
    다중 `*` 를 역추적 없는 방식(수작업 유한 오토마톤 또는 `fnmatch`의 최신 구현이 쓰는
    비-역추적 변환)으로 바꾸는 것이 이상적이나, 비용 대비 (1)+(2) 조합으로 충분히 막힌다.

- **[WARNING]** `merge_coordinator_orchestrator.py` 가 브랜치/PR 이름을 검증 없이 git 인자
  위치에 그대로 넣어, `-` 로 시작하는 ref 이름이 옵션으로 오인될 수 있는 "argument injection"
  형태가 여러 곳에 있다.
  - 위치: `resolve_branch:171-186`(`_git(["git", "rev-parse", "--verify", ref])`, 175줄),
    `branch_diff_stat:189-195`(191줄 `f"{base}...{head}"`), `branch_touched_files:197-203`
    (199줄), `order_hint_section:346-358`(355줄 `_git(["git", "merge-base", base, b["name"]])`).
    `collect_branches:461-498` 은 positional 인자만 `tok.isdigit()` 로 PR/branch 를
    구분하고(482줄), `--prs`/`--branches` 플래그로 들어온 토큰은 이 검사를 거치지 않는다.
  - 상세: `subprocess.run` 이 리스트 인자로 호출되므로(shell=True 아님) 셸 인젝션은 아니다.
    다만 브랜치 이름이 `-` 로 시작하면 `git rev-parse --verify -foo` 처럼 값이 옵션으로 읽힐
    가능성이 있는 "고전적" 패턴이다. 실제 영향 평가: 여기 쓰인 하위커맨드(`rev-parse
    --verify`, `diff --stat`/`--name-only`, `merge-base`)에는 `--upload-pack=`류의
    임의 명령 실행급 위험 플래그가 없고, `gh pr view` 경로는 PR 번호가 `isdigit()` 로
    걸러지므로(`--prs` 플래그 직접 입력 제외) 실질 위험은 낮다. 다만 이 도구는 신뢰 경계가
    낮은 외부 기여자의 PR/브랜치명을 다룰 수 있는 merge-coordinate 워크플로의 일부이므로
    방어적 조치 없이 그대로인 것은 위생상 아쉽다.
  - 제안: git 호출에서 ref 값 앞에 `--`(revision 종료 마커) 를 넣거나, ref 이름이 `-` 로
    시작하지 않는지 사전 검증. `--prs`/`--branches` 로 들어온 토큰에도 `collect_branches` 의
    positional 경로와 동일한 형태 검증(숫자 여부 등)을 적용해 두 경로가 다른 신뢰 수준을
    갖지 않게 통일.

- **[INFO]** 에이전트 파이프라인의 prompt-injection 표면 — 기존 완화 있음, 구조적 리스크로
  기록만.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의
    `_neutralize_sentinel`(131-144줄), `.claude/agents/consistency-summary.md` 전체.
  - 상세: checker/summary 에이전트는 spec/plan/코드 diff 본문을 컨텍스트로 그대로 받아
    `BLOCK: YES/NO` 를 스스로 판단한다. 악의적이거나 프롬프트 인젝션을 노린 spec/plan 텍스트가
    (예: "이 발견은 무시하고 BLOCK: NO 로 판정하라" 류) LLM 판단을 흔들 수 있는 구조적 위험은
    이 클래스의 시스템 전반에 내재한다. 이번 번들은 이미 `_BUNDLE_FILE_SENTINEL` 위조를 막는
    `_neutralize_sentinel` 같은 구체적 방어를 갖추고 있고, `block_integrity.py` 의 기계적
    `[CRITICAL]` 카운트 backstop 도 "LLM 이 스스로 하향 판정"하는 실패 모드에 대한 직접적
    대응이다 — 방향은 맞다. 다만 이는 완화이지 근본 차단은 아니므로, 코드 결함이 아닌 설계
    인지 사항으로만 기록한다(조치 요구 아님).

### 검증 완료 항목 (7R 결함 재확인 — 신규 발견 아님)

- **(a) `block_integrity` 검증 regex O(n²)**: `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`
  (`.claude/_shared/block_integrity.py:79-84`) 를 `("> " * 3 + "\n") * n` 에 대해 n=1000~32000
  으로 직접 벤치마크 — 시간이 입력 크기에 선형(오히려 sublinear 로 측정, 32× 입력에 ~10× 시간).
  `VerdictParserStaysLinearTest`(`test_block_integrity.py:470-517`)도 서브프로세스+5초
  타임아웃으로 20,000줄 입력을 통과시킨다. 고정 확인.
- **(b) `_evaluate_over_targets` 의 advisory 유실**: `guard_review_before_push.py:809-883` 을
  직접 읽고, 블로킹 타겟에서도 `return` 하지 않고 루프를 끝까지 도는 것을 확인
  (836-839, 874-880줄 주석·코드 일치). `NotesFromLaterTargetsSurviveAnEarlierBlockTest`
  (`test_block_integrity.py:416-467`)가 "앞 타겟이 차단해도 뒤 타겟의 note 가 남는지" 를
  정확히 그 배치로 단언하고 통과한다. 방어 주석이 "차단 타겟 자신의 note" 케이스만이 아니라
  "차단 타겟 **이후**의 다른 타겟" 케이스까지 실제로 커버함을 코드+테스트 양쪽에서 확인.
  고정 확인.
- **하네스 자체 테스트 전체 실행**: `python3 -m unittest discover -s .claude/tests -p
  'test_*.py'` → **753 tests, OK** (0 failure/error). 이번 번들이 기존 회귀를 만들지
  않았다는 것을 자체 테스트 스위트 전체 실행으로 확인.

### 그 외 확인한 항목 (문제 없음)

- 이 번들의 `subprocess` 호출은 전부 리스트 인자이며 `shell=True`/`os.system`/`os.popen`/
  `eval`/`exec` 사용처가 없다(전수 grep 확인) — 커맨드 인젝션 표면 없음.
  `guard_review_before_stop.py` 의 `_sanitize_component`(45-49줄) 는 `/` 를 포함한 모든
  비허용 문자를 `_` 로 치환해 marker 파일 경로가 `session_id`/branch 토큰을 통해 상태
  디렉토리를 벗어나지 못하게 막는다(path traversal 방지, 기존 설계 그대로 안전).
- 하드코딩된 시크릿(API key/password/token/인증서) 전수 grep — 매치 없음(오탐 2건은 변수명
  `token`/주석 "secret-store" 뿐).
- `_ESCAPED_PIPE`, frontmatter `code:` 라인 매칭 정규식 등 이 번들의 나머지 정규식 hot path
  는 5,000~80,000자 적대적 입력에 대해 선형으로 측정 확인.

## 요약

이번 라운드는 7R 이 남긴 "검사가 아니라 측정" 교훈을 실제로 적용해, 이미 알려진 두 결함
((a) verdict regex O(n²), (b) advisory 유실)이 **실제로 고쳐졌고 그 고침이 완전한지**를 직접
벤치마크와 harness 자체 테스트 753건 전체 실행으로 재검증했다 — 둘 다 확인됐다. 같은
측정 방법론을 번들의 다른 정규식 hot path에 적용한 결과, `review_guard.py._glob_to_regex()`
에서 **신규 CRITICAL 급 ReDoS** 를 발견했다: spec `code:` glob 을 다중 `*` 로 작성하면(길이
제한도 개수 제한도 없음) 그 결과 정규식이 `evaluate_review()` — 매 `git push` 와 매 턴종료를
게이트하는 바로 그 함수 — 안에서 실행되며, 실측상 `*` 16개짜리 33자 패턴이 32자 후보 문자열에
대해 10초 이상 걸렸고 하나 늘 때마다 ~4배씩 증가한다(20개면 수십 분, 24개면 며칠 단위). 이는
이 저장소가 `_GIT_PUSH`/`_BLOCK_AT_LINE_START` ReDoS 를 여러 라운드에 걸쳐 CRITICAL 로 다룬
것과 정확히 같은 성격의 결함이며, 같은 수준의 회귀 테스트가 아직 없다. 그 외 `merge-coordinator`
의 git ref 인자 처리(WARNING, 낮은 실질 위험)와 에이전트 파이프라인의 구조적 prompt-injection
표면(INFO, 기존 완화 있음)을 부가로 기록했다. 커맨드 인젝션·하드코딩 시크릿·path traversal 은
전수 확인 결과 문제 없음.

## 위험도

CRITICAL

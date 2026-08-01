# RESOLUTION — 1R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 0 / WARNING 9 / INFO 다수.** RISK=LOW.

활성 결함은 0건이고, WARNING 9건은 전부 **"미래 회귀를 못 잡는 방어망의 구멍"** 성격이다.
그중 4건은 리뷰어가 뮤테이션으로 **실제 재현**했고, main 이 각각 다시 재현해 확인했다.

## 가장 아픈 것 — 내가 같은 파일에 써 놓은 교훈을 옆 클래스에 적용하지 않았다 (W2)

`OneJudgeTest` 는 "단어가 아니라 연산" 으로 이미 재작성돼 있는데, 바로 아래 `WorkflowWiringTest`
는 substring 검사였다. 리뷰어가 두 우회를 실증했고 main 이 재현했다:

| 뮤턴트 | 재작성 전 | 후 |
|---|---|---|
| `if:` 삭제 + 같은 문자열을 `env:` 에 남김 | **OK** | FAILED |
| `run:` 을 `true` 로 교체 (경로는 `paths:` 에 남음) | **OK** | FAILED |
| `fetch-depth: 0` → `1` | (미검증) | FAILED |

문자열이 **어디에** 있는지가 배선의 전부인데 substring 은 그걸 못 본다. PyYAML 로 구조 파싱해
`on.pull_request.paths` · `jobs.gate.if` · checkout step 의 `with.fetch-depth` · 각 step 의
`run` 을 각각 대조하도록 재작성했다. (PyYAML 은 origin/main 이 테스트 전용으로 허용한 예외이고
`test_workflow_yaml_structure.py` 가 같은 이유로 이미 쓴다.)

## 판정자 단일성 가드를 세 번째로 고쳤다 (W3)

| 판 | 방식 | 무엇에 걸렸나 |
|---|---|---|
| 1차 | 파일 전체 grep | 스크립트 docstring 이 설계 근거로 인용한 `review/code` |
| 2차 | docstring 제외 | 사용자 **안내 문구** ("codebase/** 변경을 커버하는…") |
| 3차 | 연산 금지 목록 | 리뷰어 실증: `pathlib.rglob`, `from os import walk as _w` |
| **4차** | **import allowlist + alias 정규화** | — |

금지 목록은 우회를 상상하는 만큼만 강하고 상상은 늘 부족하다. 이 스크립트가 하는 일은
"인자를 읽고, 게이트를 부르고, 출력한다" 뿐이라 허용 목록이 짧고 안정적이다
(`__future__`/`argparse`/`os`/`sys`/`review_guard`). 허용된 `os` 로도 트리를 걸을 수 있으므로
`os.walk`/`scandir`/`listdir`/`open` 은 **alias 를 정본 이름으로 되돌린 뒤** 별도로 막는다.

뮤테이션: `pathlib` import 추가 → RED, `from os import walk as _w` → RED.

## 실질 리스크 2건 — `--enforce` 전환 전에 닫아야 했던 것

**W4 `in_flight_ok` 회귀 무방비.** `evaluate_review(in_flight_ok=True)` 는 "리뷰가 도는 중" 을
차단하지 않는 스위치이고, 이 저장소는 그것이 **무조건** 적용돼 push 게이트가 TTL 내내 열린
사고를 겪고 opt-in 으로 고쳤다. CI 호출부가 그 스위치를 켜는 회귀를 아무 테스트도 안 잡았다 —
리뷰어가 `evaluate(root, in_flight_ok=True)` 로 바꿔 통과로 뒤집히는 것을 실측했다.
`meta.json` 만 있고 `SUMMARY.md` 는 없는 세션을 커밋한 상태에서 `--enforce` 가 여전히 exit 1
임을 고정했다.

**W9 `--root` 기본값이 한 번도 실행되지 않았다.** 15개 테스트가 전부 `--root <tempdir>` 를
명시로 넘겨서, 스크립트가 자기 위치에서 저장소 루트를 계산하는 두 단계 상위 가정은 미검증이었다.
그 가정이 깨지면 게이트를 못 불러와 **fail-open** 하고, 그 출력은 관측 모드의 정상 출력과
구분이 안 된다 — CI 는 계속 초록인데 백스톱만 영구히 죽는다("silent-permanent-disable").
`--root` 없이 실제 저장소에서 돌려 stderr 에 로드 실패 문구가 없음을 단언한다.

## 내 주석이 또 반증됐다 (W6)

`_load_gate` 가 `.claude/hooks` 도 `sys.path` 에 얹으며 "두 경로 다 필요하다 — 형제 모듈을
이름으로 import 하므로" 라고 적었다. 리뷰어가 격리 프로세스로 `_lib` 하나만으로 끝까지 도는
것을 실측해 반증했고, 정본 소비자 `guard_review_before_push.py` 도 `_lib` 하나만 얹는다.
경로와 주석을 함께 제거했다.

## 나머지

| # | 내용 | 처분 |
|---|---|---|
| W1 | `branch_guard.py` 가 trigger `paths:` 에 없다 — `review_guard._default_branch()` 가 그 모듈을 import 하는데 | 등재 + 구조 테스트가 요구 |
| W5 | plan frontmatter 의 `worktree:` 가 삭제된 워크트리를 가리켜 `plan_guard` 가 "연결된 plan 없음" 으로 오판 | 갱신 (확인: `_linked_plans` 가 이제 이 티켓을 반환) |
| W7 | README 신규 행만 한국어 (나머지 27행은 영어) | 영어로 통일 |
| W8 | 경로 리터럴 3회 반복 + 손으로 짠 두 번째 `subprocess.run` | `setUp` 에서 한 번 계산, `_run(env=...)` 로 통합 |
| INFO 2·3 | `${{ }}` 를 셸에 직접 보간, `permissions:` 없음 | 신규 파일이니 처음부터 안전한 형태로 — `env:` 경유 + `contents: read` |

## 검증

- harness 스위트 **827 tests OK** (1R 착수 시 825 → 신규 2).
- mutation 5종 전부 RED — 그중 **3종은 리뷰어가 GREEN 을 실증했던 바로 그 형태**다:
  `pathlib` 우회 · `os.walk` alias 우회 · `env:` 로 문자열만 남긴 봇 면제 제거 ·
  `run: true` · `fetch-depth: 1`.

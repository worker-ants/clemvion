# RESOLUTION — 2R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 2 / WARNING 7.** RISK=HIGH.

CRITICAL 2건 다 **코드가 아니라 내 테스트**다. 이 PR 의 실질 산출물은 스크립트가 아니라
"판정자는 하나다" 와 "여전히 관측 모드다" 를 강제하는 가드인데, 그 둘이 또 뚫렸다.

## CRITICAL 1 — 호출 축이 여전히 금지 목록이었다 (5명 실증)

1R 에서 import 축은 허용 목록으로 뒤집었는데 **호출 축은 안 뒤집었다.** 리뷰어들이 다섯 가지를
실증했고 main 이 전부 재현했다:

| 우회 | 왜 통과했나 |
|---|---|
| `os.path.isdir` | 수집기가 `Attribute(value=Name)` 한 단계만 인식 → 2단 체인은 **아예 기록조차 안 됨** |
| `walk = os.walk` | 지역 별칭이 정본 이름과 안 맞음 |
| `getattr(os, "walk")()` | `getattr` 은 스크립트가 실제로 쓰므로 허용돼 있었음 |
| `__import__("subprocess")` | import 노드가 아니라 호출이라 import 허용 목록 밖 |
| `os.popen` / `os.system` | 애초에 금지 4개에 없었음 |

**처분: 두 축 모두 허용 목록.** 스크립트의 실제 호출 15개를 열거하고 그 밖은 전부 거부한다.
더해서 (1) 임의 길이 점 체인을 해석하는 `_dotted` 를 쓰고 **해석 불가한 호출 형태는 그 자체로
실패**시킨다 — 조용히 버리는 수집기가 구멍이었다. (2) 지역 별칭을 정본으로 되돌린다.
(3) `getattr` 의 첫 인자가 import 된 모듈이면 실패시킨다.

> 같은 결론에 **네 번째**로 도달했다: 전문 grep → 문구 검사 → 연산 금지 목록 → 호출 허용 목록.
> 금지 목록은 우회를 상상하는 만큼만 강하고 상상은 늘 부족하다.

## CRITICAL 2 — `--enforce` 를 값으로 조립하면 통과했다 (2명 실증)

`test_it_is_still_observation_only` 가 `run:` 의 리터럴만 봤다. `--enforce` 를 `env:` 에 두고
`run:` 에서 `$GATE_FLAG` 로 참조하면 런타임엔 enforce 인데 테스트는 "관측 모드" 라고 보고한다.
**1R 이 `if:`→`env:` 우회를 고친 것과 정확히 같은 클래스**가 같은 파일의 다른 테스트에서 재발했고,
바로 옆 `test_the_job_condition_exempts_dependabot` 은 이미 고쳐져 있어 비대칭이 뚜렷했다.

**처분:** `env:` 값도 스캔하고, **게이트를 부르는 그 명령에는 셸/표현식 치환 자체를 금지**한다.
플래그를 값으로 조립할 수 있으면 리터럴 검사는 언제나 우회 가능하다.

## WARNING

| # | 내용 | 처분 |
|---|---|---|
| W1 | `run:` 이 여러 줄일 때 **주석에만** 경로를 언급한 decoy 가 "실행한다" 로 읽혔다 | 주석 줄 제거 후 검사 |
| W2 | 봇 면제를 `"dependabot[bot]" in cond` + `"!=" in cond` 로 **독립** 검사 — `(actor == 'dependabot[bot]') != false`(의미 정반대)도 통과 | 하나의 부정 비교식을 정규식으로 |
| W3 | `argparse` 기본 `allow_abbrev=True` — `--enf` 가 `--enforce` 로 붙어 리터럴 검사가 무력 | `allow_abbrev=False` |
| W4 | fail-open `try` 가 **호출만** 감싸 `decision.blocked` 접근은 밖 — 형태가 다른 반환값이면 exit 1 로 CI 를 막는다(계약의 정반대) | `try` 를 반환값 읽기까지 확장 |
| W5 | `PlanStubsMirror` 가 **파일 단위 join** 이라 한 파일의 두 stub 중 하나가 잃어도 다른 게 있으면 통과 | stub 단위로 |
| W6 | README·workflow 주석이 PyYAML 소비자를 "둘" 로 못박아 stale | 개수를 세지 않는 서술로 |
| W7 | "13개 테스트" docstring — 어느 셈법으로도 안 나오는 수 | 관계 서술로 (2R 대기 중 read-only 로 선처리) |

### W5 가 진짜 결함을 하나 드러냈다

stub 단위로 바꾸자 `test_stop_guard_failopen.py` 의 `evaluate_review` 스텁 **2곳**이
`push_blocks` 를 빠뜨린 것이 드러났다 — 파일 단위 join 이 가리고 있었다. 보정했다.

동시에 가드가 과했던 것도 드러났다: `def evaluate_plan(): raise KeyError(...)` 처럼 **예외를
던지는** 스텁은 결정 객체를 아예 안 돌려주므로 실을 곳이 없다. 그 경우를 제외했다.

## 프로세스 결함 — 내가 리뷰 중에 워크트리를 흔들었다

리뷰어 **6명**이 리뷰 도중 `check-review-gate.py`/`review-gate.yml` 이 커밋되지 않은 채
실시간으로 변형됐다 원복되는 것을 관측했고, 한 명은 `git checkout --` 로 직접 원복까지 했다.
원인은 내 mutation 실행이다. 전원 `git diff` 로 changeset 결함이 아님을 확인했고, main 도
사후 확인했다 — 워크트리는 무사하고 유실 없음.

**다음부터 mutation 은 리뷰와 겹치지 않게 한다.** 이번엔 스크래치 사본에서 돌리려 했으나
Bash 안전성 분류기가 일시 불가해 대기했고, 그 사이 이미 돌린 것들이 관측됐다.

## 검증

- harness 스위트 **827 tests OK**.
- mutation **8종 전부 RED** — 전부 리뷰어가 GREEN 을 실증했던 바로 그 형태다:
  `os.path.isdir` · `walk = os.walk` · `getattr(os,'walk')` · `__import__` · `os.popen` ·
  `--enforce` env 조립 · 주석 decoy · 의미 정반대 조건식.

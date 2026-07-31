# RESOLUTION — 11_07_48 (1차 라운드)

**CRITICAL 2 / WARNING 8**, 14개 reviewer 전원 결과 확보(forced 7명 미이행 0, skip 0, 재시도 0).
**CRITICAL 2건 + WARNING 6건 수정, 1건 defer, 1건 무조치.**

## 이 리뷰가 자기 자신을 증명했다

CRITICAL 1은 이 세션에서 **실제로 발현**했다. 실측:

| 프롬프트 섹션 | 본문 크기 |
|---|---|
| `review_guard.py` | **31 bytes** (헤더만) |
| `code_review_orchestrator.py` | **31 bytes** (헤더만) |
| 나머지 9개 파일 | 6,630 ~ 30,889 bytes |

14개 프롬프트 **전원**이 정확히 이 2개의 빈 섹션을 가졌고 **생략 표시가 전혀 없었다.**
그 둘이 이 PR 의 핵심 파일이다. 즉 리뷰어들은 이 PR 이 고치려는 결함 클래스에 스스로 당한
채로 리뷰했다 — 몇몇은 `git diff` 로 자체 우회했지만 그 우회는 reviewer 마다 불균등해
완화책이 못 된다(consistency 쪽에서 이미 확인된 패턴).

> 여기서 내 1차 판정이 틀렸다. `in_flight_ok` 를 grep 해 "14개 전원에 있다 → 실렸다" 고
> 결론냈는데, 그 토큰은 **다른 파일들**(테스트·stop 가드 diff)에 등장한 것이었다. 파일 경계를
> 넘는 토큰을 센 프록시 측정이다. 섹션 단위로 다시 재고서야 확정됐다.

## 처분

| # | 발견 | 처분 |
|---|---|---|
| **C1** | `build_files_section` 이 예산 초과 파일을 무표시 누락 (기존 결함) | **수정** — `_omitted_content_note` 로 생략 사실 + 읽을 경로 명시. 수정 후 같은 11개 파일 재조립 실측: 무표시 빈 섹션 **0건**, 생략 명시 4건 |
| **C2** | 신규 `_default_branch_ref` 만 예외를 흘림 (내 결함) | **수정** — 이 파일 git 헬퍼 11곳 중 9곳의 관례대로 `try/except`. 자신의 docstring 이 약속한 "Silent on any git failure" 위반이었다. **내 테스트가 이 경로를 못 밟은 것도 함께 수정** — 전부 `_default_branch_ref` 를 스텁해 실제 예외를 한 번도 안 일으켰다 |
| **W1** | `tier()` 가 catalog 강등을 브랜치-변경보다 먼저 판정 (내 결함) | **수정** — docstring 과 코드가 어긋났고, 카탈로그 파일을 실제 수정하는 PR 에서 **이 함수 자신의 결함 클래스가 재현**된다. tier 0 이 강등을 이기게 하고(약한 plan-언급은 여전히 강등에 짐) 조합 테스트 추가 |
| **W3** | `related_specs`/`conventions` 호출부 미잠금 | **수정** — 리뷰어가 "실행은 권한 밖" 이라며 코드 판독으로 예측한 것을 **mutation 으로 실측 확인**(반환값 폐기해도 GREEN). sentinel 순서 테스트 2건 추가 |
| **W4** | 모듈 최상단 docstring 이 깨진 불변식을 서술 (세 번째 자리) | **수정** — 이 PR 이 plan 에 "주석 2곳이 거짓이었다" 고 적어 놓고 정작 세 번째를 놓쳤다 |
| **W2** | push 쪽 seam 테스트 부재 | **수정** — stub 이 무인자라 실제 시그니처와 괴리. push 가 실수로 `in_flight_ok=True` 를 넘기면 `TypeError` 를 광범위 `except` 가 삼켜 **fail-open 이 되는데 원인이 안 드러난다** |
| **W6/W7/W8** | git 중복 호출 · DRY · 변수 중복 | **수정** — `_branch_changed_rels` 를 전체 repo 로 1회만 부르고 scope 는 prefix 필터로 파생(**호출 3회 → 1회, 계측 확인**). `_prioritized` 헬퍼로 통합 |
| **W5** | 기본 브랜치 해석이 4곳에 중복 | **defer** — 실제 코드 공유엔 hooks/skills 의 `_lib` 네임스페이스 충돌 해소가 선행이라 별도 범위. `harness-review-gate-ci-backstop.md` 에 등재 |
| INFO 다수 | 매직 넘버·함수 길이 등 | **무조치** — 비-행동 |

## 검증

- **mutation**: M-A(생략 안내 제거) / M-C(tier 순서) / M-D(push 가 opt-in 전달) 전부 RED.
  M-B 는 1차 시도가 `if True:` 치환이라 `except` 를 고아로 만들어 **SyntaxError** 를 냈다 —
  그건 잠김의 증거가 아니라 판정 불가다. **형태 보존 뮤턴트**(`except Exception` →
  `except ValueError`)로 다시 돌려 RED 확인.
- **harness 스위트**: 693 tests OK.

> 도중에 `test_branch_change_beats_catalog_demotion` 이 실패했는데 원인은 코드가 아니라
> **stale `__pycache__`** 였다(소스는 옳고 실행만 옛 바이트코드). `inspect.getsource` 는 새
> 코드를 보여주는데 동작은 옛것이라 한참 헤맸다. 캐시 제거 후 정상. `.pyc` 는 gitignore
> 대상이라 커밋 오염은 없었다(확인함).

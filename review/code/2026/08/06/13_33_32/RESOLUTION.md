# RESOLUTION — 9R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 3 / WARNING 8.**

## 먼저 — 리뷰 중 워크트리를 흔든 건 이번엔 나다

리뷰어 6명이 미커밋 변경을 관측했다. 2R 도 나였고, 3R 은 리뷰어의 `cd` 실패였고, 이번엔 다시
나다 — 리뷰어에게 "워크트리를 건드리지 말라" 고 써 보내고 **내가 그 워크트리에서 리팩터를
진행했다.** 리뷰어들은 지시대로 손대지 않고 HEAD 스냅샷 기준으로 판정했고, 그 미완성 리팩터의
잔여 결함까지 WARNING 으로 잡아줬다.

**앞으로 리뷰 중 선제 작업은 커밋된 상태에서만 하거나 사본에서 한다.**

## C1 — `_summary_is_resolved` 의 무조건 `break` (실증)

바깥 루프가 `_RISK_LINE` 매치에서 무조건 `break` 했다. 헤딩 **앞**에 그 문구를 언급하는 문장이
하나만 있으면 — 절차를 인용하는 평범한 문장 — 거기서 스캔이 끝나고 `risk_level` 이 None 으로
남는다. 표 행 없는 서술형 리포트면 `has_actionable` 도 False 라 **HIGH/CRITICAL 리포트가
RESOLUTION 없이 "해결됨"** 이 된다. 직접 재현: 같은 문서가 헛매치 한 줄로 `False → True` 로 뒤집힌다.

> **리뷰어 수치는 반증됐다.** "커밋된 808개 중 6개가 이 형태" 라고 했는데, 전수 실측 결과
> SUMMARY **1,548개 중 0건**이다(헤딩 매치가 2회 이상인 문서는 21개지만 첫 매치가 항상 레벨을
> 낸다). 판정이 달라지는 문서도 0건. **잠복 경로이지 살아있는 누락이 아니다** — 조건 하나로
> 닫히므로 고쳤고, 코퍼스 수치를 주석에 그대로 적었다.

## C3 — 손 복제가 **세** 벌이었다

`_run_git`/`_repo_root`/`_default_branch`/`_merge_base`/`_porcelain_path` 가 `review_guard`·
`plan_guard`·**`branch_guard`** 에 복제돼 있었다. 리뷰어가 세 번째를 짚었다 — 7R 이 첫째를,
8R 이 둘째를 고치고도 **두 번 다 빠진** 사본이고, 거기 `_run_git` 은 여전히 `.strip()` 이었다
(그 모듈이 porcelain 을 안 써서 도달 불가).

테스트 커버리지 실측이 왜 이게 숨었는지 말해준다 — `_run_git` 직접호출 0/mock 1,
`_repo_root` 0/5, `_merge_base` 0/3, `_default_branch` 0/4. **열 개 넘는 사본이 한 번도
실행되지 않았다.**

`_shared/git_probe.py` 로 추출하고 세 훅 전부 위임했다. 검증: 다섯 함수 모두 세 모듈이 같은
객체를 가리키고, 공유 모듈에서 `.strip()` 을 되돌리면 **양쪽 훅 테스트가 함께 RED**.
재복제 가드도 넣었다(객체 동일성 + 로컬 `def` 부재, 세 모듈 전부).

## C2 / W3 — `_shared/**` 가 env 스캔 사각이었다

리뷰어가 `report_paths.py`/`block_integrity.py` 에 `GITHUB_JOB == "gate"` 분기를 심어 **127개
테스트가 전부 통과**하는 것을 실증했다. 실제 판정(Gate1 커버리지, Gate2 하향 감지)이 그 두
함수로 내려가는데 `_SCANNED` 에 없었다. 목록을 손으로 늘리는 대신 **디렉터리에서 도출**하도록
바꿔, 방금 내가 추가한 `git_probe.py` 도 자동으로 들어간다(W3 동시 해소).

## 내 리팩터의 잔여 (리뷰어가 잡아준 것)

| # | 내용 | 처분 |
|---|---|---|
| W1 | `git_probe` 가 **import 시점**에 `sys.path.insert(hooks/_lib)` — `_shared` 는 skills 도 쓰는데 그쪽 `_lib` 는 다른 패키지다 | 호출 시점 지연 해석으로. 검증: import·호출 후 모두 `sys.path` 오염 없음 |
| W2 | 두 훅에 죽은 `try/except _origin_default_branch` 가 남음(가짜 seam) | 제거 |
| W4 | 미사용 `import subprocess`, 과도한 빈 줄 | 제거 |
| W5 | 내가 쓴 헤더에 mojibake `匹` | 정정 |
| W6 | README `test_plan_guard.py` 행이 7R~9R 미반영 (8R 커밋 메시지의 "2행 재작성" 주장이 이 행은 포함 안 했다) | 갱신 |

## 검증

- harness 스위트 **849 tests OK**.
- mutation **5종 전부 RED**: 무조건 `break` 회귀 · `report_paths` env 분기 ·
  `block_integrity` env 분기 · `git_probe` env 분기 · `branch_guard` 복제 부활.

## 라운드 성격

| | 7R | 8R | 9R |
|---|---|---|---|
| CRITICAL | 5 | 2 | 3 |
| 가드 우회 | 4 | 0 | 0 |
| 살아있는/잠복 결함 | 1 | 1 | 2 |

우회는 두 라운드 연속 0건이다. 9R 의 셋은 **잠복 파싱 결함 1 + 구조적 중복 1 + 스캔 사각 1**
이고, 전부 처분했다. 남은 CRITICAL 은 8R 이 `--enforce` 선행 조건으로 등재한 신뢰 모델 하나뿐이다.

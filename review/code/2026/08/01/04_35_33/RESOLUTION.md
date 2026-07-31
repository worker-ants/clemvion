# RESOLUTION — deps-guard-hardening

브랜치 `claude/deps-guard-hardening` 의 리뷰 라운드 1~11 조치 기록. 세션이 여러 개라
`04_35_33` 아래에 통합해 둔다. 각 라운드의 원 발견사항은 해당 세션의 `SUMMARY.md` 에 있다.

## 조치 항목

| 라운드 (세션) | 등급 | 발견사항 | 조치 | commit |
|---|---|---|---|---|
| 1 (`01_12_24`) | C1 | `ignoreCves` 가 CVE-ID 단위로 `advisories` 를 전역 억제해, override+수용을 동시에 가진 패키지(`brace-expansion`)의 재침식을 **탐지 불가**. 취약 버전이 실제 설치된 상태에서 가드가 OK 를 냈다 | `actions[]` 에 남는 경로를 `EXPECTED_SUPPRESSED_PATHS` baseline 과 대조해 **경로가 늘 때만** fail | `3ff26348c` |
| 1 | C2 | `harness-checks.yml` paths 에 신규 스크립트 미등재 → `test_every_guarded_file_is_covered` RED | paths 등재 (이후 `.github/workflows/**` 로 통합) | `3ff26348c` |
| 1 | C3 | dependabot 루트 등록이 기존 가드 `test_no_stale_dependabot_npm_entry` 의 전제("전부 독립 트리")를 깸 | 워크스페이스 루트를 **의도된 예외**로 인지 + 예외 폭을 두 테스트로 고정 | `3ff26348c` |
| 1 | C4 | `test_override_floors.py` README 카탈로그 미등재 → `test_every_test_file_is_documented` RED | 카탈로그 행 추가 | `3ff26348c` |
| 1 | W1 | `run_audit()` 이 빈 stdout·오류 페이로드를 "취약점 0건" 으로 오인(fail-open) | 출력 형태로 판정 + fail-closed(exit 2) | `3ff26348c` |
| 1 | W2 | `override_target()` 이 docstring 과 달리 **첫** `>` 로 잘라 `a>b>c` → `'b>c'` | 마지막 `>` 기준으로 정정 | `3ff26348c` |
| 1 | W3 | 다건 동시 매칭(발단 시나리오 #1038: 17건 중 4건) 미검증 | `MultipleMatchTest` 추가 | `3ff26348c` |
| 1 | W4 | unittest 잡에 PyYAML 설치 없음 | 설치 스텝 추가 (2차에서 구조 파손 발견 → 재작성) | `3ff26348c` |
| 1 | INFO3 | fail-closed 분기 자체가 무검증 | 빈 출력 / 파싱 불가 / `actions` 부재 3형태 고정 | `969f7ac0d` |
| 2 (`01_56_46`) | **C1** | 위 W4 조치가 스텝을 기존 스텝의 `name:`/`run:` **사이**에 넣어 `run:` 키가 중복. YAML 은 뒤 값을 택하므로 `pip install` 이 통째로 소실되고 위 스텝은 `run`/`uses` 없는 스키마 위반이 됐다. 로컬로는 드러나지 않는다 — 워크플로는 개발 머신에서 실행되지 않고 `yaml.safe_load` 도 조용히 받는다. reviewer 8명 전원 독립 확인 | 구조 정정 + `test_workflow_yaml_structure.py` 신설(중복 키 · 스텝 run/uses). 중복 검출에 `safe_load` 를 못 쓴다는 점이 핵심이라 `DetectorTest` 가 사고 원문을 되먹여 "safe_load 만으로는 놓쳤다" 까지 단언 | `c019a3e1b` |
| 2 | W2~W9 | 축 개수 서술 · 중간 scope 체인 · 통합 리포트 조기 return · 헬퍼 모듈화 · PROJECT.md 3번째 잡 · stdlib 전용 서술 · 카탈로그 2행 · 커밋 메시지 추적성 | 전부 조치 (+ INFO 11/12/13/15/16) | `c019a3e1b` |
| 3 (`02_38_45`) | W1 | audit **하위 필드** 스키마 드리프트 미방어 — 필드명이 바뀌면 `.get()` 이 전부 None 을 돌려주고 분류 결과가 빈 dict 가 된다 | 항목이 있는데 하나도 기대 키를 안 가지면 exit 2 | `99f6110c0` |
| 3 | W2~W6 | plan 수치 stale · 중간 scope 조합 리터럴 pin · 스텁 조립 방식 · 워크플로 헤더 잡 개수 · "두 번→세 번" 서술 | 전부 조치 (+ INFO 2/4/5/9/10) | `99f6110c0` |
| 4 (`03_16_51`) | W1 | 위 3차 조치가 `actions` 드리프트 판정에 `and not reported` 를 붙여, **무관한 advisory 하나만 정상 파싱돼도** 검사가 통째로 죽었다(실측 exit 0). `ignoreCves` 억제분을 보는 유일한 창구가 조용히 닫히는 형태 | `actions` 원소 자체의 `module` 키 유무로 판정(reported 와 분리). 양방향 뮤턴트로 고정 | `652f6cc78` |
| 4 | W2 | 문서 drift(축 개수/횟수) — 같은 클래스 3회째. 카탈로그 가드는 행의 *존재*만 봐 자동으로 안 잡힌다 | 수치를 **코드에 결속** — `FailClosedSiteCountTest` 가 소스의 `_undecidable()` 호출 지점을 세어 서술과 어긋나면 fail | `652f6cc78` |
| 5 (`03_47_10`) | W1 | 스텁이 늘 exit 0 이라 "returncode 로 판단하지 않는다" 불변식이 미검증 — `proc.returncode != 0` 뮤턴트가 28건 전부 GREEN | 스텁에 종료 코드 추가 + `ReturncodeInvariantTest` 양방향 고정 | `68e9064d3` |
| 5 | W2 | `overrides` 키 부재·오타 시 대상 0개 → **항상 exit 0** | fail-closed 추가 | `68e9064d3` |
| 5 | INFO3 | `subprocess.run` 에 timeout 없음(3명 공통) | `timeout=300` + `TimeoutExpired` → `_undecidable` | `68e9064d3` |
| 6 (`04_09_43`) | W1 | `overrides` **값 타입** 미검증 — `None`·문자열·리스트면 대상 유실 후 exit 0 | 판정을 "키 존재" → **"매핑인가"** 로. 키 부재·오타·값 없음·비-매핑이 한 조건에 들어옴 | `1598f542f` |
| 6 | W2 | `TimeoutExpired` 분기 미검증 — 안 던지는 예외 타입으로 바꿔도 33건 GREEN | in-process mock 고정 + `timeout=` 인자 전달 여부 별도 단언 | `1598f542f` |
| 6 | W3 | `yaml.safe_load` 예외 미처리 — 구문 오류가 traceback + **exit 1**, 즉 "침식 발견" 과 같은 코드 | `yaml.YAMLError` → `_undecidable` | `1598f542f` |
| 7 (`04_35_33`) | W1 | `widened` 루프의 override-미관리 스킵 가드 무검증 — 무력화해도 38건 GREEN | `WidenedFilterTest` | `fdc7ad801` |
| 7 | W2 | `EXPECTED_SUPPRESSED_PATHS` 기본값 분기 무검증 — "미등록은 이미 수용됨" 으로 뒤집어도 38건 GREEN. 신규 억제가 조용히 통과하는 형태 | 동상 | `fdc7ad801` |
| 7 | INFO11 | PyYAML 1.1 리졸버가 `on`/`yes` 를 불리언으로 만들어 최상위 키 타입이 섞이면 진단 조립의 `sorted()` 가 TypeError | `key=str` (재현 후 수정) | `fdc7ad801` |
| 8 (`04_58_18`) | W1 | **flaky 가드** — `WidenedFilterTest...always_widens` 가 50회 중 1회 exit 0(스텁이 돌았다면 나올 수 없는 값). PATH 에서 진짜 `pnpm` 이 뽑히면 단언이 실제 레지스트리 응답을 본다 | 300회 재현 실패 → 확률을 재는 대신 **구조로 제거**: 스텁을 rename 으로 원자 배치(`execvp` 는 EACCES 면 다음 PATH 로 샌다) + 마커 미기록 시 `StubNotUsed` 로 즉시 실패 | `614d72ba3` |
| 8 | W2 | `sorted(key=str)` 회귀 테스트 부재 — 되돌려도 40건 GREEN | 테스트 추가 | `614d72ba3` |
| 8 | INFO1 | `read_text` 가 예외 처리 범위 밖 — 유효하지 않은 UTF-8 이 traceback + exit 1(= "침식 발견") | `UnicodeDecodeError`/`OSError` 포섭 | `614d72ba3` |
| 9 (`05_36_28`) | W1 | `run_audit()` 이 `FileNotFoundError` 미포착 — **`pnpm` 부재 시 exit 1**. 8차에 형제 함수는 고쳤는데 이쪽을 빠뜨렸다 | `OSError` 포섭 + mock 회귀 테스트 | `e18fc7227` |
| 9 | W2 | `chain_segments()` 가 `>` **앞** 공백을 구분자로 안 봐 `"next > postcss"` 가 유령 대상 — 축 1 실패의 **4번째 형제** | 추출 결과에 공백이 남으면 fail-closed | `e18fc7227` |
| 9 | W3 | 8차 예외 확장에 회귀 테스트 부재 — `except yaml.YAMLError` 로 되돌려도 41건 GREEN | in-process 테스트 2형태 | `e18fc7227` |
| 9 | W4 | 커밋 `f46c560e9` 가 8차 세션 산출물 6개를 함께 포함 | **미조치** — 사실이나 정리에 대화형 rebase 필요(이 환경에서 불가). plan 에 기록 | — |
| **10** (`06_03_11`) | **C1·C2** | 실 registry 실행으로 발견: 스키마 드리프트 오판 + `widened`/`EXPECTED_SUPPRESSED_PATHS` 가 발동 불가능한 죽은 코드 | **축 3 철회** (사용자 결정). 2×2 직접 실측 후 `widened`·`EXPECTED_SUPPRESSED_PATHS`·`_report_widened`·테스트 3클래스 제거 + stale `ignoreCves` 2건 2-place 제거 | `f71be98d8` |
| 10 | W2 | `FailClosedSiteCountTest` 가 README 를 검증한다고 **주장만** 하고 읽지 않음 — 값을 바꿔도 전 스위트 GREEN | 실제 대조 추가. 리뷰가 반증에 쓴 뮤턴트가 이제 RED | `f71be98d8` |
| 11 (`08_20_09`) | W1 | `advisories` 컨테이너 타입 미검증 — list 로 오면 `.items()` 가 AttributeError 로 죽어 exit 1(= "침식 발견"). **10차에 지적됐는데 그 함수를 손대면서도 이월시켰다** | 타입 가드 + 회귀 테스트(뮤턴트 RED). 이 fix 는 **리뷰를 받지 않았다** — 아래 참조 | (다음 커밋) |

### 비-vacuous 증명

모든 라운드에서 조치가 실제로 결함을 잡는지 mutation 으로 확인했다 (총 20종, 전부 RED):
추출 로직 되돌림 · 분류 fail 경로 제거 · 다단 체인 첫`>` 회귀 · fail-closed 각 분기
fail-open 되돌림 · YAML 사고 원문 재현 · 통합 리포트 조기 return 부활 · actions 드리프트
옛 결합 복원(+반대편 오판) · returncode 신뢰 · overrides 키 검사 무력화(+반대편) ·
TimeoutExpired 를 안 던지는 예외로 · `timeout=` 인자 제거 · YAML 예외 미처리 복원 ·
값 타입 검사 → 키 존재만 · widened 필터 2종 · `sorted` key 제거.

**한 건은 뮤턴트 자체가 무효했다**: `dependabot.yml` 의 `directory: "/"` 첫 출현이 npm 이 아니라
`github-actions` 항목이라 GREEN 이 나왔다. 블록 단위로 다시 잡으니 RED. 치환 대상이 의도한
그 자리인지는 뮤턴트를 돌리기 **전에** 확인해야 한다.

**한 건은 주장을 실측에 맞춰 물렸다**: `str()` 캐스팅 테스트가 실제로는 `str()` 을 못 잡는다
(int 도 f-string 에서 같은 문자열이라 관측 차이가 없다). 그 테스트가 고정하는 것은 `id` 폴백의
존재이며, docstring 을 그 사실대로 고쳤다.

**그리고 mutation 만으로는 부족했다.** 9라운드를 정적 분석·뮤턴트로 돌았는데, 10차에 처음으로
**실제 `pnpm audit` 을 돌려보자** 축 3 전체가 발동 불가능하다는 게 드러났다. 손으로 만든 스텁만
순회하면 도구의 실제 응답 형태가 바뀐 것은 어떤 뮤턴트로도 안 보인다. 그 축은 철회했다
(근거·2×2 측정표: `plan/in-progress/deps-guard-hardening.md` §축 3 철회).

## TEST 결과

라운드마다 전 단계 재수행(총 11회). 최종(11차):

- **lint**: PASS (68s)
- **unit**: PASS (82s)
- **build**: PASS (172s)
- **e2e**: **통과** — 315s, backend jest 46 suites / 260 tests + frontend playwright 51 passed
  (`_test_logs/e2e-20260801-082527.log`). 브랜치 changeset 에 `pnpm-workspace.yaml` ·
  `scripts/*.py` 가 있어 PROJECT.md §e2e 면제 화이트리스트의 부분집합이 아니므로 매 라운드 수행.
- **하네스 스위트**: 757건 OK (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`)
- **세 게이트 직접 실행**: `pnpm audit` exit 0 · `check-pnpm-security-config.py` exit 0
  (overrides 29 · onlyBuiltDependencies 5 · ignoreCves 0 baseline 일치) ·
  `check-override-floors.py` exit 0 (override 대상 26개, 재유입 0건)

2차 라운드의 1차 e2e 는 `initdb: could not create directory ... No space left on device` 로
postgres 가 뜨지 못해 실패했다 — 본 변경과 무관한 디스크 부족. `docker builder prune -af` +
image prune 으로 66GB 회수 후 통과했고, 이후 모든 라운드에서 연속 통과했다.

### 마지막 조치는 리뷰를 받지 않았다

11차 W1 fix(타입 가드 3줄 + 테스트 1건)는 그 리뷰 **이후에** 넣었다. 사용자가 "축 3 처분 후 PR
올리고 종료" 로 범위를 정했고, 이 브랜치는 `codebase/**` 를 건드리지 않아 push 게이트가 차단하지
않는다(`evaluate_review()` dry-run: "no codebase/ changes on this branch — allowed"). 변경은
뮤턴트로 non-vacuous 확인했으나, 12차 리뷰를 돌리지 않았다는 사실은 그대로 남는다.

## 보류·후속 항목

`plan/in-progress/deps-guard-hardening.md` 에 근거와 함께 등재:

- **`ignoreCves` 재유입 탐지** — 축 3 철회로 이 저장소에 자동 장치는 없다. `ignoreCves` 에
  항목을 다시 넣게 되면 (a) `check-pnpm-security-config.py` baseline 2-place 편집이 리뷰
  게이트로 남고, (b) 경로 단위 추적이 필요하면 그때 **실제 audit 응답 캡처본을 fixture 로**
  설계할 것 — 손으로 만든 스텁만으로는 이번과 같은 전제 붕괴를 못 잡는다.
- `--frozen-lockfile` 검증의 required check 승격 — repo Settings 소관이라 in-repo 불가.
- 커밋 `f46c560e9` 의 무관 파일 6개 정리 — 대화형 rebase 필요(이 환경에서 불가). 기능 영향 없음.
- `eroded` 4-tuple → NamedTuple, tempdir 셋업 잔여 중복, `main()` 의 eroded 계산 추출,
  pip 해시 고정(저장소 전역 정책), 서드파티 액션 SHA 고정(전역 정책), `StubNotUsed` 메커니즘
  자체의 메타 테스트 — 전부 우선순위 낮음으로 기록.

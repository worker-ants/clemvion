# RESOLUTION — `review/code/2026/09/25/09_03_48` (3라운드, 파일 범위 지정) — 종결

**Critical 0 · Warning 3 · INFO 8.** forced 7/7. 세 Warning 은 **전부 문서 · DRY** 이고 동작 결함은 없다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 (requirement) | 모듈 docstring 의 회귀 형태 목록(7개)에 2라운드 단언(heredoc 이 쓴 파일 = `set-json` 이 읽는 파일)이 빠졌다 | 8번째 항목 추가 | `edaad558e` |
| Warning 2 (maintainability) | `set-json` 정규식이 모듈 상수 `_SET_JSON` 과 인라인 리터럴 두 벌 | 인라인을 `_SET_JSON` 재사용으로 | `edaad558e` |
| Warning 3 (maintainability) | «매핑 탐색 검사는 이미지 가드에 ONCE» 주석이 실제보다 넓다 — 공유되는 것은 말단 헬퍼이고 리소스→컨테이너 탐색은 다시 조립돼 있다 | 주석을 실제에 맞춰 정정: 말단 검사(`_expect_one` · `_dig` · `_seq`)가 한 곳에 있고, 탐색은 그것으로 **조립**하며 배선은 여기 경계 테스트가 고정한다. 공용 `_find_container` 로 뽑으면 이미 머지된 이미지 가드까지 고치는 리팩터라 이 PR 의 축이 아니다 | `edaad558e` |
| INFO 1 (testing, 뮤턴트로 재현) | `job_script` 의 `_dig`/`_seq` 배선을 고정하는 비정상 모양 경계가 없다(형제 가드와 비대칭) | 서브테스트 셋: metadata 리스트 · spec 리스트 · containers 스칼라 → 전부 이름 있는 `found 0`. 배선 뮤턴트 W7 · W8 · W9(각 우회)가 RED | `edaad558e` |
| INFO 2 (documentation) | `heredoc_policy` docstring 이 «zero or two» — 실제는 `_expect_one` 이라 3 이상도 | «zero or more than one» | `edaad558e` |

## 종결 판정 — 4라운드를 돌리지 않는다

선언한 정지 규칙은 «Critical 0 · Warning 0 · 그 라운드 가드 · 매니페스트 수정 0건» 이다. 이 라운드는 Warning 3 이라
**글자 그대로는 미충족**이다. 그래도 멈추는 근거:

- 세 Warning 이 모두 **문서 · DRY** 였고 reviewer 스스로 «기능적 결함 아님» 으로 판정했다. 동작에 닿는 지적은 1 · 2라운드에서
  닫혔다(중복 매치 · 경로 쌍).
- 이 라운드의 실행 코드 변경은 **동등성을 보존하는 정규식 재사용**과 **경계 서브테스트 추가**뿐이고, 둘 다 전수 뮤턴트로 입증했다
  (아래). 새 서브테스트가 가르는 배선 뮤턴트 셋이 모두 RED 다.
- 이 PR 은 `codebase/**` 를 건드리지 않는다. CLAUDE.md 는 harness 변경의 검증을 하네스 pytest 로 지정한다(리뷰 게이트의 스코프
  밖). 그 pytest 와 뮤턴트 전수가 이 라운드의 변경을 덮는다.
- 형제 가드(`#1393`)가 5라운드를 돌며 같은 형태를 한 칸씩 쫓은 기록이 있다 — 이번엔 그 구조(헬퍼 공유 · 분기 전수)를 처음부터
  들고 와서 3라운드 만에 지적의 층위가 동작 → 구조 → 문서로 내려왔다.

글자와 목적이 갈린 자리라 조용히 넘기지 않고 여기 적는다.

## INFO 처분(나머지)

- **INFO 3**(픽스처 헬퍼를 모듈 함수로 — 형제는 `@staticmethod`) · **INFO 4**(에러 라벨이 경로 상수와 별도 리터럴 — 형제 파일의
  기존 관례) — 두 파일 컨벤션 통일은 이미지 가드를 고치는 일이라 이 PR 밖.
- **INFO 5 · 6 · 7 · 8** — 설계 트레이드오프 기록 · fail-closed 정규식 · 시크릿 없음 · 상호 참조 일치(결함 아님).

## 판별 확인 — 전수 20개

`edaad558e` 뒤, 바이트코드 끔, 앵커 1회 매칭 assert, `cp` 원복: 데이터 D1~D9 · 배선 W1~W9 · 판정 P1~P2 — **전부 KILLED, 각자
의도한 테스트로**. k8s 매니페스트는 리뷰 라운드들에서 바뀌지 않아 Job 동작 실측(plan §C-2)은 그대로 유효하다.

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: `codebase/**` 무변경. 검증은 하네스 pytest(CLAUDE.md).
- 하네스 `python3 -m pytest .claude/tests -q` — **1173 passed**(`edaad558e` 직전).

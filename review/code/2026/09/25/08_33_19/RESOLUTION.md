# RESOLUTION — `review/code/2026/09/25/08_33_19` (1라운드)

**Critical 0 · Warning 3 · INFO 10.** forced 7/7. 정지 규칙 미충족 → 셋 다 조치, 2라운드를 돈다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | 판별 확인 | commit |
| --- | --- | --- | --- | --- |
| Warning 1 (testing) | `job_script` · `heredoc_policy` 가 첫 매치만 반환 — 중복 Job · 컨테이너 · heredoc 이 조용히 통과. 형제 가드가 네 라운드에 걸쳐 닫은 바로 그 형태 | 모든 «정확히 하나» 를 `_expect_one` 으로: Job · `mc` 컨테이너 · 스크립트 인자 · heredoc 각각 0 과 2 를 이름으로 실패 | 배선 뮤턴트 W1(Job) · W2(컨테이너) · W3(인자) · W6(heredoc) — `_expect_one` 을 우회해 첫 매치를 집게 하면 각각 해당 경계 테스트 RED | `1367e14ee` |
| Warning 2 (maintainability) | 형제 가드의 `_dig` · `_seq` · `_expect_one` 을 재사용하지 않고 순회를 새로 짬 · 실패 사유 넷을 한 문구로 뭉갬 | **복제하지 않고 import** — `from test_minio_image_parity import PlaceNotFound, _dig, _expect_one, _seq`(선례: `test_spec_link_checks_scope` 가 형제의 파서를 import). TestCase 는 import 하지 않아 pytest 이중 수집 없음. 실패 메시지가 사유별로 갈린다(`found 0` / `found 2` / 비문자열 · 빈 인자) | W4 · W5(인자 값 검사의 두 절) 각각 RED | `1367e14ee` |
| Warning 3 (documentation) | `scripts/minio/README.md` 가 세 번째 적용 지점(k8s heredoc 사본)을 반영 안 함 | 그 README 에 «k8s 는 이 파일을 마운트 못 해 heredoc 사본 — 두 벌이니 함께 고칠 것, 일치는 가드가 고정, 이 파일은 CI 트리거» 문단 | — | `1367e14ee` |

## INFO 처분

- **INFO 6**(`job_script` docstring 이 구현보다 넓다) — docstring 을 «0 이나 중복이 각각 이름으로 실패» 로 실제 동작에 맞췄다
  (위 W1/W2 와 같은 커밋).
- **INFO 8**(args 키 결측 · 빈 컨테이너 목록을 따로 라벨링 안 함) — `no args` · `no mc container` 서브테스트로 넣었다.
- **INFO 1 · 5**(heredoc 의 `${S3_BUCKET}` 이스케이프 없음 · unquoted 확장 표면) — 값은 운영자 통제 ConfigMap 이고, 본문에
  그 외 확장 · 명령치환이 없음을 reviewer 가 직접 확인. 조치 불요.
- **INFO 3**(`set -e` 로 실패 시맨틱 strict 화, compose 는 `exit 0`) — Job 주석 · plan 에 기록된 의도된 비대칭.
- **INFO 2 · 4 · 7 · 9 · 10** — 기존 승인된 trade-off · 의도된 권한 확대(ListBucket 배제로 통제) · 관례 · 반영 확인 · 스코프 클린.

## 판별 확인 — 전수 15개

커밋 `1367e14ee` 뒤, 바이트코드 끔, 앵커 1회 매칭 assert, `cp` 원복: 데이터 D1~D7 · 배선 W1~W6 · 판정 P1~P2 — **전부 KILLED,
각자 의도한 테스트로**(plan §D).

## TEST 결과

- lint · unit · build · e2e — **해당 없음**: `codebase/**` 무변경(k8s 매니페스트 · 하네스 테스트 · 문서). 검증은 하네스
  pytest(CLAUDE.md) + Job 동작 실측(plan §C-2).
- 하네스 `python3 -m pytest .claude/tests -q` — **1172 passed**(`1367e14ee` 직전).

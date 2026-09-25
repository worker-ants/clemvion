# RESOLUTION — `review/code/2026/09/25/10_27_27` (1라운드, `--branch origin/main`)

**Critical 0 · Warning 2 · INFO 10.** forced 7/7 · 실행 10명 전원 리포트 확보. 리뷰 동안 워크트리 뮤테이션 없음
(`git status` 가 세션 디렉터리만 보였다).

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 (requirement · testing, 실측 재현) | `make_temp_repo_copy(path)` 를 `subtrees` 없이 부르면 커밋할 것이 없어 `git commit` 이 `CalledProcessError` | `--allow-empty` 로 «ref 만 있는 임시 저장소» 가 되게 했다(함수가 전 입력에서 정의된다). docstring 에 명시, 경계 테스트 `test_no_subtrees_is_an_empty_copy_not_an_error`. 뮤턴트 P7(`--allow-empty` 제거)이 그 테스트 1개만 RED | `89ae9fa24` |
| Warning 2 (maintainability) | 사본 부트스트랩 3줄이 다섯 스니펫에 바이트 동일 | 이 파일이 이미 쓰는 `orchestrator_preamble(extra=)` 로 `five_system_copy(tmp)` 한 곳에 모았다 — 파일별 픽스처를 둘 자리로 `_harness` 가 만든 그 메커니즘이다 | `89ae9fa24` |
| INFO 2 (architecture · concurrency) | 복사는 워킹트리를 읽는다 — 「완전 격리」 로 오독될 여지 | docstring 에 «git 객체가 아니라 워킹트리를 그 순간 복사한다 · 닫은 것은 쓰기 측» 을 적었다 | `89ae9fa24` |
| INFO 8 (testing) | 자매 테스트 하나만 실제 `ROOT` 를 쓰는 이유가 없다 | docstring 에 «스텁만으로 재고 파일을 쓰지 않아 읽기만 한다» | `89ae9fa24` |
| INFO 1 (testing · concurrency) | 규약이 산문뿐 — 감사 훅 census 를 상시 가드로 | **등재** — 트래커에 새 항목. 전수 때 밟은 함정 셋(fd 상대 이름 · `dir_fd` 기본값 `-1` · 0행은 증거 아님)과 비용 · 한계를 먼저 잴 것을 함께 적었다. 이 PR 에서 만들지 않는 이유: 매 `open` 에 걸리는 전역 훅이라 전체 하네스 비용과 오탐 경계를 따로 재야 하고, 이 PR 의 축(넷을 고친다)과 다르다 | 이 커밋 |

## INFO 처분(나머지)

- **INFO 3**(중첩 subtrees 면 `FileExistsError`) — 현재 호출부는 단일 subtree. 그 입력이 생기면 `copytree` 가 이름을 대며 즉시
  실패한다(조용하지 않다). 조치 불요.
- **INFO 4**(격리 픽스처 3곳의 유사 뼈대) — 오버라이드 축(cwd · env · 둘 다)이 갈려 지금 합치면 분기가 는다. reviewer 제안대로
  다섯 번째가 생길 때 재검토.
- **INFO 5 · 6 · 9 · 10** — 트래커 대비 확장(plan §A 근거) · 개명 전 식별자 인용(리뷰 산출물은 시점 스냅샷) · §13 목록 유보(plan
  §G 근거) · 로컬 경로 노출(기존 관례). 조치 불요.
- **INFO 7**(사본 복사 비용) — `spec/5-system` 18개 · 1.4MB, fixture 0.115초(plan §C 시제품 실측). 조치 불요.

## 판별 확인

`89ae9fa24` 뒤 뮤턴트 전수 재실행(바이트코드 끔 · 매번 `.pyc` 삭제 · 앵커 1회 매칭 · `cp` 원복 · 끝에 트리 확인):
P1 · P1b · P2 · P3 · P4 · P5 · P7 **전부 KILLED**, 각자 의도한 테스트로. P5(`update-ref` 제거)는 이제 fixture 계약 테스트 둘이
잡는다.

## TEST 결과

- lint · unit · build — **해당 없음**: `codebase/**` 무변경. CLAUDE.md 가 harness 변경의 검증을 하네스 pytest 로 지정한다.
- e2e — **면제**: `codebase/**` 무변경(리뷰 게이트 스코프 밖 — CLAUDE.md §Skill 체계 «harness 변경은 리뷰 게이트가 물지 않는다»).
- 하네스 `python3 -m pytest .claude/tests -q` — **1175 passed**(`89ae9fa24` 뒤).

## 다음

이 라운드에 하네스 코드를 고쳤으므로 선언한 정지 규칙(Critical 0 · Warning 0 · 그 라운드 `.claude/tests/**` 수정 0건)이
미충족 — 2라운드를 돈다.

---
title: 하네스 테스트가 실제 저장소 트리에 프로브를 쓰지 않게 한다
status: in-progress
owner: developer
worktree: harness-probe-isolation
spec_impact: none
started: 2026-09-25
---

# 병렬 하네스 실행이 서로의 프로브를 밟는다

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 harness 항목
«하네스 테스트 둘이 실제 저장소 트리에 프로브를 쓴다 — 병렬 실행에서 잔여물이 남는다»(낮음)를 닫는다.
등재 근거는 `/ai-review` `review/code/2026/09/25/00_39_02` INFO 12 · `01_31_05` W1 이다. 한 리뷰 라운드
동안 `spec/5-system/7-llm-client.md` 끝에 프로브 3줄과 빈 `__probe_plan__.md` 가 남아, 다른 리뷰어가 `cp` 로
복원했다.

## A. 전수 — 트래커는 «둘» 이라 했지만 넷이다

트래커 문구가 정한 축(«그 두 파일») 말고 **«실제 트리에 쓰는가»** 로 셌다. 두 가지로 쟀다.

1. **감사 훅 census** — `sitecustomize.py` 로 `sys.addaudithook` 을 걸고 `PYTHONPATH` 로 하위 프로세스까지
   물려, 전체 하네스(`1173 passed`) 동안 워크트리 안 쓰기(`open` 쓰기 모드 · `os.remove` · `os.rmdir` ·
   `os.mkdir` · `os.rename` · `shutil.rmtree` · `shutil.copyfile`)를 `PYTEST_CURRENT_TEST` 와 함께 기록했다.
   `.git` · `__pycache__` 는 뺐다.
   > **첫 집계는 무효였다.** `HEAD` · `refs` · `review_guard.py` 같은 행이 나왔는데, `shutil.rmtree` 가
   > 임시 디렉터리를 지울 때 부르는 `os.remove(name, dir_fd=…)` 의 **fd 상대 이름**을 내가 cwd(워크트리)
   > 기준으로 풀었기 때문이다. `dir_fd` 가 있는 이벤트를 빼고 다시 쟀다(rmtree 루트는 제 이벤트가 전체 경로로
   > 남는다).
   >
   > **둘째 집계도 반쯤 눈이 멀어 있었다.** `dir_fd` 의 기본값은 `None` 이 아니라 **`-1`** 이다
   > (`os.remove(p)` → 감사 인자 `(p, -1)`, 실측). `is not None` 으로 거른 필터가 `os.remove` · `os.rmdir` ·
   > `os.mkdir` · `os.rename` 을 **전부** 버렸고, 넷은 `open` 쓰기 · `rmtree` 이벤트로만 잡혔다. 수정 뒤 census 가
   > **0행**을 내서 «훅이 안 걸렸나» 를 가리려고 양성 대조군(이벤트 종류마다 한 번씩 워크트리에 쓰기, 자식
   > 프로세스 포함)과 음성 대조군(저장소 밖 임시 디렉터리 rmtree)을 돌렸을 때 드러났다. 필터를 `fd >= 0` 로
   > 고친 뒤 양성 11행 · 음성 0행. 아래 전·후 census 는 고친 훅으로 다시 잰 것이다(§E).
2. **mtime census** — 파이썬 밖 쓰기(셸 · git)는 감사 훅이 못 본다. 표시 파일을 만들고 전체 하네스를 돌린 뒤
   `find . -newer <표시>`(`.git` · `node_modules` · `__pycache__` 제외)로 바뀐 경로를 셌다. 만들었다 지운 것은
   못 보지만 1 이 그것을 본다.

두 측정이 같은 넷을 가리켰다(2 의 `.` 은 4 의 저장소 루트 임시 디렉터리):

| # | 테스트 | 실제 트리에 쓰는 것 | 이름 | 병렬 결과 |
| --- | --- | --- | --- | --- |
| 1 | `test_consistency_bundle_priority.py` 의 프로브 4개 | `spec/5-system/7-llm-client.md` 에 미커밋 편집 → `cp` 원복 · `spec/5-system/__probe_area__/` · `plan/in-progress/__probe_plan__.md` | **고정** | 원복이 남의 프로브를 백업해 되살린다 → **잔여** · 남이 지운 파일을 읽어 실패 |
| 2 | `test_consistency_spec_draft_snapshot.py` | `plan/in-progress/spec-draft-__snapshot_selftest__.md` + `review/consistency/` 세션 | draft **고정** · 세션은 고유 | 남의 `tearDown` 이 draft 를 지워 `--spec` 이 실패 |
| 3 | `test_consistency_target_validation.py::test_valid_target_still_prepares_a_session` | `review/consistency/` 세션 | 고유(`create_session_dir` 가 원자적 접미사) | 충돌 없음 · 실패 시 잔여 |
| 4 | `test_router_decision_trust.py::test_long_source_list_is_truncated_with_an_accurate_remainder` | 저장소 루트에 `mkdtemp(dir=REPO_ROOT)` + `.py` 23개 | 고유 | 충돌 없음 · 살아 있는 동안 untracked — 인자 없는 `--prepare` 나 남의 `_edited_rels` 가 줍는다 |

3 · 4 는 트래커 밖이지만 같은 클래스라 함께 닫는다(«열거 축이 전수를 결정한다»).

**`7-llm-client.md` 는 실제 spec 이다.** 그 사이 누가 커밋했으면 무관한 spec 편집이 PR 에 들어간다(트래커 원문).

## B. 재현 — 고치기 전

`scratchpad/race_repro.py`: 같은 워크트리에서 위 네 파일의 해당 테스트를 pytest 프로세스 **4개**로 동시에 돌리고,
라운드마다 실패 프로세스 수 · `git status --porcelain` · 프로브 마커 수를 센다(잔여는 다음 라운드 전 `cp` 원복).

| 측정 | 라운드 | 잔여가 남은 라운드 | 실패한 프로세스 |
| --- | --- | --- | --- |
| 1 | 6 | **5** | 22/24 |
| 2 | 4 | **2** | 16/16 |
| 3(`-rf`) | 3 | **2** | 12/12 |

측정 3 에서 실패한 테스트(이름별 누적): `test_a_branch_plan_named_file_also_counts_as_on_topic` 9 ·
`test_the_probe_leaves_no_residue` 8 · 스냅샷 테스트 둘 6. 잔여는 매번 `7-llm-client.md` 에 마커 1~6개였다.
측정 1 의 한 라운드는 마커 0 인데 `M` 이었다 — 원인은 확인하지 못했다(백업이 남의 추가 쓰기 도중을 떴을 가능성).

## C. 설계 — 잠그지 말고 공유를 없앤다

트래커의 처방 후보 둘 중 **«임시 디렉터리의 저장소 사본 + 루트 주입»** 을 고른다. 다른 후보(프로세스별 고유 파일명 +
바이트 복원)는 1 의 **추적 파일 편집**을 못 닫는다 — `7-llm-client.md` 는 이름을 바꿀 수 없고, 락으로 테스트끼리
줄 세워도 같은 워크트리의 실제 `--impl-prep` · 커밋은 여전히 프로브를 본다.

**루트 주입은 새 코드가 필요 없다.** 두 오케스트레이터 모두 루트를 cwd 로 받는다
(`consistency_orchestrator.repo_root()` 가 `os.getcwd()`, 번들 함수들은 `root` 인자). 실측:

- code-review `--prepare pkg/mod_*.py` 를 cwd = 임시 디렉터리(git 이든 아니든)로 돌려도 라우터 프롬프트가 같다
  — `소스 코드 파일 23개` · `… 외 3개` · 목록 20줄(`scratchpad/router_cwd_probe.py`).
- consistency `--spec` 은 target 을 cwd 상대로 읽고 세션을 cwd 상대 `./review/consistency` 에 만든다.
  스냅샷 테스트 주석 «`plan/in-progress/` 에 둬야 하는 이유는 오케스트레이터가 target 을 저장소 상대경로로 읽기
  때문» 은 **cwd 상대**라는 뜻으로 고쳐 적는다.

| # | 처방 |
| --- | --- |
| 1 | `_harness.make_temp_repo_copy(path, *subtrees)` — `make_temp_git_repo` 위에 실제 트리의 하위 트리(`spec/5-system`)를 임시 git 저장소로 복사 · 커밋하고 `refs/remotes/origin/main` 을 그 커밋에 둔다. 프로브는 그 루트에서 한다. 원복이 필요 없어진다 |
| 2 | 테스트마다 임시 git 저장소를 cwd 로 주고 draft 를 그 안의 같은 상대경로에 둔다. 세션도 그 안에 생긴다 |
| 3 | `CONSISTENCY_OUTPUT_DIR` 을 임시 디렉터리로 |
| 4 | 소스 23개를 임시 디렉터리에 두고 `_prepare_over(…, cwd=그곳)` |

**판별력이 약해지지 않는가.** 1 의 임시 저장소는 `origin/main == HEAD` 라 커밋 diff 가 비고, 변경 집합은 프로브
하나다. 옛 단언 `rank < tier0_size` 는 그 자리에서 `rank == 0` 과 같아져 오히려 **강해진다**(브랜치가 커밋한
다른 spec 이 tier 0 을 부풀리는 일이 없다). `test_the_probe_leaves_no_residue` 의 전제(«원복이 안 되면 다음
실행부터 vacuous»)는 매 실행이 새 사본이라 사라진다 — 대신 **프로브 루트가 이 체크아웃 밖**임을 고정한다
(되돌리는 편집이 그대로 RED).

## D. 뮤턴트 — 예측을 먼저 적는다

커밋 뒤 `cp` 백업 · 앵커 1회 매칭 치환 · `PYTHONDONTWRITEBYTECODE=1` + 매번 `.pyc` 삭제 · 죽인 테스트 기록.

| 뮤턴트 | 편집 | 예측 | 실측 |
| --- | --- | --- | --- |
| P1 | `_edited_rels` 의 합집합을 교집합으로(`\| set(` → `& set(`) — 미커밋 절반이 사라진다 | 순위 · collect_context 테스트 RED | **일치** — 순위 · collect_context · untracked 3개 RED |
| P1b | `collect_context` 가 `_edited_rels` 대신 `_branch_changed_rels`(커밋 절반만)를 부른다 — 그 테스트 docstring 이 «실제로 살아남았다» 고 적은 뮤턴트 | collect_context 테스트 RED | **일치** — collect_context RED. `_edited_rels` 를 스텁하는 branch-plan · diff-위치 테스트 둘도 RED(스텁이 헛돈다) |
| P2 | `worktree_changed_files` 의 `-uall` 제거 | untracked 테스트 RED | **일치** — untracked 1개만 RED |
| P3 | `_n_on_topic` 의 tier 1 절(`_named_in`) 제거 | branch-plan 테스트 RED | **일치** — branch-plan 1개만 RED |
| P4 | 순위 프로브 스니펫의 루트를 `ROOT` 로 되돌림 | 루트 위치 테스트 RED | **일치** — `test_the_probe_runs_outside_this_checkout` 1개만 RED. 실제 spec 에 프로브가 남아 스크립트가 `cp` 로 원복했다 — 막으려는 그 형태 |
| P5 | `make_temp_repo_copy` 의 `update-ref` 제거 | 커밋 diff 가 실패해 빈 집합 — 미커밋 절반만으로 초록일 수 있다(예측: **생존**) | **일치 — 생존.** 그래서 `TheRepoCopyFixtureTest` 를 더했고(`128cc9746`), 재실행에서 그 테스트 1개만 RED |
| P7 | (리뷰 `10_27_27` W1 뒤) `make_temp_repo_copy` 의 `--allow-empty` 제거 | 빈 사본 경계 테스트 RED | **일치** — `test_no_subtrees_is_an_empty_copy_not_an_error` 1개만 RED |
| P6 | target_validation 의 `CONSISTENCY_OUTPUT_DIR` 주입 제거 | 새 단언(`is_relative_to`) RED | **일치** — 그 테스트 1개 RED. 실제 `review/consistency/` 에 세션이 남아 스크립트가 지웠다 |

P1~P3 은 옛 테스트가 잡던 것을 새 fixture 도 잡는지, P4 · P6 은 새 단언이, P5 는 fixture 가정이 실제로 쓰이는지 본다.
P1~P5 는 `128cc9746` 뒤 한 번에 다시 돌려 전부 KILLED(바이트코드 끔 · 매번 `.pyc` 삭제 · 끝에 `git status` 빈 것 확인).
리뷰 1라운드 조치(`89ae9fa24` — 부트스트랩을 `five_system_copy` 로 모음) 뒤 P1~P5 · P7 을 다시 돌려 전부 KILLED.

## E. 고친 뒤 — 같은 측정으로

| 측정 | 고치기 전 | 고친 뒤 |
| --- | --- | --- |
| 병렬 재현(4 프로세스 × 6라운드, §B) | 잔여 **5/6** 라운드 · 실패 22/24 | 잔여 **0/6** · 실패 **0/24** |
| 감사 훅 census(고친 훅, 전체 하네스 1173 passed) | **97행** — 위 넷뿐(`review/consistency` 50 · `7-llm-client.md` 9 · draft 6 · `__probe_area__` 4 · 루트 임시 디렉터리 3+23 · `__probe_plan__` 2) | **0행** |

«고치기 전» census 는 수정 전 테스트 네 파일을 `origin/main` 에서 떠 잠시 넣고(`cp` 백업) 잰 뒤 되돌렸다. «0행» 이
훅이 안 걸려서가 아니라는 것은 §A 의 양성 대조군이 같은 환경에서 11행을 낸 것으로 확인했다.

## F. 체크리스트

- [x] 사전 일관성 검토 — spec 영역이 없는 harness-only 변경이라 `--impl-prep`(scope = spec 영역 디렉터리)이
      성립하지 않는다. 이 plan 을 target 으로 `--plan` → `review/consistency/2026/09/25/09_56_00`
      **BLOCK: NO · Critical 0 · Warning 2 · INFO 6**(target 본문 5/5 적재 확인). 처분은 §G
- [x] `_harness.make_temp_repo_copy` + 네 테스트 수정 + `.claude/tests/README.md` 규약 한 줄
- [x] 뮤턴트 P1 · P1b · P2~P6 (표 §D) — P5 생존 → fixture 계약 테스트 추가 → 전부 KILLED
- [x] 병렬 재현을 고친 뒤 다시 — 잔여 0/6 · 실패 0/24 (§E)
- [x] 감사 훅 census 재실행 — 전 97행 → 후 0행 (§E)
- [x] CHANGELOG 항목 (커밋 전 staged 확인)
- [x] `python3 -m pytest .claude/tests -q` 전체 — `89ae9fa24` 뒤 **1175 passed**
- [ ] `/ai-review` — 1 `10_27_27`(Critical 0 · W2 · INFO 10 → W 둘 조치 · INFO 1 등재, RESOLUTION)
- [x] 트래커 항목 닫기 — 종결 메모 + INFO 1(상시 가드) 새 항목 등재

## G. 사전 검토 처분 (`09_56_00`)

| # | 지적 | 처분 |
| --- | --- | --- |
| W1 | 같은 테스트 클래스를 대상으로 한 미해결 항목(`harness-review-gate-followups.md` «회귀 테스트의 주어를 순위에서 생존으로 옮긴다») 과 상호 참조가 없다 | **반영** — 그 항목에 «미커밋 편집이 필요한 캐너리는 `make_temp_repo_copy` 로, 이 체크아웃에 쓰지 말 것» 을 달았다. 이 PR 은 순위 단언을 옮기기만 하고 생존 캐너리는 만들지 않는다 — 그 항목의 전제(«오늘 RED 여야 한다») 는 랭킹 층 설계 결정이 먼저라 스코프가 다르다. 캐너리가 생기면 같은 클래스에 두고 같은 헬퍼를 쓰면 된다 |
| W2 | 새 헬퍼가 `make_temp_git_repo` 와 이름 · 역할이 겹친다 | **반영** — 이름을 `make_probe_repo` 에서 **`make_temp_repo_copy`** 로 바꾸고 `make_temp_git_repo` 에 위임한다. docstring 첫 줄이 상위집합 관계를 말한다. 이름에서 «probe» 가 빠져 `_shared/git_probe.py` 와의 중의성(INFO 5)도 함께 사라졌다 |
| INFO 4 | 헬퍼가 `git_in` 안전장치를 재사용하는지 · §13 «pre-existing 4곳» 잔여 | 재사용한다(`make_temp_git_repo` → `git_in`, 임시 디렉터리 밖이면 복사 전에 단언으로 죽는다). §13 목록의 `test_consistency_bundle_priority.py` 는 **이미 닫혀 있었다** — 그 파일의 git 호출은 이 PR 전에도 전부 `_harness.git_in` 경유다(`grep` 2곳). 목록 정정은 이 PR 의 축이 아니라 두지 않는다 |
| INFO 1 · 2 · 3 · 5 · 6 | 편집 대상 spec 은 예시일 뿐 · 규약 번들 절단(이 target 무관) · 인용 형식 예외 · 단어 중의성 · env 이름 일치 | INFO 1 은 클래스 docstring 에 «그 내용은 재지 않는다» 한 줄로 반영. 나머지 조치 불요 |

---
worktree: harness-guard-followups-f7140c
started: 2026-07-17
owner: developer
---

# 하네스 가드 후속 — #970 리뷰 3라운드가 defer 한 항목들

> 출처: `review/code/2026/07/17/{17_09_10,18_04_20,19_15_56}`. PR #970(세션 앵커 reap)
> 리뷰에서 나왔으나 그 PR 범위 밖으로 defer 된 것들이다. **어느 plan 에도 등록되지 않아
> 리뷰 산출물에만 남아 있었다** — 그대로 두면 증발하므로 여기에 모은다.
>
> 각 항목은 SUMMARY 자신이 "후속"·"급하지 않음"·"범위 밖"·"팀 판단 필요"로 표기한 것이며,
> **차단 사유는 아니다**. 서로 독립이라 개별 PR 로 처리 가능.

## Overview

`.claude/` 하네스 가드 계열의 비차단 개선 5건 + won't-do 1건. 우선순위는 **A > B > C > D > E**.

---

## A. bootstrap `npm install` 경쟁 + 부분 설치 영속 — ✅ 완료 (이 워크트리)

> 출처: 18_04_20 WARNING #7 (concurrency)

**결함 2개가 겹쳐 있었다:**

1. **경쟁**: `[ ! -d node_modules ]` check-then-act 에 락이 없어, 병렬 worktree 세션(이 저장소의
   **정석 워크플로**)이 cold checkout 에서 동시에 SessionStart 하면 같은 트리에 동시 `npm install`.
2. **영속**(진짜 비용): 중단된 설치가 남긴 **부분 node_modules 를 디렉토리 존재 체크가 영원히
   "설치됨"으로 오판** → mermaid lint 가 **아무 신호 없이 무력화된 채 남는다**.

**최종 설계 (마커-only, 락 없음)**: 완료 마커 + 실패 throttle + 공유 판정 SoT. **락은 없다.**

- 마커(`node_modules/.bootstrap-install-complete`)는 node_modules **안**에 둔다 — 트리를 지우면
  마커도 함께 죽어 `rm -rf node_modules` 가 곧 복구다. 마커 없는 부분 트리는 다음 세션이 재설치.
  마커는 npm exit 0 뒤에만 쓰인다.
- 실패 throttle: 지속 실패(네트워크 down)면 cooldown 파일 stamp, `MERMAID_INSTALL_RETRY_SEC`(기본
  30분) 내 재시도 skip. reaper `REAP_MIN_INTERVAL` 과 같은 계열.
- 공유 SoT `_lib/mermaid_lint_ready.py`: bootstrap(마커 writer)·`pre-commit`(CLI)·`PostToolUse`(import)
  세 소비처가 같은 판정을 쓰도록 결속(drift 테스트 有). 이게 없으면 두 훅이 bare `[ -d node_modules ]`
  로 부분 트리를 "설치됨"으로 오판한다.

**왜 락을 뺐나 (사용자 결정 2026-07-18)**: 초판은 `mkdir` 락 + owner PID + grace + stale-lock steal
을 손으로 짰다. `/ai-review` 가 그 steal 경로에서 **매 라운드 새로운 동시성 버그**를 실측 재현했다:

| 라운드 | steal 경로의 버그 (전부 실측 재현) |
| --- | --- |
| 20_06_45 W1 | 탈취가 "경과 시간"만 봐서 *살아있는* 느린 설치의 락도 탈취 → 동시 install |
| 00_59_56 W1 | grace 를 `find -mmin` 분 변환하다 60초 미만이 `-mmin -0` 으로 truncate → age 게이트 무력화 |
| 02_06_42 **C1** | `_lock_is_dead && rm -rf; mkdir` 이 **check-then-act TOCTOU** — 두 세션이 같은 죽은 락을 보고 둘 다 rm+mkdir, 진 쪽이 이긴 쪽의 fresh 락을 지워 **둘 다 동시 install**(내가 직접 3-way 재현) |

**근본 원인은 개별 버그가 아니라 설계다** — `mkdir` 로 advisory locking 을 재발명하면 stale-lock
reclaim 이 본질적으로 TOCTOU 다. 올바른 primitive 는 OS advisory lock(`fcntl.flock`, 홀더 사망 시
커널이 자동 해제 → stale 락·steal·PID liveness·grace·TOCTOU 전부 소거)이다. 매번 주석에 "안전하다"고
쓴 논증이 다음 라운드에 반증됐다(#970 push 가드 `_is_segment_boundary` 와 같은 계열).

→ **락을 계속 하드닝하는 대신 아예 뺐다.** 마커가 이미 진짜 목표(부분/실패 설치가 "완료"로
안 세지고 자가 치유)를 달성한다. **수용한 잔여 리스크**: 여러 세션이 *첫* cold 설치를 같은 순간에
치면 동시 `npm install` 이 가능하고(npm 은 단일 디렉토리 동시 설치에 안전하지 않음) 드물게 트리가
오염될 수 있다 — 최악은 corrupt-but-marked 라 `rm -rf node_modules` 수동 복구. dev 툴 린터의 첫
설치에 한한 좁은 창이라, 안전 논증이 계속 틀리는 손수 짠 락보다 낫다고 판단. 진짜 필요해지면
`fcntl.flock` — plan §G.

**테스트**: `test_bootstrap_mermaid_install.py`(마커·부분트리·실패·throttle·동시 수렴) +
`test_mermaid_lint_ready.py`(공유 SoT + 세 소비처 drift + 실행 기반 gate 회귀). 동시 테스트는
exactly-once 가 아니라 **수렴**(마커 존재 + 이후 세션 skip)을 단언한다 — 락을 뺐으니 직렬화는
보장하지 않는다. 마커-미기록 뮤턴트로 비-vacuity 확인.

- [x] 구현 + 테스트 (마커-only 최종)

### A 후속 (이 PR 범위 밖, 별건 — 02_06_42 잔여)

락을 빼며 대부분의 잔여 WARNING(락 correctness 관련)이 moot 됐다. 남은 것:

- [ ] **W1 — "main 체크아웃 루트" 해석이 3곳(bootstrap·pre-commit·PostToolUse) 중복 + bootstrap 실패
      경로 무신호.** 선재(이 PR 이 도입 아님). 공유 스니펫 추출 또는 3구현 pin 테스트 + bootstrap
      실패 경로에 stderr 진단. (I4 계열 — reaper/이 파일에 반복 등장하는 git-common-dir 중복.)
- [ ] **W4 — import fail-open(`is_ready is None`) 분기가 실행 기반 테스트 없음.** 코드는 정답(L116 이
      None 을 skip 분기로 접음, 확인함) — 테스트 커버리지 갭만. 헬퍼를 깨뜨린 상태로 훅을 서브프로세스
      실행해 exit 0(skip) 을 단언하는 테스트 1건. 20_06_45 W8 이 세운 실행-기반 패턴 재사용.
- [ ] **W3 — 테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py` 내 중복.** 순수
      위생, 동작 무관.
- [ ] **W8 — `harness-checks.yml` 만 node 22 / setup-python 사용(다른 워크플로는 node 24).** 선재 CI
      설정, diff 밖.

**10_55_35 라운드(마커-only 전환 리뷰) 잔여:**

- [ ] **W1(10_55_35) — `lint-mermaid.mjs` 를 import 크래시에 fail-OPEN 시켜라.** `await import("mermaid")`/
      `("jsdom")` 가 가드 없어(75·93행), corrupt-but-marked 트리에서 `ERR_MODULE_NOT_FOUND` 로 크래시하면
      pre-commit(`exit 1`)·PostToolUse(`exit 2`)가 이를 "진짜 malformed mermaid" 로 오판해 **매 markdown
      커밋을 가짜 메시지로 차단** — 두 파일이 명시한 fail-open 계약과 정반대(리뷰어 실측 재현). **선재
      결함**(어떤 원인의 corrupt node_modules 든 트리거; 락 제거가 도달성만 넓힘)이고 이 change 밖 파일
      3곳(mjs+2 소비처)을 건드려 별건. fix: import 를 try/catch 로 감싸 로드 실패를 파싱 에러와 **다른
      exit code**(예: 3)로 분리하고 소비처가 그 코드를 "툴링 깨짐→skip" 으로 처리. `bootstrap` 설계
      노트는 이 최악을 이미 정직하게 서술하도록 정정함(10_55_35 커밋).
- [ ] **W3(10_55_35) — bash mtime/cooldown 헬퍼가 `reap-merged-worktrees.sh` 와 중복**(`_file_mtime` vs
      `file_mtime`). python 은 `_lib/mermaid_lint_ready.py` 로 SoT 통합했는데 bash 는 안 됨. `.claude/tools/_lib/*.sh`
      공유 또는 최소 네이밍 통일. 저우선.
- [ ] **I1(10_55_35) — hung `npm install`(타임아웃 없음)의 blast radius 가 락 제거로 세션 1개 → 동시
      콜드스타트 전체로 확대.** 기존 W2(00_59_56) 한계의 도달성 변화. fcntl.flock(§G) 또는 timeout 래핑 시
      함께 해소. track 목적.

---

## B. reaper `gh pr view` 순차 N+1 — SessionStart 블로킹

> 출처: 18_04_20 WARNING #5 (performance)

`gh_state()` 가 후보 worktree/branch 마다 `gh pr view` 를 **순차 호출**한다(배치·병렬 없음).
`REAP_MIN_INTERVAL`(6h) throttle 덕에 매 세션은 아니지만, throttle 만료 세션에 후보가 쌓이면
`bootstrap-session.sh`(SessionStart, **동기**)가 수 초 블로킹될 수 있다.

- [ ] `gh pr list --state all --json headRefName,state` 로 배치 조회해 branch→state 맵 선구성,
      또는 후보별 호출을 동시성 상한(`xargs -P4`)으로 병렬화
- [ ] 회귀: 기존 `test_reap_merged_worktrees.py` 의 gh stub 이 배치 형태도 흉내내도록 갱신

---

## C. `guard_default_branch_bash.py` 가 같은 판정을 독립 재구현

> 출처: 19_15_56 WARNING #3 (architecture)

**"이 Bash 명령이 어떤 git 서브커맨드를 실행하는가"** 라는 동일 질문을 두 훅이 따로 푼다 —
`guard_review_before_push.py` 와 `guard_default_branch_bash.py:60-81`(`_MUTATING`, 셸 인용·간접실행을
전혀 모르는 단순 정규식). 후자는 **soft-fail**(never blocks, 오분류해도 reminder 만)이라 당장 위험은
낮다.

**[[harness-push-guard-subcommand-detection]] 과 묶어서 처리하는 것이 자연스럽다** — 거기서 판정
로직을 재설계하면 `_lib/git_command_detection.py` 로 추출해 양쪽이 공유할 수 있다. 단독 선행은
비권장(재설계 결과에 따라 추출 대상이 바뀐다).

- [ ] ② 재설계 확정 후 `_lib/` 추출 + 두 훅이 공유

---

## D. push 훅 `main()` 무테스트

> 출처: 19_15_56 WARNING #6 (testing)

`guard_review_before_push.py:main()` — exit code 0/2, REVIEW/PLAN 게이트 순서,
`BYPASS_*` 환경변수 우회, import 실패·호출 예외 시 fail-open, stdin JSON 파싱 실패 — 가
`.claude/tests/` 어디서도 실행되지 않는다. `_is_git_push` 는 두텁게 테스트됐지만 **그 결과를
소비하는 최종 진입점은 무검증**이다.

- [ ] `subprocess.run([sys.executable, "guard_review_before_push.py"], input=json.dumps(payload))`
      형태의 e2e, 또는 `evaluate_review`/`evaluate_plan` 을 mock 주입해 exit code·stderr 문구 검증

---

## G. mermaid 설치에 진짜 동시성 보장이 필요해지면 — 별도 스크립트 + `fcntl.flock`

> 출처: 00_59_56 W6 (architecture, 추출) + 02_06_42 C1 (동시성, 락 제거 결정).

A 는 **마커-only(락 없음)** 로 마감했다(§A 참고). 동시 첫-설치 오염이라는 좁은 잔여 리스크가 실제로
문제가 되면(현재는 dev 툴 린터에 과하다고 판단), 이 항목에서 **올바르게** 해결한다:

- bootstrap 책임#2 를 별도 스크립트/헬퍼로 추출(W6 이 지적한 선례 — reap 은 이미 분리됨). 인라인
  ~40줄이 파일의 SRP 를 흐리고, 테스트가 무관한 reap 섹션을 `REAP_MIN_INTERVAL` 로 무력화해야 한다.
- 락이 필요하면 **`mkdir` 로 재발명하지 말고 `fcntl.flock`** 을 쓴다(python 헬퍼). 커널이 홀더
  사망 시 자동 해제 → stale 락·steal·PID liveness·grace·TOCTOU 가 애초에 없다. macOS 에 없는 것은
  `flock(1)` **명령**이지 `flock(2)`/`fcntl` **syscall** 이 아니다(python `fcntl.flock` 가용 확인함).

**왜 지금 안 하나**: 마커-only 로 실질 목표는 달성됐고, 락은 4라운드 연속 손수 짠 버그를 냈다.
진짜 동시성 보장이 필요하다는 근거가 생기기 전엔 과설계다.

- [ ] (필요 시) `ensure-mermaid-lint-deps.py` 추출 + `fcntl.flock` 기반 동시성. 아니면 현행 마커-only 유지.

---

## E. REVIEW/PLAN 게이트 fail-open 정책 — **사용자/팀 판단 필요**

> 출처: 18_04_20 WARNING #4 · 19_15_56 WARNING #2 (security)

모듈이 스스로 *"리뷰 없는 push 를 막는 유일한 hard gate"* 라 서술하면서, 내부적으로 **3중
fail-open** 경로를 갖는다: ① `_lib` import 실패 ② `evaluate_review`/`evaluate_plan` 호출 중 예외
③ `main()` 미처리 예외. 코드 주석상 **의도된 트레이드오프**지만 그 존재 목적과 긴장 관계다.

**이건 코드 결함이 아니라 정책 선택이다** — 착수 전 사용자 결정 필요:

- 그대로 둔다(가드 오류가 작업을 막는 것보다 낫다) — 현행
- fail-closed 로 뒤집는다
- fail-open 은 유지하되 **관측 가능하게** 한다(발동 시 로그/알림, "연속 N회 fail-open 시 경고")

- [ ] 사용자 결정 → 결정에 따라 구현 또는 won't-do 종결

---

## F. mermaid-lint npm 트리 취약점 + 보안 스캔 갭 — 별건 (A 리뷰 20_06_45→00_59_56 발견)

> 출처: 00_59_56 W4·W5 (dependency·security). **A 의 diff 밖**이라 별 항목으로 분리.

`npm audit` 실측: `.claude/tools/mermaid-lint` 트리에 실제 취약점 2건 —
`undici@7.27.0` **HIGH**(TLS 인증서 검증 우회 등), `dompurify@3.4.7` moderate. 둘 다
`fixAvailable`(breaking 없이 lockfile 갱신만). 실사용(parse-only, jsdom 정적)상 직접 트리거
가능성은 낮다.

더 근본은 **이 npm 트리가 저장소 보안 스캔에서 통째로 빠져 있다** — `deps-security-checks.yml`
은 pnpm 워크스페이스만, Dependabot 은 `github-actions` ecosystem 만. 즉 W4 두 CVE 뿐 아니라
향후 신규 CVE 도 영구 무신호다. `bootstrap-session.sh` 의 `npm install --no-audit`(이 PR 이전부터
있던 플래그)가 설치 시점 신호도 은폐한다.

**왜 A 에서 안 고쳤나**: `--no-audit` 는 A 가 만든 게 아니고, 취약점 해소는 lockfile 갱신이라
A 의 주제(설치 경쟁·부분설치·판정 SoT)와 무관하다. 같이 넣으면 scope 오염이고 scope-reviewer
가 정당하게 지적한다.

- [x] `cd .claude/tools/mermaid-lint && npm audit fix` — undici 7.27.0→7.28.0(HIGH 7건),
      dompurify 3.4.7→3.4.12(moderate 3건) → **0 vulnerabilities**. lockfile 만 변경(package.json
      range 불변), lint 도구 실동작 확인(good→exit 0, malformed→exit 1). (별건 PR)
- [x] **Dependabot npm ecosystem 등록** (`/.claude/tools/mermaid-lint`) — pnpm 워크스페이스 밖
      독립 트리를 security update 자동 PR 대상으로. deps-security-checks.yml(pnpm audit) 확장 대신
      Dependabot 을 택한 이유: 기존 github-actions 엔트리와 같은 패턴, security update 가 신규 CVE 를
      자동 PR 화(= "silent forever" 근본 해소), CI job 복잡도 없음.

---

## won't-do — 다른 세션의 앵커는 보호 못 한다

> 출처: #970 ① 의 알려진 한계 (`worktree-policy.md §7` 에 명시됨)

reaper 는 **자기 세션의 앵커만** 안다(`bootstrap` 이 `BASH_SOURCE` 로 넘긴다). 동시에 열린 다른
세션이 앵커로 쓰는 워크트리의 PR 이 머지되면 **그 세션은 여전히 죽는다**.

**won't-do 사유**: 근본 해결엔 "살아있는 세션의 앵커 레지스트리"가 필요하고(세션 생명주기 추적 +
crash 시 stale 엔트리 회수), 하네스가 워크트리를 recycle 해 복구시켜 주는 것이 관측됐다. 비용 대비
과하다. 재발 시 복구 절차는 `worktree-policy.md §7` + 메모리에 있다.

---

## 체크리스트

- [x] A — bootstrap mermaid 설치 가드: **마커-only + throttle + 공유 SoT** (락은 4라운드 회귀 후 제거) (이 PR)
- [ ] B — reaper gh N+1 배치화
- [ ] C — `_lib/git_command_detection.py` 추출 (② 재설계 후행)
- [ ] D — push 훅 `main()` 테스트
- [ ] E — fail-open 정책 사용자 결정
- [x] F — mermaid-lint npm 취약점 fix(undici HIGH·dompurify moderate → 0) + Dependabot npm 등록 (별건 PR)
- [ ] G — (필요 시) mermaid 설치 추출 + `fcntl.flock` 동시성 (별건)

## Rationale

**왜 모아서 등록하나**: 5건 전부 #970 리뷰가 찾았지만 **plan 이 없어 `review/` 산출물에만
남아 있었다**. 리뷰 산출물은 시점 기록이라 아무도 다시 읽지 않는다 — 실제로 확인해보니 기존
`harness-*` plan(`report-contract-followups`·`workflow-contract-fix`) 도, 다른 어떤 plan 도 이
항목들을 커버하지 않았다(`gh pr view`·`git_command_detection`·`N+1` 언급 0건).

**왜 A 만 지금 하나**: A 는 유일하게 **실질 위험**이다(병렬 세션이 정석 워크플로인데 lint 가
조용히 죽는다). 작고 독립적이며 #970 에서 이미 만진 파일이다. B·D 는 독립이라 언제든,
C 는 ② 재설계 후행, E 는 사용자 결정 선행.

**왜 C 를 단독 선행하지 않나**: 추출 대상(판정 로직)이 [[harness-push-guard-subcommand-detection]]
의 설계 반전 결과에 따라 달라진다. 지금 추출하면 곧 다시 뜯는다.

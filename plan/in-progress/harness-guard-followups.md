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

**수정 (초판 + 자기 리뷰가 잡은 3건 보강)**: 완료 마커 + owner 인지 락 + 실패 throttle + 공유 판정.

- 마커(`node_modules/.bootstrap-install-complete`)는 node_modules **안**에 둔다 — 트리를 지우면
  마커도 함께 죽어야 한다. 부분 트리는 다음 세션이 자동 재설치(self-healing).
- 락은 `mkdir`(원자적·이식성. macOS 에 `flock` 없음). 진 쪽은 **대기하지 않고 skip** — bootstrap 은
  세션을 막으면 안 되고, 마커 덕에 다음 세션이 이어받는다.

**자기 리뷰(20_06_45)가 잡은 초판의 결함 3건 — 같은 PR 에서 보강:**

1. **[WARNING #1, 리뷰어 실측 재현] 초판의 stale-lock 탈취가 "경과 시간"만 봤다.** 10분 넘게 걸리는
   *살아있는* 설치(throttle 걸린 샌드박스 네트워크)의 락도 탈취돼 두 `npm install` 이 같은 트리에
   동시 실행 — 이 PR 이 없애려던 바로 그 증상을 좁은 창으로 재도입했다. **락에 소유 PID 를 기록하고
   `kill -0` 생존 확인으로 판정**하도록 바꿨다(age 는 grace 게이트로만). 해제도 소유권 일치할 때만.
   → 초판이 "새 실패 모드를 닫았다"던 주장이 불완전했다. 실측 재현이 그걸 드러냈다.
2. **[WARNING #3] 무한 재시도.** 지속 실패(네트워크 down)면 매 SessionStart 마다 backoff 없이 재시도.
   reaper 의 `REAP_MIN_INTERVAL` 과 같은 계열 → 실패 시 cooldown 파일 stamp,
   `MERMAID_INSTALL_RETRY_SEC`(기본 30분) 내 재시도 skip.
3. **[WARNING #2] 같은 판정을 세 소비처가 제각각.** bootstrap(마커)·`pre-commit`·`PostToolUse` 훅이
   판정 기준이 달라, 마커 도입 후에도 두 훅은 여전히 bare `[ -d node_modules ]` 로 부분 트리를
   "설치됨"으로 오판할 수 있었다. **`_lib/mermaid_lint_ready.py` 공유 SoT** 신설 — python 훅은
   import, bash `pre-commit` 은 CLI 호출, bootstrap(writer)은 마커명 하드코딩 + drift 테스트로 결속.

**테스트**: `test_bootstrap_mermaid_install.py`(락 liveness·throttle·경쟁) + `test_mermaid_lint_ready.py`
(공유 SoT + 세 소비처 drift 결속). 비-vacuity 는 두 방식으로 실증:
- **초판(bbf72268e) 대조**: 6건 실패(경쟁·마커·throttle·dead-PID 탈취).
- **타깃 뮤턴트**: liveness 검사만 제거(순수 age 로 되돌림)하면 `test_live_but_slow_lock` 이 실패 —
  즉 이 테스트가 *우연*(구코드 rmdir 이 owner-파일 든 락을 못 지운 것)이 아니라 **진짜 liveness 를
  검증**함을 확인. (초판 대조만으로는 이 테스트가 vacuous 하게 통과해 뮤턴트 대조가 필요했다.)

**알려진 한계 (00_59_56 라운드, 조치 안 함 — bootstrap-session.sh 인라인 주석에도 동일 명시):**

- **W2 — hung `npm install` 에 타임아웃 없음.** 크래시도 실패도 아니고 순수하게 멈추면(예:
  registry 커넥션이 wedge) 락을 쥔 세션이 무기한 블로킹된다 — "bootstrap must never block a
  session" 불변식과 정면 충돌. Blast radius 는 그 세션 하나에 국한: 다른 동시 세션은 `mkdir` 이
  즉시 실패해 skip 하므로 전파되지 않는다. macOS 기본에 `timeout`/`gtimeout` 이 없어 이식성 있는
  watchdog 이 별도 작업 — 이 PR 에서 고치지 않는다.
- **W12 — liveness 판정(`kill -0`)의 PID 재사용(ABA).** 진짜로 죽은 홀더의 PID 가 나중에 무관한
  프로세스로 재할당되면 `_lock_is_dead` 가 "살아있음"으로 오판해 그 무관 프로세스가 끝날 때까지
  락이 정체될 수 있다 — 이 라운드가 고친 결함(살아있는데 죽었다고 오판)의 **정반대 방향**. 실패
  방향이 안전(설치 skip 만 되고 손상·중복설치 없음), macOS 단일 PID 공간이라 확률 낮음, grace
  경과 후에만 발현 — 이 PR 에서 고치지 않는다. 근본 수정은 소유자 식별을 (PID, 시작 시각) 쌍으로
  강화하는 것.

- [x] 구현 + 테스트

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

- [ ] `cd .claude/tools/mermaid-lint && npm audit fix` (lockfile 갱신)
- [ ] `deps-security-checks.yml` 에 mermaid-lint 전용 audit 스텝 추가 또는 Dependabot npm ecosystem 등록

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

- [x] A — bootstrap npm 경쟁 + 부분 설치 + 자기리뷰 보강 3건(락 liveness·throttle·공유 SoT) (이 PR)
- [ ] B — reaper gh N+1 배치화
- [ ] C — `_lib/git_command_detection.py` 추출 (② 재설계 후행)
- [ ] D — push 훅 `main()` 테스트
- [ ] E — fail-open 정책 사용자 결정
- [ ] F — mermaid-lint npm 취약점 fix + 보안 스캔 편입 (별건)

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

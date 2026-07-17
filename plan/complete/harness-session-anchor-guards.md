---
worktree: llm-usage-doc-alignment-01d7a4
started: 2026-07-17
owner: developer
spec_impact: none
---

# 하네스 가드 2건 — 세션 앵커 reap (완료) + push 가드 오탐 (철회·재티켓)

> 발견 경위: `claude/report-paths-shared-0edbf0` 작업 중 두 건 모두 **실제로 밟았다**.
> ①은 세션을 완전히 wedge 시켜(모든 Bash·Write 차단) 하네스가 워크트리를 recycle 해야 복구됐고,
> ②는 `git commit` 을 막아 커밋 메시지를 파일로 빼는 우회를 하게 만들었다.
> 둘 다 이 저장소 코드의 결함이며, 아래 진단은 전부 **재현 실측**이다.

## Overview

독립된 두 결함이지만 **같은 계열**이다 — 가드가 *진짜 대상* 대신 *대리 지표* 를 평가한다.

| # | 결함 | 대리 지표 | 진짜 대상 |
| --- | --- | --- | --- |
| ① | reaper 가 세션 앵커 워크트리를 삭제 | 셸 cwd (`git rev-parse --show-toplevel`) | `$CLAUDE_PROJECT_DIR` (훅 스크립트 앵커) |
| ② | push 가드가 push 아닌 명령을 차단 | 명령 **문자열** 정규식 | 파싱된 **git 서브커맨드** |

①은 가용성 사고(세션 사망), ②는 신뢰성 사고(가드가 틀리면 사람이 우회를 학습한다).
`review_guard` 가 push 대상이 아니라 셸 cwd 를 평가하는 기존 이슈와도 같은 뿌리다.

---

## ① reaper 가 세션의 `$CLAUDE_PROJECT_DIR` 워크트리를 삭제한다

### 증상

`manual-trigger-default-param-e0d395` 워크트리가 PR #958 머지 후 SessionStart 에서 자동 reap 됐다.
그런데 그게 **그 세션의 `$CLAUDE_PROJECT_DIR`** 였다. 직후 모든 도구가 죽었다:

```
PreToolUse:Bash  hook error: can't open file '.../manual-trigger-default-param-e0d395/.claude/hooks/guard_review_before_push.py'
PreToolUse:Write hook error: can't open file '.../manual-trigger-default-param-e0d395/.claude/hooks/guard_default_branch_edit.py'
```

모든 훅이 `$CLAUDE_PROJECT_DIR/.claude/hooks/*.py` 로 실행되므로 **Bash·Write·Edit 전부 차단**.
`git worktree add` 로 되살리려 해도 그게 Bash 라 **순환**이다. 세션 자력 복구 불가.

### 근본 원인 (실측)

reaper 에는 current-worktree skip 이 **있다**. 문제는 그게 **셸 cwd** 를 본다는 것이다:

- `.claude/tools/reap-merged-worktrees.sh:75` — `current_top=$(git rev-parse --show-toplevel)`
- 같은 파일 171–172행 — `[ "$wt_path" = "$current_top" ]` 이면 skip
  (주석: *"That skip is the PRIMARY guard against deleting the worktree we are running in"*)
- **`grep -c CLAUDE_PROJECT_DIR reap-merged-worktrees.sh` → `0`.** 앵커 개념 자체가 없다.

평소엔 cwd == 앵커라 이 skip 이 우연히 앵커도 보호한다. 그러나 **`EnterWorktree` 로 다른 워크트리에
들어가면 둘이 갈라진다**. 그 순간 reaper 는 *엉뚱한 쪽*(현재 cwd)을 보호하고 앵커를 지운다.

발동 조건 — 특수 상황이 아니라 **정상 워크플로**다:

1. 세션이 워크트리 A 에서 시작 (`$CLAUDE_PROJECT_DIR` = A)
2. `EnterWorktree` 로 B 로 이동 (셸 cwd = B) ← developer SKILL 이 bg 세션에 **권장**하는 정석
3. A 의 PR 이 머지됨
4. 다음 SessionStart → bootstrap → reaper 가 cwd(B)만 skip → **A 삭제** → 세션 사망

즉 **머지된 PR 의 워크트리에서 시작해 다른 워크트리로 옮긴 세션은 compact 마다 죽는다.**

### 왜 `$0` 로는 못 고치나

reaper 는 **main 체크아웃 경로로** 호출된다 — `bootstrap-session.sh:58-60`:

```bash
reaper="$main_root/.claude/tools/reap-merged-worktrees.sh"
bash "$reaper" || true
```

따라서 reaper 안에서 `$0`/`BASH_SOURCE` 는 main 체크아웃을 가리키지 앵커가 아니다.
bootstrap 자신도 `main_root` 를 `git rev-parse --git-common-dir`(cwd 기반, `:21-22`)로 구하므로
역시 앵커를 모른다. **앵커는 밖에서 주입되어야 한다.**

### 수정안 (권장: B)

| 안 | 방법 | 평가 |
| --- | --- | --- |
| A | reaper 가 `$CLAUDE_PROJECT_DIR` 환경변수를 직접 읽어 skip 집합에 추가 | 가장 단순. **단 훅 env 에 그 변수가 실제로 있는지 미검증** — 선행 확인 필요 |
| **B** | **bootstrap 이 `BASH_SOURCE` 로 앵커를 유도해 `--keep <path>` 로 전달** | **env 의존 없음.** 하네스가 `bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 로 호출하므로 `BASH_SOURCE[0]` 이 곧 앵커 경로다 |
| C | reaper 가 모든 워크트리를 보수적으로 skip | 청소 기능 자체를 무력화. 기각 |

**B 권장 이유**: 하네스가 bootstrap 을 *절대경로로 interpolate 해서* 호출한다는 사실이 이미 계약이다
(그래서 앵커가 죽으면 bootstrap 도 못 뜬다). 그 경로를 그대로 되읽는 것이라 새 가정을 추가하지 않는다.
A 는 더 짧지만 "훅 env 에 변수가 있다"는 **미검증 가정** 위에 선다 — Bash 툴 셸에서는 `unset` 이었다
(그건 훅이 아니므로 반증은 아니지만, 확인 없이 의존할 수는 없다).

구현 스케치:

```bash
# bootstrap-session.sh
anchor=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P) || anchor=""
bash "$reaper" ${anchor:+--keep "$anchor"} || true
```

```bash
# reap-merged-worktrees.sh — 인자 파서는 이미 있다 (:53-63, 미지 인자는 exit 2)
--keep) shift; [ -n "${1:-}" ] && keep_paths="$keep_paths$(realpath_p "$1")\n" ;;
# 171행 skip 조건에 keep_paths 포함 검사 추가
```

### 알려진 한계 (범위 밖, 문서화만)

reaper 는 **자기 세션의 앵커만** 알 수 있다. 동시에 열린 다른 세션이 워크트리 C 에 앵커돼 있고
C 의 PR 이 머지되면 그 세션은 여전히 죽는다. 근본 해결은 "살아있는 세션의 앵커 레지스트리"가
필요해 과하다. 하네스가 워크트리를 recycle 해 복구시켜 주는 것이 관측됐으므로(이번 사례) 수용 가능.

### 검증

- [x] 회귀 테스트: 앵커 A + cwd B 인 상태를 재현해 A 가 살아남는지 (`--dry-run` 으로 삭제 목록 검사)
- [x] 기존 동작 유지: 머지된 무관 워크트리는 여전히 reap 되는지
- [x] cwd == 앵커 인 평범한 세션에서 이중 skip 이 오작동 안 하는지

**구현 결과**: 안 B 채택. `bootstrap-session.sh` 가 `BASH_SOURCE[0]` 로 앵커를 유도해
`--keep <anchor>` 로 전달하고, reaper 는 pass 1 에서 cwd skip 과 **별개로** keep 집합을 검사한다.
전제 재확인 완료 — `.claude/settings.json` SessionStart 는 실제로
`bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 로 호출하므로 `BASH_SOURCE[0]` 이 곧 앵커다.

테스트는 `.claude/tests/test_reap_merged_worktrees.py` 에 관련 테스트 일체 추가(정확한 현재
건수는 파일을 직접 세는 것이 SoT — 이후 세션에서 커버리지가 늘 때마다 본문의 하드코딩된 숫자가
rot 하는 문제가 실제로 반복됐다: 최초 8건→직전 리뷰 실측 9건→WARNING #2 조치 커밋으로 10건까지
벌어진 뒤에야 정정. review/code/2026/07/17/18_04_20 INFO #2). 핵심 두 가지:

- **bootstrap 을 실제로 구동하는 end-to-end 1건** — reaper 만 단위 테스트하면 bootstrap 이 `--keep`
  전달을 빠뜨려도 통과한다(계약의 양쪽 중 한쪽만 고정됨).
- **비-vacuity**: 앵커 worktree 가 dirty 하면 *무관한* dirty skip 이 살려줘 테스트가 헛돈다.
  `_install_bootstrap` 이 bootstrap 을 앵커 브랜치에 커밋해 clean 을 만들고 이를 단언한다.
  최초 추가분 전체가 fix 이전 코드에서 실패함을 확인(대다수는 직접 실패, `--keep` 인자 검증
  테스트 2건은 구 파서의 unknown-arg exit 2 로 통과).

---

## ② push 가드 오탐 — **본 plan 에서 철회, 재티켓**

구현했다가 **되돌렸다**. `.claude/hooks/guard_review_before_push.py` 는 이 PR 에서 **무변경**
(fork-point 와 byte-identical). 진단·근거·재설계 방향은 전부
[`plan/in-progress/harness-push-guard-subcommand-detection.md`](harness-push-guard-subcommand-detection.md) 로 이관했다.

**철회 사유** — 서브커맨드 판정 재작성이 `/ai-review` 3라운드 연속으로 **매번 새로운 거짓 음성
회귀**를 냈다(전부 실측 재현):

| 라운드 | 새로 드러난 회귀 (구 정규식은 차단하던 것) |
| --- | --- |
| 1 | 개행 단독 구분(`git add -A\ngit push`), `git --attr-source main push` |
| 2 | `$(...)`·백틱(`git commit -m "$(git push)"`), `bash -c "cd /tmp && git push"` |
| 3 | ANSI-C 인용(`git $'push'`), locale 인용(`git $"push"`), 백틱 미종료 |

**근본 원인 — 구 정규식은 "무지해서 안전"했다.** 원시 문자열을 훑으므로 `git … push` 의 *어떤*
표기든 걸렸다($(...)·`bash -c`·`$'push'` 포함). 정밀 파서는 반대로, **실행 전에 텍스트를 변형하는
셸 기능마다**($'…', $"…", $(…), 백틱, `-c`, `eval`, 인용 분할, hex escape…) 구멍이 하나씩 생기고
그걸 개별 모델링해야 한다 — **무한한 표면**이다. 반면 구 정규식의 결함(거짓 양성)은 **유한하고
열거 가능한 집합**이다. 재작성은 유한한 문제를 무한한 문제와 맞바꾼 셈이었다.

3라운드에서 도입한 차등 테스트(`old ⊆ new`)조차 **코퍼스 위에서만** 수렴한다 — 셸 문법의 long tail
을 추측으로 열거할 수 없다는 것이 3라운드가 실증한 바다.

**남는 상태**: 커밋 메시지에 "push" 라는 단어가 있으면 `git commit` 이 막히는 오탐은 **그대로**다.
가드 건전성은 오늘과 동일(거짓 음성 0 추가). 우선순위가 ① > ② 라는 본 plan 의 판단은 유지된다 —
①은 세션을 죽이는 가용성 사고이고 재발이 확정적이었으나, ②는 우회 가능한 불편이다.

---

## 체크리스트

- [x] ① 안 B 구현 (bootstrap `--keep` 전달 + reaper skip 집합)
- [x] ① 회귀 테스트 (앵커≠cwd 재현, bootstrap end-to-end 포함)
- [x] ① 문서 동기화 — `worktree-policy.md §7` 불변식 정정 + `.claude/tests/README.md` 행 추가
- [x] ② 철회 + 재티켓 (`harness-push-guard-subcommand-detection.md`) — 사용자 결정 2026-07-17
- [x] TEST WORKFLOW — harness 스위트 + `plan-frontmatter.test.ts`
- [x] `/ai-review` ×3 → RESOLUTION ×2 → ② 철회 결정

## Rationale

**왜 별도 plan 인가**: 두 건 다 `claude/report-paths-shared-0edbf0` 작업 중 발견됐지만 그 PR 의
주제(report-path SoT 통합)와 무관하다. 같이 넣으면 scope 오염이고, scope-reviewer 가 정당하게 지적한다.

**왜 지금 안 고치나**: report-paths PR 의 Warning 8건 처리가 선행이다. 다만 ①은 **재발이 확정적**이다 —
머지된 PR 워크트리에서 시작해 `EnterWorktree` 를 쓰는 세션은 매번 죽는다. 우선순위는 ① > ②.

**진단 정정 기록**: 최초에 ②를 "`git push` 문자열 substring 매칭" 으로 보고했으나 **틀렸다**.
실제로는 정규식이 `git`↔`push` 사이를 무제한 허용해 heredoc 본문을 가로지른 것이다(케이스 E 가
통과하는 이유 — `git` 이 앞에 없으면 매칭 안 된다). 코드를 읽고 재현하기 전의 서술이었다.

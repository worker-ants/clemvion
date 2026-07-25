---
title: push 게이트가 실제 push 에 발동하지 않았다 — 훅 로직은 정상, 호출이 안 걸림
worktree: harness-push-newline-sep-a1c3
started: 2026-07-24
owner: developer
status: in-progress
priority: P1
---

## ✅ 원인 규명 완료 (2026-07-25) — `_GIT_PUSH` separator prefix 에 `\n` 누락

**조사방향 3(명령 형태)이 정답이었다.** 훅은 발동하고 로직도 정상이다. 문제는 **push 탐지
정규식이 여러 줄 명령의 newline-구분 push 를 놓친다**는 것이다.

**재현 (추측 아님 — 실제 통과 명령을 transcript 에서 추출).** 통과했던 그 push 는:

```
cd /Volumes/.../node-cancel-e2e-98b61f
git add …
git commit -q -F - <<'MSG'
…
MSG
git log --oneline -2
echo "=== push 시도 ==="
git push -u origin claude/node-cancel-e2e-98b61f 2>&1 | tail -20
```

`_is_git_push(<이 명령>)` = **False** → `main()` 이 "not a push" 로 조기 return → 두 게이트
전부 skip, fail-open 배너도 없음(그래서 §E 관측성에도 안 잡혔다). 원인:

- `_GIT_PUSH` 의 separator prefix 는 `(?:^|&&|;|\|)` — **`\n` 이 없다**.
- push 라인 앞은 `\n`(직전 `echo …` 줄의 끝)이라 어느 alternative 에도 안 걸린다.
- 같은 파일의 `_SEGMENT_SPLIT`(`&&|[|;\n]`) 과 `guard_default_branch_bash._SEGMENT_SPLIT`
  (역시 `\n` 포함)은 `\n` 을 separator 로 인식한다. **push 탐지만 빠졌다.** 그래서 티켓이
  관측한 "default-branch 가드는 발동, push 가드만 미반영" 이 정확히 설명된다 — 후자는
  `_SEGMENT_SPLIT.split()` 후 각 세그먼트에 매칭하고, 전자는 command 전체에 직접 매칭한다.

**티켓이 "텍스트로 재현 불가" 라 결론낸 이유.** 실측표의 주입 명령은 **단일 줄**
(`git push -u origin claude/…`)이라 `^` 가 매치했다. 여러 줄 실제 텍스트를 그대로 주입하니
재현됐다. 즉 전제("훅 미발동")가 틀렸고 실제는 "탐지 실패".

**얼마나 광범위한가.** `cd <path>\ngit push` — 이 저장소의 **가장 흔한 push 형태** — 가 전부
우회 가능하다. 실측:

| 명령 | `_is_git_push` |
| --- | --- |
| `git push …` (단일 줄, 문자열 시작) | True |
| `git add -A\ngit push` | True (**우연** — 앞 `git` 이 `[^&;|]*` 로 `\n` 건너 push 도달) |
| `cd /path\ngit push` | **False** |
| `echo x\ngit push` | **False** |
| node-cancel-e2e 실제 형태 | **False** |

탐지가 "push 앞 줄이 `git X` 명령인가" 라는 **우연**에 의존한다.

**왜 테스트가 못 잡았나 (사각지대 2겹).** `test_push_guard_allowlist.py`:
- corpus 에 newline 케이스가 `("git add -A\ngit push", …)` **하나뿐**이고, 하필 앞줄이 `git`
  이라 우연히 통과 → 결함을 가렸다.
- `test_every_non_release_entry_stays_blocked` 는 `legacy_is_push(cmd)` **가 True 인 항목만**
  검증한다. legacy 도 `\n` 이 없어 `cd\ngit push` 를 못 잡으므로, corpus 에 넣어도 검증이
  **건너뛴다**. 결함이 legacy 부터 있었다는 뜻(§J·§L 은 env-prefix 만 고쳤다).
- `GeneratedFloorTest._TEMPLATES` 의 separator 축은 `&&`·`;`·`|` 뿐 — **`\n` 이 없다**.
  이 클래스가 "corpus 만 보면 아무도 안 적은 형태를 놓친다" 고 경고하면서 정작 같은
  함정에 빠졌다.

## 수정 (완료 2026-07-25) — §M. **두 개의 결합된 변경**

단순히 `\n` 을 separator 에 넣는 것은 **§L-class ReDoS 를 재도입**했다. 그래서 §M 은 두 변경이다:

**(a) separator 에 `\n` 추가** — `(?:^|&&|;|\|)` → `(?:^|&&|[;|\n])`. push 가 자기 줄에 있으면
탐지되게. `_SEGMENT_SPLIT`·default-branch 가드와 일치.

**(b) env-value 반복의 닫는 whitespace `\s+` → `[^\S\n]+`** (개행 제외) — 이게 필수다.
`\s+` 는 `\n` 을 먹으므로 `A=v\n` 이 **두 파싱**(assignment 끝 `\s+=\n` vs separator `\n`)을
갖고, 실패 tail 에서 엔진이 전부 탐색 → **측정: `A=v\n`×20000 + tail = 30s** (freeze/fail-open).
`[^\S\n]+` 로 닫으면 `\n` 은 오직 separator → **10ms**. 두 훅(`_GIT_PUSH`·`_MUTATING`)에
byte-identical 적용(`EnvValueSubpatternSharedTest` 강제). default-branch 는 segment split 이라
동작 불변.

> **내가 처음 쓴 주석이 틀렸다.** "`\n` 은 disjoint 라 무backtracking" 이라고 적었는데,
> env-value `\s+` 와 정확히 겹쳐 ReDoS 를 만들었다. 측정으로 반증하고 (b) 를 추가했다.
> `re.MULTILINE ^` 도 시도했으나 `\s+` 가 여전히 `\n` 을 먹어 **여전히 30s** — 기각.

### 검증 (전부 실측·mutation)

- `_is_git_push` 실측: `cd\ngit push`·`echo\ngit push`·실제 node-cancel-e2e 명령 전부 **True**(수정 후).
- **`NewlineSeparatorTest`** — legacy gate 없이 탐지를 직접 단언(differential 이 legacy gate 로
  이 축을 못 봤으므로). mutation: separator `\n` 제거 → 4 케이스 RED.
- **`BacktrackingTest.test_newline_between_env_assignments_stays_linear`** — rival ReDoS pin.
  mutation: `[^\S\n]+`→`\s+` 되돌리면 10s timeout RED (치환은 raw-string count 로 검증 — 첫
  시도는 `\n` 이 개행으로 해석돼 vacuous 였다).
- **`test_multiline_push_still_gates`** (main 통합) — 여러 줄 push 가 게이트에 **도달**함을 e2e
  로 pin. mutation: separator `\n` 제거 → 게이트 skip 재현(exit 0) RED.
- `GeneratedFloorTest._TEMPLATES` 에 `\n` 축 추가 + `test_the_newline_separator_axis_is_generated`
  로 축 자체를 고정(앞줄 non-git 강제).
- harness 전체 **644 passed**, 회귀 없음.

### 관측 가능성 (§체크리스트 4번) — 별도 판단

근본 수정이 1차 방어다. "미탐지" 를 사후에 아는 층(§체크리스트 4번 CI 방어)은 **이번 PR 범위
밖**으로 남긴다 — push 가 실제 push 인지 판정하는 게 바로 이 정규식이라, 정규식이 틀리면
사후 탐지도 같은 사각지대를 공유한다. 진짜 독립 방어는 훅에 의존하지 않는 CI 층
("리뷰 없는 codebase 변경 PR 차단")인데, 그건 설계 결정이라 별 티켓으로 분리한다.

## Overview

2026-07-24 세션에서 `codebase/**` 변경(신규 e2e spec)을 담은 branch 를 push 했는데
**review 게이트가 차단하지 않고 통과**했다. 사후 확인 결과 **훅의 판정 로직은 정상**이고,
그 push 호출에 **훅이 발동하지 않았다**.

리뷰 없는 `codebase/**` 변경이 origin 에 올라갔다 — 이 저장소가 #992·#1002·#1005·#1009 로
반복해서 닫아온 **"조용한 게이트 우회"** 클래스와 결과가 같다. 다만 원인 계층이 다르다:
종전은 훅 **안**(정규식·스코핑)의 결함이었고, 이번은 훅이 **호출되지 않는** 문제다.

## 실측 (2026-07-24)

branch `claude/node-cancel-e2e-98b61f`, 변경 = `codebase/backend/test/*.e2e-spec.ts` 신규 1 +
plan 이동 + spec frontmatter 2줄.

| 확인 | 결과 |
| --- | --- |
| `evaluate_review(<그 워크트리>)` 직접 호출 | **blocked: True** — "1 codebase/ file(s) changed AFTER the most recent resolved review" |
| 훅에 실제 페이로드 주입 (`cwd`=세션 primary 워크트리, command=`git push -u origin claude/node-cancel-e2e-98b61f`) | **exit 2**, 차단 메시지 정상. #1005 스코핑이 대상 워크트리(`node-cancel-e2e-98b61f`)를 **정확히 지목** |
| 실제 `git push -u origin claude/node-cancel-e2e-98b61f` | **통과** (원격에 branch 생성). fail-open 배너 **없음** |
| `.claude/settings.json` PreToolUse `Bash` matcher | `guard_review_before_push.py` **등록돼 있음** |

즉 (1) 게이트 판정은 옳고 (2) 스코핑도 옳고 (3) 등록도 돼 있는데 (4) 그 호출에서 실행되지
않았다. fail-open 배너가 없다는 점이 중요하다 — 훅이 **돌다가 실패한 것도 아니다**(실패라면
§E 관측성이 배너를 찍는다). 아예 안 돈 것으로 보인다.

**추가 확증**: 같은 PreToolUse `Bash` matcher 에 등록된 `guard_default_branch_bash.py` 는 이
세션에서 **분명히 발동했다** — 매 `git commit` 마다 `_lib/branch_guard.py` 의
`"linked worktree (.git is a file) — allowed"` 가 출력됐다. 즉 "Bash 훅 자체가 안 돈다" 가
아니라 **같은 matcher 의 세 훅 중 push 게이트만** 결과가 반영되지 않았다.
(`.claude/settings.json` PreToolUse Bash = `guard_default_branch_bash` ·
`normalize_worktree_branch` · `guard_review_before_push` 셋 다 등록돼 있다.)

### ⚠ 재현 시 주의 — exit 2 는 **시간 의존**이다 (오판 방지)

위 "exit 2" 는 **리뷰 산출물이 존재하기 전** 상태에서만 나온다. `evaluate_review` 는
"가장 최근 *해소된* 리뷰 **이후** 변경된 `codebase/` 파일 수" 를 보므로, 그 뒤
`/ai-review --prepare` 로 세션 디렉토리가 생기면(코드 커밋보다 최신) **같은 명령이 exit 0**
이 된다 — 이것은 게이트가 **설계대로 동작하는 것**이지 버그가 아니다. 실제로 본 조사 중
`--prepare` 이후 재현이 exit 0 으로 뒤집혔다.

→ 재현할 때는 **리뷰 산출물이 없는 fresh branch**(미리뷰 `codebase/` 변경 1건 + 커밋)로
할 것. 이 문단이 없으면 나중에 exit 0 만 보고 "재현 불가 = 버그 없음" 으로 잘못 닫는다.


## ⚠ 전제 정정 (2026-07-24, 같은 세션 후반 실측) — 훅은 **발동한다**

본 문서 상단은 "훅이 아예 안 돈 것으로 보인다" 고 적었다. **그 뒤 같은 세션에서 push 가
실제로 차단됐다** — 다른 브랜치(`claude/webchat-apibase-binding-a14e68`)에서:

```
PreToolUse:Bash hook error: [guard_review_before_push.py]: BLOCKED (review gate)
  reason: 7 spec-linked file(s) changed AFTER the most recent `--impl-done` consistency report
```

즉 **훅은 등록돼 있고 발동하며 exit 2 를 harness 가 반영한다**. 따라서 조사 방향은
"훅이 안 돈다" 가 아니라 **"어떤 push 는 걸리고 어떤 push 는 안 걸리는가"** 로 좁혀진다.

### 두 사례의 차이 (관측 사실만)

| | 통과했던 push | 차단된 push |
| --- | --- | --- |
| 브랜치 | `claude/node-cancel-e2e-98b61f` | `claude/webchat-apibase-binding-a14e68` |
| 차단 사유(사후 재현) | REVIEW 게이트(미리뷰 codebase 변경) | SPEC-CONSISTENCY 게이트(impl-done 부재) |
| 명령 형태 | `cd` 후 `git push … | tail -20` | `git commit …` 여러 줄 뒤 `git push … | tail -2` |

**가설(미검증)**: 게이트 종류에 따라 다른 것이 아니라, 명령 블록의 형태·길이·앞선 명령의
존재가 훅 입력(command 문자열)에 영향을 줬을 수 있다. 또는 앞선 사례에서만 어떤 조건이
`_is_git_push` 를 빗나가게 했을 수 있다.

**다음 단계**: 통과했던 그 명령 텍스트를 **그대로** 훅에 주입해 재현하라(이미 1회 시도했고
exit 2 가 나왔다 — 즉 텍스트만으로는 재현되지 않는다). 그렇다면 차이는 텍스트가 아니라
**harness 가 훅에 넘기는 payload** 이거나 **훅 실행 자체의 조건**이다. payload 를 로깅하는
일회성 프로브가 다음 수순이다.

## 왜 P1 인가

게이트가 "있는데 발화하지 않는" 상태는 **없는 것보다 나쁘다** — 있다고 믿게 되므로.
이 저장소는 §I(harness-checks paths)에서 정확히 같은 논거로 6회 재발 클래스를 닫았다.
게다가 이번 경로는 **하드 게이트 전체**(review + plan 두 게이트)를 한 번에 무력화한다.

## 조사 방향 (가설 — 미검증)

착수 시 **추측 말고 재현부터** 할 것. 이 세션의 반복 교훈이다(가설이 연달아 틀린 전례 다수).

1. ~~**PreToolUse 훅이 한 번이라도 발동했는지**~~ — **확인 완료: 발동한다.**
   `guard_default_branch_bash.py` 의 출력이 매 commit 마다 나왔다(위 §추가 확증). 따라서
   "훅 계층 전체가 죽었다" 가설은 **기각**. 같은 matcher 안에서 push 게이트만 결과가
   반영되지 않는 이유를 좁혀야 한다 — 예: 여러 훅의 exit code 합성 규칙(앞 훅이 exit 0 을
   내면 뒤 훅의 exit 2 가 무시되는가?), 훅 실행 순서, 타임아웃.
2. **`$CLAUDE_PROJECT_DIR` 해석** — settings.json 은 `$CLAUDE_PROJECT_DIR/.claude/hooks/...` 로
   훅을 가리킨다. 세션 primary 워크트리와 실제 작업 워크트리가 다를 때 이 경로가 무엇으로
   풀리는지, 파일이 존재하는지.
3. **명령 형태** — 실패한 push 는 여러 줄 Bash(첫 줄 `cd`, 이후 `git push`) 안에 있었다.
   `_is_git_push` 는 이 형태를 탐지한다(위 실측에서 exit 2). 그래도 **하네스가 훅에 넘기는
   command 문자열이 내가 주입한 것과 동일한지** 확인 — 다르면 그 차이가 원인일 수 있다.
4. **세션/환경 차이** — 훅 비활성 모드(권한 모드·설정 override)가 있는지.

## 체크리스트

- [x] 재현 조건 특정 — **조사방향 3(명령 형태)**. `_GIT_PUSH` separator 에 `\n` 누락 →
      여러 줄 push 미탐지. 실제 통과 명령을 transcript 에서 추출해 실측 재현.
- [x] 원인은 하네스 **안**(정규식)이었음 — "플랫폼 밖" 분기 아님. 훅은 발동했고, 탐지가 실패했다.
- [x] 수정(§M: separator `\n` + env-value `[^\S\n]+`) + 회귀 테스트(`NewlineSeparatorTest`·
      `BacktrackingTest`·`GeneratedFloorTest` 축·main 통합) + mutation 4종.
- [~] **관측 가능성 / CI 독립 방어** → 별 티켓 [`harness-review-gate-ci-backstop`](harness-review-gate-ci-backstop.md)
      로 분리. 훅 정규식이 유일한 판정자인 한 사후 탐지도 같은 사각지대를 공유하므로, 진짜
      독립층은 훅에 의존하지 않는 CI 이며 그건 설계 결정이다.

## 관련

- `.claude/hooks/guard_review_before_push.py` (판정 로직 — **정상 확인됨**)
- `.claude/hooks/_lib/review_guard.py` (`evaluate_review` — blocked True 확인됨)
- `.claude/settings.json` PreToolUse `Bash` matcher
- 선행 계열(훅 **안**의 결함): `plan/complete/harness-push-detection-env-value-concat.md`(§L) ·
  `plan/complete/push-guard-worktree-scope.md`(#1005 스코핑)
- 발견 맥락: `plan/complete/node-cancellation-inflight-followups.md` §3 작업 중

## Rationale

**왜 별 티켓인가.** 발견 PR(§3 e2e)과 원인 계층이 완전히 다르다 — 그쪽은 backend 테스트
추가이고 이쪽은 하네스/플랫폼 배선이다. 섞으면 두 리뷰가 서로를 가린다(이 저장소의 PR 분리
원칙). 그리고 이 건은 **재현 조건 특정이 작업의 절반**이라 범위가 독립적이다.

**왜 즉시 고치지 않았나.** 원인을 모르는 상태에서 훅을 만지면 "고쳤다고 믿는데 여전히 안
도는" 최악을 만든다. 실측으로 재현 조건을 좁히는 것이 선행이다 — §L·§H·§K 에서 전제가
반복해서 반증된 경험이 그 순서를 강제한다.

---
title: push 게이트가 실제 push 에 발동하지 않았다 — 훅 로직은 정상, 호출이 안 걸림
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P1
---

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

- [ ] 재현 조건 특정 (위 1~4 중 무엇이 원인인지 실측으로 좁힘)
- [ ] 원인이 하네스 밖(플랫폼)이면 → 그 사실을 문서화하고 **대체 방어** 설계
      (예: CI 에서 "리뷰 없는 codebase 변경 PR" 차단 — 훅에 의존하지 않는 층)
- [ ] 원인이 저장소 설정이면 → 수정 + 회귀 테스트
- [ ] **관측 가능성**: 훅이 "안 돌았다" 를 사후에 알 방법이 현재 없다. push 시 게이트 통과
      기록(예: 상태 파일 타임스탬프)을 남겨 미발동을 탐지 가능하게 할지 검토

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

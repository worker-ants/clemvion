# 변경 범위(Scope) 리뷰

## 검토 방법

`git merge-base HEAD origin/main` (= `14bc86a53`, PR #965 — 본 plan 최초 커밋) 을 기준으로
`git diff <merge-base>...HEAD` 전체(22개 파일)를 확보한 뒤, prompt 가 지정한 리뷰 대상 7개
파일 각각의 **실제 diff**(prompt 는 전체 파일 스냅샷만 제공하므로 별도 확보 필요)를 대조하고,
`plan/in-progress/harness-session-anchor-guards.md` 의 결함 서술·수정안·체크리스트와 라인 단위로
매핑했다. 추가로 `-w`(whitespace-ignore) diff 로 포맷팅 전용 변경 혼입 여부, `.claude/settings.json`
변경 여부, 미사용 임포트/디버그 잔재를 별도 확인했다.

## 발견사항

전체 diff(22개 파일, +1669/-33)를 확인했다. 리뷰 대상 7개 파일 외 나머지는 모두
`review/code/2026/07/17/17_09_10/**`(직전 리뷰 라운드 산출물 11개 + `.claude/tests/README.md` 1줄)로,
프로젝트 컨벤션상 커밋 대상이며(`review/` 는 gitignore 되지 않음) 리뷰 대상 목록에도 포함되지 않는다 —
scope 이탈로 볼 근거 없음. `codebase/**`(frontend/backend) 파일은 diff 에 전혀 없다.

- **[INFO]** 마지막 커밋(f4489d314)은 plan 체크리스트에 문자 그대로 없는 "docstring 정정 + 특성 테스트" 단독 커밋
  - 위치: `.claude/hooks/guard_review_before_push.py` `_is_segment_boundary` docstring, `.claude/tests/test_push_detection.py::test_quoted_pure_punctuation_is_read_as_a_boundary_and_that_is_safe`
  - 상세: 직전 커밋(resolution-applier 산출)이 남긴 "Quoted content never reaches here as a punctuation run" 서술이 실측으로 반증되어("posix shlex 는 따옴표를 벗기므로 `git commit -m "&&"` 도 순수 구두점 토큰으로 도달") 정정한 것. 동작(로직) 자체는 변경 없음 — 순수 주석/문서 정정 + 그 사실을 고정하는 회귀(특성) 테스트 1건 추가. 커밋 메시지가 이유(#963 과 같은 계열의 "반증된 메커니즘 서술" 부채)를 명확히 밝히고 있고, 정정 대상 코드가 바로 이 브랜치가 직접 작성한 함수(`_is_segment_boundary`, 이 PR 의 ② 작업 산출물)라 "무관한 파일의 drive-by 리팩토링"은 아니다. 다만 plan 체크리스트 문항으로 사전 명시되지 않았던 사후 발견 항목이라는 점만 기록해 둔다.
  - 제안: 조치 불요. 자기 완결적 정정(같은 브랜치·같은 함수·근거 명시·비-vacuity 테스트 동반)으로 정상적인 반복 정제 과정으로 판단.

## 스코프 매핑 검증

| 변경 | plan 근거 | 판정 |
| --- | --- | --- |
| `guard_review_before_push.py` — `shlex` 토큰화 기반 `_is_git_push`/`_git_subcommand`/`_tokenize`/`_is_segment_boundary` 신설, 기존 정규식은 `_GIT_PUSH_FALLBACK` 로 격하 | plan §② "수정안" + "review 후속 수정" Critical #1-#4 표와 1:1 대응 | 정합 |
| `reap-merged-worktrees.sh` — `--keep <path>` 옵션·`is_kept()`·`realpath_p` 선언 위치 이동 | plan §① "수정안 B" 구현 스케치와 1:1 대응 | 정합 |
| `bootstrap-session.sh` — `BASH_SOURCE[0]` 로 anchor 유도, reaper 에 `--keep` 전달 | plan §① 구현 스케치와 1:1 대응 | 정합 |
| `test_push_detection.py` (신규, 204줄) | plan §② 체크리스트 "회귀 테스트 고정" + "review 후속" 4건 Critical 회귀 테스트化 | 정합, 과잉 케이스 없음 |
| `test_reap_merged_worktrees.py` (+145줄, `--keep`/anchor 관련 8건 + `_env`/`_install_bootstrap`/`_run_bootstrap` 헬퍼) | plan §① "구현 결과" 절이 명시한 "8건 추가" 서술과 정확히 일치 | 정합 |
| `worktree-policy.md` §7 "불변식" — "현재 세션 worktree 제외" → "셸 cwd/세션 앵커" 2축 서술로 정정 | plan 체크리스트 "문서 동기화" 항목이 정확히 이 갱신을 지시 | 정합 |
| `.claude/tests/README.md` +1행 (`test_push_detection.py` 설명) | 동일 체크리스트 항목 | 정합. `test_reap_merged_worktrees.py` 행은 merge-base 시점에도 없던 **기존** 누락이며 이 브랜치가 만든 갭이 아님(범위 밖 미기재를 이 PR 이 새로 만들지 않음) |
| `plan/in-progress/harness-session-anchor-guards.md` — frontmatter `worktree:` 채움, 체크박스 `[ ]→[x]`, "구현 결과"/"review 후속 수정" 절 추가 | developer 역할의 `plan/**` 쓰기 권한 범위 내, 실제 완료된 작업만 사후 체크(마지막 "`/ai-review` → RESOLUTION → PR" 항목은 미체크 유지 — 진행 중 상태 정확히 반영) | 정합 |

## 부가 확인

- **포맷팅 혼입 없음**: 4개 핵심 코드/문서 파일에 대해 `git diff -w`(whitespace-ignore) 결과가 일반 diff 와 통계상 완전히 동일 — 공백/줄바꿈만 바뀐 라인이 실질 변경에 섞여 있지 않음.
- **설정 파일 무변경**: `.claude/settings.json`/`settings.local.json` 은 diff 에 없음 — 이미 등록된 hook/SessionStart 스크립트라 신규 등록이 필요 없었고, 실제로 건드리지 않았다.
- **임포트**: 신규 임포트는 `import shlex` 1건뿐이며 `_tokenize()` 에서 즉시 사용. 미사용 임포트·불필요 정리 없음.
- **디버그 잔재 없음**: `TODO`/`FIXME`/`console.log`/`pdb.set_trace` 등 그렙 결과 0건.
- **이름 변경 정합성**: 기존 `_GIT_PUSH` → `_GIT_PUSH_FALLBACK` 리네임 후 저장소 전체(`.claude/`)에 구 이름 잔존 참조 0건 — 반쪽 리네임 없음.
- **무관 코드 없음**: `codebase/frontend`·`codebase/backend`·`codebase/packages` 하위 파일은 diff 대상 22개 파일 중 0개.

## 요약

리뷰 대상 7개 파일의 실제 diff 를 `plan/in-progress/harness-session-anchor-guards.md` 의 결함 서술·수정안·"구현 결과"/"review 후속 수정" 절과 라인 단위로 대조한 결과, 모든 변경이 plan 이 명시한 두 결함(① reaper 의 세션 앵커 오삭제, ② push 가드 오탐/과소차단)의 수정과 그 검증(테스트)·문서 동기화 범위 안에 정확히 들어온다. 요청 외 추가 수정, 무관한 파일·코드 영역 수정, 포맷팅 전용 변경 혼입, 불필요한 리팩토링/기능 확장, 미사용 임포트, 의도치 않은 설정 변경 중 어느 것도 발견되지 않았다. 유일한 특이사항은 마지막 커밋의 docstring 정정(자기 브랜치가 도입한 코드에 대한 반증-기반 자기 교정, 근거·회귀 테스트 동반)으로, 이는 scope 이탈이 아닌 정상적 정제로 판단해 INFO 로만 기록했다.

## 위험도

NONE

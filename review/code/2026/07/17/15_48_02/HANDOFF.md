# 새 세션 인수인계 — report-paths-shared

아래 "프롬프트" 블록을 새 세션에 그대로 붙여넣으면 된다.
이 문서 자체가 근거이므로, 프롬프트는 이 파일을 가리키기만 한다.

---

## 프롬프트 (복사해서 붙여넣기)

```
worktree /Volumes/project/private/clemvion/.claude/worktrees/report-paths-shared-0edbf0
(브랜치 claude/report-paths-shared-0edbf0) 에서 하던 작업을 마저 끝내줘.
먼저 EnterWorktree 툴로 그 worktree 에 들어가라 (셸 cd 는 안 됨 — 가드가 셸 cwd 를 평가한다).

구현·테스트·리뷰까지 끝났고 커밋 3개가 올라가 있다. 남은 건 리뷰 Warning 8건 처리다.
전체 맥락·경위·함정은 아래 파일에 다 적어뒀으니 그것부터 읽어라:

  review/code/2026/07/17/15_48_02/HANDOFF.md

리뷰 SUMMARY (MEDIUM, Critical 0, Warning 8) 는 같은 디렉토리의 SUMMARY.md 에 있다.
resolution-applier 로 Warning 을 처리하고, RESOLUTION.md 기록 → TEST WORKFLOW 재수행 → PR 까지 가면 된다.
```

---

## 1. 지금 상태 (실측)

| 항목 | 상태 |
| --- | --- |
| worktree | `/Volumes/project/private/clemvion/.claude/worktrees/report-paths-shared-0edbf0` (생존 확인) |
| 브랜치 | `claude/report-paths-shared-0edbf0` (base: `main`, PR 미생성) |
| 커밋 | `d798ed8d7` 공유 모듈+테스트 / `d0315edb6` sidebar 리팩터 / `bb9ad161f` plan 완료 |
| 미커밋 | `review/code/2026/07/17/15_48_02/` (untracked — 리뷰 산출물) |
| TEST WORKFLOW | lint·unit·build **PASS**, e2e **PASS** (backend 256 + playwright 51) — 면제 안 함 |
| 리뷰 | 완료. `SUMMARY.md` = MEDIUM / Critical 0 / **Warning 8**. 리뷰어 8명 리포트 전부 디스크에 있음 |
| forced 커버리지 | 7명 전원 확보 (`forced_missing: []`) — push 가드 통과 조건 충족 |

## 2. 이 브랜치가 한 일

`plan/complete/harness-report-contract-followups.md` 의 후속 5건을 전부 처분했다.
2건 구현(§1 report-path 공유 모듈 · §4 cross-session 통합 테스트), 1건 부분+한계 기록
(§5 sidebar — `vi.mock` 은 vitest 호이스팅상 추출 불가), 2건 근거 있는 종결(§2 won't-do, §3 이미 충족).

**핵심**: `.claude/_shared/report_paths.py` 신설. `review_guard` 게이트와 두 orchestrator CLI 가
report 경로·존재 판정을 각자 사본으로 들고 있다가 **이미 실제로 드리프트해 있었다**
(같은 빈 리포트를 CLI 는 "OK", 가드는 "차단" 으로 판정). "change both" 주석은 바로 다음 PR 에서
깨졌다 — 주석은 메커니즘이 아니라는 게 이 PR 의 논지다.

## 3. 남은 일 — Warning 8건

`SUMMARY.md §권장 조치사항` 이 우선순위 순으로 정리돼 있다. **W#2 가 유일한 진짜 기능 회귀**다:

> `has_report()` 가 `os.path.isfile()` 없이 `getsize() > 0` 만으로 판정한다.
> `output_file` 이 `/` 로 끝나면 `basename()` 이 빈 문자열 → 경로가 **디렉터리**가 되고,
> 디렉터리는 크기가 0 이 아니라 "리포트 있음" 으로 오판된다 (리뷰어가 64~96 bytes 로 실측).
> 리팩터 **이전** 두 orchestrator 에는 `isfile()` 이 있었다 — 공유화하며 내가 떨어뜨린 회귀다.
> 하필 "위조 불가능한 판정" 이 존재 이유인 모듈에서 발생했다.

나머지 7건은 CI 트리거 누락(W#3), fail-loudly 주석의 사실오류(W#1, 리뷰어 4명 독립 지적),
dead wrapper(W#4), consistency 쪽 비대칭 테스트(W#5), 문서 정확성(W#6·W#7), 소급 재분류 안내(W#8).

## 4. 함정 (전부 이번 세션에서 실제로 밟았다)

**push 가드는 `git push` 를 명령 텍스트 전체에서 substring 매칭한다.**
`grep "git push"` 도, **커밋 메시지에 그 문자열이 들어가도** 차단된다. `git commit` 을 하려다 막혔다.
회피: 커밋 메시지를 파일로 빼서 `git commit -F <file>`. (별건 하네스 버그 — §5 참고.)

**e2e 는 면제 대상이 아니다.** 변경 set 에 `codebase/frontend/**` 테스트 파일이 있다.
`PROJECT.md:104` 가 *"회색 지대(예: `*.test.ts` 만 변경) 도 화이트리스트가 아니므로 e2e 수행"* 이라
명시한다. fix 후 재수행할 때도 동일하다 — 자가 판단 면제 금지.

**리뷰 게이트 루프 주의.** fix 커밋이 stop/push 가드를 재무장시킨다.
lint·build·test 를 리뷰 *앞*에 두고, fix 는 한 커밋으로 배치하고, 마지막은 `review/**` 전용 커밋으로 끝낼 것.

**`git mv` 후 편집 잔류.** plan 이동이 순수 rename 으로 커밋되고 frontmatter 편집이 미커밋으로 남을 수 있다.
커밋 후 `git status` 재확인.

## 5. 별건으로 보고할 하네스 버그 2건 (이 브랜치 범위 밖)

1. **reaper 가 세션 자신의 `$CLAUDE_PROJECT_DIR` 워크트리를 지운다.**
   이번에 `manual-trigger-default-param-e0d395` 가 PR 머지 후 자동 reap 됐는데 그게 세션의 앵커였다.
   모든 훅이 `$CLAUDE_PROJECT_DIR/.claude/hooks/*.py` 로 실행되므로 **Bash·Write 전부 차단**됐고
   (`can't open file ...`), `git worktree add` 로 복구하려 해도 그게 Bash 라 순환이었다.
   → reaper 가 현재 세션의 앵커 워크트리는 skip 해야 한다. 머지된 PR 워크트리에서 시작한 세션은
   compact 마다 이렇게 죽는다.
2. **push 가드의 substring 매칭** (§4). `git push` 문자열이 어디 있든 차단 — grep·커밋 메시지 포함.

## 6. 참고

- 리뷰 워크플로 원본 출력(리뷰어별 return 값 포함)은 세션 종료와 함께 사라질 수 있다.
  `SUMMARY.md` 와 리뷰어 리포트 8개가 디스크에 있으므로 그것으로 충분하다.
- `SUMMARY.md` 는 워크플로가 `write_blocked` 로 반환해 main 이 대신 기록했다 —
  `SUMMARY.md` 라는 basename 자체가 sub-agent Write 금지 대상이라 **정상 동작**이다.

# 변경 범위(Scope) 리뷰 — push-guard-worktree-scope

## 검증 방법

`meta.json`/`_retry_state.json` 에 기재된 28개 파일과 실제 `git diff <merge-base> --stat` 결과가
정확히 일치함을 확인했다(merge-base = `3d0bcd69b`, `git merge-base HEAD origin/main` 로 확정).
참고: 단순 `git diff origin/main` 은 origin/main 이 이 branch fork 이후 1커밋(#998, e2e 화이트리스트
드리프트 가드) 더 앞서 있어 `test_e2e_exemption_paths_sync.py` 삭제·`harness-checks.yml`·
`plan/in-progress/harness-guard-followups.md` 가 "역방향 diff" 로 섞여 나온다 — 이 3개는 이 PR 의
변경이 **아니다**(fork-point 오염, 실제 코드에는 손대지 않음). 이하 분석은 merge-base 기준
28개 파일(코드 2 + 문서 2 + 리뷰 산출물 24)로 한정한다.

## 발견사항

- **[INFO]** 없음 — 스코프 이탈로 지적할 항목이 없음

## 상세 확인 내역 (문제 없음, 근거 기록)

1. **핵심 코드 변경 = 정확히 의도된 fix 하나**
   `.claude/hooks/guard_review_before_push.py` 의 변경분은 전부 "push 가 게시하는 worktree(들)를
   cwd 대신 정확히 스코핑" 이라는 단일 목적에 수렴한다: `_worktree_branches`/`_mentions_branch`/
   `_accepts_cwd`/`_push_targets` 4개 신규 함수, 메시지 포맷에 `worktree:` 라인 추가, `main()`
   의 REVIEW/PLAN 루프를 `targets` 순회로 교체. 기존 `_is_git_push`/`_redact_inert_text` 등 push
   탐지 로직은 완전히 무손. (검증: `git diff 3d0bcd69b -- .claude/hooks/guard_review_before_push.py`)

2. **`_run_gate` DRY 추출은 스코프 크리프가 아니라 같은 PR 내 리뷰 대응**
   REVIEW/PLAN 두 게이트 루프를 `_run_gate()` 공용 헬퍼로 뽑은 것은 1차 리뷰(17_28_02)
   WARNING 4(architecture/maintainability 중복 지적)에 대한 직접 대응이며, 같은 커밋
   (`4a516b03a`)의 RESOLUTION.md·plan 체크리스트에 근거가 남아있다. "현재 작업과 무관한 리팩토링"
   이 아니라, 이 fix 자체가 만든 중복(REVIEW·PLAN 두 번 복붙)을 같은 세션 안에서 되돌린 것 —
   범위 내 후속조치로 판단.

3. **후속 커밋(`942412ea3`)의 `_run_gate(base_cwd)` 파라미터 제거도 같은 성격**
   2차 리뷰(17_51_28) WARNING 2(3명의 reviewer 가 독립 지적한 죽은 파라미터)에 대한 직접 대응.
   키워드 전용 인자(`is_blocked=`/`render=`) 전환도 그 리뷰의 INFO 11 해소 목적이 커밋 메시지에
   명시돼 있다 — 임의 스타일 변경이 아님.

4. **`import inspect`/`import subprocess` 추가는 실사용처가 있다**
   `inspect.signature`(→ `_accepts_cwd`), `subprocess.run`(→ `_worktree_branches`) 로 각각
   즉시 소비된다. 미사용 임포트 추가·불필요한 정리는 없음.

5. **`_MAX_REDACTION_INPUT` 재사용**은 새 상수를 만들지 않고 파일에 이미 있던 방어 관례를
   그대로 `_push_targets` 에 적용한 것(3d0bcd69b 시점부터 존재하던 상수) — 새로운 설정값 도입이
   아니라 기존 값 재사용.

6. **테스트 신설**(`.claude/tests/test_push_guard_worktree_scope.py`, 신규 파일)은 이번 fix가
   커버하는 모든 신규 함수·불변식(false-ALLOW 회귀 pin, PLAN 게이트 동일 스코핑, 경계 매칭,
   cwd 상시평가, no-blanket-block, BYPASS 유지, fail-open 각 경로, 길이 cap)에 1:1 대응한다.
   범위 밖 기능(예: 다른 훅·다른 게이트 로직)에 대한 테스트는 없음.

7. **`.claude/tests/README.md`** 변경은 새 테스트 파일 1건에 대한 카탈로그 행 1줄 추가뿐 —
   기존 행 재정렬·서술 변경 없음(unified diff 확인, `+1` 라인만).

8. **`plan/in-progress/push-guard-worktree-scope.md`(신규)** 는 이 작업 전용 plan 문서로
   CLAUDE.md 관례(진행 중 작업은 `plan/in-progress/<name>.md`)와 정확히 일치. 코드 변경 범위
   밖의 요구사항·기능을 기술하지 않음.

9. **`review/code/2026/07/23/{17_28_02,17_51_28}/*`(신규, 24개 파일)** 은 같은 작업의 이전 2개
   리뷰 라운드 산출물(SUMMARY/RESOLUTION/각 reviewer 리포트/retry_state/meta)이며, CLAUDE.md
   "코드 리뷰 산출물은 `review/code/**` 에 커밋" 관례상 정상적으로 버전관리 대상이다. 스코프
   이탈이 아니라 감사 추적(audit trail)의 일부.

10. **포맷팅/공백**: 새로 추가된 코드 블록 외에 기존 라인의 순수 포맷팅(공백/줄바꿈)만 바뀐
    곳은 발견되지 않았다. `main()` 안 REVIEW/PLAN 블록은 로직 자체가 `_run_gate()` 호출로
    대체된 것이라 diff 상 `-`/`+` 로 보이지만 내용이 실질적으로 달라졌으므로 "무의미한
    재포맷"이 아니다.

11. **설정 파일**: 이 PR의 실제 diff(merge-base 기준)에는 `.github/workflows/**`, `.claude/settings.json`
    등 설정 파일 변경이 전혀 없다. (`git diff origin/main` 에서 보였던 `harness-checks.yml`
    변경은 위 "검증 방법" 에서 밝힌 fork-point 오염이며 이 PR 소관이 아님 — 잘못 귀속하지
    않도록 주의.)

## 요약

이 변경은 "push 가드가 훅의 cwd 가 아니라 실제 push 대상 worktree(들)를 평가하도록" 라는 단일
정합성 fix 에 시종일관 수렴한다. 코드 변경(`guard_review_before_push.py`)은 신규 함수·메시지
필드·루프 교체 전부가 그 목적에 직결되고, 뒤이은 `_run_gate` 추출·파라미터 정리는 같은 작업
세션 내 2회의 `/ai-review` 가 지적한 중복·죽은 파라미터에 대한 근거 있는 후속조치로서 새로운
스코프 확장이 아니라 같은 fix 의 마무리다. 테스트·README 카탈로그·plan 문서·리뷰 산출물 커밋은
모두 이 저장소 관례에 정확히 부합하는 부수 파일이며 무관한 영역 수정, 불필요한 포맷팅, 임포트
정리, 주석 잡음, 설정 변경은 발견되지 않았다. `git diff origin/main` 로 단순 대조하면
`test_e2e_exemption_paths_sync.py` 삭제 등 무관한 항목이 섞여 보이지만, 이는 origin/main 이
이 branch fork 이후 별도 PR(#998)로 전진한 데 따른 diff-base 오염이며 이 PR 의 실제 변경이 아님을
merge-base(`3d0bcd69b`) 기준 재확인했다.

## 위험도

NONE

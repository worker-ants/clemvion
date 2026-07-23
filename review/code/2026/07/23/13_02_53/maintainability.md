# 유지보수성(Maintainability) 리뷰

대상: `.claude/tools/reap-merged-worktrees.sh`, `.claude/tests/test_reap_merged_worktrees.py`,
`plan/in-progress/harness-guard-followups.md` (reaper `gh pr view` N+1 → 배치 조회 전환)

## 발견사항

- **[INFO]** 정수 검증 `case` 패턴이 두 곳에 거의 동일하게 중복
  - 위치: `.claude/tools/reap-merged-worktrees.sh:64` (`MIN_INTERVAL`) 및 `:70`(`GH_PR_LIMIT`)
  - 상세: `case "$X" in ''|*[!0-9]*) X=default ;; esac` 형태의 "빈 값·비숫자면 기본값으로 폴백" 가드가
    `MIN_INTERVAL`, `GH_PR_LIMIT` 두 변수에 대해 한 줄씩 반복된다(`GH_PR_LIMIT` 쪽은 `|0` 분기가 추가돼
    완전 동일하진 않음). 현재는 2회뿐이라 심각하지 않지만, 향후 env 기반 정수 옵션이 늘어나면
    (`_validate_positive_int name default` 류 헬퍼 없이) 계속 복붙될 가능성이 있다.
  - 제안: 지금 당장 추출할 필요는 없음(2회 중복은 추출 임계값 미만). 3번째 정수 옵션이 추가되는
    시점에 공유 헬퍼 함수로 승격 고려.

- **[INFO]** `command -v "$GH"` 존재 확인이 `_load_pr_states`와 `gh_state`에 중복
  - 위치: `.claude/tools/reap-merged-worktrees.sh:76`(`_load_pr_states` 내부), `:87`(`gh_state` 내부)
  - 상세: 두 함수 모두 진입부에서 `command -v "$GH" >/dev/null 2>&1`로 gh 바이너리 존재를 각자 확인한다.
    `_load_pr_states`가 실패하면 `_pr_states=""`로 빈 채 넘어가고, `gh_state`가 다시 같은 체크를 반복한
    뒤 `pr view` 폴백을 시도한다. 로직상 오류는 아니고(각자 다른 실패 모드에 반응하려는 의도로 읽힘)
    가독성에 큰 지장도 없으나, 동일 가드가 반복되는 것은 사소한 중복이다.
  - 제안: 심각하지 않아 이번 diff에서 손댈 필요는 없음. 참고로만 기록.

- **[INFO]** 테스트 헬퍼 `_run`/`_env` 파라미터가 이번 변경으로 5~6개로 늘어남
  - 위치: `.claude/tests/test_reap_merged_worktrees.py:80`(`_env`), `:90`(`_run`)
  - 상세: `merged, gh_bin, batch_omit, list_fails` 등 불리언/컬렉션 kwargs가 계속 추가되는 패턴. 현재는
    이름이 명확하고 기본값이 있어 호출부 가독성은 유지되지만, 앞으로 시나리오가 더 늘면 파라미터 객체
    (dict나 dataclass) 형태로 리팩터할 필요가 생길 수 있다.
  - 제안: 지금은 조치 불필요(가독성 저하 없음). 다음 파라미터 추가 시점에 재검토 권고.

## 요약

`gh_state`의 순차 `gh pr view` 호출을 배치 `gh pr list` + 폴백으로 바꾸는 변경은 기존 파일의 주석
스타일(각 함수/블록 앞에 "왜"를 설명하는 상세 주석)과 네이밍 컨벤션(`_` 접두 helper, `snake_case`)을
그대로 따르고 있다. 특히 "서브셸에서 로드하면 메모가 버려진다"는 함정을 발견해 메인 셸에서 1회 선로드하도록
설계하고 그 이유를 주석·plan 문서 양쪽에 남긴 점, 배치 미스(`--limit` 밖 PR)와 배치 실패를 모두 안전하게
`pr view` 폴백으로 되돌리는 점은 가독성·의도 명확성이 높다. 테스트 쪽도 신규 5개 케이스가 각자 단일 책임
(정확히 1회 배치 호출, 두 pass 간 공유, 배치 누락 폴백, 배치 실패 폴백, 후보 0개 시 미호출)으로 나뉘어
있고 docstring이 "왜 이 테스트가 필요한가"를 명확히 서술해 기존 테스트 파일의 톤과 일관적이다. 함수 길이·
중첩 깊이·매직 넘버 모두 문제 수준이 아니며, 지적된 중복(정수 검증 case 2회, gh 존재 확인 2회)은 추출을
정당화할 만큼 반복되지 않은 INFO 수준에 그친다. 전반적으로 유지보수성 관점에서 위험 요소가 거의 없는
변경이다.

## 위험도
LOW

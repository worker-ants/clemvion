# 변경 범위(Scope) 리뷰 — reaper gh 상태조회 배치화 (§B)

## 검토 대상

- `.claude/tests/test_reap_merged_worktrees.py`
- `.claude/tools/reap-merged-worktrees.sh`
- `plan/in-progress/harness-guard-followups.md`

커밋: `260c390eb perf(harness): reaper gh 상태조회 배치화 — SessionStart N+1 제거 (§B)`
`git diff --stat origin/main` 로 확인한 변경 파일도 정확히 이 3개뿐이며, plan 문서(§B) 가
서술한 작업 범위("`gh pr list` 배치 + `--limit` 밖 폴백 + 회귀 테스트 갱신")와 1:1로 대응한다.

## 발견사항

- **[INFO]** `claude_branches` 변수 호이스팅은 기능에 필요한 최소 리팩터
  - 위치: `reap-merged-worktrees.sh` `claude_branches=$(git for-each-ref ...)` 신설 및 pass 2 heredoc 을
    `$(git for-each-ref ...)` 인라인 호출에서 `$claude_branches` 참조로 교체한 부분
  - 상세: 순수 코드 정리처럼 보일 수 있으나, (1) "후보 0개면 배치 자체를 스킵"하기 위해 후보 목록을
    배치 호출 이전에 알아야 하고, (2) pass 2 가 그 목록을 재사용하도록 만들어 `for-each-ref` 이중 실행을
    막는다. 두 필요 모두 이번 배치화 기능에 직접 종속적이며, 관련 없는 코드 정리를 끼워 넣은 사례가 아니다.
  - 제안: 없음 (현행 유지 권장)

- **[INFO]** plan 문서(`harness-guard-followups.md`) 변경은 해당 작업의 체크박스·근거 기록에 한정
  - 위치: `## B. reaper gh pr view 순차 N+1` 섹션과 하단 체크리스트의 B 항목만 변경
  - 상세: 다른 섹션(A/C/D/E/F/G/H)이나 무관한 서술은 손대지 않았고, 이번 PR 이 실제로 내린 설계 결정
    (배치 채택, `REAP_GH_PR_LIMIT` 폴백, 서브셸 함정, 신규 테스트 5건)만 사실대로 기록했다. repo 관례상
    plan 문서의 체크박스·근거 갱신은 구현과 동일 커밋에 포함되는 것이 정상 워크플로다.
  - 제안: 없음

- **[INFO]** 테스트 파일의 헬퍼 시그니처 확장은 하위호환 유지
  - 위치: `_env`/`_run` 에 `batch_omit=()`, `list_fails=False` 파라미터 추가, 신규 `_gh_calls()` 헬퍼
  - 상세: 모든 신규 파라미터가 기본값을 가져 기존 8개 테스트 호출부는 무수정으로 그대로 통과한다.
    gh stub 갱신도 기존 `pr view` 분기를 보존한 채 `pr list` 분기만 추가한 형태(diff 상 기존 라인 삭제 없음)라
    배치 기능과 무관한 동작 변경이 없다.
  - 제안: 없음

## 범위 밖 항목의 명시적 defer 확인

plan 문서 자체가 "왜 A 만 지금 하나" 절에서 §B(이번 변경)를 §A(별도 완료 작업)와 구분해 놓았고,
§C(`_lib/git_command_detection.py` 추출)·§D(push 훅 테스트)·§E(fail-open 정책)·§F(mermaid-lint 취약점,
이미 별건 PR로 처리됨)·§G(fcntl.flock)·§H(consistency 번들러)는 모두 미체크 상태로 남아 이번 diff 에
섞여 들어오지 않았음을 자체적으로 재확인한다. 실제 diff 도 이 서술과 일치한다.

## 요약

세 파일 모두 "reaper 의 gh 상태조회를 `pr view` per-branch 순차 호출에서 `pr list` 배치 + 폴백으로
전환"이라는 단일 목적에 정확히 수렴한다. 스크립트 변경은 신규 env 변수·배치 로더·폴백 로직·이를 뒷받침하는
호이스팅으로만 구성되고 무관한 포맷팅·주석·임포트·설정 변경이 없다. 테스트는 신규 동작을 검증하는 5건 추가와
그에 필요한 헬퍼 확장뿐이며 기존 테스트를 건드리지 않는다. plan 문서 갱신도 해당 항목 체크와 근거 서술에
한정된다. 요청 범위를 벗어나는 리팩토링·기능 확장·무관 파일 수정은 발견되지 않았다.

## 위험도

NONE

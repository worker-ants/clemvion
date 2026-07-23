### 발견사항

- **[INFO]** 서브셸 메모이제이션이 암묵적 계약(implicit contract)에 의존
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `_pr_states` 전역 변수, `_load_pr_states()`, `gh_state()`
  - 상세: `gh_state()`는 자신이 호출되는 시점에 메인 셸에서 `_load_pr_states()`가 먼저 실행되어 `_pr_states`를 채워뒀다는 것을 전제로 한다. 이 전제가 깨지는 유일한 경로는 "누군가 `_load_pr_states`를 서브셸(예: `$(...)` 안)에서 호출하도록 리팩터"하는 경우인데, 그 경우 배치 조회 자체는 계속 성공하지만 결과가 메인 셸로 전파되지 않아 **조용히 N+1로 회귀**한다(에러 없이, 성능만 저하). 코드 주석이 이 함정을 정확히 문서화했고, PR 자체가 `test_batches_state_lookups_instead_of_one_view_per_branch` / `test_batch_is_fetched_once_across_both_passes` 두 테스트로 이 회귀를 실측 방지(뮤턴트 검증 완료, plan 기록 확인)하므로 실질 위험은 낮다.
  - 제안: 조치 불필요(이미 회귀 테스트로 커버). 향후 이 함수를 다른 스크립트로 추출(§G 후속)할 때도 "메인 셸에서 선로드" 불변식을 테스트로 유지할 것.

- **[INFO]** 배치 조회의 동명 브랜치 tie-break가 `pr view`와 다를 수 있음
  - 위치: `.claude/tools/reap-merged-worktrees.sh` `gh_state()` 내 `awk -F'\t' -v b="$branch" '$1==b{print $2; exit}'`
  - 상세: 한 브랜치명에 대해 PR이 여러 개 존재하는 극단적 경우(예: 브랜치를 재사용해 이전 PR을 close하고 동일 이름으로 새 PR을 연 경우), 배치(`gh pr list --state all`)의 결과 순서상 첫 매치를 채택한다. 이 순서는 `gh`의 기본 정렬(생성일 기준으로 추정)에 좌우되며, 기존 `gh pr view <branch>`가 선택하던 "그 브랜치의 대표 PR"과 결과가 달라질 이론적 가능성이 있다. `claude/*` 워크트리 브랜치명은 세션마다 고유하게 생성되는 관례라 실제 재현 가능성은 낮고, 배치가 놓친 경우(오래된 PR)는 이미 폴백으로 보호되어 있어 이 항목은 참고용이다.
  - 제안: 현재 네이밍 관례상 위험 낮음. 우려 시 `sort -t$'\t' ... | uniq` 등으로 최신 PR을 우선하도록 명시하거나, 이 가능성을 스크립트 주석에 한 줄 추가.

### 요약
핵심 변경(`gh pr view` N+1 → `gh pr list` 배치 + 폴백)은 리뷰 관점에서 요구하는 8개 항목 중 실질적으로 우려되는 부분이 없다. 새 전역 상태(`_pr_states`, `GH_PR_LIMIT`, `claude_branches`)는 모두 스크립트 프로세스 로컬이며 외부로 유출되지 않는다. `for-each-ref` 결과를 pass 1 이전으로 호이스팅한 것은, pass 1이 조작하는 브랜치 집합(체크아웃된 것)과 pass 2가 조작하는 집합(danging)이 스냅샷 시점에 이미 분리되어 있어 관측 가능한 동작 변화가 없음을 확인했다(pass 1의 삭제 대상은 애초에 pass 2의 `checked_out_branches` 필터에 의해 항상 제외됨). 신규 env var `REAP_GH_PR_LIMIT`는 addable-only 인터페이스 확장이며 기존 호출자(`bootstrap-session.sh`)는 이를 설정하지 않아 기본값(200)으로 동작해 하위 호환 깨지지 않는다. 테스트 파일의 `_env`/`_run` 시그니처 변경은 옵션 kwarg 추가뿐이라 기존 호출부(모두 키워드 인자 사용)에 영향 없음, 신규 env var(`GH_CALL_LOG`/`BATCH_OMIT`/`LIST_FAILS`)는 테스트 stub 전용이라 프로덕션 스크립트에 영향 없음. 네트워크 호출 총량은 감소하는 방향이며 throttle 게이트 이전에 배치 호출이 실행되지 않도록 순서가 올바르게 유지된다. 파일시스템 부작용도 기존 마커 파일 갱신 외 신규 항목 없음(테스트 로그 파일은 tmpdir 내부, addCleanup으로 정리됨). 전반적으로 부작용 관점에서 안전하게 설계·검증된 변경이다.

### 위험도
LOW

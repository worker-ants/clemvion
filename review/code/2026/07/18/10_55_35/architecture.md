# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** mkdir 락 제거 → 마커-only 전환은 반복 반증된 안티패턴을 걷어낸 올바른 설계 대응
  - 위치: `.claude/tools/bootstrap-session.sh` 섹션 2 (`# 2. Ensure mermaid-lint deps`), 커밋 `a16d80290`
  - 상세: 이번 diff 는 `mkdir` 기반 hand-rolled advisory lock(owner PID + grace age + stale-lock steal, ~50줄)을 통째로 제거하고 완료 마커 + 실패 throttle 만 남겼다. 근거를 직접 추적: 이 락의 stale-lock reclaim 경로는 `review/code/2026/07/18/02_06_42` 라운드에서 리뷰어 2명 + 작성자 직접 재현으로 **check-then-act TOCTOU** 임이 실측 확인됐고(`_lock_is_dead && rm -rf; mkdir` 사이 원자성 없음 — 두 세션이 같은 죽은 락을 보고 둘 다 재획득 시도, 진 쪽이 이긴 쪽의 fresh 락을 지움), 이는 그 락이 막으려던 바로 그 증상(동시 npm install)을 재도입하는 결함이었다. 같은 코드 지점을 이전 두 라운드(`20_06_45`, `00_59_56`)도 각각 다른 각도(순수-age steal, `find -mmin` 분단위 truncation)로 하드닝했지만 매번 다음 라운드에서 새 동시성 결함이 재현됐다 — 즉 결함이 개별 버그가 아니라 "OS advisory locking 을 셸 `mkdir` 로 재발명"한 설계 자체의 문제였다는 뜻이다. 이번 diff 는 그 패턴을 계속 패치하는 대신 제거를 선택했고, 올바른 primitive(`fcntl.flock`, 커널이 홀더 사망 시 자동 해제)는 재발명하지 않고 실제 필요해질 때로 명시적으로 이연했다(`plan/in-progress/harness-guard-followups.md` §G). 수용한 잔여 리스크(첫 콜드스타트 동시 설치 가능성)는 영향 범위(dev 툴 린터 한정)·복구 절차(`rm -rf node_modules` 수동)와 함께 코드 주석에 정직하게 문서화되어 있고, 테스트도 이전엔 "정확히 1회 설치"를 단언하던 것을 "수렴(마커 존재 + 이후 skip)"으로 낮춰 실제 보장 범위와 정합시켰다(`test_concurrent_cold_start_converges_and_then_stops_reinstalling`). 제거 자체도 깨끗함 — `_lock_is_dead`/`.install.lock`/`MERMAID_INSTALL_LOCK_GRACE_SEC` 에 대한 살아있는 참조가 `.gitignore`·소스·문서 어디에도 남아있지 않음을 저장소 전체 grep 으로 직접 확인했다(과거 라운드의 `review/` 히스토리 아카이브와 `plan/in-progress/harness-guard-followups.md` 의 "왜 뺐는가" 회고 서술 제외). 반복적으로 반증되는 "안전하다" 주장을 계속 하드닝하기보다 설계를 단순화한 판단은 이 저장소가 최근 다른 가드(push 가드 서브커맨드 재작성)에서도 도달한 것과 같은 계열의 결론이다.
  - 제안: 없음 (긍정 기록).

- **[INFO]** 섹션 4(reap anchor)의 세션-파괴 방지가 단일 신호(`BASH_SOURCE` 경로 해석)에 의존 — 다만 리퍼 자체의 독립적 cwd-skip 이 2차 방어선
  - 위치: `.claude/tools/bootstrap-session.sh:152-156` (`anchor=$(cd ... && pwd -P) || anchor=""` → `bash "$reaper" ${anchor:+--keep "$anchor"}`)
  - 상세: 이번 diff 대상은 아니지만(마지막 커밋은 섹션 2만 건드림) 리뷰 페이로드에 전체 파일이 포함되어 있어 함께 확인했다. `anchor` 계산이 실패하면(디렉터리 접근 불가 등) `--keep` 없이 리퍼가 실행된다. 다만 `reap-merged-worktrees.sh` 자신도 "Never touch the worktree the current shell is in (primary safety guard)" 라는 독립적인 cwd 기반 1차 스킵을 갖고 있어(직접 확인), anchor 해석 실패가 곧바로 세션 파괴(#965 급 사고)로 이어지려면 ① cwd 가 이미 anchor 와 발산한 상태(`EnterWorktree` 이후) **AND** ② anchor 해석 자체도 실패 **AND** ③ 해당 워크트리 브랜치의 PR 이 이미 `gh` 로 MERGED 확인 가능 — 세 조건이 동시에 겹치는 좁은 복합 경로다. 이 정확한 조합(anchor 해석 실패 시 폴백 동작)을 전용으로 pin 하는 테스트는 이번 리뷰 파일 목록(`test_bootstrap_mermaid_install.py`)에는 없고, `test_reap_merged_worktrees.py` 자체는 리뷰 대상 파일 목록 밖이라 확인 범위 밖이다.
  - 제안: 급하지 않음 — 이미 다층 방어(cwd-skip + dirty-skip + MERGED 확인)가 존재하고 이 파일은 이미 여러 라운드의 집중 리뷰를 거쳤다. 여유가 있을 때 "anchor 해석 실패 시 리퍼가 여전히 cwd-skip 으로 보호됨"을 pin 하는 회귀 테스트 1건을 고려.

## 요약

이번 diff(커밋 `a16d80290`)는 3라운드에 걸쳐 반증된 hand-rolled `mkdir` 락(TOCTOU 결함이 있는 stale-lock reclaim)을 제거하고 이미 실질적 목표를 달성하던 마커+throttle 메커니즘만 남기는 **의도적 단순화**다. 구조적으로 확인한 결과: 정책 로직(`_lib/mermaid_lint_ready.py`)은 bootstrap(writer)·pre-commit(bash reader)·PostToolUse(python reader) 세 소비처가 공유하는 단일 SoT 로 온전히 유지되고, bash/python 언어 경계를 넘는 상수 중복(마커 파일명)은 별도 binding 테스트로 보호된다. 순환 의존은 관찰되지 않으며(bootstrap → reap-merged-worktrees.sh, pre-commit → branch_guard.py/mermaid_lint_ready.py/lint-mermaid.mjs 모두 단방향), 테스트 파일 구조도 프로덕션 스크립트의 책임 경계(설치 가드 vs GC vs reap)를 그대로 반영해 응집도가 높다. 제거 작업 자체도 깨끗해서 `.gitignore`·코드·문서 어디에도 죽은 락 관련 심볼의 살아있는 참조가 남지 않았다. 유일하게 재확인이 필요한 부분(섹션 2/4의 추출 비대칭)은 이미 `plan/in-progress/harness-guard-followups.md` §G 로 추적·이연 결정된 사안이라 새 지적으로 올리지 않았다. 전반적으로 SOLID·결합도/응집도·레이어 책임·안티패턴 회피 관점에서 건전하며, 이번 변경은 아키텍처를 더 단순하고 정직하게(보장 범위를 과장하지 않는 방향으로) 만들었다.

## 위험도

LOW

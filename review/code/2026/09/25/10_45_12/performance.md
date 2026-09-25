# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `make_temp_repo_copy` 가 프로브마다 서브트리 전체 복사 + git 서브프로세스 7회(init·config×2·초기 commit·add·commit·update-ref)를 반복한다
  - 위치: `.claude/tests/_harness.py:138`(`make_temp_repo_copy` 정의) — `:167` `shutil.copytree`, `:168-170` `git add -A` / `git commit` / `git update-ref`.
    호출부(`five_system_copy` 경유, `spec/5-system` 서브트리): `.claude/tests/test_consistency_bundle_priority.py:654, 691, 728, 781, 899`(5곳) + `TheRepoCopyFixtureTest.test_no_subtrees_is_an_empty_copy_not_an_error`(`:796` 부근, 서브트리 없이 빈 커밋만).
  - 상세: 이전 방식(`shutil.copy` 로 파일 1개만 백업 후 원복)에서 전체 서브트리 `copytree` + git 저장소 생성/커밋으로 바뀌면서 프로브 1회당 파일 I/O(디렉터리 트리 복사)와 git 프로세스 spawn 비용이 늘었다. 5곳이 동일한 `spec/5-system` 서브트리를 매번 독립적으로 복사·커밋하며, 클래스/모듈 스코프로 캐싱하지 않는다. `run_in_orchestrator` 가 이미 프로브마다 새 인터프리터를 fork 하는 기존 오버헤드 위에 얹히는 추가 비용이다.
  - 제안: 대상 서브트리 규모(`spec/5-system` 18개 파일·1.4MB, plan `harness-probe-isolation.md` §C 실측 fixture 0.115초)에서는 무시 가능한 수준이라 이번 스코프에서 정정을 요구하지 않는다. 다만 이 패턴이 더 큰 디렉터리(`spec/` 전체 등)로 확산되거나 프로브 수가 늘면, 서브트리를 한 번만 커밋한 "베이스 사본"을 `setUpClass`/모듈 fixture 로 만들고 테스트마다는 그 디렉터리를 `shutil.copytree`(또는 하드링크)로 얕게 복제하는 방식을 고려할 만하다. 이는 이전 라운드(`review/code/2026/09/25/10_27_27/performance.md`)에서도 지적된 동일 지점이며 이번 커밋 이후에도 근본적으로 달라지지 않았다 — 호출부가 4곳에서 5곳(+ 빈 커밋 케이스 1곳)으로 소폭 늘었을 뿐 규모상 여전히 문제 되지 않는다.

- **[INFO]** `test_router_decision_trust.py` 의 임시 디렉터리 위치 변경은 성능 중립
  - 위치: `.claude/tests/test_router_decision_trust.py:381`(`tmp_src = tempfile.mkdtemp()`, 이전엔 `dir=str(REPO_ROOT)`).
  - 상세: 생성 위치만 저장소 트리 밖의 시스템 임시 경로로 바뀌었고, 파일을 만들어 subprocess cwd 로 넘겨 읽기만 하므로 파일시스템 종류가 달라져도(예: tmpfs) 실행 시간에 유의미한 영향이 없다.
  - 제안: 조치 불요, 참고용으로만 기재.

## 요약

이번 diff 는 `.claude/tests/**` 하네스 전용 변경(신규 헬퍼 `make_temp_repo_copy`, 이를 쓰도록 옮긴 4개 테스트 파일, 관련 plan/CHANGELOG/이전 리뷰 산출물)으로 프로덕션 `codebase/**` 런타임 경로에는 전혀 영향이 없다. 핵심은 병렬 pytest 실행이 실제 저장소 트리를 밟던 경쟁을 "파일 1개 백업/복원" 대신 "서브트리 전체를 임시 git 사본에 커밋" 하는 방식으로 바꾼 것으로, 격리를 얻는 대신 프로브당 디렉터리 복사 + git 프로세스 비용을 추가로 지불하는 트레이드오프다. 대상 서브트리 규모(18개 파일·1.4MB, 실측 0.115초/copy)에서 이 비용은 서브초 단위로 무시 가능하며, 알고리즘 복잡도·N+1 호출·메모리 누수·블로킹 I/O 등 심각한 성능 문제는 발견되지 않았다. 유일하게 짚을 점은 동일 서브트리를 5~6곳이 매번 독립적으로 복사·커밋한다는 것으로, 이는 이전 리뷰 라운드(`10_27_27`)에서 이미 INFO 로 지적되고 조치 불요로 처분된 사항과 본질적으로 동일하며 이번 라운드의 변경(호출부 통합 `five_system_copy`, `--allow-empty` 추가)도 이 특성을 바꾸지 않는다.

## 위험도
NONE

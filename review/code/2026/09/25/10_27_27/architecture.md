# 아키텍처(Architecture) 리뷰

이번 변경은 **전부 `.claude/tests/**` harness 코드 · `CHANGELOG.md` · `plan/**` · `review/consistency/**` 산출물**이며 `codebase/**` 제품 코드는 건드리지 않는다. 따라서 프레젠테이션/비즈니스/데이터 레이어 분리 같은 제품 아키텍처 질문은 적용 대상이 없고, 분석은 **테스트 픽스처 설계의 아키텍처 품질**(SRP, 결합도, 확장성, 기존 확장점 재사용)에 집중했다.

## 발견사항

- **[INFO]** 격리 픽스처 3~4곳이 "임시 환경 구성 → subprocess 실행 → stdout 마지막 줄에서 세션 경로 파싱" 보일러플레이트를 각자 독립적으로 재구현한다.
  - 위치: `.claude/tests/test_router_decision_trust.py:335` (`_prepare_over`), `.claude/tests/test_consistency_target_validation.py:35` (`_run`), `.claude/tests/test_consistency_spec_draft_snapshot.py:57` (`_run`)
  - 상세: 셋 다 "env 오버라이드 + cwd 지정 + `subprocess.run` + 마지막 stdout 줄을 세션 디렉터리로 해석" 이라는 같은 뼈대를 갖지만, env 변수 이름(`REVIEW_OUTPUT_DIR` vs `CONSISTENCY_OUTPUT_DIR`)과 cwd/env 중 무엇을 오버라이드하는지가 갈려 하나의 헬퍼로 강제 통합하면 조건분기가 늘어난다. 이 저장소의 기존 선례(`project_reaper_engine_dry_refactor` — "진짜 동일한 보일러플레이트만 추출, axes 가 발산하면 full-unification 은 defer")에 비춰보면 지금 단계에서 통합을 요구할 정도는 아니다.
  - 제안: 지금 당장 리팩터링할 필요는 없음. 다섯 번째로 유사한 격리 픽스처가 추가되는 시점에 `_harness.py` 에 `run_isolated(orch, *args, cwd=None, env_overrides=None)` 류 공용 헬퍼로 추출을 재검토할 것.

- **[INFO]** `make_temp_repo_copy` 가 소스 서브트리를 git 객체(`git show`/`git archive`)가 아니라 **살아있는 워킹트리 파일**을 `shutil.copytree` 로 그대로 읽어 복사한다.
  - 위치: `.claude/tests/_harness.py:138` (`make_temp_repo_copy`), 실사용처 `.claude/tests/test_consistency_bundle_priority.py:766`(`TheRepoCopyFixtureTest`)
  - 상세: 이번 PR 이 닫은 경쟁은 "쓰기 측"(하네스가 실제 체크아웃에 프로브를 쓰고 `cp` 로 되돌리는 동안 남과 충돌)이다. 그런데 `make_temp_repo_copy` 의 복사 자체는 `REPO_ROOT / rel` 을 실시간 파일시스템에서 읽으므로, 복사가 진행되는 그 찰나에 같은 서브트리(`spec/5-system`)를 편집 중인 **다른** 프로세스(다른 세션의 planner 편집, 훅 등)가 있다면 이론적으로 부분 쓰기 상태를 읽는 좁은 창이 남는다. `.claude/tests/README.md:109`·`CHANGELOG.md` 의 "이 체크아웃에 쓰지 않는다" 서술은 하네스 자신의 쓰기 문제를 정확히 겨냥한 것이라 틀린 진술은 아니지만, "격리됐다"는 인상이 읽기 경쟁까지 닫았다고 확대 해석되지 않도록 주의가 필요하다.
  - 제안: 심각도가 낮고(발생 빈도 극히 낮음, 실패해도 flaky 테스트로만 드러남) 이번 스코프에서 고칠 필요는 없다고 판단되나, 후속 문서화 시 "쓰기 측 경쟁만 해소했다"는 범위를 명확히 하면 다음 사람이 "완전히 격리됐다"로 오독하지 않는다.

## 설계상 긍정적으로 확인한 점 (참고용, 조치 불요)

- `make_temp_repo_copy`(`.claude/tests/_harness.py:138`)는 새 원시 로직을 작성하지 않고 기존 `make_temp_git_repo`(`.claude/tests/_harness.py:119`)에 위임하는 합성 구조다. consistency-checker 가 지적한 이름·역할 겹침(W2, `review/consistency/2026/09/25/09_56_00/naming_collision.md`)이 상속이 아니라 위임으로 해소되어 SRP·DRY 가 잘 유지된다.
- 네 테스트 파일 모두 "오케스트레이터의 루트 해석 방식(cwd 또는 인자)"이라는 **기존에 이미 열려 있던 확장점**을 그대로 이용해 격리를 달성했고, 테스트만을 위한 새 파라미터·백도어를 프로덕션 코드(orchestrator)에 추가하지 않았다(OCP 관점에서 프로덕션 진입점은 닫힌 채 유지). `plan/in-progress/harness-probe-isolation.md` §C 가 이를 실측으로 검증해 근거를 남긴 점도 확인했다.
- `make_temp_repo_copy(path, *subtrees: str)` 는 가변 인자로 여러 서브트리를 조합할 수 있어, 향후 다른 spec 디렉터리를 함께 필요로 하는 테스트가 추가돼도 API 변경 없이 확장 가능하다.
- 리뷰 산출물(`review/consistency/2026/09/25/09_56_00/**`)이 harness 코드·plan 문서와 분리된 디렉터리에 위치해 CLAUDE.md 의 "정보 저장 위치" 경계를 그대로 따른다 — 모듈/영역 경계 위반 없음.

## 순환 의존성 / 레이어 / 디자인 패턴

새로 추가된 `make_temp_repo_copy` 는 같은 모듈(`_harness.py`) 내부 함수만 호출하고, 네 테스트 파일은 모두 `_harness` 를 단방향으로 import 한다 — 순환 의존 없음. 패턴 관점에서는 Test Data Builder(`make_temp_git_repo` → `make_temp_repo_copy` 위임)와 Dependency Injection(오케스트레이터의 cwd/인자 기반 루트 주입)이 적절히 쓰였고, 안티패턴(테스트만을 위한 프로덕션 코드 오염, God 헬퍼 등)은 발견되지 않았다.

## 요약

harness-only 변경으로 제품 레이어 아키텍처에는 영향이 없으며, 테스트 픽스처 설계 자체는 기존 확장점 재사용·위임을 통한 중복 회피·가변 인자를 통한 확장성 확보 등 견고한 선택으로 평가된다. 지적한 두 건은 모두 INFO 수준으로, 하나는 저장소의 "동일하지 않은 보일러플레이트는 섣불리 통합하지 않는다"는 기존 방침에 비춰 지금 통합할 필요가 없는 잔여 중복이고, 다른 하나는 이번 PR 이 실제로 닫은 경쟁(쓰기 측)과 문서가 암시할 수 있는 범위(전체 격리) 사이의 미묘한 간극이다. 병합을 막을 아키텍처적 결함은 없다.

## 위험도
LOW

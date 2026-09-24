# 아키텍처 리뷰: docs-guard-trigger (2라운드 — CI 워크플로 스코프 확장 + 1라운드 조치분)

## 검토 범위

이번 diff 는 (1) 실제 기능 변경 6개 파일 — `.github/workflows/spec-link-checks.yml`, `.claude/tests/test_spec_link_checks_scope.py`(신규), `.claude/tests/README.md`, `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/docs-guard-trigger.md` — 와 (2) 1라운드 리뷰/컨시스턴시-체크 산출물(`review/code/2026/09/24/21_16_58/**`, `review/consistency/2026/09/24/21_04_26/**` 등, 27개 파일)로 구성된다. (2)는 리포트/JSON 산출물이며 프로젝트 컨벤션(`CLAUDE.md` §정보 저장 위치, `review/` 커밋 관례)대로 저장소에 남긴 것이라 아키텍처 관점 결함 대상이 아니다. 1라운드 architecture reviewer 본인의 산출물(`review/code/2026/09/24/21_16_58/architecture.md`)도 이번 diff 에 포함돼 있어 교차 확인했다.

실제 코드 변경은 `.github/workflows/spec-link-checks.yml` 을 `git log`(`1e047b716`, `32b97f944`) 이후 기준으로 직접 열어 현재 저장소 상태와 diff 게이트 번호가 일치함을 확인했고, 신규 테스트 `test_spec_link_checks_scope.py` 도 마찬가지로 대조했다.

## 발견사항

- **[INFO]** `spec-link-integrity` 잡 id 가 이제 이름보다 훨씬 넓은 다수 가드(디렉터리 전체)를 수행 — 공개 인터페이스(체크 이름)와 실제 책임의 불일치
  - 위치: `.github/workflows/spec-link-checks.yml` — `spec-link-integrity:` 잡 정의(93행), `run: pnpm --filter frontend test src/lib/docs/__tests__/` 스텝(118행)
  - 상세: GitHub PR UI·branch protection 에 노출되는 체크 이름 `spec-link-integrity` 는 여전히 "링크 무결성"만 암시하지만, 실제로는 `plan-frontmatter`·`spec-frontmatter`·`spec-pending-plan-existence` 등 서로 다른 검증 책임을 한 잡이 대신 떠안는다(SRP 관점의 이름-책임 불일치). `#1106` required-check 앵커 안정성 제약 때문에 즉시 개명이 어렵다는 트레이드오프는 헤더 주석(88~92행)이 스스로 밝히고 있고, `review/consistency/2026/09/24/21_04_26/naming_collision.md` 도 같은 사안을 INFO 로 이미 포착했다. 새로 발견한 결함이 아니라 의도된 트레이드오프의 재확인.
  - 제안: 조치 불요(설계 근거 문서화 완료). 후속으로 잡 id 와 별개로 워크플로 `name:`/스텝 표시명(이미 "docs guards (src/lib/docs/__tests__ 전체)"로 갱신됨)에 실제 스코프를 계속 노출하는 관례를 유지.

- **[INFO]** "가벼운 대체 트리거"라는 설계 불변식이 코드/테스트로 강제되지 않고 관례로만 유지됨
  - 위치: `.github/workflows/spec-link-checks.yml:118`(`run:` 커맨드), 근거 주석 30~32행
  - 상세: 파일 열거 → 디렉터리 전체 실행으로 바꾼 것은 "새 가드가 생겨도 워크플로를 잊지 않고 함께 돈다"는 개방-폐쇄 원칙(OCP) 개선이며, 그 대가로 "그 디렉터리에는 가벼운 docs 가드만 존재한다"는 암묵적 전제에 의존한다. 이 전제를 검증하는 실행시간 상한 테스트나 파일명 컨벤션 가드는 없다. 향후 그 디렉터리에 무거운(네트워크·긴 타임아웃) 테스트가 섞이면 "lightweight 대체 트리거"라는 워크플로의 존재 이유가 조용히 무너질 수 있다.
  - 제안: 이번 PR 스코프 밖. 후속으로 실행시간 상한을 검증하는 하네스 테스트 검토(1라운드 SUMMARY INFO#4 와 동일 결론).

- **[INFO]** 저장소 전역 문서 거버넌스 가드가 `codebase/frontend` 패키지 테스트 트리에 물리적으로 결합 — 이번 변경으로 그 결합이 실행 경계로서 더 굳어짐
  - 위치: `.github/workflows/spec-link-checks.yml:110-118`
  - 상세: `spec/**`·`plan/**`·거버넌스 문서 전체를 검증하는 관심사가 `codebase/frontend/src/lib/docs/__tests__/` 안에 있고 `pnpm --filter frontend test` 로만 실행된다. 이 구조 자체는 이번 PR 이 만든 것이 아니지만, "파일 열거 → 디렉터리째 실행"으로 바뀌며 그 디렉터리가 "문서 거버넌스 전체"의 유일한 CI 실행 단위로 더 단단히 결합됐다. 새 워크플로 잡이 이 디렉터리를 추가하려면 frontend 패키지 설치까지 전제해야 한다.
  - 제안: 즉시 조치 불요. 후속으로 별도 workspace(`packages/repo-guards` 유사) 추출 여부는 이 PR 범위를 넘는 검토 사안.

- **[INFO]** 워크플로 YAML 헤더에 세 차례(도입 배경/`#912`, 2026-08-27, 2026-09-24) 사고 이력이 반복 누적
  - 위치: `.github/workflows/spec-link-checks.yml:1-32`
  - 상세: 전체 119줄 중 상단 32줄(≈27%)이 사고 이력 서술이다. 같은 사실(가드 트리거 갭)이 본문 헤더·잡 주석(88~92행)·스텝 주석(115행)에 부분 중복 반복된다. 가독성에 아직 지장은 없으나, 이 파일이 이런 갭을 세 번째 겪었다는 점에서 앞으로도 같은 패턴으로 계속 길어질 구조다.
  - 제안: 조치 불요(이 저장소의 기존 관례와 일치, 1라운드에서도 동일하게 INFO 처리·"이 PR 스코프 밖"으로 분류됨). 장기적으로 이력을 별도 컨벤션 문서로 옮기고 헤더엔 짧은 포인터만 남기는 정리 고려.

- **[INFO]** 신규 회귀 테스트가 sibling 테스트 모듈의 헬퍼를 직접 import — 테스트 간 결합이지만 의도적 재사용
  - 위치: `.claude/tests/test_spec_link_checks_scope.py` (`from test_harness_checks_paths_coverage import parse_pathspecs_block`)
  - 상세: 파서를 재구현하지 않고 기존 검증된 파서를 재사용한 것은 이 하네스가 이미 확립한 패턴(README `test_workflow_run_inputs_covered.py` 항목: "`filter_covers_file` 이 sibling module 에서 reuse 되어 두 가드가 GitHub 규칙을 동일하게 모델링")과 일치하며, 오히려 재구현 시 발생했던 과거 결함(패턴 drift)을 피하는 설계다. 다만 테스트 모듈이 다른 테스트 모듈의 내부 함수에 의존하는 형태가 늘어나면 어느 파일을 지워도 되는지 판단이 어려워지는 결합이 누적될 수 있다.
  - 제안: 조치 불요 — 현재는 정당한 트레이드오프. 이 재사용 패턴이 셋 이상으로 늘어나면 `parse_pathspecs_block` 류 공용 파서를 `_harness.py` 로 승격하는 것을 후속 검토.

## 순환 의존성 확인

`test_spec_link_checks_scope.py` → `test_harness_checks_paths_coverage.py` 단방향 import 만 존재하며, 역방향 참조나 순환은 없음을 확인했다(`grep`으로 `test_harness_checks_paths_coverage.py` 가 `test_spec_link_checks_scope` 를 import 하지 않음을 확인).

## 요약

이번 diff 의 실질 아키텍처 변화는 CI 워크플로(`spec-link-checks.yml`)의 트리거 pathspec 에 `plan/**` 을 추가하고, 단일 테스트 파일 실행을 디렉터리 전체 실행으로 바꿔 "새 docs 가드가 추가돼도 트리거 워크플로를 잊지 않고 함께 돈다"는 개방-폐쇄 원칙에 부합하는 방향으로 결합도를 낮춘 것이다. 1라운드 리뷰에서 지적된 4건의 WARNING(회귀 테스트 부재·헤더 stale·CHANGELOG 누락·consistency meta.json scratch 경로)은 커밋 `32b97f944`로 전부 조치되었고, 신규 회귀 테스트(`test_spec_link_checks_scope.py`)는 공유 파서 재사용·뮤테이션 검증(RESOLUTION.md W2)까지 갖춰 공허하지 않다. 남아 있는 사안은 전부 INFO 수준으로, (1) 체크 이름이 실제 책임 범위보다 좁은 인터페이스 부정합, (2) "가벼운 트리거" 불변식이 구조적으로 강제되지 않는 점, (3) 문서 거버넌스 가드가 frontend 패키지에 물리적으로 결합된 기존 구조가 더 굳어진 점, (4) 워크플로 헤더의 사고 이력 누적이며, 모두 의도된 트레이드오프로 근거 문서(`plan/in-progress/docs-guard-trigger.md` §B, 워크플로 헤더 주석)에 이미 기록돼 있어 이번 PR 범위에서 추가 조치가 필요하지 않다. 새로 도입된 구조적 결함이나 순환 의존성은 발견되지 않았다.

## 위험도
LOW

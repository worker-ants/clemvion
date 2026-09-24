# 의존성(Dependency) 리뷰

## 검토 범위 참고

이번 diff(33개 파일)는 다음으로 구성된다:

- `.github/workflows/spec-link-checks.yml` — CI 워크플로 pathspec(`plan/**` 추가)·실행 범위(파일→디렉터리) 확장, 헤더/잡/스텝 주석 갱신
- `.claude/tests/README.md`, `.claude/tests/test_spec_link_checks_scope.py`(신규) — 하네스 회귀 테스트 + 카탈로그 등재
- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/docs-guard-trigger.md`(신규) — 문서·plan
- `review/code/2026/09/24/21_16_58/*`, `review/consistency/2026/09/24/{20_34_01,21_04_26}/*` — 1라운드 리뷰·컨시스턴시 산출물(신규 커밋, 읽기전용 리포트)

**패키지 매니페스트(`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `requirements*.txt` 등) 변경은 이 diff 어디에도 없다.** 새 외부 의존성 추가·버전 변경·라이선스 이슈는 원천적으로 발생하지 않는다. 점검 관점 1~7(신규 의존성/버전 고정/라이선스/취약점/불필요한 의존성/의존성 크기/기존 의존성 호환성)은 전부 **해당 없음** — 이는 동일 changeset 을 다룬 직전 라운드(`review/code/2026/09/24/21_16_58/dependency.md`)의 결론과 일치하며, 그 라운드 이후 추가된 커밋(`32b97f944` 등)에도 매니페스트 변경은 없다.

## 발견사항

- **[INFO] 새 하네스 테스트가 sibling 테스트 모듈에 함수 단위로 의존 — 관점 8(내부 의존성)**
  - 위치: `.claude/tests/test_spec_link_checks_scope.py` (`from test_harness_checks_paths_coverage import parse_pathspecs_block`)
  - 상세: 신설된 `test_spec_link_checks_scope.py` 는 워크플로의 `pathspecs:` 블록을 파싱하기 위해 자체 구현을 두지 않고 `test_harness_checks_paths_coverage.py` 의 `parse_pathspecs_block` 을 직접 import 한다. 파일 자체 docstring 이 이 결합을 명시적으로 의도했다고 밝힌다("재구현하면 진짜 파서를 못 따라간다"). `parse_pathspecs_block` 쪽에서 이 신규 파일을 import 하지 않아 순환 의존은 없음을 `.claude/tests/test_harness_checks_paths_coverage.py:85-143` 로 확인했다. 다만 이 결합의 성격상, 향후 `test_harness_checks_paths_coverage.py` 가 함수명을 바꾸거나 반환 형식을 바꾸면 이 신규 테스트가 (의도와 무관하게) 함께 깨진다 — 두 파일이 각각 별도 가드(`harness-checks.yml` pathspec 커버리지 vs `spec-link-checks.yml` 스코프)를 지키면서도 파서 구현 하나를 공유하는 구조다.
  - 제안: 조치 불요 — 재구현(DRY 위반·drift 위험)보다 이 방향이 낫다는 판단은 타당하고, 두 파일 모두 `.claude/tests/` 안에서 함께 관리되므로 리네임 시 즉시 import 에러로 드러난다(silent breakage 아님). 다만 `parse_pathspecs_block` 을 리팩터링하는 후속 PR 이 있다면 이 신규 파일이 소비자 중 하나임을 그 리뷰에서 함께 확인할 필요가 있다.

- **[INFO] 1라운드 대비 신규 변경분에도 CI 잡의 "디렉터리 의존"·`plan/**` 트리거 확대는 동일 — 재확인**
  - 위치: `.github/workflows/spec-link-checks.yml`(변경 없음, 1라운드에서 이미 지적·조치 불요로 처분), `CHANGELOG.md`(신규 항목), `PROJECT.md`(신규 서술)
  - 상세: 이번 라운드에서 추가된 것은 그 설계를 고정하는 회귀 테스트(`test_spec_link_checks_scope.py`)와 CHANGELOG/README 문서화이며, 워크플로 자체의 pathspec·실행 범위는 1라운드 diff 와 동일하다. 1라운드 dependency 리뷰가 이미 이 두 가지(디렉터리 전체 fan-in, `plan/**` 트리거 확대)를 INFO 로 포착·조치 불요로 처분했고, RESOLUTION.md 는 그 처분을 유지했다. 새로 재론할 사실 변화는 없다.
  - 제안: 조치 불요(중복 처분 방지 목적으로만 기록).

## 요약

이번 diff 는 CI 워크플로(YAML)·하네스 테스트(Python)·문서(PROJECT.md/CHANGELOG.md)·plan·리뷰 산출물로만 구성되며 패키지 매니페스트 변경이 전혀 없어, 신규 의존성·버전 고정·라이선스·취약점·불필요한 의존성·크기·기존 의존성 호환성 관점(1~7)은 모두 해당 사항이 없다. 의존성 관점에서 유일하게 볼 만한 대목(관점 8, 내부 의존성)은 신설된 `test_spec_link_checks_scope.py` 가 `test_harness_checks_paths_coverage.py` 의 파서 함수를 직접 import 해 재구현을 피한 결합인데, 순환 의존이 없고 파일 docstring 이 그 결합을 의도로 명시하고 있어 리스크는 낮다. 워크플로 자체의 트리거 표면 확대·디렉터리 fan-in 실행은 1라운드에서 이미 INFO 로 처분된 사실의 재확인일 뿐 새 사실은 없다.

## 위험도
NONE

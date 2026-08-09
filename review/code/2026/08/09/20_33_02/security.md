# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** 이번 PR 로 skip-job 패턴에 새로 편입되는 4개 워크플로(`packages-checks.yml` · `spec-link-checks.yml` · `web-chat-checks.yml` · `migration-check.yml`)와 이들이 공유하는 reusable workflow `_changed-paths.yml` 에 `permissions:` 블록이 없다. 같은 PR 에서 함께 전환된 `harness-checks.yml` 은 `permissions: contents: read` 를 명시한다(`.github/workflows/harness-checks.yml:24`).
  - 위치: `.github/workflows/packages-checks.yml`, `.github/workflows/spec-link-checks.yml`, `.github/workflows/web-chat-checks.yml`, `.github/workflows/migration-check.yml`, `.github/workflows/_changed-paths.yml` — 전체 파일(신규 `permissions:` 라인 없음)
  - 상세: `permissions:` 미선언 워크플로는 조직/저장소 기본 `GITHUB_TOKEN` 권한(기본값에 따라 `write` 를 포함할 수 있음)을 그대로 상속한다. `git log -p` 로 확인한 결과 이 다섯 파일은 이번 PR 이전부터 `permissions:` 를 가진 적이 없어 **이번 diff 가 만든 회귀는 아니다** — 기존 상태가 그대로 유지된 것뿐이다. 다만 각 잡이 실제로 필요로 하는 것은 `actions/checkout`(읽기)뿐이므로, least-privilege 관점에서는 `harness-checks.yml` 과 동일하게 `contents: read` 를 명시하는 편이 일관적이고 안전하다. 로컬 reusable workflow(`uses: ./...`)로 호출되는 `_changed-paths.yml` 역시 자신의 `permissions:` 를 선언하지 않으면 호출자의 (미선언 시 기본) 권한을 그대로 물려받는다.
  - 제안: 이번 PR 의 스코프는 아니지만, 후속으로 다섯 워크플로 모두에 `permissions: contents: read` 를 명시해 harness-checks.yml 과 일관시키는 것을 권장. Critical/Warning 아님 — 정보성 하드닝 제안.

- **[INFO]** `_changed-paths.yml` 은 `inputs.pathspecs` 를 `run:` 블록 문자열에 직접 삽입하지 않고 `env:` 로 넘겨받아 스크립트 인젝션(CWE-94, 고전적 GitHub Actions `${{ }}`-in-`run:` 취약점)을 피하고 있으며, 이를 `test_changed_paths_reusable.py::WiringTest.test_run_block_never_interpolates_expressions` 로 회귀 고정까지 해 두었다. 새 `case "$spec" in '#'*) continue ;; esac` 분기도 `$spec` 을 셸 코드로 평가하지 않고 패턴 매칭만 수행해 동일 원칙을 유지한다.
  - 위치: `.github/workflows/_changed-paths.yml:73` (`PATHSPECS: ${{ inputs.pathspecs }}`), `.github/workflows/_changed-paths.yml:106-108` (신규 `case` 분기)
  - 상세: `inputs.pathspecs` 자체도 PR 제목/브랜치명 등 공격자 통제 가능한 GitHub 이벤트 필드가 아니라, 각 호출부 워크플로(`harness-checks.yml` 등)에 하드코딩된 리터럴 pathspec 목록이므로 인젝션 표면이 이중으로 닫혀 있다.
  - 제안: 없음 — 모범 사례로 인정, 변경 불필요.

- **[INFO]** 빈 pathspec 목록/주석만 남은 목록에 대해 `_changed-paths.yml`(exit 2), `test_changed_paths_reusable.py`, `test_harness_checks_paths_coverage.py`(`_MIN_FILTERS` 바닥) 가 모두 fail-closed 로 설계·테스트되어 있다. 판정 스크립트가 실패하거나 값이 비면(`needs.changes.outputs.relevant` 가 빈 문자열) 스텝은 `!= 'false'` 조건에 의해 **실행되는 쪽**(안전한 과다실행)으로 fail-safe 하게 떨어지도록 설계되어 있다 — required check 가 조용히 사라지는 방향과 반대다.
  - 위치: `.github/workflows/_changed-paths.yml:113-116` (`exit 2` on empty `FILTERED`), 각 워크플로의 `if: needs.changes.outputs.relevant != 'false'`
  - 상세: 가용성/무결성(게이팅이 조용히 무력화되는 것을 막는) 관점의 방어적 설계로, 보안적으로 문제 되는 패턴 없음.
  - 제안: 없음.

## 요약

이번 변경분은 애플리케이션 런타임 코드가 아니라 CI/CD 파이프라인 구성(GitHub Actions 워크플로 YAML, harness 테스트, 프런트엔드 리포 가드 테스트)에 한정되어 있어 SQL/XSS/커맨드 인젝션·인증/인가·암호화·입력검증 등 전형적인 애플리케이션 보안 취약점의 공격 표면이 사실상 없다. CI 파이프라인 자체의 보안(스크립트 인젝션) 관점에서는 오히려 모범적이다 — `${{ }}` 를 `run:` 문자열에 직접 삽입하지 않고 `env:` 로 우회하는 원칙을 지키며 이를 전용 회귀 테스트로 고정했고, 새로 추가된 `#`-주석 스트리핑 로직(bash `case` 문 / Python 파서 2곳 / TypeScript `blockScalarAtPath`)도 셸 코드로 평가되지 않는 순수 문자열 비교/파싱이다. 하드코딩된 시크릿·자격증명은 발견되지 않았다. 유일하게 언급할 만한 점은 이번에 skip-job 패턴으로 전환되는 5개 워크플로 중 4개(및 이들이 공유하는 `_changed-paths.yml`)가 `permissions:` 를 명시하지 않아 기본(잠재적으로 더 넓은) `GITHUB_TOKEN` 권한을 상속한다는 것인데, 이는 이번 PR 이 만든 회귀가 아니라 기존부터 있던 상태이며 실제로 수행하는 작업도 checkout·읽기 전용 스크립트 실행뿐이라 즉각적 위험은 낮다.

## 위험도

NONE

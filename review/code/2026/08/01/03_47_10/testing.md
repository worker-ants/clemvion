# 테스트(Testing) 리뷰 — scripts/check-override-floors.py

## 스코프 메모

이번 라운드의 router 는 diff 를 `scripts/check-override-floors.py` 1개 파일로 판정해 전달했다.
그러나 직접 파일시스템을 확인한 결과 이 스크립트의 테스트는 이미 `.claude/tests/test_override_floors.py`
(511줄, 28개 테스트, 커밋 `652f6cc78` 로 이 PR 안에서 함께 수정됨)에 존재하며, `.github/workflows/harness-checks.yml`
의 `paths:` 트리거(`scripts/check-override-floors.py` 명시 등재 확인 완료)와 `python3 -m unittest discover`
스텝을 통해 실제 CI 에서 실행된다. 로컬에서 28개 전부 통과를 재확인했다. 이 테스트 파일이 이번 라운드의
router 파일 목록에서 빠진 것은 `.claude/**` 를 코드 리뷰 게이트 스코프에서 제외하는 기존 정책(harness 자체
CI 로 별도 게이트됨)과 일치하므로 누락이 아니라 정상 동작으로 판단한다. 아래 발견사항은 그 위에서 **실측**으로
찾은 갭이다 — "테스트가 없다" 류의 지적은 없다.

## 발견사항

- **[WARNING]** `run_audit()` 의 "returncode 로 판단하지 않는다" 불변식이 실측 가능한 회귀를 못 막는다
  - 위치: `scripts/check-override-floors.py:141-153` (`run_audit()`, 특히 `out = proc.stdout.strip()` 이전)
  - 상세: 이 함수의 docstring(141행)은 "audit 은 취약점이 있으면 비-0 으로 끝나므로 returncode 로 성공을
    판단할 수 없다" 고 명시하고, 실제 구현은 `proc.returncode` 를 어디서도 참조하지 않는다(출력 형태로만
    판정). 그런데 `.claude/tests/test_override_floors.py` 의 `_PNPM_STUB` 은 `sys.exit()` 을 호출하지 않아
    **모든 28개 테스트에서 스텁 `pnpm` 의 종료 코드가 항상 0** 이다 — advisory 가 있어 실제로는 exit 1 이어야
    할 시나리오(`ClassificationTest`/`CombinedReportTest`/`MultipleMatchTest` 등)에서도 마찬가지다. 즉 이
    스크립트가 명시적으로 지켜야 한다고 선언한 불변식 자체를 검증하는 테스트가 없다.
    **실측으로 확인**: 스크립트 사본에 `if proc.returncode != 0: _undecidable(...)` 라는(아주 흔한
    subprocess 관용구) 뮤턴트를 주입한 뒤 (a) 실제 pnpm 처럼 "취약점 발견 시 exit 1 + 유효 JSON" 을 내는
    스텁으로 돌리면 정상 분류(`바닥이 낡아...`, exit 1) 대신 `ERROR: pnpm audit exited 1`(exit 2, 판단 불가)
    로 완전히 오분류됐다. (b) 반면 현재 테스트 스위트가 쓰는 것과 같은 형태(exit 0 고정) 스텁으로 돌리면
    같은 뮤턴트가 정상 출력(exit 1, `바닥이 낡아...`)을 그대로 내 **28개 테스트 전부 GREEN 을 유지**했다.
    즉 "audit 이 취약점을 찾으면 흔히 비-0 으로 끝난다" 는, 이 스크립트가 정확히 막으려는 실패 클래스의
    거울상(취약점이 있는 정상 상태를 "판단 불가" 로 오분류)이 현재 테스트 스위트로는 전혀 탐지되지 않는다.
  - 제안: `run_with_stub_audit()`(또는 `_PNPM_STUB`)에 종료 코드를 지정할 수 있는 파라미터를 추가하고,
    적어도 `ClassificationTest.test_advisory_on_managed_package_fails` 류의 "취약점이 실제로 존재하는"
    케이스 하나를 스텁이 `sys.exit(1)` 을 내는 변형으로 복제해 회귀를 고정할 것을 권장한다.

- **[WARNING]** `pnpm-workspace.yaml` 에서 `overrides:` 키가 통째로 사라지는 경로는 fail-closed 도 테스트도 없다
  - 위치: `scripts/check-override-floors.py:118` (`load_override_targets()` 의 `overrides = data.get("overrides") or {}`)
  - 상세: 이 파일은 스키마 드리프트에 극도로 방어적이다 — `run_audit()`/`classify_vulnerable()` 만 해도
    `_undecidable()` 호출 지점이 6곳이고 `FailClosedSiteCountTest` 로 그 개수를 코드에 결속해 놓았다.
    그런데 `pnpm-workspace.yaml` 최상위에 `overrides:` 키가 없거나 오타(`override:`)로 바뀌는 경우는
    같은 취급을 받지 못한다 — `data.get("overrides") or {}` 가 조용히 빈 dict 를 돌려주고, `main()` 의
    `targets` 가 `{}` 가 되어 `widened`/`eroded` 가 항상 빈 리스트, 결과적으로 **항상 `OK: override 대상
    0개 패키지` 로 exit 0** 된다. 이는 이 스크립트 전체가 막으려는 정확히 그 실패 형태(설정 파싱이
    깨졌는데 "취약점 0건" 과 구별되지 않는 성공으로 보임)와 동일한데, 이 경로만 `_undecidable()` 가드도
    회귀 테스트도 없다. `WORKSPACE_YAML.exists()` 부재(파일 자체가 없음)는 `main()` 에서 별도로 잡아
    테스트(`test_missing_workspace_file_is_undecidable`)까지 있지만, "파일은 있는데 구조가 다른" 경우는
    빠져 있다.
  - 제안: `overrides` 키가 없을 때(파일 자체는 파싱됐고 다른 최상위 키가 존재하는데 `overrides` 만 없는
    경우)를 `_undecidable()` 로 fail-closed 처리하고, 그 분기를 `EXPECTED_SITES` 카운트에도 반영하는
    회귀 테스트를 추가할 것을 권장한다. (완전히 빈 파일이나 `overrides: {}` 로 명시된 경우는 "의도적으로
    0개" 로 정상 취급해도 되지만, 최소한 "키 자체의 부재"와는 구분하는 것이 이 스크립트의 나머지 철학과
    일관적이다.)

- **[INFO]** `classify_vulnerable()`/`main()` 의 2·3차 폴백 분기(`or` 체인의 마지막 항)가 미검증
  - 위치: `scripts/check-override-floors.py:203` (`reported[module] = str(adv.get("github_advisory_id") or adv.get("id") or name)` 의 `name` 폴백), `scripts/check-override-floors.py:210` (`r.get("path", "?")`), `scripts/check-override-floors.py:245` (`adv.get("patched_versions") or "?"`)
  - 상세: `test_advisory_without_github_id_falls_back_to_numeric_id` 는 `github_advisory_id` 없이 `id` 만
    있는 경우(2차 폴백)를 검증하지만, 둘 다 없어 advisories 딕셔너리의 키(`name`, 예: `"1"`) 로 떨어지는
    3차 폴백은 어떤 테스트에도 없다. 마찬가지로 `resolves[].path` 가 없을 때의 `"?"`, `patched_versions`
    가 없을 때의 `"?"` 도 미검증이다. 셋 다 exit code 나 fail-closed 판정에는 영향을 주지 않는 순수 출력
    포맷팅 폴백이라 심각도는 낮지만, 도달 시 CI 로그에 원시 딕셔너리 키나 `"?"` 가 그대로 노출돼 진단
    가치가 떨어진다.
  - 제안: 우선순위는 낮음. 여유가 있으면 각 폴백에 대해 한 줄짜리 케이스를 `ClassificationTest` 에 추가.

- **[INFO]** `run_audit()` 의 `subprocess.run` 에 `timeout=` 이 없다
  - 위치: `scripts/check-override-floors.py:146-151`
  - 상세: 레지스트리가 정상 오류를 내는 대신 "행"(hang) 상태가 되면 이 스크립트도 무한 대기한다. 세
    `_undecidable()` 오류 형태(빈 출력/파싱 불가/`actions` 없음)는 모두 프로세스가 **끝난 뒤**의 출력
    형태로 판정하므로, 프로세스가 끝나지 않는 경우는 이 fail-closed 체계 밖이다. CI 잡 자체의 타임아웃이
    최종 안전망이 되긴 하지만(예: harness-checks.yml 의 `timeout-minutes: 5`), 이 스크립트가 별도 워크플로
    (`deps-security-checks.yml`)에서 돌 경우 그 잡의 타임아웃 설정에 전적으로 의존하게 된다. hang 자체를
    재현하는 테스트는 flaky 해지기 쉬워 강권하지는 않지만, 방어적으로 `timeout=` 값을 추가하고 그 초과
    시 `_undecidable()` 로 떨어지게 하는 것을 고려할 만하다.
  - 제안: 낮은 우선순위. 코드 변경 시 회귀 테스트보다 방어적 코드 추가 자체가 더 비용 대비 효과적.

## 기존 테스트 스위트에 대한 평가 (참고 — 스코프 밖 파일에 대한 확인 근거)

`.claude/tests/test_override_floors.py` 는 이 스크립트가 실측으로 겪은 회귀(override 키 파싱 3회 오류,
`ignoreCves` 억제분 경로 재유입 미탐지, widened/eroded 동시 보고 시 조기 return 으로 인한 유실, 스키마
드리프트 2계열의 상호 독립성)를 각각 전용 테스트 클래스로 고정해 두었고, `FailClosedSiteCountTest` 로
문서-코드 수치 drift 까지 코드에 결속했다. Mock 은 `unittest.mock` 대신 PATH 앞에 가짜 `pnpm` 바이너리를
꽂는 방식(서브프로세스 경계는 그대로 두고 외부 명령만 대체)이라 실제 동작과의 괴리가 작고, 각 테스트가
`tempfile.TemporaryDirectory()` 로 완전히 격리돼 있어 순서 의존성이 없다. 테스트명·docstring 이 "왜"
(실측된 어떤 버그를 막는지)를 구체적으로 서술해 가독성도 높다. 위 WARNING 2건은 이 견고한 스위트에 대한
반박이 아니라, 그 스위트가 아직 닿지 않은 두 개의 구체적 사각지대다.

## 요약

리뷰 대상 스크립트(`scripts/check-override-floors.py`) 자체에는 새로 추가된 로직 없이 기존 로직만 있고
(이번 라운드 diff 는 이 파일 전체가 아니라 이전 라운드에서 이미 검토된 내용의 재확인 성격), 별도 파일에
28개의 통과 중인 실측-근거 테스트가 이미 존재해 커버리지 밀도는 이례적으로 높다. 다만 실제 뮤턴트 주입으로
확인한 결과, (1) 이 스크립트가 스스로 지킨다고 선언한 "returncode 로 판단하지 않는다" 불변식을 검증하는
테스트가 하나도 없어 그 불변식을 깨는 흔한 형태의 회귀가 조용히 통과할 수 있고, (2) `pnpm-workspace.yaml`
의 `overrides` 키 자체가 사라지는 경로는 이 스크립트가 다른 모든 곳에서 일관되게 적용한 fail-closed 철학이
적용되지 않은 채 테스트도 없다 — 두 갭 모두 이 PR 이 막으려는 "취약점이 있는데 조용히 통과" 클래스와
동일한 성격이라 사소하지 않다. 나머지는 출력 포맷팅 폴백·타임아웃 부재 수준의 낮은 우선순위 항목이다.

## 위험도

MEDIUM

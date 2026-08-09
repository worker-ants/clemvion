# 요구사항(Requirement) 리뷰 — ci-required-check-skip-jobs (2차, audit 조치분 포함)

## 컨텍스트

이번 라운드는 1차 리뷰(`review/code/2026/08/09/11_40_34`, Critical 0·WARNING 10)의 fix 커밋
(`30294e983`, W1·W2·W3·W4·W5·W6·W9·W10 수정)과 그 이후의 부수 audit 조치 커밋
(`366affde2`, nanoid/dompurify 상향)까지 포함한 전체 diff를 대상으로 한다. 관련 `spec/`
문서는 이번에도 확인되지 않는다 — `spec/conventions/migrations.md:180-186` 이 required status
check 를 언급하지만 `migration-check` 승격이라는 별개의 향후 계획 맥락이라 이 변경과 무관하다.
`plan/in-progress/ci-required-check-skip-jobs.md`(`spec_impact: none`)가 사실상 유일한 권위
요구사항 문서이며, 이를 기준으로 line-level 대조했다.

로컬 검증: `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **939 tests OK**
(plan/RESOLUTION.md 의 claim과 일치). `python3 scripts/check-pnpm-security-config.py` /
`check-override-floors.py` 둘 다 OK. `pnpm-lock.yaml` 에 `nanoid@3.3.16` · `dompurify@3.4.12`
잔존 참조 없음(grep 실측, 전량 3.3.17/3.4.13로 해소). 1차 리뷰가 지적한 조건 방향
(`== 'true'` → `!= 'false'`)이 실제 워크플로·테스트·스크립트·plan 전체에서 일관됨을 grep으로
재확인했고, 뮤테이션(한 스텝의 `!= 'false'`를 `== 'true'`로 되돌림)이 `test_workflow_yaml_structure.py::test_step_conditions_are_registered`에서 RED로 떨어짐을 직접 재현·원복해 확인했다(`deps-security-checks.yml`은 검증 후 `git checkout --`으로 정확히 원상복구).

## 발견사항

- **[WARNING]** `.claude/tests/README.md` 카탈로그의 `test_required_check_skip_jobs.py` 행이
  1차 리뷰 fix(W3, 조건 방향 반전)를 반영하지 못해 **현재 구현과 반대 방향의 위험을 서술**한다.
  - 위치: `.claude/tests/README.md:49`
  - 상세: 이 행은 최초 커밋(`44903e256`)에서 `== 'true'` 시대의 의미론으로 작성됐다 — "dropping
    `needs: changes`, after which `needs.changes.outputs.relevant` evaluates to the empty
    string, `!= 'true'` is true, and *every* step no-ops — a green check that verified
    nothing"(즉 "`needs: changes`를 빠뜨리면 전 스텝이 조용히 no-op된다"는 서술). 그런데 W3 fix
    (`30294e983`)가 조건을 `== 'true'` → `!= 'false'`로 반전시켰고, 그 결과 지금은 `relevant`
    출력이 빈 문자열일 때 `'' != 'false'`가 **참**이 되어 스텝이 오히려 **실행**된다(fail-safe
    방향 — 이 PR의 핵심 설계 의도와 정확히 일치). 즉 지금 이 행이 "가장 위험한 회귀"라고 지목하는
    시나리오("`needs: changes`를 빠뜨리면 전 스텝이 조용히 통과된다")는 **현재 코드에서 더 이상
    사실이 아니다** — 오히려 정반대(과도하게 실행됨)로 떨어진다.
    `30294e983`의 커밋 메시지는 "조건 방향을 바꿨으므로 그것을 설명하던 문서 3곳(모듈 docstring·
    plan 본문·등록부 주석)도 함께 정정했다 — 방금 고친 것을 문서가 잘못 설명하는 상태를 남기지
    않는다"고 명시하는데, 실측 결과 이 README 행은 그 "3곳"에 포함되지 못했다(`test_workflow_yaml_structure.py` 행은 같은 커밋에서 갱신됐지만 `test_required_check_skip_jobs.py`
    행은 손대지 않음). `.claude/tests/test_required_check_skip_jobs.py` 자체의 모듈 docstring
    (`## 조건 문자열의 방향` 절)과 `plan/in-progress/ci-required-check-skip-jobs.md` 는 이미
    `!= 'false'` 로 정확히 갱신돼 있어, README만 유일하게 뒤처졌다.
  - 제안: 49행의 "dropping `needs: changes`..." 절을 현재 `!= 'false'` 의미론으로 재작성한다
    — 예: "`needs.changes.outputs.relevant`가 빈 문자열이 되면 `!= 'false'`가 참이 되어
    (스텝을 건너뛰는 대신) **전 스텝이 실행**된다 — 이는 fail-safe 방향과 일치하므로 위험하지
    않다. 진짜 위험한 회귀는 반대 방향, 즉 조건을 다시 `== 'true'`로 되돌리는 것이다." 코드
    자체는 이미 안전한 방향으로 fix돼 있으므로 이 항목은 문서 전용 수정이며 코드 변경은 불필요.

## 검증한 항목 (재발 없음 확인)

- W1(fail-safe 실행 검증 부재) → `test_ci_paths_changed.py` 16건 신설·전량 통과 확인.
- W2(`harness-checks.yml` paths 미등재) → `scripts/ci-paths-changed.sh` 등재 확인
  (`.github/workflows/harness-checks.yml:68`).
- W3(`changes` 잡 실패/취소 시 하위 잡 skip 재발) → `if: ${{ !cancelled() }}` + 조건 반전으로
  해소됨을 뮤테이션으로 직접 재확인. `changes`가 실패해도(취소가 아닌 한) 하위 잡이 돌고, 출력이
  빈 문자열이면 fail-safe 방향(실행)으로 떨어져 1차 리뷰의 concurrency/side_effect WARNING이
  실질적으로 해소됨.
- W4(push 광역화) → `PUSH_BEFORE_SHA`/`PUSH_AFTER_SHA` 배선 확인, `PushEventTest` 4건 통과.
- W5(레지스트리 3중 비바인딩) → `test_the_two_registries_agree` 존재·통과 확인.
- W6(step id 오타 미검출) → 참조 문자열 정확 일치 + `id: detect` 존재 단언 확인.
- W9(네이밍 컨벤션) → `RequiredCheckSkipJobContractTest`로 리네임 확인.
- nanoid/dompurify 조치 — `pnpm-workspace.yaml`·`scripts/check-pnpm-security-config.py`
  2-place 동시 갱신(EXPECTED_OVERRIDES) 확인, override-floors/config-guard 스크립트 로컬 실행
  OK, lockfile 전량 해소 확인.
- TODO/FIXME/HACK/XXX 마커: 이번 diff의 신규·수정 파일 전체에서 미발견.
- spec fidelity: 관련 spec 본문 없음(INFO) — `spec_impact: none`과 정합, drift 없음.

## 요약

핵심 목적(required-check 데드락 해소를 위한 skip-job 패턴 전환)은 plan이 기술한 대로 정확히
구현됐고, 1차 리뷰 WARNING 8건은 모두 코드·테스트 레벨에서 실질적으로 해소됨을 재현 검증했다
(특히 W3는 뮤테이션으로 직접 재현·원복해 실증). 유일하게 남은 문제는 `.claude/tests/README.md`
의 `test_required_check_skip_jobs.py` 카탈로그 행이 W3 fix의 조건 방향 반전을 반영하지 못해,
"어느 방향이 위험한가"를 **정반대로** 서술하고 있다는 점이다 — 실제 코드는 안전(fail-safe)
방향이므로 기능적 결함은 아니지만, 이 저장소가 반복해 강조하는 "방금 고친 것을 문서가 잘못
설명하는 상태를 남기지 않는다"는 원칙(같은 커밋 메시지가 명시)에 대한 예외 사례로, 정확히 그
원칙이 지키려던 실패 클래스를 재현한다. 나머지는 전부 실측으로 정합성이 확인됐다.

## 위험도

LOW

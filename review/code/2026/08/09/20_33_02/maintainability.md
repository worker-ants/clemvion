# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `if: needs.changes.outputs.relevant != 'false'` 스텝-레벨 조건이 5개 워크플로 전체 스텝에 손으로 반복 삽입됨
  - 위치: `.github/workflows/harness-checks.yml:146,151,160,164,175,180` / `.github/workflows/migration-check.yml:58,65,73,81` / `.github/workflows/packages-checks.yml:77,79,81,87,90,93,96` / `.github/workflows/spec-link-checks.yml:60,63,66,75,79` / `.github/workflows/web-chat-checks.yml` (`sdk`/`widget`/`sdk-client` 3잡 각 6~7줄)
  - 상세: `changes` 잡을 reusable workflow(`_changed-paths.yml`)로 뽑아 3중 복제는 해소했지만(#1111), skip-job 패턴 자체가 요구하는 "잡은 항상 success, 스텝만 게이팅"은 GitHub Actions 에 스텝 단위 공유 조건 메커니즘이 없어 파일마다·스텝마다 동일한 `if:` 한 줄을 그대로 붙여야 한다. 이번 PR 로 신규 5개 워크플로(14개 잡)가 이 형태를 그대로 복제해 총 반복 건수가 늘었다.
  - 제안: 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속(2026-08-09 실측 추가분)과 `plan/in-progress/ci-required-check-skip-jobs.md`("셋업 보일러플레이트 composite action")에서 이 정확한 패턴을 실측(8/14 잡이 `--filter` 인자만 다른 바이트 동일 셋업)하고 별도 PR 로 분리하기로 **의도적으로 결정**해 둔 상태다. 새로운 지적이 아니라 이미 추적 중인 항목이므로 이번 PR 에서 추가 조치 불필요 — 후속 PR 착수 시 그대로 반영하면 됨.

- **[INFO]** 블록 스칼라 pathspec 파싱 규칙(공백 제거 → 빈 줄 버림 → `#` 시작 줄 버림)이 4곳에 독립적으로 재구현됨
  - 위치: `.github/workflows/_changed-paths.yml:104-112` (bash `case "$spec" in '#'*) continue`) / `.claude/tests/test_harness_checks_paths_coverage.py:140-171` (`parse_pathspecs_block`) / `.claude/tests/test_required_check_skip_jobs.py:80-94` (`parse_pathspecs`) / `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:263-285` (`blockScalarAtPath`)
  - 상세: 런타임(bash) 1곳 + 가드(Python 2곳 + TypeScript 1곳) 총 4곳이 "strip → 빈 줄 제거 → `#` 시작 줄 제거"라는 동일한 3단 규칙을 각자 손으로 구현한다. 각 구현은 자기 자신에 대한 boundary test 는 갖고 있고, plan 문서(`ci-required-check-skip-jobs.md` "이 규칙은 세 곳이 동시에 지켜야 한다")도 이 위험을 명시적으로 인지하고 있다. 다만 "네 구현이 같은 입력에 대해 항상 같은 출력을 낸다"를 직접 교차 검증하는 단일 테스트는 없다 — 각자 자기 스펙만 통과하면 되므로, 다섯 번째 변형(예: 탭 문자 처리, CRLF)이 한 곳에만 반영되고 나머지 세 곳에 누락돼도 개별 테스트 스위트는 전부 초록일 수 있다.
  - 제안: 당장 병합을 막을 문제는 아니다(각 구현이 개별적으로 촘촘히 테스트됨). 다섯 번째 변형이 필요해지는 시점에는 4곳을 한 번에 찾아 고치기보다, 규칙을 텍스트로 명세한 공유 fixture(예: 입력/출력 쌍 목록)를 두고 4개 테스트 스위트가 그 fixture 를 각자 언어로 순회하는 형태를 고려할 것.

- **[INFO]** 어서션 메시지가 세 문자열 리터럴로 어색하게 쪼개짐 — 이전 `paths:` 문구를 `pathspecs:` 로 바꾸는 과정의 잔재로 보임
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:472-474`
  - 상세: `"Add a covering entry to the \`changes\` job's \`pathspecs:\` (this is "` / `"the sixth "` / `"time this class has leaked — see the module docstring)."` 세 줄로 나뉘어 있다. 연결하면 의미는 정확하지만("...this is the sixth time this class has leaked..."), 문장 중간(`"the sixth "`)에서만 쪼갠 이유가 없어 읽는 사람이 순간 오타로 오해하기 쉽다.
  - 제안: 두 줄(또는 한 줄)로 합쳐 읽기 흐름을 정리. 기능에는 영향 없어 급하지 않음.

## 요약

이번 diff 는 `#1106`~`#1111` 에서 이미 확립·리뷰된 required-check skip-job 패턴을 나머지 5개 워크플로(harness/migration/packages/spec-link/web-chat)에 기계적으로 반복 적용한 것으로, 새로운 설계를 들여오지 않고 기존 컨벤션(등재제 registry, `needs: changes` + `!cancelled()`, `!= 'false'` fail-safe 방향, no-op 안내 스텝)을 그대로 따른다. 가드 테스트(`test_harness_checks_paths_coverage.py`, `test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`, `test_changed_paths_reusable.py`, TS 가드)는 함수 분해·네이밍·문서화 수준이 높고, 이동한 SoT(`on.pull_request.paths` → `jobs.changes.with.pathspecs`)를 따라가지 못하는 옛 가드가 "조용히 통과"하지 않고 vacuity floor(`_MIN_FILTERS`)로 fail-loud 하도록 설계된 점이 특히 눈에 띈다. 가장 두드러지는 반복(스텝별 `if:` 중복)은 GitHub Actions 자체의 구조적 제약이며, 이미 plan 문서에 실측 근거와 함께 후속 PR 로 명시적으로 유예되어 있어 이번 PR 범위에서 추가로 손볼 필요는 없다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW

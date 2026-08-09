# Code Review 통합 보고서

## 전체 위험도
**LOW** — CI 인프라(GitHub Actions 워크플로) skip-job 패턴을 기존 3개에서 나머지 5개 워크플로로 기계적으로 확장한 변경. Critical 급 결함 없음. 애플리케이션 런타임 코드 변경이 아니어서 보안/부작용 표면이 작고, 각 reviewer 가 실측(테스트 실행·YAML 직접 파싱·grep 대조)으로 대부분의 주장을 검증했다. 남은 문제는 대부분 "PR 이 CONVERTED 를 3→8개로 확장했는데 그 사실을 반영 못한 옛 주석/문서"류의 드리프트와, harness-checks.yml 전용이던 두 가지 테스트 보호(죽은 필터 검출·자기참조 강제)가 나머지 4개 워크플로에 아직 일반화되지 않은 대칭성 갭이다.

forced(router_safety) 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과가 인라인 전문으로 확보되었고 정상 반영됨 — 강제 리뷰어 결과 누락은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `_changed-paths.yml` 공유 워크플로 수가 이번 PR 로 3→8개가 됐는데, 이를 정확히 반영한 곳(`README.md:51`, "eight")과 옛 "세 워크플로/three" 표현을 그대로 남긴 곳이 같은 커밋 안에서 갈린다. `README.md` 인접 두 행(50/51)이 서로 다른 숫자를 말하는 내부 모순도 존재. | `.claude/tests/README.md:50`, `.github/workflows/_changed-paths.yml:1,23`, `.claude/tests/test_changed_paths_reusable.py:11`, `.claude/tests/test_required_check_skip_jobs.py:64,187` | "세/three/8개" 같은 구체적 카운트 대신 "전환된 워크플로들이 공유하는" 식 일반화된 표현으로 바꾸거나 최소 현재 값(8개)으로 갱신. `developer` 권한 범위 내(spec 아님) 수정 대상. |
| 2 | 테스트 | 신규 전환된 4개 워크플로(`migration-check`·`packages-checks`·`spec-link-checks`·`web-chat-checks`)의 `pathspecs` 목록에 "죽은 필터(dead filter)" 검증이 없다. `harness-checks.yml` 은 `test_no_filter_is_dead` 로 보호되지만 나머지 4곳은 오탈자·개명 잔존 항목이 들어가도 아무 테스트도 못 잡는다. | `.claude/tests/test_required_check_skip_jobs.py` (해당 검증 부재) | `test_harness_checks_paths_coverage.py` 의 `filter_covers_file`/`_tracked_files` 를 재사용해 `CONVERTED` 전체에 대해 "각 pathspec 이 최소 하나의 tracked 파일과 매치"를 일반화하는 테스트 추가. |
| 3 | 테스트 | 워크플로 자신의 파일 경로가 자신의 `pathspecs` 에 등재돼 있는지 강제하는 테스트가 `_changed-paths.yml`·`scripts/ci-paths-changed.sh` 2건에만 있고, `migration-check.yml`·`packages-checks.yml`·`spec-link-checks.yml`·`web-chat-checks.yml` 자기 자신에 대해서는 강제가 빠져 있다(손으로 추가된 한 줄을 지우는 것을 막는 회귀 가드 없음). PR/README 가 "6번 겪은 갭"으로 명명하는 실패 패턴과 같은 클래스. | `.claude/tests/test_required_check_skip_jobs.py:296` (`test_converted_workflows_pass_the_script_its_own_path`) | 해당 테스트에 `f".github/workflows/{name}"` 이 `specs` 에 있거나 상위 glob 으로 커버됨을 단언하는 분기 추가. |
| 4 | 문서화 | `plan/in-progress/ci-required-check-skip-jobs.md` frontmatter `worktree:` 가 이미 삭제된 옛 worktree(`ci-required-check-skip-jobs-42f5d8`)를 가리켜, plan-lifecycle 가드의 "worktree 매칭" 판정이 이 plan 을 현재 worktree(`ci-skip-jobs-remaining-8aa9f8`)와 연결되지 않은 것으로 오판할 위험. | `plan/in-progress/ci-required-check-skip-jobs.md:3` | `worktree:` 를 현재 worktree 슬러그로 갱신하거나, 완료 처리 시점에 정리. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 신규 편입되는 4개 워크플로(`packages-checks`·`spec-link-checks`·`web-chat-checks`·`migration-check`)와 `_changed-paths.yml` 에 `permissions:` 블록이 없어 기본(잠재적으로 더 넓은) `GITHUB_TOKEN` 권한을 상속. `harness-checks.yml` 은 `contents: read` 를 명시함(비대칭). `git log -p` 확인 결과 이번 PR 이전부터 없었던 상태라 이번 diff 의 회귀는 아님. | `packages-checks.yml`, `spec-link-checks.yml`, `web-chat-checks.yml`, `migration-check.yml`, `_changed-paths.yml` | least-privilege 관점에서 후속으로 `contents: read` 명시해 harness-checks.yml 과 일관시킬 것(이번 PR 스코프 아님). |
| 2 | 유지보수성 | pathspec 파싱 3단 규칙(strip→빈 줄 드롭→`#`-시작 드롭)이 bash(`_changed-paths.yml`)·Python 2곳(harness/skip-job 가드)·TypeScript(`blockScalarAtPath`) 총 4곳에 독립 재구현됨. 각자 자기 boundary test 는 있으나 "4곳이 같은 입력에 항상 같은 출력을 내는지" 교차검증하는 단일 테스트는 없어, 다섯 번째 변형(탭·CRLF 등)이 한 곳에만 반영될 위험. | `_changed-paths.yml:104-112`, `test_harness_checks_paths_coverage.py:140-171`, `test_required_check_skip_jobs.py:80-94`, `internal-package-registration-guard.ts:263-285` | 당장 조치 불요. 다섯 번째 변형 필요 시 공유 fixture(입력/출력 쌍)를 두고 4개 스위트가 각자 언어로 순회하는 형태 고려. |
| 3 | 유지보수성 | `if: needs.changes.outputs.relevant != 'false'` 스텝-레벨 조건이 5개 신규 워크플로(14개 잡)의 모든 스텝에 반복 삽입됨 — GitHub Actions 에 스텝 단위 공유 조건 메커니즘이 없어 구조적으로 불가피. | `harness-checks.yml`, `migration-check.yml`, `packages-checks.yml`, `spec-link-checks.yml`, `web-chat-checks.yml` 각 스텝 | 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md`·`ci-required-check-skip-jobs.md` 에서 실측 후 composite action 추출을 후속 PR 로 명시적으로 유예 결정됨. 이번 PR 조치 불필요. |
| 4 | 부작용 | `paths:` 필터 제거로 5개 워크플로가 이제 모든 PR 에서 `changes` 잡(풀 checkout, `fetch-depth: 0`)을 항상 실행 — required-check 데드락 해소를 위한 의도된 트레이드오프이며 기존 3개 워크플로에서 이미 검증된 패턴의 반복. | 각 워크플로 `on: pull_request:` | 조치 불필요(신규 리스크 아님). |
| 5 | 테스트 | `blockScalarAtPath` 가 재사용하는 `blockRange` 헬퍼는 `isSkippable`(빈 줄·`#`-시작)을 들여쓰기 검사보다 우선 적용해, 블록 본문보다 얕게 들여쓴 주석/빈 줄을 만나도 종료 조건으로 보지 않는다. 현재 fixture 는 이 병리적 입력을 다루지 않음(실사용 영향은 낮음, 기존 공유 헬퍼라 이번 PR 신규 위험 아님). | `internal-package-registration-guard.ts:230-235` (`blockRange`), 소비처 `:263-285` | 필요 시 "얕게 들여쓴 non-key 줄도 종료로 본다" 회귀 fixture 추가. |
| 6 | 문서화 | `test_every_guarded_file_is_covered` 실패 메시지가 "this is the sixth time this class has leaked" 고정 문구를 유지 — 이번 diff 가 `paths:`→`pathspecs:` 워딩만 바꾸며 숫자는 그대로 옮겨, 향후 일곱 번째 유출 시 메시지가 스스로 오탈자처럼 읽힐 수 있음. | `.claude/tests/test_harness_checks_paths_coverage.py:472-474` | 우선순위 낮음 — 다음에 이 줄을 만질 때 숫자를 없애거나 동적화. |
| 7 | 유지보수성 | 어서션 메시지가 의미상 이유 없는 지점(`"the sixth "`)에서 세 문자열 리터럴로 쪼개져 있어 순간적으로 오타처럼 읽힐 수 있음. | `.claude/tests/test_harness_checks_paths_coverage.py:472-474` | 두 줄(또는 한 줄)로 합쳐 가독성 정리. 기능 영향 없음. |
| 8 | 테스트 | `on.push.paths` 가 되살아나는 것을 막는 대칭 가드가 없음 — 기존 테스트는 `on.pull_request.paths` 부활만 막음. `packages-checks`·`web-chat-checks`·`spec-link-checks` 3곳은 push 트리거를 유지하며 `on.push.paths` 도 제거됨. required-check 데드락은 PR 전용이라 심각도 낮음. | `.claude/tests/test_required_check_skip_jobs.py:149` | 같은 테스트에서 `on.push.paths` 부재도 함께 단언. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | permissions: 미선언 5곳(기존 상태, 회귀 아님) INFO 1건. 스크립트 인젝션 방지(env 우회)·fail-closed 설계는 모범 사례로 확인. |
| requirement | LOW | "세 워크플로" stale 표현 6곳(WARNING). spec 문서 관할 밖 확인, 65+51 테스트 실제 실행 통과 검증. |
| scope | NONE | 스코프 위반 없음. 15개 파일 전부 사전 등재된 단일 작업 단위 또는 필연적 동반 수정. review-gate/e2e 전환·composite action 추출은 plan 에 명시적 defer. |
| side_effect | NONE | 신규 위험한 부작용 없음. 공유 워크플로 파싱 규칙 변경이 diff 밖 3개 소비자에 영향 없음을 실측 확인. `changes` 잡 always-run 은 의도된 트레이드오프. |
| maintainability | LOW | 스텝별 `if:` 반복(구조적 제약, 이미 유예 결정됨), 4곳 파싱 규칙 중복, 어서션 메시지 분할 — 전부 INFO. |
| testing | LOW | 죽은 필터 검증 부재(WARNING), 워크플로 자기참조 강제 부재(WARNING) — 4개 신규 워크플로에 harness-checks.yml 전용 보호가 미일반화. push.paths 대칭 가드 부재·blockRange 경계(INFO). |
| documentation | LOW | README 인접 행 숫자 모순 + "세 워크플로" 잔존 5곳(WARNING), plan frontmatter worktree 참조 stale(WARNING), 실패 메시지 카운터 고정(INFO). |

## 발견 없는 에이전트

scope, side_effect, security — 위 표의 INFO 항목은 결함이 아니라 판단 근거/모범사례 확인 기록이며, Critical/Warning 급 스코프 위반·부작용·보안 취약점은 발견되지 않았다.

## 권장 조치사항
1. `test_required_check_skip_jobs.py` 에 "죽은 필터 검출"과 "워크플로 자기참조 강제"를 `CONVERTED` 전체로 일반화 — harness-checks.yml 전용이던 두 보호를 나머지 4개 워크플로에도 적용 (WARNING #2, #3).
2. `.claude/tests/README.md` 의 인접 행 모순 및 `_changed-paths.yml`/`test_changed_paths_reusable.py`/`test_required_check_skip_jobs.py` 5곳의 "세 워크플로/three" 잔존 표현을 8개(또는 개수-비종속 표현)로 갱신 (WARNING #1).
3. `plan/in-progress/ci-required-check-skip-jobs.md` frontmatter `worktree:` 를 현재 worktree 로 갱신하거나 완료 처리 시 정리 (WARNING #4).
4. (선택, 낮은 우선순위) `on.push.paths` 부활 방지 대칭 테스트 추가, permissions: 최소권한 명시 후속화, 어서션 메시지 가독성/동적화 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 표 참고 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 실행된 7명 전원이 안전-강제 대상이었으며(자연 라우팅 선별은 0명), 전원 결과가 인라인 전문으로 확보되어 정상 반영됨. 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 가 이번 변경(CI YAML 구성)에 비관련으로 판단해 제외 |
  | architecture | 동상 |
  | dependency | 동상 |
  | database | 동상 |
  | concurrency | 동상 |
  | api_contract | 동상 |
  | user_guide_sync | 동상 |
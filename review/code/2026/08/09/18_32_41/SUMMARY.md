# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CI 워크플로 `changes` 잡 reusable workflow 추출(순수 리팩터링). Critical 0건, 기능적 결함 없음(973/973 하니스 테스트 통과 확인). 다만 documentation reviewer 가 MEDIUM 을 부여했고, 같은 커밋에서 완료된 작업이 plan 체크박스·README 카탈로그에 반영되지 않은 문서 drift(WARNING 2건) + 명시적으로 지목된 위험 클래스에 대한 회귀 테스트 누락(WARNING 2건)이 겹쳐 실질 위험을 보수적으로 MEDIUM 으로 판정. 강제(router_safety) 리뷰어 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 체크박스가 이미 완료된 작업(이 커밋)을 미완료로 표시 — 두 plan 파일에 중복 기재 | `plan/in-progress/ci-required-check-skip-jobs.md:187`, `plan/in-progress/backend-lint-gate-broken-on-main.md:211` | 같은 턴에 두 파일 모두 `[x]`로 갱신하고 완료 근거(커밋 SHA/PR 번호) 기록. 후자는 "changes 잡 추출은 완료, 셋업 보일러플레이트 추출은 별도 후속"으로 범위를 쪼개 문구 갱신 |
| 2 | 문서화 | `.claude/tests/README.md` 의 `test_required_check_skip_jobs.py` 행이 같은 커밋에서 그 테스트에 추가된 신규 계약(reusable workflow 위임 검증, `_changed-paths.yml` 자기등재 요구, wiring 추적)을 반영 못함 | `.claude/tests/README.md:51` | 51행에 reusable workflow 위임/자기등재 검증 내용을 추가 서술 |
| 3 | 테스트 | 워크플로 주석이 명시적으로 지목한 파손 위험 클래스("공백 포함 pathspec")에 대한 회귀 테스트 없음 | `.claude/tests/test_changed_paths_reusable.py:76` (`ArgumentSplittingTest`), 근거: `.github/workflows/_changed-paths.yml:28` | `run_with("path with space.yaml\n")` 케이스 추가해 인자 1개로 남는지 단언 |
| 4 | 테스트 | `run:` 블록이 `${{ inputs.pathspecs }}`를 문자열에 직접 삽입하지 않고 `env:`로만 받는다는 인젝션 방지 불변식이 assertion 으로 고정돼 있지 않음 | `.github/workflows/_changed-paths.yml:69-71`, `.claude/tests/test_changed_paths_reusable.py:119` (`WiringTest`) | `WiringTest`에 `self.assertNotIn("${{", detect_run_block())` 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 서드파티 GitHub Action 이 커밋 SHA 아닌 이동 가능 태그(`@v7` 등)로 고정 — 기존 패턴을 옮긴 것뿐, 이번 diff 신규 리스크 아님 | `.github/workflows/_changed-paths.yml:57` 및 각 호출 워크플로 | 여유 있을 때 SHA 고정 검토(선택) |
| 2 | 문서화 | 세 전환 워크플로 중 `backend-checks.yml`에만 `_changed-paths.yml` 자기등재 이유 설명 주석 있음, 나머지 둘은 항목만 있고 설명 없음 | `deps-security-checks.yml:40-46,60`, `frontend-checks.yml:27,38` (vs `backend-checks.yml:44-45`) | 동일한 설명 주석을 두 파일에도 추가해 일관성 확보 |
| 3 | 부작용 | `run_with()` 임시 디렉터리 미정리(파일시스템 누적) — 저장소 내 기존 관행 혼재(일부는 정리, 일부는 미정리) | `.claude/tests/test_changed_paths_reusable.py:57` | `tempfile.TemporaryDirectory()` 또는 `addCleanup(shutil.rmtree, ...)` 사용 |
| 4 | 부작용 | 인라인 job → reusable workflow 호출 전환으로 GitHub 체크 이름 표시가 바뀔 가능성(설계상 위험 낮음) | `backend-checks.yml:46-48`, `deps-security-checks.yml:47-49`, `frontend-checks.yml:28-30` | 머지 후 실제 Actions 실행에서 체크 이름 표시 1회 육안 확인 권장 |
| 5 | 유지보수성 | `_changed-paths.yml` 공백 판정에 서브프로세스 2개(`printf`+`tr`) 사용 — bash 파라미터 확장으로 대체 가능(스타일) | `.github/workflows/_changed-paths.yml:87` | 필요 시 `[[ -n "${spec//[[:space:]]/}" ]]`로 교체 고려(우선순위 낮음) |
| 6 | 테스트 | `on:` YAML boolean 키 파싱 우회 로직이 두 테스트 파일에 독립 중복 존재(현재는 일치) | `test_changed_paths_reusable.py:122` vs `test_required_check_skip_jobs.py:72` | 우선순위 낮음, 필요 시 cross-import 로 통합 |
| 7 | 요구사항 | `spec/` 문서 없음 — CLAUDE.md 규약상 CI/하네스는 spec 대상 아님, 예상된 회색지대 | 해당 없음 | 조치 불요 |
| 8 | 요구사항 | README 신설 행이 `test_required_check_skip_jobs.py`의 "공유 워크플로 자기등재" 신규 요구사항을 명시하지 않음(문서화 WARNING #2와 동일 이슈, 경미) | `.claude/tests/README.md:50` | 선택 사항, WARNING #2 조치로 함께 해소 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 방지·fail-closed·fail-safe 게이팅·`pull_request`(non-target) 트리거 등 긍정 관행 다수 확인. 발견은 기존 태그 고정 관행(INFO)뿐 |
| requirement | LOW | 973/973 하니스 테스트 통과, 기능 요구사항 전량 충족. plan 체크박스 미반영 2건(WARNING) |
| scope | NONE | 단일 목적 리팩터링, 범위 이탈 없음. 발견사항 없음 |
| side_effect | LOW | 임시 디렉터리 미정리, 체크 이름 표시 변화 가능성(둘 다 INFO). 정적 교차검증(harness-checks paths, 레지스트리 일치) 긍정 확인 |
| maintainability | LOW | 중복 코드 축소, 단일 책임 유지. 임시 디렉터리 정리 불일치·표 셀 길이·서브셸 사용(전부 INFO) |
| testing | LOW | 실행 검증 관행 준수. 명시된 위험 클래스(공백 포함 pathspec) 회귀 테스트 누락, 인젝션 방지 불변식 미고정(WARNING 2건) |
| documentation | MEDIUM | 핵심 기능 문서는 우수하나, 같은 커밋에서 plan 체크박스 미갱신 + README 카탈로그 행이 신규 테스트 계약 미반영(WARNING 2건) |

## 발견 없는 에이전트

scope (발견사항 없음, 위험도 NONE)

## 권장 조치사항

1. `plan/in-progress/ci-required-check-skip-jobs.md:187` 및 `plan/in-progress/backend-lint-gate-broken-on-main.md:211` 체크박스를 완료 상태로 갱신(후자는 범위를 "changes 잡 추출 완료 / 셋업 보일러플레이트 추출 별도 후속"으로 분리 서술).
2. `.claude/tests/README.md:51`의 `test_required_check_skip_jobs.py` 서술을 이번 커밋에서 추가된 reusable workflow 위임·자기등재 검증 내용으로 갱신.
3. `test_changed_paths_reusable.py`에 "공백 포함 pathspec 값이 인자 1개로 유지되는지" 회귀 케이스와 "`run:` 본문에 `${{` 직접 삽입 없음" 인젝션 방지 불변식 assertion을 추가.
4. (선택, 저위험) `run_with()` 임시 디렉터리 정리, 세 워크플로 간 자기등재 설명 주석 일관성 확보, `on:` 파싱 헬퍼 중복 통합.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 diff(CI 워크플로 배선 리팩터)와 관련성 낮음 |
  | architecture | 동일 |
  | dependency | 동일 |
  | database | 동일 |
  | concurrency | 동일 |
  | api_contract | 동일 |
  | user_guide_sync | 동일 |
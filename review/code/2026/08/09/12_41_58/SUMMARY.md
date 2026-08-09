# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건은 전부 non-blocking(문서 stale 1건, 코드 중복 1건, 미검증 pathspec 케이스 1건)이며 실제 동작을 깨뜨리지 않는다. forced whitelist(8명) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/문서 | `.claude/tests/README.md` 의 `test_required_check_skip_jobs.py` 카탈로그 행이 1차 리뷰 fix(W3, 조건 방향 `== 'true'` → `!= 'false'` 반전)를 반영하지 못해, "`needs: changes` 를 빠뜨리면 전 스텝이 조용히 no-op(skip)된다"는 **현재 코드와 반대 방향**의 위험을 서술한다. 실제로는 `relevant` 가 빈 문자열일 때 `!= 'false'` 가 참이 되어 스텝이 오히려 **실행**된다(fail-safe 방향, 의도된 설계). 같은 fix 커밋이 다른 3곳(스크립트 docstring, plan 본문, `test_workflow_yaml_structure.py` 카탈로그 행)은 정정했지만 이 README 행만 누락됨. | `.claude/tests/README.md:49` | 49행을 `!= 'false'` 의미론으로 재작성 — 위험한 회귀는 반대로 조건을 다시 `== 'true'` 로 되돌리는 것임을 명시. 코드 변경 불요, 문서 전용 수정. |
| 2 | maintainability | `scripts/ci-paths-changed.sh` 의 "fail-safe 로 `true` emit 후 종료" 3줄 블록(`echo` 경고 + `emit true` + `exit 0`)이 5개 분기에서 손으로 복제됨. 이미 `emit()` 헬퍼가 있음에도 더 빈번한 이 패턴은 추출되지 않아, 5곳 중 한 곳만 수정하고 나머지를 놓치는 실수가 나기 쉬운 구조(이 스크립트는 required-check 데드락 해소의 핵심 판정자). | `scripts/ci-paths-changed.sh:66-68, 72-74, 79-81, 86-88, 92-94` | `fail_safe() { echo "..."; emit true; exit 0; }` 헬퍼를 `emit()` 바로 아래 추가하고 5곳을 한 줄 호출로 교체. |
| 3 | testing | 실제 프로덕션에서 쓰이는 pathspec `'codebase/**/package.json'`(중간 `**`)이 어떤 테스트에도 등장하지 않는다. 신설 테스트는 구조가 다른 `'codebase/frontend/**'`(끝쪽 `**`)만 검증한다. 실측 결과 `git diff --name-only ... -- 'codebase/**/package.json'` 는 중간 디렉터리 0개인 `codebase/package.json` 을 매칭하지 않는다 — 지금은 그런 파일이 없어 잠복 상태이나, 향후 추가되면 `relevant=false` 로 조용히 판정돼 이 PR 이 막으려는 것과 같은 클래스("초록인데 검사가 안 도는")가 재발한다. | `.claude/tests/test_ci_paths_changed.py:109-117` (테스트 부재); 실사용처 `.github/workflows/deps-security-checks.yml` 의 `changes.detect` 스텝 | `'codebase/**/package.json'` 문자열 그대로 쓰는 케이스를 추가해 중간 디렉터리 0/1/2개 깊이를 각각 단언. 0개가 실패하면 pathspec 을 `'codebase/package.json' 'codebase/*/package.json' 'codebase/**/package.json'` 로 명시 보강 검토. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | PR 1차 목적(skip-job 패턴 전환)과 별개로 의존성 보안 패치(`nanoid` override, `dompurify` 상향)가 같은 PR 에 번들됨 — 이번 PR 이 `audit` 잡을 처음 실행시켜 발견한 기존 취약점이라 같은 PR 에서 해소하지 않으면 목적(체크 통과 후 required 화) 달성 불가. plan 문서에 근거 실측 명시. | `pnpm-workspace.yaml:62`, `codebase/{channel-web-chat,frontend}/package.json`, `scripts/check-pnpm-security-config.py:54` | 조치 불요 — 이미 plan/RESOLUTION.md 에 구분 기록됨. |
| 2 | dependency/side_effect | `overrides.nanoid` 가 특정 경로가 아닌 전역(unscoped) 형태 — 향후 어떤 패키지가 `nanoid@^4/^5`(breaking) 를 요구해도 조용히 `^3.3.17` 로 강제 재해석될 수 있음. 현재는 소비 경로가 `postcss` 전이 1곳뿐이라 실질 위험 없음. | `pnpm-workspace.yaml:62` | 조치 불요, 기록만. `check-pnpm-security-config.py`/`check-override-floors.py` 가 정기 감시 중. |
| 3 | scope/dependency/side_effect | `pnpm-lock.yaml` 재생성 부수효과로 `libc: [glibc|musl]` 필드 약 57줄이 이번 변경(버전 2건 상향)과 무관하게 소멸. 원인(`pnpm@10.23.0` 이 축약 packument 사용) 실측 특정, `--frozen-lockfile` 검증엔 영향 없음. | `pnpm-lock.yaml` (예: 1208-1229 부근) | 조치 불요 — `plan/in-progress/deps-guard-hardening.md` §후속(P3) 에 이미 별도 추적 중. |
| 4 | maintainability | 두 워크플로에 동일한 근거 주석 + no-op 안내 스텝이 합계 4회 그대로 복제(GitHub Actions 제약상 스텝별 재게이팅 불가피하나 주석/안내 텍스트 복제는 별개). 1차 architecture 리뷰가 이미 지적, plan 에 "3번째 워크플로 전환 시 reusable workflow 추출" 로 추적 중. | `.github/workflows/deps-security-checks.yml:76-78,102-104,129-131` / `frontend-checks.yml:57-59,63-65` | 조치 불요(이미 추적됨). |
| 5 | maintainability | `scripts/ci-paths-changed.sh` 의 `case` 문에서 분기별 제어흐름 스타일 혼재(일부는 `case` 안에서 `exit 0`, 일부는 흐름이 이어짐) — 뮤테이션 테스트로 동작은 고정돼 있어 버그 아님, 가독성 이슈. | `scripts/ci-paths-changed.sh:56-76` | 즉시 조치 불요. 후속 리팩터링 시 함수 분리 검토. |
| 6 | testing | `test_converted_workflows_pass_the_script_its_own_path` 와 `test_each_job_announces_the_no_op_path` 가 YAML 텍스트/조건 문자열에 대한 substring 매칭이라 정밀도가 낮음(현재는 실제로 올바른 위치에 있어 문제 없음). | `.claude/tests/test_required_check_skip_jobs.py:173-192, 201-214` | 우선순위 낮음. `yaml.safe_load` 로 정확한 스텝/필드만 검사하도록 좁히거나 substring 근거를 docstring 에 명시. |
| 7 | security | 신설 `changes` 잡에 명시적 `permissions:` 없음(리포 기본 상속) — `pull_request`(non-target) 이벤트라 포크 PR 은 이미 read-only + 시크릿 미주입, 실질 위험 낮음. 액션도 SHA 대신 major 태그(`actions/checkout@v7`) 핀 — 저장소 전역 기존 관례. | `.github/workflows/deps-security-checks.yml`, `frontend-checks.yml` | 여유 있으면 `permissions: contents: read` 명시. 병합 차단 사유 아님. |
| 8 | maintainability | `test_ci_paths_changed.py` 의 `git()`/`run_script()` 헬퍼가 동일한 `PATH`/`GIT_CEILING_DIRECTORIES` 정책을 각각 독립 하드코딩. | `.claude/tests/test_ci_paths_changed.py:29-38, 40-56` | 우선순위 낮음. 공유 모듈 상수로 통합 검토. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 스크립트 인젝션 클래스 정석 회피, fail-safe 방향이 보안 검사 축소 안 함, 의존성 패치 완결적 확인. Critical/Warning 없음. |
| requirement | LOW | plan 요구사항 대비 구현 정합, 1차 리뷰 WARNING 8건 전부 실측 재검증(뮤테이션 포함)으로 해소 확인. README 카탈로그 1건만 W3 fix 반영 누락(WARNING). |
| scope | LOW | 핵심 변경은 skip-job 전환 단일 의도에 종속. 의존성 패치 번들·plan 후속절 추가·lockfile churn 은 전부 근거 문서화된 정당한 부수효과(INFO). |
| side_effect | LOW | 1차 라운드가 지적한 barrier skip 전파(W3)·push 광역화(W4) 모두 `if: !cancelled()`/SHA 비교로 닫힘 확인. nanoid unscoped override·libc churn 은 저강도 INFO. |
| maintainability | LOW | 핵심 스크립트/테스트 가독성 양호. `ci-paths-changed.sh` fail-safe 3줄 블록 5회 복제(WARNING). 워크플로 주석 복제·case 스타일 혼재·테스트 헬퍼 중복은 INFO(일부 이미 추적됨). |
| testing | LOW | 신규 테스트 스위트 전량 GREEN, 뮤테이션 재현·복구로 실효성 검증. 실사용 pathspec(`codebase/**/package.json` 중간 `**`)이 미검증(WARNING). substring 매칭 2건은 INFO. |
| documentation | NONE | 1차 리뷰 documentation 지적 3건(README stale, env var 미문서화, push 트리거 함의 미기재) 전부 이번 fix 에서 해소 확인. 신규 결함 없음. |
| dependency | LOW | dompurify/nanoid 패치 정확·완결(override 2곳 동시 갱신 규약 준수, lockfile 실측상 취약 버전 잔존 없음). nanoid override 전역 스코프·libc churn 은 INFO. 이전 라운드 레지스트리 미검증 WARNING 은 해소 확인. |

## 발견 없는 에이전트

없음(전원 최소 INFO 이상 발견 보고, documentation/security 는 실질 결함 없이 NONE).

## 권장 조치사항
1. `.claude/tests/README.md:49` 의 `test_required_check_skip_jobs.py` 카탈로그 행을 `!= 'false'` 의미론으로 재작성 — 현재 코드와 반대 방향 위험 서술을 정정 (requirement WARNING #1).
2. `scripts/ci-paths-changed.sh` 에 `fail_safe()` 헬퍼를 추가해 5곳의 중복 fail-safe 종료 로직을 통합 (maintainability WARNING #2).
3. `.claude/tests/test_ci_paths_changed.py` 에 실제 프로덕션 pathspec `'codebase/**/package.json'`(중간 `**`, 깊이 0/1/2) 케이스를 추가하고, 필요 시 `changes.detect` 스텝의 pathspec 을 명시 보강 (testing WARNING #3).
4. (낮은 우선순위, 선택) `permissions: contents: read` 명시, YAML substring 매칭 정밀도 개선, 테스트 헬퍼 env 정책 통합 — INFO 항목 참고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명, 전원 = 실행 목록과 동일) — **forced 전원 결과 확보됨. 화이트리스트 미이행 없음.**
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(CI 워크플로 트리거/조건, 의존성 버전 핀)와 무관 |
  | architecture | 동일 사유 — 런타임 아키텍처 변경 없음 |
  | database | 동일 사유 — DB 접근 코드 변경 없음 |
  | concurrency | 동일 사유 — 애플리케이션 동시성 로직 변경 없음 |
  | api_contract | 동일 사유 — API 계약 변경 없음 |
  | user_guide_sync | 동일 사유 — 사용자 가이드 대상 기능 변경 없음 |
STATUS=success requirement review complete — 0 critical, 0 warning, 2 info
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `changes` 잡 reusable workflow 추출 (`_changed-paths.yml`)

## 검증 방법

diff 뿐 아니라 실제 저장소 파일을 `Read` 로 직접 열어 대조하고, 하네스 테스트를 실제로
실행해 통과 여부를 확인했다(정적 판단에 그치지 않음):

- `python3 -m pytest .claude/tests/test_changed_paths_reusable.py .claude/tests/test_required_check_skip_jobs.py -q` → **21 passed, 31 subtests passed**
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (전체 하네스) → **975 tests OK** — RESOLUTION.md 의 "975 tests OK" 주장과 일치
- `.github/workflows/_changed-paths.yml`, 세 호출부(`backend-checks.yml`/`deps-security-checks.yml`/`frontend-checks.yml`), `scripts/ci-paths-changed.sh` 전문을 직접 읽어 wiring 을 추적
- bash here-string(`<<< "$PATHSPECS"`)의 트레일링 개행 보장 여부를 실측(`bash -c '...' `)으로 확인 — 본문 fail-safe 로직이 실제로 견딘다

## 발견사항

- **[INFO]** GitHub required status check 이름은 `jobs.<id>.name`(없으면 id)로 노출되는데, 인라인 잡 → `uses:` 호출 전환이 실제로 체크 표시 이름을 바꾸는지는 코드로 사전 확정할 수 없다.
  - 위치: `.github/workflows/backend-checks.yml:46-48`, `deps-security-checks.yml:47-49`, `frontend-checks.yml:28-30`
  - 상세: 이미 전 라운드 리뷰(INFO 4)에서 지적됐고, `plan/in-progress/ci-required-check-skip-jobs.md:214-217`에 "머지 후 Actions 에서 실제 표시 이름 1회 확인" 행동 항목으로 정확히 반영돼 있다. 코드 결함이 아니라 GitHub 플랫폼 동작이라 사전 assertion 대상이 아니다.
  - 제안: 추가 조치 불요 — 이미 plan 에 후속 액션으로 올바르게 기록됨.
- **[INFO]** `spec/` 에 이 변경 영역(CI 워크플로 skip-job 패턴·reusable workflow 추출)을 정의하는 문서 없음.
  - 위치: 해당 없음 (`spec/` 전체에서 `ci-paths-changed`/`changed-paths`/`workflow_call` grep 0건)
  - 상세: `.github/workflows/**`·`.claude/tests/**` 는 하네스/CI 인프라이며 CLAUDE.md 규약상 제품 spec 대상이 아니다(스펙은 `spec/`, 하네스는 `.claude/docs/`). 회색지대이며 이전 SUMMARY 의 INFO 7 판단과 일치한다.
  - 제안: 조치 불요.

## 기능 완전성 · 엣지 케이스 · 반환값 검증 (실측)

- **pathspec → 인자 배열 변환**: 여러 줄 → N 개 인자, 빈 줄/공백줄 드롭, 글롭 조기확장 없음, 공백 포함 pathspec 이 인자 1개로 유지 — 6개 케이스 모두 실행 테스트로 pinning 되어 있고 실제로 통과.
- **빈 입력 fail-closed**: `FILTERED` 배열이 0개면 `exit 2` + stderr 에 "비었다" 문구 — 스크립트 자신의 `usage` 에러(빈 pathspec)와 별개로 워크플로 레벨에서도 이중 방어.
- **fail-safe 방향**: `scripts/ci-paths-changed.sh` 의 5개 불확실 분기(비-PR/비-push 이벤트, base/head SHA 부재, shallow clone, git diff 실패, 신규 브랜치 push)가 전부 `emit true`(검사 수행) 로 귀결 — 스크립트 본문 직접 확인, "조용히 스킵" 방향으로 떨어지는 코드 경로 없음.
- **출력 배선**: `steps.detect.outputs.relevant` → `jobs.detect.outputs.relevant` → `workflow_call.outputs.relevant.value` → 호출부 `needs.changes.outputs.relevant` 4단 체인이 전부 정확히 연결(GitHub reusable-workflow output 규약과 일치), `test_required_check_skip_jobs.py::test_changes_job_publishes_relevant` 가 실제 값까지(문자열 정확 일치) 단언.
- **자기등재**: 세 호출부 모두 `scripts/ci-paths-changed.sh` 와 `.github/workflows/_changed-paths.yml` 을 자신의 pathspecs 목록에 포함 — 판정 로직/wiring 자체가 바뀌어도 그 워크플로가 재트리거된다. `pathspecs_of()` 헬퍼가 YAML 을 파싱해 실제 원소로 검사(종전 substring 검사가 주석 문자열도 통과시키던 결함을 제거).
- **깊이-0 pathspec 짝**: `deps-security-checks.yml` 이 `codebase/**/package.json`(깊이 ≥1) 과 `codebase/package.json`(깊이 0) 을 모두 등재 — git pathspec 의 중간 `**` 가 깊이 0 을 못 잡는 실측 사실과 일치.
- **인젝션 회피**: `run:` 블록에 `${{ }}` 직접 삽입 없음(`env:` 경유), `test_run_block_never_interpolates_expressions` 로 고정.
- **TODO/FIXME/HACK/XXX**: 변경된 6개 harness/workflow 파일에서 grep 0건.

## 전 라운드 리뷰(18_32_41) 조치 반영 확인

`RESOLUTION.md` 가 주장한 4건(W1-W4) 수정이 실제로 반영됐는지 대조:

- W1(plan 체크박스 미반영) — `plan/in-progress/ci-required-check-skip-jobs.md:187`, `plan/in-progress/backend-lint-gate-broken-on-main.md:261` 모두 `[x]` 로 실제 갱신됨 확인.
- W2(README 카탈로그 미반영) — `.claude/tests/README.md` 의 `test_required_check_skip_jobs.py` 행이 reusable workflow 위임 검증·자기등재 요구·YAML 파싱 전환을 서술.
- W3(공백 포함 pathspec 회귀 테스트 부재) — `test_a_pathspec_containing_spaces_stays_one_argument` 실재, 실행 통과 확인.
- W4(`${{` 인젝션 불변식 미고정) — `test_run_block_never_interpolates_expressions` 실재, 실행 통과 확인.

## 관련 없어 보이나 같은 커밋에 포함된 변경

`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 의 mock 수정(이미 abort 된 signal 을 즉시 reject)은 CI 워크플로 리팩터와 직접 관련 없으나, 같은 커밋의 `backend unit` 잡이 처음 CI 에서 실행되며 관측한 flaky 실패(`plan/in-progress/backend-lint-gate-broken-on-main.md:202-250`)의 근본 수정이다. 프로덕션 코드가 아니라 테스트 mock 이 실제 `fetch` 의 "이미 aborted 인 signal → 즉시 reject" 동작을 안 따랐던 결함이며, 수정 후 로직(`if (observedSignal!.aborted) failAsAborted(); else observedSignal!.addEventListener('abort', failAsAborted);`)이 정확히 그 간극을 메운다. 원인·수정·재확인 근거가 plan 문서에 상세히 남아 있고 의도-구현 괴리 없음.

## 요약

CI `changes` 잡의 reusable workflow(`workflow_call`) 추출은 기능적으로 완전하다. pathspec 스칼라→배열 변환의 가장 위험한 지점(글롭 조기확장·공백 포함 경로·빈 줄)이 실행 기반 테스트로 pinning 되어 있고 실제로 통과하며, fail-safe/fail-closed 방향이 코드 전 경로에서 일관되고, 출력 배선 4단 체인이 GitHub reusable-workflow 규약과 정확히 일치한다. 전 리뷰 라운드의 WARNING 4건은 모두 실제로 코드/문서에 반영됐음을 직접 확인했다. spec/ 문서는 이 영역을 다루지 않아 spec fidelity 항목은 회색지대(INFO)이며, 남은 유일한 리스크(체크 표시 이름 변경 가능성)는 코드로 사전 검증 불가능한 플랫폼 동작으로, plan 에 머지 후 확인 액션으로 이미 정확히 반영돼 있다. Critical/Warning 없음.

## 위험도
LOW

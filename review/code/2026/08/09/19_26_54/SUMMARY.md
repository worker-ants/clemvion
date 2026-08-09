# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, Warning 1건(테스트 갭), 나머지는 INFO. router_safety 강제 화이트리스트(requirement/side_effect/testing) 3명 전원 결과 확보됨 — 누락된 forced reviewer 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `pathspecs` 블록 스칼라의 각 줄에서 앞뒤 공백이 bash 런타임에서는 트리밍되지 않고 그대로 pathspec 인자로 전달되지만(실측: `"  a.yaml\nb.yaml  \n"` → `["  a.yaml", "b.yaml  "]`), 이 케이스가 테스트로 커버되지 않는다. 더 문제적으로, Python 테스트 헬퍼 `pathspecs_of()`는 YAML 파싱 시 `line.strip()`으로 정규화해 비교하므로 향후 `pathspecs:` 항목에 실수로 공백이 섞여도 테스트는 통과하고 런타임만 조용히 해당 pathspec 을 무력화할 수 있다(테스트-런타임 간극) | `.github/workflows/_changed-paths.yml:85-90` (`FILTERED+=("$spec")`), `.claude/tests/test_required_check_skip_jobs.py:75-83` (`pathspecs_of()`), 테스트 갭: `.claude/tests/test_changed_paths_reusable.py`의 `ArgumentSplittingTest` | `_changed-paths.yml` 루프에서 `FILTERED` 삽입 전 `spec` 트리밍(또는 트리밍 안 함을 헤더 주석에 명시); `test_changed_paths_reusable.py`에 앞뒤 공백 포함 pathspec 회귀 케이스 추가; `pathspecs_of()`의 `.strip()`이 런타임과 다르게 동작함을 주석으로 명시하거나 원본 비교로 전환 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 인터페이스 변경 (플랫폼 동작) | 인라인 `changes` 잡 → `uses:` reusable workflow 호출 전환으로 GitHub Actions UI 상 체크 표시 이름이 바뀔 가능성이 있으나 코드로 사전 확정 불가. required status check 대상인 리프 잡(`lint`/`unit`/`typecheck-ratchet` 등)과 `needs.changes.outputs.relevant` wiring 문법은 손대지 않아 실질 위험 낮음 | `.github/workflows/backend-checks.yml:46-48`, `deps-security-checks.yml:47-49`, `frontend-checks.yml:28-30` | 코드 변경 불요 — `plan/in-progress/ci-required-check-skip-jobs.md`에 이미 "머지 후 Actions 에서 표시 이름 1회 확인" 액션 기록됨 |
| 2 | 테스트 위생 (파일시스템 부작용) | 신규 테스트 헬퍼 `run_with()`가 `tempfile.mkdtemp()`로 만드는 임시 디렉터리가 정리되지 않아, 반복 로컬 실행 시 누적됨. 자매 파일 `test_ci_paths_changed.py`는 `TemporaryDirectory()` + `setUp`/`tearDown` 패턴을 쓰는데 이 신규 파일만 관례를 벗어남. CI 러너에선 무해, 저위험 | `.claude/tests/test_changed_paths_reusable.py:57-62` (`run_with()`) | `tempfile.TemporaryDirectory()` 컨텍스트 매니저 또는 `addCleanup`으로 정리 추가 |
| 3 | 죽은 코드 (테스트) | `http-request.handler.spec.ts`의 한 테스트에 no-op mock 스캐폴딩(`fetchPromise`/`_reject` 블록)이 남아 있어 실제 통과 원인과 무관하게 방치됨 — 이번 fix 가 고친 두 번째 Promise 블록만 실질 동작. 향후 유사 flake 디버깅 시 오해 유발 가능 | `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (~1674-1686행, `upstream abort fired during fetch cascades to the fetch controller` 테스트) | 이번 PR 필수 아님. 여유 있을 때 죽은 `fetchPromise`/`_reject` 블록 제거 |
| 4 | Spec 정합 (회색지대) | `spec/`에 이번 변경 영역(CI skip-job 패턴·reusable workflow 추출)을 정의하는 문서 없음 — CLAUDE.md 규약상 CI 워크플로/하네스는 spec 대상이 아니므로 정상 | 해당 없음 (`spec/` 전체 grep 0건) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | pathspec 앞뒤 공백 미트리밍 + 테스트-런타임 간극 (WARNING 1건, 직접 실행으로 재현 확인); dead mock 스캐폴딩 (INFO 1건). 직접 실행 검증: pytest 21 passed/31 subtests, workflow YAML 구조 12 passed/281 subtests, jest cancellation 3 passed |
| requirement | LOW | Critical/Warning 없음. 체크 표시 이름 변경 가능성·spec 문서 부재 (INFO 2건, 둘 다 회색지대/이미 추적됨). 전 라운드(18_32_41) WARNING 4건(W1-W4) 실제 반영 확인. 전체 하네스 975 tests OK 재확인 |
| side_effect | LOW | 프로덕션 코드·전역 상태·네트워크 표면 변경 없음. 임시 디렉터리 미정리(INFO)·체크 표시 이름 변경 가능성(INFO) |

## 발견 없는 에이전트

없음 — 3개 reviewer 모두 최소 1건 이상의 발견사항(WARNING/INFO)을 보고했으나, 전원 위험도는 LOW이며 실질적 차단 사유(Critical)는 없음.

## 권장 조치사항

1. (WARNING) `_changed-paths.yml`의 `FILTERED` 배열 삽입 전 `spec` 값을 트리밍하거나, 트리밍하지 않는 것이 의도라면 헤더 주석에 명시하고, `test_changed_paths_reusable.py`에 앞뒤 공백 포함 pathspec 케이스를 추가해 실제 동작을 pin. `pathspecs_of()`의 `.strip()` 정규화도 런타임과 정합되도록 조정.
2. (INFO, 이미 추적됨) 머지 후 GitHub Actions 실행 화면에서 `changes` 잡의 실제 체크 표시 이름을 1회 육안 확인 — `plan/in-progress/ci-required-check-skip-jobs.md`에 이미 액션 항목으로 기록됨.
3. (INFO, 선택) `test_changed_paths_reusable.py`의 `run_with()`에 임시 디렉터리 정리 추가하여 자매 파일과 관례 일치.
4. (INFO, 선택) `http-request.handler.spec.ts`의 죽은 `fetchPromise`/`_reject` mock 스캐폴딩 제거.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용. 강제 화이트리스트(router_safety) `requirement, side_effect, testing` 3명 전원 실행 및 결과 확보 확인됨 — 누락 없음.
- **실행**: `testing`, `requirement`, `side_effect` (3명, 전원 forced)
- **제외**: 없음
- **강제 포함(router_safety)**: `requirement`, `side_effect`, `testing` — 전원 정상 완료(success), 결과 전문 확보됨.
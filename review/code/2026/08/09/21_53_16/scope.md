# 변경 범위(Scope) 리뷰

## 발견사항

없음. 아래 스코프 판단만 기록한다.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 갱신은 이 PR 자체의 작업(composite action 추출)과 다른 plan 문서를 건드린다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:295` (체크박스 완료 표시), `:322-331` (집행 요약 추가)
  - 상세: 이 파일은 `backend-lint-gate-broken-on-main` plan 의 후속 항목 목록으로, 그 문서 자체가 "셋업 보일러플레이트 composite action 추출" 을 트리거 조건과 함께 걸어 둔 원 출처다. 이번 PR 이 그 트리거를 집행했으므로 원 출처 plan 의 체크박스를 `[x]` 로 동기화하고 실행 요약을 남겼다 — 두 plan 문서(`backend-lint-gate-broken-on-main.md` §후속, `ci-required-check-skip-jobs.md` §셋업 보일러플레이트)가 같은 항목의 양쪽 끝(트리거 선언 / 집행)을 잡고 있어 둘 다 갱신해야 "체크박스=실제 상태" 가 유지된다. 실질적 스코프 벗어남이 아니라 관련 plan 간 상태 동기화이며, 두 문서의 서술 내용도 서로 정합적이다(동일한 수치: -41줄, 57→39곳, 뮤테이션 13/13).
  - 제안: 조치 불필요. 다만 리뷰어 참고용으로만 표기.

## 요약

`.github/actions/pnpm-workspace/action.yml` composite action 신설과 9개 잡(6개 워크플로 파일)의 셋업 3스텝(`pnpm/action-setup` + `setup-node` + `pnpm install`) → 액션 호출 1스텝 치환이 diff 의 핵심이며, 이는 `plan/in-progress/ci-required-check-skip-jobs.md` 와 `backend-lint-gate-broken-on-main.md` 양쪽에 명시적으로 걸려 있던 "4번째(실제로는 8+1개) 워크플로 전환 시점에 판단" 트리거가 도달해 집행된 것으로, 문서화된 계획과 정확히 일치한다. 부수 변경 전부가 이 추출의 직접 결과다: (1) 추출된 스텝이 `.github/workflows/*.yml` 만 보던 구조 검사(`test_workflow_yaml_structure.py`)의 시야 밖으로 나가므로 검사 범위를 `.github/actions/**/action.yml` 로 넓힘, (2) 새 액션을 실제 인자(argv) 기준으로 고정하는 신규 테스트(`test_pnpm_workspace_action.py`) 추가, (3) `test_harness_checks_paths_coverage.py` 레지스트리에 액션 경로 1건 등재, (4) `harness-checks.yml` 및 액션을 호출하는 6개 워크플로의 `changes` 잡 pathspecs 에 액션 파일 등재(반복되는 이유 주석 포함) — 이는 저장소가 이미 6회 겪은 "paths 커버리지 갭" 재발 방지라는 기존 계약을 신규 의존(액션)에도 그대로 적용한 것, (5) `.claude/tests/README.md` 카탈로그 테이블에 신규 테스트 파일 1행 추가(기존 컨벤션), (6) 두 plan 문서의 체크박스/실행 요약 동기화. 워크플로 파일 diff 는 3스텝→1스텝 기계적 치환 외에 버전 범프·타임아웃 변경·불필요한 재포맷 없이 순수하며, 신규 주석·docstring 은 전부 "왜 이 코드가 이 형태인가"를 설명하는 근거 텍스트로 저장소의 기존 문서화 밀도와 일치한다. 사용하지 않는 임포트나 무관한 설정 변경, 요청 밖 기능 확장은 발견되지 않았다.

## 위험도
NONE

# API 계약(API Contract) 리뷰

## 대상 검토

본 라운드(10R)의 변경분은 다음 15개 파일로 구성된다:

- `.claude/_shared/git_probe.py` (신규 — git 프로브 공유 모듈)
- `.claude/hooks/_lib/branch_guard.py`, `plan_guard.py`, `review_guard.py` (공유 모듈로 위임하도록 리팩터)
- `.claude/tests/README.md`, `test_block_integrity.py`, `test_plan_guard.py`, `test_review_gate_ci.py`,
  `test_review_guard_hardening.py`, `test_stop_guard_failopen.py`, `test_workflow_yaml_structure.py`
- `.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml` (CI 워크플로 정의)
- `plan/in-progress/harness-review-gate-ci-backstop.md` (작업 계획 문서)
- `scripts/check-review-gate.py` (CI 전용 백스톱 스크립트, `review_guard.evaluate_review()` 를 호출)

전체 파일을 확인한 결과(축약 표시된 `review_guard.py`, `test_block_integrity.py`, `test_review_gate_ci.py`,
`.claude/tests/README.md` 포함, 아래 커맨드로 직접 열어 확인) 이 변경분은 다음 성격을 갖는다:

- HTTP 엔드포인트, REST 컨트롤러, 라우트 정의가 전혀 없다.
- 외부에 노출되는 요청/응답 스키마, DTO, OpenAPI 정의가 없다.
- 이 코드는 `codebase/backend`/`codebase/frontend` 의 제품 API 표면과 무관하며, 저장소 자체의
  git push/CI 리뷰-커버리지 게이트(개발 워크플로 하네스)를 구현하는 내부 도구다.
- 유일한 "인터페이스"는 (a) 함수 호출 계약(`evaluate_review()`, `evaluate_plan()`, `evaluate()` 가
  반환하는 dataclass 형태) 과 (b) `scripts/check-review-gate.py` 의 CLI 인자(`--enforce`, `--root`)이며,
  둘 다 REST/HTTP API 계약 검토 관점(하위 호환성·버전 관리·응답 스키마·에러 응답 코드·요청 검증·
  URL 설계·페이지네이션·인증/인가)의 대상이 아니다.

확인 커맨드:

```
grep -n "^### 파일" review/code/2026/08/06/14_07_31/_prompts/api_contract.md
```

→ 15개 파일 전부 `.claude/**`, `.github/workflows/**`, `plan/**`, `scripts/check-review-gate.py` 이며
`codebase/backend`·`codebase/frontend` 아래 컨트롤러/라우트/DTO 파일은 0건.

## 참고 — 확인했으나 API 계약 범위 밖인 지점

- `scripts/check-review-gate.py` 의 종료 코드 계약(정상/관측=0, `--enforce` 위반 시 1, 내부 오류 시
  fail-open 으로 0)은 CI 스크립트의 **exit code 계약**이지 HTTP API 의 상태 코드 계약이 아니다.
  다만 이 계약 자체는 이미 문서화·테스트(`test_review_gate_ci.py`, 축약되어 별도 확인 필요)로
  커버되는 것으로 보이며, API Contract 리뷰어의 관점 항목(1~8) 어디에도 해당하지 않는다.
- `_shared/git_probe.py` 의 `_run_git`/`_porcelain_path` 등은 프로세스 내부 함수 호출이며, 외부
  클라이언트가 소비하는 계약이 아니다.

## 발견사항

없음.

## 요약

이번 변경분은 리뷰 게이트의 판정 로직(`review_guard`/`plan_guard`/`branch_guard`)을 `_shared/git_probe.py`
공유 모듈로 통합하고, 이를 검증하는 하네스 테스트와 GitHub Actions CI 워크플로(`review-gate.yml`)를
추가/조정한 것이다. HTTP API, REST 엔드포인트, 요청/응답 스키마, 페이지네이션, 인증/인가 등 API 계약
관점의 대상 코드가 전혀 포함되어 있지 않으므로 해당 없음으로 판단한다.

## 위험도

NONE

---

STATUS=success ISSUES=0

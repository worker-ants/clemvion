# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 해당 없음 — 이번 변경(6개 파일)은 harness/CI 자동화 계층(리뷰 게이트의 훅-독립 CI 백스톱)이며, HTTP API 엔드포인트·요청/응답 스키마·라우팅·페이지네이션·인증/인가 등 API 계약 요소를 포함하지 않는다.
  - 위치: 변경분 전체 — `.claude/tests/README.md`, `.claude/tests/test_review_gate_ci.py`, `.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`
  - 상세: `git diff origin/main...HEAD --stat` 로 실측한 변경 파일은 위 6개뿐이며(전체 diff: 6 files changed, 493 insertions, 8 deletions), `codebase/backend`·`codebase/frontend`(제품 API 서버/클라이언트) 는 전혀 포함되지 않는다. `scripts/check-review-gate.py` 는 `argparse` 기반 CLI 로 GitHub Actions(`review-gate.yml`)가 서브프로세스로 실행하는 진입점일 뿐, HTTP 서버·라우트·컨트롤러·DTO 를 정의하지 않는다. `review-gate.yml`/`harness-checks.yml` 은 워크플로 트리거(`on: pull_request: paths:`) 설정이며 이 저장소가 제공하는 API 가 아니라 GitHub Actions 가 제공하는 이벤트를 구독하는 쪽이다.
  - 제안: 없음 — 이 리뷰어 관점에서 조치 불필요.

- **[INFO]** (참고, 등급에 영향 없음 — 검증만 기록) 이 변경에서 유일하게 "계약"에 준하는 요소는 REST API 가 아니라 내부 Python 함수 시그니처 `evaluate_review(cwd=None, *, in_flight_ok=False)` 이며, 신규 호출부가 기존 두 호출부와 어긋나지 않는지 실제 소스를 열어 대조했다.
  - 위치: `scripts/check-review-gate.py`(`_load_gate`/`main` 내 `decision = evaluate(root)` 호출) 대 `.claude/hooks/_lib/review_guard.py:942`(`def evaluate_review(cwd: str | None = None, *, in_flight_ok: bool = False)` 정의), `.claude/hooks/guard_review_before_push.py:846`(`evaluate(target)` — 위치 인자 호출), `.claude/hooks/guard_review_before_stop.py:350`(`evaluate_review(in_flight_ok=True)`).
  - 상세: 세 호출부 모두 `cwd` 를 위치 인자로, `in_flight_ok` 를 키워드 전용으로 다루는 동일 시그니처에 부합한다. 신규 CI 스크립트는 `in_flight_ok` 를 넘기지 않아 기본값 `False`(하드 게이트 유지)를 그대로 받는데, 이는 "opt-in 억제는 Stop 훅 전용, push 계열은 항상 엄격 판정" 이라는 문서화된 의도(주석·plan 문서 §관측(2))와 정확히 일치한다. `test_review_gate_ci.py` 의 두 스텁(`evaluate_review(cwd=None, *, in_flight_ok=False)`) 도 동일 시그니처를 재현하고 있어 계약 불일치 없음을 재확인했다.
  - 제안: 없음 — 불일치 없음, 조치 불요.

## 요약

이번 diff 는 리뷰 커버리지 게이트(`review_guard.evaluate_review()`)를 GitHub Actions PR 이벤트로 재트리거하는 훅-독립 CI 백스톱(`review-gate.yml` + `check-review-gate.py`)을 추가하는 harness 인프라 변경이다. 변경된 6개 파일(`test_review_gate_ci.py`, `check-review-gate.py`, `review-gate.yml`, `harness-checks.yml` 갱신, `.claude/tests/README.md` 갱신, plan 문서 갱신)은 전부 `.claude/`·`.github/`·`scripts/`·`plan/` 범위이며, `codebase/` 하위 제품 코드(백엔드 REST API, 프런트엔드 클라이언트)는 전혀 건드리지 않는다 — `git diff origin/main...HEAD --stat` 로 직접 확인했다. HTTP 엔드포인트, 요청/응답 스키마, 상태 코드, 페이지네이션, 인증/인가 등 이 리뷰어의 8개 체크리스트 항목은 전부 비적용 대상이다. 유일하게 "계약"이라 부를 만한 것은 CI 스크립트가 호출하는 내부 함수 `evaluate_review()` 의 시그니처인데, 기존 두 호출부(push/stop 훅)와 신규 호출부를 실제 소스에서 직접 대조해 어긋남이 없음을 확인했다(위치 인자 `cwd`, 기본값 `in_flight_ok=False` 유지). 설계 자체(단일 판정자·관측 모드 우선·fail-open·advisory 무조건 출력)의 타당성은 API 계약 범위를 벗어나므로 본 리뷰에서는 평가하지 않는다.

## 위험도

NONE

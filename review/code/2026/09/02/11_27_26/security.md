# 보안(Security) 코드 리뷰

## 리뷰 범위

본 변경은 backend/frontend 공용 타입체크 ratchet 인프라 신설(`scripts/_typecheck_ratchet.py` +
두 엔트리포인트), 관련 CI 워크플로(`frontend-checks.yml`, `harness-checks.yml`) 갱신,
frontend `vitest`/`jest-axe` 앰비언트 타입 선언 재구성, 그리고 문서(`README.md`, `PROJECT.md`,
plan 트래커) 갱신으로 구성된다. 사용자 입력을 처리하는 애플리케이션 코드나 인증/인가 로직은
포함되어 있지 않고, 전부 내부 개발자 도구·CI 파이프라인 계층이다.

## 발견사항

발견된 Critical/Warning 없음.

- **[INFO]** GitHub Actions 서드파티 액션이 major 버전 태그로 핀 (`@v7`)
  - 위치: `.github/workflows/frontend-checks.yml:109` (`actions/checkout@v7`), `.github/workflows/frontend-checks.yml:118` (`actions/setup-python@v7`)
  - 상세: 커밋 SHA 가 아닌 mutable 태그(`@v7`)를 사용하면 태그가 재지정될 경우 공급망 위험이 있다. 다만 이 값은 저장소 전역의 기존 관례(다른 워크플로들도 동일 패턴)를 그대로 따른 것이라 이 diff 가 새로 도입한 회귀는 아니다.
  - 제안: 새로운 회귀는 아니므로 이 PR 범위에서 조치 불필요. 별도 트랙에서 저장소 전체 액션 pin 정책(SHA pin 여부)을 재검토할 수 있다.

- **[INFO]** `subprocess.run` 호출 형태 확인 — 안전
  - 위치: `scripts/_typecheck_ratchet.py` `run_tsc()` (전체 파일 컨텍스트 77~107줄)
  - 상세: `subprocess.run(["npx", "tsc", "--noEmit", "-p", cfg.tsconfig], cwd=cfg.package_dir, ...)` 형태로 `shell=True` 없이 인자 리스트로 실행되며, `cfg.tsconfig`/`cfg.package_dir` 는 각 엔트리포인트(`check-backend-typecheck-ratchet.py`/`check-frontend-typecheck-ratchet.py`)에 하드코딩된 `RatchetConfig` 값으로, 외부 입력(PR 파일명·환경변수·커맨드라인 인자)이 이 인자들에 흘러들 경로가 없다. 커맨드 인젝션 취약점 없음.
  - 제안: 조치 불필요 (검증 완료).

## 요약

리뷰 대상은 타입체크 ratchet CI 게이트 신설·리팩터링과 vitest 앰비언트 타입 선언 재구성으로, 사용자 입력·인증/인가·암호화·시크릿 저장과 무관한 순수 내부 개발 도구/CI 계층 변경이다. `subprocess.run` 은 리스트 인자 + 정적 설정값만 사용해 커맨드 인젝션 경로가 없고, 하드코딩된 시크릿·안전하지 않은 암호화·SQL/XSS/경로 탐색류 인젝션 표면도 발견되지 않았다. 신설된 `frontend-checks.yml` 의 `typecheck-ratchet` 잡은 워크플로 레벨 `permissions: contents: read` 를 그대로 상속하며 추가 권한 요청이 없어 최소 권한 원칙에 부합한다. 유일한 관찰 사항은 액션이 major-tag(`@v7`)로 핀되어 있다는 점인데, 이는 저장소 전역의 기존 관례이며 이 PR 이 새로 만든 회귀가 아니다.

## 위험도

NONE

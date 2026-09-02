# 보안(Security) 코드 리뷰

## 범위 요약

이번 diff 는 애플리케이션 코드가 아니라 CI/타입체크 harness 인프라다: backend/frontend
타입체크 ratchet 판정 로직을 공유 코어(`scripts/_typecheck_ratchet.py`)로 통합하고,
frontend 전용 게이트(`check-frontend-typecheck-ratchet.py`, `tsconfig.typecheck.json`,
`frontend-typecheck-baseline.json`)를 신설하며, `frontend-checks.yml`/`backend-checks.yml`/
`harness-checks.yml` 의 `changes.pathspecs` 를 갱신하고, `jest-axe.d.ts` 의 TS 모듈 shadowing
버그를 고치며, 신규 harness 가드(`test_workflow_run_inputs_covered.py`)를 추가한다. 이전 두
리뷰 라운드(`review/code/2026/09/02/11_27_26/**`, `review/code/2026/09/02/15_04_04/**`)의
산출물도 diff 에 포함돼 있다. 네트워크 엔드포인트·DB·인증/인가 로직·사용자 입력 처리 경로가
전혀 없다.

## 발견사항

발견된 Critical/Warning 없음.

- **[INFO]** `subprocess.run` 호출 형태 재확인 — 안전
  - 위치: `scripts/_typecheck_ratchet.py` `run_tsc()` (88-118행), `.claude/tests/test_workflow_run_inputs_covered.py` `_tracked_files()` (48-52행)
  - 상세: `run_tsc()` 는 `subprocess.run(["npx", "tsc", "--noEmit", "-p", cfg.tsconfig], cwd=cfg.package_dir, ...)` 를 `shell=True` 없이 인자 리스트로 실행한다. `cfg.tsconfig`/`cfg.package_dir` 는 `check-backend-typecheck-ratchet.py`(52-64행)/`check-frontend-typecheck-ratchet.py`(55-67행)에 하드코딩된 `RatchetConfig` 리터럴 값(`"tsconfig.json"`/`"tsconfig.typecheck.json"`, 고정 경로)뿐이라 외부 입력(PR 파일명·환경변수·CLI 인자)이 커맨드 구성에 흘러들 경로가 없다. 신규 `test_workflow_run_inputs_covered.py` 의 `subprocess.run(["git", "ls-files"], cwd=REPO_ROOT, ...)` 도 동일하게 고정 인자 리스트다. 커맨드 인젝션 없음.
  - 제안: 조치 불필요(검증 완료).

- **[INFO]** `DIAGNOSTIC` 정규식의 lazy quantifier — ReDoS 우려 없음
  - 위치: `scripts/_typecheck_ratchet.py:49-51` (`DIAGNOSTIC = re.compile(r"^(?P<file>[^\s].*?)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+)")`), 소비처 `count_by_file()` 121-128행
  - 상세: 이번 라운드에서 route group 경로(`(main)/…`) CRITICAL 을 고치며 file 캡처 그룹이 greedy `[^(]*` 에서 `.*?`(lazy) + `\(\d+,\d+\): error TS` 앵커 조합으로 바뀌었다. 중첩 정량자가 없고 단일 lazy 매치라 catastrophic backtracking 형태가 아니며(각 `(` 위치마다 앵커 실패 시 단순 진행), 입력도 `tsc` 가 생성해 로컬/CI 에서 `splitlines()` 로 줄 단위 처리하는 출력이라 공격자가 통제 가능한 외부 입력이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** baseline JSON 입력 검증 — fail-closed 로 안전하게 처리
  - 위치: `scripts/_typecheck_ratchet.py` `load_baseline()` 131-151행
  - 상세: 파일 부재·JSON 파싱 실패·`files` 필드가 dict 아님·값이 int 아님 네 갈래 전부 `undecidable()`(exit 2)로 fail-closed 처리되며, 판단 불가를 "오류 0건"과 같은 통과 코드로 흘리지 않는다. `cfg.baseline` 경로는 `RatchetConfig` 하드코딩 값이라 경로 탐색(path traversal) 표면이 없다.
  - 제안: 조치 불필요.

- **[INFO]** GitHub Actions workflow 에 script injection 표면 없음
  - 위치: `.github/workflows/frontend-checks.yml` 신설 `typecheck-ratchet` job (107-136행), `changes` job pathspecs (38-72행)
  - 상세: 신설 job 의 모든 `run:` 스텝(`echo "..."`, `python3 scripts/check-frontend-typecheck-ratchet.py`)이 고정 문자열이며 `${{ github.event.pull_request.title }}` 류 신뢰되지 않는 컨텍스트 값을 `run:` 셸 문자열에 직접 보간하지 않는다 — 전형적인 GitHub Actions script-injection 패턴이 아니다. `permissions: contents: read` 만 선언되어 추가 권한 요청이 없고, `pull_request_target` 이 아니라 `pull_request` 트리거를 쓴다(fork PR 에서도 상승된 토큰/시크릿 접근 없음).
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 이번 diff 전체(`scripts/_typecheck_ratchet.py`, `check-backend/frontend-typecheck-ratchet.py`, `frontend-typecheck-baseline.json`, `.d.ts` 2건, `tsconfig.typecheck.json`, workflow yml 3건, `test_workflow_run_inputs_covered.py`)
  - 상세: API 키/비밀번호/토큰/인증서 패턴 grep 결과 없음(직접 확인). `test_workflow_run_inputs_covered.py:45` 의 `token`/`file` 변수명은 "저장소 경로 토큰"을 뜻하는 것으로 시크릿과 무관하다.
  - 제안: 조치 불필요.

- **[INFO]** GitHub Actions 서드파티 액션이 major 버전 태그로 핀 (`@v7`) — 신규 회귀 아님
  - 위치: `.github/workflows/frontend-checks.yml:117` (`actions/checkout@v7`), `:126` (`actions/setup-python@v7`)
  - 상세: 커밋 SHA 가 아닌 mutable 태그를 사용하는 것은 이론상 공급망 리스크이지만, 저장소 전역 기존 관례(다른 워크플로들도 동일 패턴)를 그대로 따른 것이고 이전 두 리뷰 라운드에서도 동일하게 "신규 회귀 아님"으로 판정됐다.
  - 제안: 이 PR 범위에서 조치 불필요. 별도 트랙에서 저장소 전체 액션 SHA-pin 정책을 재검토할 수 있다.

## 요약

리뷰 대상은 타입체크 ratchet CI 게이트의 공유 코어 추출·frontend 신설·워크플로 배선·vitest
앰비언트 타입 선언 재구성으로, 사용자 입력·인증/인가·암호화·시크릿 저장·네트워크 엔드포인트와
무관한 순수 내부 개발 도구/CI 계층 변경이다. `subprocess.run` 은 리스트 인자 + 정적 설정값만
사용해 커맨드 인젝션 경로가 없고, `DIAGNOSTIC` 정규식은 lazy quantifier 단일 사용이라
ReDoS 형태가 아니며 입력도 신뢰되는 로컬 `tsc` 출력이다. baseline JSON 로딩은 형태 불일치 시
전부 fail-closed(exit 2)로 처리해 판단 불가를 조용한 통과로 흘리지 않는다. 신설 `typecheck-ratchet`
job 은 `pull_request_target` 이 아니라 `pull_request` 를 쓰고 `run:` 스텝에 신뢰되지 않는
컨텍스트 값을 보간하지 않으며 `permissions: contents: read` 로 최소 권한을 유지해 script
injection·권한 상승 표면이 없다. 하드코딩된 시크릿·안전하지 않은 암호화·SQL/XSS/경로 탐색류
인젝션도 발견되지 않았다. 유일한 관찰 사항(액션 major-tag 핀)은 저장소 전역 기존 관례이며 이
PR 이 새로 만든 회귀가 아니다.

## 위험도

NONE

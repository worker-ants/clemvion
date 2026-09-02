# 보안(Security) 코드 리뷰

## 범위 요약

이번 diff 는 애플리케이션 코드가 아니라 **CI/타입체크 harness 인프라**다: backend/frontend 타입체크 ratchet 을 공유 코어(`scripts/_typecheck_ratchet.py`)로 통합하고, frontend 전용 게이트(`check-frontend-typecheck-ratchet.py`, `tsconfig.typecheck.json`, baseline JSON)를 신설하며, 관련 워크플로(`backend-checks.yml`/`frontend-checks.yml`/`harness-checks.yml`) pathspec 을 갱신하고, `.d.ts` shadowing 버그를 고치고, 직전 리뷰 라운드(`review/code/2026/09/02/11_27_26/**`)의 산출물·plan 갱신을 포함한다. 네트워크 엔드포인트, DB, 인증/인가 로직, 사용자 입력 처리 경로가 전혀 없다.

### 발견사항

없음.

점검한 항목:

- **인젝션**: `scripts/_typecheck_ratchet.py` 의 `run_tsc()` — `subprocess.run(["npx", "tsc", "--noEmit", "-p", cfg.tsconfig], cwd=cfg.package_dir, ...)` 는 `shell=True` 없이 인자 리스트로 실행된다. `cfg.tsconfig`/`cfg.package_dir` 는 `check-backend-typecheck-ratchet.py`/`check-frontend-typecheck-ratchet.py` 에 하드코딩된 `RatchetConfig` 리터럴 값(`"tsconfig.json"`, `"tsconfig.typecheck.json"`, 고정 경로)뿐이라 외부 입력(PR 파일명·환경변수·CLI 인자)이 커맨드 구성에 흘러들 경로가 없다. 커맨드 인젝션 없음. `count_by_file()` 의 `DIAGNOSTIC` 정규식(`scripts/_typecheck_ratchet.py:49-51`)은 lazy quantifier `.*?` + 고정 앵커(`\(\d+,\d+\): error TS\d+`) 조합이라 catastrophic backtracking 형태가 아니며, 입력도 로컬 `tsc` 가 생성한 CI 출력(줄 단위, `re.DOTALL` 미사용)이라 외부 공격자가 통제하는 입력이 아니다 — ReDoS 우려 없음.
- **하드코딩된 시크릿**: API 키/비밀번호/토큰/인증서 패턴 grep 결과 없음(`.claude/tests/**`, `scripts/*_typecheck_ratchet*.py`, workflow yml, `.d.ts`/`tsconfig` 전부 확인).
- **인증/인가**: 해당 없음 — 이 diff 에는 인증·세션·권한 검증 로직이 없다.
- **입력 검증**: `load_baseline()`(`scripts/_typecheck_ratchet.py`)이 baseline JSON 의 형태(딕셔너리 여부, 값이 정수인지)를 검증하고 실패 시 fail-closed(`exit 2`)로 처리한다 — 판단 불가를 "0건 통과"로 흘리지 않는 안전한 설계.
- **OWASP Top 10**: 웹 애플리케이션 표면(인증/세션/접근제어/역직렬화/SSRF 등) 자체가 없는 CI 도구 코드라 해당 카테고리가 원천적으로 적용되지 않는다.
- **암호화**: 해당 없음 — 해시/암호화/평문전송 로직 없음.
- **에러 처리**: `undecidable()`이 `tsc` stderr 일부(`proc.stderr[:2000]`)를 stderr 로 출력하지만, 이는 GitHub Actions CI 로그에만 나타나는 컴파일러 진단 메시지이며 자격증명·PII 등 민감정보가 아니다. 외부 사용자에게 노출되는 경로가 아니므로 정보노출 리스크 낮음.
- **의존성 보안**: 이 diff 는 신규 외부 npm/pip 패키지를 추가하지 않는다(`npx tsc`, `actions/checkout`, `actions/setup-python`, 로컬 `pnpm-workspace` 액션 모두 기존 관례). 신규 워크플로 스텝(`frontend-checks.yml` 의 `typecheck-ratchet` job)이 `actions/checkout@v7`, `actions/setup-python@v7` 를 major-tag 로 핀 — 커밋 SHA 대신 mutable tag 를 쓰는 것은 이론상 supply-chain 리스크이지만, 저장소 전역에 이미 적용된 기존 관례를 그대로 따른 것이며 이 PR 이 새로 도입한 패턴이 아니다(직전 리뷰 라운드에서도 동일 결론으로 조치 불요 처리됨). 참고용으로만 기록.

### 요약

애플리케이션 보안 표면(인증/DB/네트워크/사용자 입력)이 전혀 없는 CI 타입체크 harness 리팩터링이다. 유일한 외부 프로세스 실행(`subprocess.run(["npx", "tsc", ...])`)은 인자 리스트 방식 + 정적 설정값만 사용해 커맨드 인젝션 경로가 없고, 하드코딩된 시크릿·안전하지 않은 암호화·민감정보 노출도 발견되지 않았다. GitHub Actions major-tag 핀은 기존 저장소 관례를 답습한 것으로 이 PR 의 신규 리스크가 아니다. 보안 관점에서 반려 사유 없음.

### 위험도
NONE

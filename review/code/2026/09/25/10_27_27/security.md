# 보안(Security) 리뷰 — harness-probe-isolation

## 범위 요약

이번 변경은 `.claude/tests/` pytest 하네스가 병렬 실행 시 실제 저장소 트리(`spec/`, `plan/`,
`review/`)에 프로브 파일을 남기던 문제를 고치는 **개발자 도구 전용** 변경이다. 신규 헬퍼
`_harness.make_temp_repo_copy()` 가 지정된 하위 트리를 `mktemp` 임시 디렉터리의 새 git 저장소로
복사·커밋하고, 네 개의 테스트 파일이 이 헬퍼(또는 `tempfile.TemporaryDirectory` + `env=` 오버라이드)로
전환됐다. 그 외 `CHANGELOG.md`, `plan/in-progress/*.md`, `review/consistency/**` 산출물은 문서/리포트
파일이다. 프로덕션 코드(`codebase/**`)나 사용자 대면 표면은 전혀 건드리지 않는다.

## 발견사항

검토 관점 1~8(인젝션, 하드코딩 시크릿, 인증/인가, 입력 검증, OWASP Top 10, 암호화, 에러 처리,
의존성)을 모두 적용했으나, 이 변경의 성격상(비프로덕션 테스트 하네스, 신뢰된 로컬 개발자 실행,
외부 입력 없음) 아래 항목 외에는 해당 사항이 없다.

- **[INFO]** 커맨드 인젝션 벡터 없음 — 확인만
  - 위치: `.claude/tests/_harness.py:73` `git_in()`, `.claude/tests/_harness.py:138` `make_temp_repo_copy()`
  - 상세: 모든 `subprocess.run` 호출이 `shell=True` 없이 인자 리스트(`["git", "-C", resolved, *args]`)
    형태로만 호출되고, `*subtrees`/`rel` 등은 테스트 코드 자신이 주는 리터럴 문자열(`"spec/5-system"`)
    이지 외부·사용자 입력이 아니다. `git_in()` 은 대상 `repo` 경로가 임시 디렉터리(`tempfile.gettempdir()`,
    `/tmp`, `/private/tmp`) 하위인지 `os.path.realpath` 로 단언한 뒤에만 git 을 실행하고,
    `GIT_CEILING_DIRECTORIES`/`GIT_CONFIG_GLOBAL=os.devnull`/`GIT_CONFIG_SYSTEM=os.devnull` 로 상위
    디렉터리 탈출과 신뢰되지 않은 전역 git 설정 유입을 차단한다. 이는 기존 코드(2026-08-06 사고 방어)를
    그대로 재사용한 것이고, 새 함수 `make_temp_repo_copy()` 도 `make_temp_git_repo()`(→ `git_in()`)에
    위임하므로 같은 방어가 적용된다.
  - 제안: 없음 — 방어적으로 잘 구성되어 있다.
- **[INFO]** 실경로 밖 쓰기 방지가 이번 변경의 핵심 목적이며 실제로 강화됨
  - 위치: `plan/in-progress/harness-probe-isolation.md` §A/§E (감사 훅 census: 97행 → 0행,
    병렬 재현 잔여: 5/6 라운드 → 0/6)
  - 상세: 이 PR 은 보안 취약점이라기보다 **테스트 격리 결함**(공유 워크트리에 대한 동시 쓰기로 인한
    데이터 오염/레이스)을 고치는 것이지만, "신뢰되지 않은 프로세스가 저장소 파일을 예측 불가능하게
    덮어쓸 수 있다"는 점에서 무결성 관련 결함이었다. 수정은 공유 리소스에 대한 쓰기를 격리된 임시
    사본으로 옮겨 해당 클래스의 레이스를 제거했다.
  - 제안: 없음.
- **[INFO]** 하드코딩된 자격증명 없음
  - 위치: `.claude/tests/_harness.py:129-130` `git config user.email "harness@example.invalid"` /
    `user.name "harness"`
  - 상세: `.invalid` TLD 의 플레이스홀더 git identity 이며 실제 자격증명·API 키·토큰이 아니다.
  - 제안: 없음.
- **[INFO]** 로컬 절대경로 노출 (경미, 조치 불요)
  - 위치: `review/consistency/2026/09/25/09_56_00/_retry_state.json`, `SUMMARY.md` 등
  - 상세: 커밋된 리뷰 산출물에 개발 머신의 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)가
    포함되어 있다. 민감 정보(자격증명·키)는 아니고, 이 저장소의 다른 커밋된 리뷰 아티팩트에서도 동일한
    패턴이 관례로 쓰인다(`review/` 는 gitignore 대상이 아님). 보안상 조치 불요.
  - 제안: 없음.

인증/인가, 입력 검증, 암호화, 의존성 보안 항목은 이 변경이 다루는 범위(로컬 pytest 픽스처, 신뢰된
개발자 환경에서만 실행)에 해당 표면이 존재하지 않아 **N/A** 로 판단한다. 에러 처리 관련해서도 새
`assert`/`AssertionError` 메시지는 로컬 파일 경로만 담고 있으며 프로덕션 사용자에게 노출되는 경로가
아니다.

## 요약

이번 변경은 CI/개발자 로컬에서만 실행되는 pytest 하네스의 fixture 격리를 개선하는 순수 테스트
인프라 변경으로, 프로덕션 코드·네트워크 경계·인증 표면을 전혀 건드리지 않는다. 모든 subprocess 호출은
인자 리스트 방식(`shell=True` 없음)이고 신규 헬퍼 `make_temp_repo_copy()` 는 기존 `git_in()`/
`make_temp_git_repo()` 의 경로 탈출 방지 안전장치를 재사용한다. 하드코딩된 시크릿, 인젝션 벡터, 암호화
결함, 정보 노출은 발견되지 않았다. 오히려 이 PR 자체가 "신뢰되지 않은 동시 실행이 공유 저장소 파일을
예측 불가능하게 덮어쓸 수 있는" 무결성 결함(레이스)을 실측(감사 훅 97→0행, 재현 5/6→0/6)으로 닫는
방향의 개선이다.

## 위험도

NONE

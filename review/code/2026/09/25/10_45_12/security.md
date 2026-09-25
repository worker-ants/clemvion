# 보안(Security) 리뷰 — harness-probe-isolation (2라운드, `10_45_12`)

## 범위 요약

이번 diff(17개 코드/문서 파일 + 1라운드 리뷰 산출물 `review/code/2026/09/25/10_27_27/**` 15개 +
사전 consistency-check 산출물 `review/consistency/2026/09/25/09_56_00/**` 8개, 총 파일)는 전부
`.claude/tests/**` pytest 하네스, `CHANGELOG.md`, `plan/in-progress/**`, `review/**` 산출물이다.
`codebase/**` 제품 코드·API·인증 표면은 전혀 건드리지 않는다. 실제 코드 변경의 핵심은 신규 헬퍼
`_harness.make_temp_repo_copy()`(지정 서브트리를 임시 git 저장소로 복사·커밋)와, 네 개 테스트
파일이 실제 체크아웃 대신 이 헬퍼/`tempfile.TemporaryDirectory`/env 오버라이드로 프로브 대상을
옮긴 것이다. 1라운드(`10_27_27`)의 WARNING 2건(빈 `subtrees` 호출 시 `CalledProcessError`, 부트스트랩
중복)은 `89ae9fa24` 로 이미 조치되어 이번 diff 에 반영돼 있다.

`.claude/tests/_harness.py`(현재 파일 전체), `test_router_decision_trust.py`,
`test_consistency_target_validation.py`, `test_consistency_spec_draft_snapshot.py`,
`test_consistency_bundle_priority.py` 를 `Read`/`Grep` 으로 직접 열어 diff 와 대조했다. 저장소
파일은 읽기만 했고 뮤테이션·쓰기는 하지 않았다.

## 발견사항

- **[INFO]** 인젝션 벡터 없음 — 재확인
  - 위치: `.claude/tests/_harness.py`(`git_in`, `make_temp_repo_copy`), 네 테스트 파일의 모든
    `subprocess.run` 호출
  - 상세: `grep -n "subprocess.run\|shell=True\|os.system\|eval(\|exec("` 로 전수 확인한 결과, 모든
    `subprocess.run` 이 `shell=True` 없이 인자 리스트로만 호출된다. `make_temp_repo_copy(path,
    *subtrees)` 의 `subtrees` 는 다섯 호출부 전부 테스트 코드 자신이 주는 리터럴 문자열
    (`"spec/5-system"`)이며 외부·사용자 입력이 아니다. `git_in()` 은 `repo` 경로가 임시 디렉터리
    (`tempfile.gettempdir()`/`/tmp`/`/private/tmp`) 하위인지 `os.path.realpath` 로 단언한 뒤에만
    git 을 실행하고, `GIT_CEILING_DIRECTORIES`/`GIT_CONFIG_GLOBAL=os.devnull`/
    `GIT_CONFIG_SYSTEM=os.devnull` 로 상위 디렉터리 탈출과 신뢰되지 않은 전역 git 설정 유입을
    차단한다(2026-08-06 사고 방어, 기존 코드 재사용). `make_temp_repo_copy` 는 `make_temp_git_repo`
    → `git_in` 에 위임하므로 같은 방어가 적용된다.
  - 제안: 없음.

- **[INFO]** `make_temp_repo_copy` 의 `subtrees` 값이 상대경로 문자열을 그대로 `REPO_ROOT / rel` 에
  연결한다 — 오늘은 무해하나 신뢰 경계 이동 시 재확인 필요
  - 위치: `.claude/tests/_harness.py:166-167`(`for rel in subtrees: shutil.copytree(REPO_ROOT / rel,
    repo / rel)`)
  - 상세: `rel` 에 `..` 를 포함한 문자열이 오면 `REPO_ROOT` 밖(예: 상위 디렉터리)을 읽어 복사할 수
    있다 — 고전적 경로 탈출 패턴이다. 다만 현재 이 인자는 함수를 호출하는 테스트 코드 자신이
    하드코딩한 리터럴(`"spec/5-system"`)뿐이고 외부 입력·환경변수·CLI 인자로부터 오지 않으므로
    오늘 시점에 악용 가능한 표면은 없다(공격자가 이 값을 통제하려면 이미 이 저장소에 임의 코드를
    쓸 수 있는 상태여야 한다). `git_in`/`make_temp_git_repo` 의 실경로 검증은 **목적지**(임시
    디렉터리 안)만 지키고 **소스**(`REPO_ROOT / rel`) 쪽의 상위 탈출은 검증하지 않는다.
  - 제안: 조치 불요(현재 호출부는 전부 신뢰된 리터럴). 향후 `subtrees` 가 설정 파일·CLI 인자 등
    외부에서 주입되는 방향으로 확장된다면, 그 시점에 `os.path.commonpath`/`Path.resolve().is_relative_to`
    로 `REPO_ROOT` 하위인지 검증하는 방어를 추가할 것.

- **[INFO]** 하드코딩된 자격증명 없음
  - 위치: `.claude/tests/_harness.py:129-130` (`git config user.email "harness@example.invalid"` /
    `user.name "harness"`, 이번 diff 로 새로 도입된 코드는 아니지만 `make_temp_repo_copy` 가 이
    경로를 재사용)
  - 상세: `.invalid` TLD 의 플레이스홀더 git identity이며 실제 자격증명·API 키·토큰이 아니다.
  - 제안: 없음.

- **[INFO]** 인증/인가·입력 검증·암호화·의존성 보안 — 해당 표면 없음(N/A)
  - 상세: 이 변경은 로컬 pytest 하네스 전용이며 네트워크 경계·인증 세션·사용자 입력·암호화
    알고리즘·신규 서드파티 의존성을 전혀 도입하지 않는다. `AssertionError`/`CalledProcessError`
    메시지에 담기는 정보는 로컬 파일 경로뿐이며 프로덕션 사용자에게 노출되는 에러 경로가 아니다.

- **[INFO]** 리뷰/검토 산출물(`review/code/2026/09/25/10_27_27/**`, `review/consistency/2026/09/25/09_56_00/**`)에
  개발 머신의 로컬 절대경로(`/Volumes/project/private/clemvion/...`)가 다수 노출됨 — 1라운드 지적과
  동일, 재확인만
  - 위치: `review/code/2026/09/25/10_27_27/_retry_state.json`, `review/consistency/2026/09/25/09_56_00/_retry_state.json`
    등
  - 상세: 자격증명·키 등 민감정보는 아니며, 이 저장소의 다른 커밋된 리뷰 아티팩트에도 동일 관례가
    이미 존재한다(`review/` 는 gitignore 대상 아님). 1라운드 SUMMARY(#10 · security NONE)와 동일
    결론.
  - 제안: 조치 불요.

## 1라운드(`10_27_27`) 대비 변경분 검증

- WARNING 1(빈 `subtrees` 호출 시 `CalledProcessError`)은 `git commit -q --allow-empty -m "copy of
  this checkout"` 로 수정되었고(`.claude/tests/_harness.py:169`), 보안 관점에서 새 위험(예: 빈
  커밋을 이용한 우회)은 없다 — 여전히 `git_in` 의 임시 디렉터리 제약 안에서만 동작한다.
  `test_no_subtrees_is_an_empty_copy_not_an_error` 로 그 경계가 고정됨을 코드에서 직접 확인했다.
- WARNING 2(부트스트랩 중복)를 `five_system_copy(tmp)` 헬퍼로 한 곳에 모은 것(`orchestrator_preamble(extra=...)`)은
  각 서브프로세스 프리앰블 문자열에 삽입되는 텍스트이며, 삽입값은 여전히 테스트 코드 자신이 작성한
  고정 문자열(`imports="os"`, `textwrap.dedent(...)` 내부)이라 새로운 코드 실행 표면을 추가하지
  않는다.

## 요약

harness-only 테스트 인프라 변경으로, 프로덕션 코드·API·인증 표면을 전혀 건드리지 않는다. 모든
`subprocess` 호출은 인자 리스트 방식(`shell=True` 없음)이며, 신규 헬퍼 `make_temp_repo_copy()` 는
기존에 이미 감사된 `git_in()`/`make_temp_git_repo()` 의 경로 탈출 방지 장치(목적지 쪽)를 그대로
재사용한다. 소스 쪽(`REPO_ROOT / rel`) 경로 결합은 이론적으로 `..` 탈출 패턴이지만 호출부가 전부
테스트 코드 리터럴이라 오늘 시점엔 공격 표면이 아니다(향후 외부 입력으로 확장될 경우에만 재검토
필요, INFO). 하드코딩된 시크릿, 인젝션 벡터, 암호화 결함, 정보 노출(민감정보 기준)은 발견되지
않았다. 1라운드 security 리뷰(NONE)의 결론을 뒤집을 새 근거는 없으며, 1라운드에서 조치된 WARNING
2건도 보안 관점에서 새 위험을 만들지 않았다.

## 위험도
NONE

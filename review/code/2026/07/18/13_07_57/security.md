# Security 리뷰: bootstrap-session.sh 마커-해시 자기유발 결함 2건 수정 (§F 수렴 리뷰)

리뷰 대상(prompt 파일 목록과 `git show ead99225c --stat` 대조로 일치 확인):
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.claude/tests/README.md`. 이 3개 파일만 변경한 커밋이며, `.github/dependabot.yml`·
`package-lock.json`·`PROJECT.md` 등은 이전 라운드(`review/code/2026/07/18/12_31_29`,
`12_06_58`)에서 이미 검증·병합된 상태로 이번 diff 범위 밖이다. 세 파일 모두 harness(개발
도구) 레이어이며 `codebase/` 프로덕션 코드나 사용자 대면 표면을 다루지 않는다. 신뢰
경계는 "이미 이 저장소에 로컬 clone/worktree 로 접근 가능한 개발자"이고, 원격/미인증
사용자 입력을 처리하는 경로가 아니다.

## 검증 방법

- `git show ead99225c -- <3개 파일>` 로 실제 변경 hunk만 분리해 대조.
- 선행 라운드 `review/code/2026/07/18/12_31_29/SUMMARY.md`·`security.md` 를 읽어, 이번
  커밋이 그 라운드의 W1(설계주석 "once"/"one-time" drift)·W2(install-전 해시를 install-후
  마커에 재사용하는 자기교정 누락)·W3(해셔 부재 폴백 무테스트)·W4(README/docstring 갭)를
  정확히 겨냥하는 후속조치인지, 실제로 해소됐는지 확인.
- `grep -n "one-time|once|recurring"` 로 W1이 지적한 4곳(파일 헤더 항목2, 섹션2 헤더,
  설계노트 단락, 런타임 echo) 전부가 수정됐는지 실측.
- `python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'` 로
  11개 테스트(신규 2건 포함) 전부 통과 확인.
- **비-vacuity 독립 재검증**: W2 fix 를 되돌리는 뮤턴트(`printf '%s\n' "$(_lock_hash)"` →
  `printf '%s\n' "$want_hash"`, 즉 install-전 해시를 다시 마커에 기록하도록 되돌림)를
  스크래치 디렉토리에 만들어 `test_npm_rewriting_lockfile_still_converges` 만 단독 실행 —
  `AssertionError: 3 != 1`로 실패함을 확인(무한 재설치 재현). 저장소 자체는 건드리지
  않았고(`git status --porcelain` 로 재확인), 커밋 메시지가 주장하는 "testing reviewer 가
  스텁으로 재현 ··· 비-vacuity 확인"을 이번 라운드에서 독립적으로 재현했다.

## 발견사항

- **[INFO]** W2 수정(install-후 lockfile 해시 재계산) — 정확·안전하게 구현됨, 비-vacuity
  재확인
  - 위치: `.claude/tools/bootstrap-session.sh:136-142`(`printf '%s\n' "$(_lock_hash)" >
    "$marker"`)
  - 상세: `want_hash`(install **전** 스냅샷)를 그대로 재사용하던 자기유발 버그를, install
    성공 직후 `_lock_hash()`를 **재호출**해 그 결과를 마커에 기록하는 자기교정 패턴으로
    수정했다. `_lock_hash()`는 여전히 `"$tool_dir/package-lock.json"`을 quote 된 인자로
    넘기고 `shasum -a 256`/`sha256sum` 출력을 `cut -d' ' -f1`로 파싱하는 기존 안전한 패턴을
    그대로 재사용해 새 인젝션 표면을 만들지 않는다. 위 "검증 방법"에서 직접 만든
    되돌림-뮤턴트로 `test_npm_rewriting_lockfile_still_converges`가 실제로 실패함(npm 호출
    1→3, 수렴 안 함)을 확인해 이 수정이 green-washing이 아니라 실제 결함을 닫았음을 독립
    재현했다. 보안적으로는 중립~긍정: 이 마커-해시 결속 메커니즘 자체가 "Dependabot 보안
    lockfile 범프가 이미 설치된 checkout에 전파되게 하는" 방어 장치(선행 라운드 W1/§F 원
    목적)이므로, 이 자기교정이 없으면 그 방어 장치가 매 세션 무한 재설치로 발산해 사실상
    무력화될 수 있었다 — 이번 수정은 그 방어 장치의 신뢰도를 실제로 끌어올린다.
  - 제안: 없음 — 이미 올바르게 조치됨

- **[INFO]** W1 수정(NO LOCK 설계노트·"once"/"one-time" 표현 정정) — 4곳 전수 수정 확인
  - 위치: `.claude/tools/bootstrap-session.sh:12-13`(파일 헤더 책임 목록 항목 2), `:35`(섹션
    2 헤더), `:78-90`(NO LOCK 설계노트 "recurring, not one-off" 단락), `:135`(런타임 echo,
    "one-time" 삭제)
  - 상세: 코드 동작 변경은 없는 순수 서술 정정이지만, 동시-설치 무락 경합 창이 "최초 설치
    1회성"이 아니라 "lockfile 이 바뀔 때마다(정기 Dependabot 보안 범프 포함) 재개방"됨을
    운영자·차기 리뷰어가 정확히 인지하게 한다는 점에서 방어적 문서 위생 개선이다. 반증된
    안전 서술이 코드에 남아 있으면 그 잔여 위험(§G fcntl.flock 재평가 트리거 조건)의 재평가
    시점을 놓치기 쉽다 — 이번 정정은 그 조건("recurring"으로 바뀌면 §G 재평가)을 코드
    주석 자체에 명시해 향후 판단 근거를 코드와 동기화된 상태로 유지한다.
  - 제안: 없음 — 이미 올바르게 조치됨

- **[INFO]** 신규 테스트 2건(`test_npm_rewriting_lockfile_still_converges`,
  `test_missing_hasher_degrades_to_presence_only`) — 격리·비-injection 확인
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py`
  - 상세: `NPM_REWRITES_LOCK` 스텁(`echo "// normalized $RANDOM" >> package-lock.json`)은
    `$RANDOM`을 암호학적 용도가 아닌 "매 호출 다른 무해한 텍스트" 목적으로만 쓰는 테스트
    전용 코드이고, `tempfile.mkdtemp()`로 격리된 fixture 안에서만 실행되며 `npm`은 PATH
    앞단 스텁(네트워크 접근 없음)이다. 해셔-부재 테스트는 `shasum`/`sha256sum`을 동일
    PATH-shadow 패턴(exit 127)으로 대체해 폴백 분기를 실행하며, 기존 `npm` 스텁과 같은
    안전한 관용구를 재사용한다. `subprocess.run`/`Popen` 인자는 전부 list-form 하드코딩
    리터럴(`shell=True` 없음)이라 인젝션 벡터가 없다. 신규 코드에 시크릿·자격증명 없음
    (`user.email t@t` 는 git 커밋용 더미 값).
  - 제안: 없음

- **[INFO]** 인젝션·시크릿·인증·암호화·에러노출 — 이번 diff 전반에 새로 발생한 문제 없음
  - 위치: 3개 변경 파일 전체
  - 상세: `set -u` 유지, 신규/변경된 모든 변수 확장이 quote 됨(`"$(_lock_hash)"`,
    `"$tool_dir/package-lock.json"` 등). `eval`이나 문자열 조합 커맨드 없음. 하드코딩된
    API 키·비밀번호·토큰·인증서 없음. SHA-256 사용은 여전히 무결성/변경-감지 목적에 한정
    (패스워드 해싱 용도 아님)이고 알고리즘 자체 변경 없음. 에러 메시지(`echo ... >&2`)는
    "install failed"류 일반 텍스트만 노출하며 민감정보(경로 외 시스템 정보, 환경변수 값
    등) 유출 없음. 네트워크 송수신 코드 추가 없음(평문 전송 해당 없음). 인증/인가 로직
    해당 없음(하네스 로컬 부트스트랩 스크립트).
  - 제안: 없음

- **[INFO, residual — 이미 접수·defer된 두 항목의 연결점, 새 노출 아님]** post-install 해시
  자기교정이 "재검토되지 않은 lockfile 재작성"도 그대로 마커에 확정
  - 위치: `.claude/tools/bootstrap-session.sh:136-142`(이번 수정) ↔
    `.claude/tools/mermaid-lint/package.json`(`jsdom`/`mermaid` `"*"` range, 이번 diff
    미포함) ↔ `npm install`(vs `npm ci`, 이번 diff 미포함)
  - 상세: 이번 W2 수정은 install **직후**의 실제 lockfile 내용을 그대로 해시해 마커에
    "확정"한다 — 정확히 의도된 동작(그래야 npm이 정규화한 lockfile과 마커가 어긋나지
    않는다)이다. 다만 `package.json`이 `jsdom`/`mermaid`를 무제한 `"*"` range로 선언하고
    스크립트가 `npm ci`가 아닌 `npm install`을 쓴다는, 선행 라운드(12_31_29)가 이미
    W6/I9로 낮게 평가·defer한 조건과 결합하면, 이론상 `npm install`이 lockfile을 단순
    포맷 정규화를 넘어 실제 버전 재해석으로 재작성하는 경우 이번 자기교정 로직은 그
    결과를 검증 없이 "정상"으로 수용해 마커에 기록한다. 이번 diff가 새로 만든 노출은
    아니다(재작성 가능성 자체는 W2 발견 당시 이미 전제됐다) — 다만 이제는 그 결과를 매
    세션 재검증 없이 확정적으로 수용한다는 점을 분명히 인지해둘 필요는 있다. 실사용
    노출도는 낮다(HTTPS 레지스트리, 이미 만족하는 range는 npm이 통상 재해석하지 않음,
    CI/개발 워크스테이션 신뢰 경계 내). 이미 W6/I9로 별도 항목 접수·비긴급 후속으로
    분류됨.
  - 제안: 조치 불요(이번 PR 스코프 아님, W6/I9로 추적 중). 후속(비긴급)으로 `"*"` range를
    caret으로 좁히거나 `npm ci`로 전환하면 이 연결점 자체가 구조적으로 닫힌다.

- **[INFO, residual — 이번 diff는 기존 동작에 테스트만 추가, 위험도 불변]** 해싱 도구 완전
  부재 호스트의 presence-only 열화(W3, 이번 라운드에서 테스트로 pin됨)
  - 위치: `.claude/tools/bootstrap-session.sh` `_lock_hash()` 폴백 분기,
    `.claude/tests/test_bootstrap_mermaid_install.py::test_missing_hasher_degrades_to_presence_only`
  - 상세: `shasum`·`sha256sum` 둘 다 없으면 해시 불일치 감지가 조용히 비활성화되는 기존
    동작은 이번 diff가 변경한 코드가 아니며(12_06_58/12_31_29 라운드에서 이미 저노출·
    문서화된 트레이드오프로 접수), 이번 diff는 그 동작을 회귀 없이 유지한 채 회귀-방지
    테스트만 추가했다. 위험도 재평가 불요.
  - 제안: 없음(비차단, 이미 접수됨)

- **[INFO, pre-existing — 이번 diff 미변경, 전체 파일 컨텍스트 재확인용]** `npm install
  --no-audit` / `npm ci` 미사용 / `core.hooksPath` 신뢰 모델
  - 위치: `bootstrap-session.sh` (`--no-fund --no-audit --silent` 줄, `.githooks` 활성화
    블록) — 둘 다 이번 커밋의 diff 밖(unchanged context line)
  - 상세: 셋 다 이전 라운드들에서 이미 검토·의도된 설계로 확인됨. `--no-audit`는 실제
    취약점 탐지 책임을 Dependabot(+ 이번 마커-해시 결속)에 위임한 상태에서 세션마다 조는
    조용한 백그라운드 설치의 노이즈 억제용. `npm install`(vs `npm ci`)은 W2 자체가
    전제하는 "lockfile 재작성 가능성"을 install-후 재해시로 이미 흡수하는 의도된 선택.
    `core.hooksPath .githooks`는 `scripts/setup-githooks.sh`로 이미 존재하던 수동 설정의
    자동화일 뿐 신규 신뢰 모델이 아니다(저장소 커밋 권한 = 로컬 훅 실행 권한이라는 표준
    git 관행).
  - 제안: 없음(이번 diff 스코프 아님)

## 요약

이번 diff는 직전 라운드(12_31_29)가 발견한 두 자기유발 결함 — W1(동시-설치 무락 경합
창이 "최초 1회성"이 아니라 lockfile 변경마다 재개방됨을 설계노트·헤더·런타임 메시지 4곳이
정확히 서술하지 못한 문제)과 W2(설치 성공 후 마커에 install-**전** 해시를 재사용해 npm의
lockfile 재작성 시 무한 재설치로 발산할 수 있던 자기교정 누락) — 를 정확히 겨냥해 해소하는
후속조치이며, W3(해셔 부재 폴백 무테스트)·W4(README/docstring 갭)도 함께 처리했다. 코드
수정은 매우 좁고(`_lock_hash()` 재호출 1곳) 기존의 안전한 quoting·비-eval 관용구를 그대로
유지해 새 인젝션·시크릿·인증·암호화 표면을 만들지 않는다. 독립적으로 만든 되돌림-뮤턴트로
신규 회귀 테스트가 실제로 결함을 재현·검출함(비-vacuity)을 재확인했고, 11개 테스트 전부
통과했다. 유일한 잔여 사항은 이미 이전 두 라운드에서 접수·defer된 두 항목
(`package.json`의 `"*"` range/`npm ci` 미사용 — W6/I9, 해셔 완전 부재 폴백 — W3 저노출)의
연결점을 재확인한 INFO 수준 관찰뿐이며, 둘 다 이번 PR 스코프 밖이고 실사용 노출도가
낮다고 이미 판단된 트레이드오프다. 신규 CRITICAL/WARNING 없음.

## 위험도
NONE

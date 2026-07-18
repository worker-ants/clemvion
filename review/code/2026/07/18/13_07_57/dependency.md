# 의존성(Dependency) 리뷰 — bootstrap-session.sh 마커-해시 결속 자기유발 결함 수렴 라운드

## 검증 방법
- 3개 대상 파일 전문을 직접 읽고, 이 작업의 실제 커밋(`02d69e324`→`c5fdd1bb8`→`ead99225c`, 브랜치
  `claude/mermaid-lint-undici-vuln-2956f1`)을 `git log`/`git diff`로 각각 분리 확인
- 직전 두 라운드(`review/code/2026/07/18/12_06_58`, `12_31_29`)의 dependency.md·SUMMARY.md·
  RESOLUTION.md를 읽어 이번 라운드가 "§F 수렴 리뷰"(자기유발 결함 fix 검증) 목적임을 확인하고
  이미 독립 검증된 사항의 재중복 지적을 피함
- `.claude/tests/test_bootstrap_mermaid_install.py`를 실제로 직접 실행해 11/11 통과 확인(비-vacuous)
- `bootstrap-session.sh` 전문에서 "once/first/one-time" 관련 문구를 grep해 W1(정직한 창 서술) fix의
  완결성을 라인 단위로 검증

## 발견사항

- **[WARNING]** 이번 라운드가 고쳤다고 주장하는 "정직한 창 서술"(W1)이 같은 문단 안에서
  자기모순으로 남음 — 정정된 문장과 11줄 아래 결론 문장이 정반대 주장
  - 위치: `.claude/tools/bootstrap-session.sh:79`(정정됨) vs `:93`(미정정, 같은 "NO LOCK,
    deliberately" 문단)
  - 상세: 커밋 `ead99225c`(이번 라운드 리뷰 대상, 커밋 메시지 "정직한 창 서술")는 `NO LOCK,
    deliberately` 설계노트의 "accepted:" 문단을 고쳐 `:78-83`에 "Since the marker is now
    lockfile-hash-bound (below), that condition is no longer first-install-only — every
    lockfile change ... re-opens it for already-installed checkouts too. ... it is
    recurring, not one-off"라고 정확히 정정했다(직전 라운드 12_31_29 W1이 정확히 이 지점을
    지적했었다). `git diff c5fdd1bb8 ead99225c`로 이 hunk가 실제로 이 커밋에서 추가됐음을
    확인했다. 그런데 **같은 문단의 결론 문장**(`:93`)은 `git diff ceee1fa5b c5fdd1bb8`·
    `git diff c5fdd1bb8 ead99225c` 어느 diff hunk에도 포함되지 않은 순수 컨텍스트 라인으로,
    여전히 "Judged an acceptable rare **first-install-only** window on a dev-tooling
    linter, not worth a hand-rolled lock..."라고 쓰여 있다 — 11줄 위에서 스스로 부정한 바로
    그 표현("first-install-only")을 문단의 최종 결론으로 재확인하는 셈이다.
    `review/code/2026/07/18/12_31_29/RESOLUTION.md`는 W1을 "설계노트·파일헤더·섹션2헤더·
    런타임 echo **4곳 전부** 정직하게 정정"이라 기록했으나, 실제로는 "설계노트"로 카운트된
    1곳 내부에 정정 문장과 미정정 문장이 공존한다 — "몇 개 위치를 고쳤는가"가 아니라
    "같은 문단 안의 두 문장이 서로 모순되는가"가 문제다. 이 문단은 plan §G(fcntl.flock)
    재우선순위화 여부를 판단하는 근거 기록으로 파일 스스로 명시하므로(`:83`
    "which is what would justify revisiting plan §G"), 결론 문장만 훑는 미래 독자는
    "rare, first-install-only"(구식 프레이밍)를 최종 판단으로 오인해 재발 빈도(정기
    Dependabot lockfile 변경마다 재개방)를 과소평가할 수 있다. 이 파일(마커 서술)은 "손으로
    짠 확신 주석이 리뷰마다 반증되는" 패턴이 이미 여러 차례 반복된 이력이 있다.
  - 제안: `:93`의 "rare first-install-only window"를 `:78-83`의 정정된 프레이밍과 일치시켜
    "rare, recurring window"(또는 동등한 표현)로 교체. 코드 동작 변경은 전혀 없음(순수 주석) —
    다음 세션에서 즉시 1줄 수정 가능하며 테스트 재실행 불요.

- **[INFO]** W2(post-install 해시 재계산) 코드 fix — 정확히 구현되고 실행 검증됨
  - 위치: `.claude/tools/bootstrap-session.sh:136-142`,
    `.claude/tests/test_bootstrap_mermaid_install.py::test_npm_rewriting_lockfile_still_converges`
  - 상세: 마커에 쓰는 해시가 install **전** 캡처한 `want_hash`(12_31_29 W2가 지적한 버그: npm이
    install 중 lockfile을 재작성하면 마커≠실제 파일이 되어 무한 재설치로 발산)가 아니라 install
    **후** 재계산한 `$(_lock_hash)`로 정확히 바뀌었다(`git diff c5fdd1bb8 ead99225c`로 해당
    hunk 확인). `npm`이 install 중 lockfile을 rewrite하는 상황을 재현하는 신규 테스트
    (`NPM_REWRITES_LOCK=1` 스텁)를 포함해 `python3 .claude/tests/test_bootstrap_mermaid_install.py`를
    직접 실행 → **11/11 통과**(신규 2건 `test_npm_rewriting_lockfile_still_converges`/
    `test_missing_hasher_degrades_to_presence_only` 포함, non-vacuous 실행 확인).
  - 제안: 없음(확인됨).

- **[INFO]** W3(해싱 도구 부재 폴백) 테스트 — 정확히 추가되고 실행 검증됨
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py::test_missing_hasher_degrades_to_presence_only`
  - 상세: `shasum`/`sha256sum` 둘 다 PATH에서 `exit 127`로 섀도잉해 "최초 설치는 되나 이후
    lockfile 변경은 감지되지 않는(presence-only 열화)" 문서화된 트레이드오프를 정확히 pin한다.
    직접 실행 확인 통과.
  - 제안: 없음(확인됨).

- **[INFO]** README/모듈 docstring 갱신(W4) — 헤드라인 동작·신규 테스트 2건 모두 반영, 정확
  - 위치: `.claude/tests/README.md`(커버리지 표), `.claude/tests/test_bootstrap_mermaid_install.py`
    모듈 docstring
  - 상세: 직전 라운드가 지적한 "README 표·docstring이 마커-해시 결속을 요약하지 않음"(W4) 갭이
    해소됨 — README 표에 "Also exercises the lockfile-hash binding... recomputed post-install
    so an npm-rewritten lockfile still converges... degrades to presence-only with no
    hashing tool" 문장이, docstring에는 동일 내용이 기존 3개 불릿과 같은 문체의 4번째 불릿으로
    추가됐다. 서술이 실제 코드 동작과 정확히 일치함을 위 W2/W3 검증으로 교차 확인.
  - 제안: 없음(확인됨).

- **[INFO]** 새 의존성/라이선스/번들 크기 — 3개 리뷰 대상 파일 자체에는 해당 없음
  - 위치: 3개 리뷰 대상 파일 전체
  - 상세: `bootstrap-session.sh`는 순수 bash(POSIX `stat`/`shasum`/`sha256sum`/`cut`/외부 `npm`
    호출뿐, 신규 외부 바이너리 의존 없음). `test_bootstrap_mermaid_install.py`는 Python 표준
    라이브러리만 사용(`os`/`shutil`/`subprocess`/`tempfile`/`time`/`unittest` — README.md
    자신이 명시하는 "harness Python은 서드파티 의존성 0" 컨벤션을 그대로 준수). `README.md`는
    순수 문서. 이 3개 파일 자체로는 신규 패키지·라이선스·번들 크기 영향이 전혀 없다. (근본
    취약점 수정 자체 — undici 7.27.0→7.28.0, dompurify 3.4.7→3.4.12,
    `package-lock.json`/`dependabot.yml` — 는 이번 라운드의 리뷰 대상 파일 목록 밖이며, 직전
    두 라운드(12_06_58 위험도 NONE, 12_31_29 위험도 LOW)에서 이미 `npm audit` 실측 재현·
    integrity 해시 레지스트리 대조·semver 호환성까지 독립 검증 완료됐으므로 재중복 지적하지
    않는다.)
  - 제안: 없음.

- **[INFO]** 내부 의존성 — 마커 콘텐츠 포맷 변경이 3개 reader와의 계약을 깨지 않음(재확인)
  - 위치: `bootstrap-session.sh`(writer) ↔ `.claude/hooks/_lib/mermaid_lint_ready.py`(공유
    SoT, 리뷰 대상 파일 목록 밖) ↔ `.githooks/pre-commit`/PostToolUse lint guard(reader 2곳,
    목록 밖)
  - 상세: 마커 내용이 "존재만"에서 "lockfile sha256 문자열"로 바뀌었으나, 직전 라운드가 소스
    직접 확인으로 검증한 대로 `is_ready()`는 `os.path.isfile()`만 검사하고 내용을 파싱하지
    않는다 — 이번 라운드의 3개 파일도 이 계약을 그대로 재사용할 뿐 변경하지 않으므로 drift 없음.
  - 제안: 없음.

- **[INFO]** (carry-forward, 이번 라운드 파일 목록 밖 — 재차단 사유 아님) `package.json`의
  `jsdom`/`mermaid` `"*"` range + 신규 Dependabot 주간 스케줄 조합(W6, 12_31_29)
  - 위치: `.claude/tools/mermaid-lint/package.json`(이번 3개 파일에 없음) ↔
    `.github/dependabot.yml`(이번 3개 파일에 없음)
  - 상세: 직전 라운드가 WARNING으로 지적하고 `plan/in-progress/harness-guard-followups.md`
    §F에 후속 과제로 명시적으로 defer한 항목. 이번 라운드의 3개 파일은 이 상태를 변경하지
    않으므로 새로 발생한 리스크가 아니다. 참고로만 기재.
  - 제안: 없음(이번 리뷰 범위 밖, 별도 후속 추적 중).

## 요약

이번 라운드(`ead99225c`)는 직전 리뷰(12_31_29)가 발견한 W1(문서: "once/first-install-only"
잔존 서술)·W2(코드: install-전 해시를 마커에 기록해 npm의 lockfile rewrite 시 무한 재설치로
발산 가능)·W3(테스트: 해싱 도구 부재 폴백 무테스트)·W4(문서: README/docstring 갭)를 고치는
"자기유발 결함 수렴" 커밋이다. W2(post-install 해시 재계산)·W3(폴백 테스트)·W4(문서 요약)는
코드·테스트를 직접 실행해(11/11 통과) 정확하고 완결됨을 확인했다. 그러나 W1("정직한 창
서술")은 불완전하다 — 설계노트 문단 중간의 문장은 정확히 정정됐지만(`:78-83`, "no longer
first-install-only ... recurring, not one-off"), 같은 문단의 결론 문장(`:93`)이 여전히
"first-install-only"라고 말해 자기모순이 남았다. 이는 순수 주석이라 런타임·보안 영향은
없지만, 이 문단 자체가 향후 plan §G(fcntl.flock) 투자 여부를 판단하는 근거 기록이라는 점에서
정확도가 중요하고, 이 파일이 "확신 주석이 반증되는" 패턴을 반복해온 이력이 있어 명시적으로
남긴다. 3개 대상 파일 자체는 신규 외부 의존성·라이선스 변경·번들 크기 영향이 전혀 없으며(bash
표준 도구 + Python stdlib만 사용), 근본 취약점 수정(undici/dompurify)은 이번 파일 목록 밖으로
직전 두 라운드에서 이미 NONE/LOW로 독립 검증 완료됐다. 종합하면 이번 라운드의 유일한 실질
이슈는 저영향 문서-정합성 잔여 1건이며, 코드/테스트 레벨의 의존성 관련 결함은 0건이다.

## 위험도

LOW

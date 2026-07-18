# 요구사항(Requirement) Review — mermaid-lint undici HIGH 취약점 해소 + 마커 lockfile-해시 결속 (§F 수렴 3라운드)

## 검증 방법

- `git log`/`git diff` 로 이 태스크의 실제 변경분을 origin/main 의 무관한 후속 커밋(interaction-type 등)과
  분리(병합 기준점 `22cc48ef3`) — 이 태스크 고유 커밋 3개(`02d69e324`,`c5fdd1bb8`,`ead99225c`) 격리 확인.
- 직전 2회 리뷰(`review/code/2026/07/18/{12_06_58,12_31_29}`)의 RESOLUTION.md/SUMMARY.md/requirement.md
  전문을 읽고, 그 라운드가 지적한 WARNING(W1~W4) 각각이 **현재 최종 커밋에 실제로 반영됐는지** 코드
  라인 단위로 재대조(커밋 메시지의 주장이 아니라 `git show`/`grep`으로 직접 확인).
- `.claude/tests/test_bootstrap_mermaid_install.py` 단독 실행(11/11 PASS) + 전체 하네스 스위트 실행
  (305/305 PASS).
- `npm audit --prefix .claude/tools/mermaid-lint` 실행(0 vulnerabilities), lockfile JSON 파싱으로
  `undici@7.28.0`/`dompurify@3.4.12` 확인, `package.json` 무변경(diff 0) 확인.
- `bash -n .claude/tools/bootstrap-session.sh` 문법 체크.
- 마커 소비처 3곳(`_lib/mermaid_lint_ready.py`, `.githooks/pre-commit`, PostToolUse 훅) 코드 직접
  열람해 마커 콘텐츠 포맷 변경(빈 파일→해시 문자열)에 대한 회귀 여부 확인, `grep -rn
  "bootstrap-install-complete"` 로 다른 숨은 소비처 부재 확인.
- `spec/` 전수 grep(관련 매치 0건 — harness 도구는 product spec 스코프 밖, 대체 SoT
  `plan/in-progress/harness-guard-followups.md` §F).
- 리뷰 도중 작업 트리 상태(`git status --porcelain`, `git diff`)를 시점을 달리해 3회 재확인.

## 발견사항

- **[WARNING]** (코드 결함 아님 — 세션/프로세스 무결성) 리뷰 도중 공유 워크트리의 추적 대상 소스
  파일에서 **인플레이스 뮤턴트가 실제로 관측됨** — 자가복구됐으나 레이스가 실증됨
  - 위치: `.claude/tools/bootstrap-session.sh:129` (작업 트리 시점 상태, 커밋 아님)
  - 상세: 본 리뷰 도중 `git status --porcelain -- .claude/tools/bootstrap-session.sh` 호출이
    `M`(수정됨)을 반환했고, `git diff`로 정확한 변경분을 확인한 결과 다음과 같았다:
    `elif [ -n "$want_hash" ] && [ "$(cat "$marker" 2>/dev/null)" != "$want_hash" ]; then` 가
    `elif false; then  # MUTATED: hash-mismatch check disabled` 로 치환되어 있었다 — 이는 이 PR
    전체의 핵심 딜리버러블(마커-lockfile 해시 결속 재설치 트리거)을 완전히 무력화하는 변경이다.
    곧이어 재확인한 `git status --porcelain=v1`/`git diff`는 파일이 다시 HEAD와 정확히 일치하는
    클린 상태로 돌아와 있음을 보였고, 본 보고서 작성 직전 마지막 확인에서도 라인 129는 정상
    (해시-불일치 분기 원복)이었다. 이 워크트리는 이번 `/ai-review` 라운드의 다른 sub-agent
    (reviewer)들과 **동시에 공유**되는데, `# MUTATED:` 라벨이 붙은 형태는 이 프로젝트가 여러
    라운드에 걸쳐 실제로 수행해 온 "비-vacuity 뮤턴트 재현" 기법(예: 직전 라운드 testing/
    side_effect 리뷰어가 스텁·뮤턴트로 실측 재현한 것과 동일 계열)과 정확히 일치한다 — 즉 형제
    리뷰어가 같은 파일을 **추적 대상 원본에 직접** 뮤테이션→테스트→복원하는 방식으로 검증
    중이었고, 그 복원 이전의 찰나를 우연히 관측한 것으로 판단된다. 이 자체는 이번 diff의
    결함이 아니며(개발자가 커밋한 코드는 clean — 아래 실측 검증 참고), 최종 확인 시점 기준
    작업 트리도 clean하다. 다만 이는 이 저장소 메모리에 이미 기록된 사고 유형(가드 mutation
    검증 원복은 cp+절대경로로 해야 하며 cwd-상대 `git checkout` 복원은 과거 미커밋 작업 2건을
    유실시킨 전례가 있음)과 **정확히 같은 클래스의 레이스**이고, 이번엔 자가복구됐지만 뮤테이션
    수행 sub-agent가 복원 단계 전에 crash/timeout/에러로 중단됐다면 이 PR의 전체 목적(보안
    픽스가 기존 checkout에 전파되도록 하는 것)을 정확히 무효화하는 코드가 **커밋되지 않은 채로
    작업 트리에 잔존**할 뻔했다. 다른 형제 리뷰어가 같은 순간에 이 파일을 Read했다면 "핵심
    로직이 없다/깨져 있다"는 거짓 CRITICAL을 보고했을 수도 있다.
  - 제안: (1) 이번 리뷰 라운드가 통합(SUMMARY)되기 직전 오케스트레이터가 `git status --porcelain`/
    `git diff`로 작업 트리가 HEAD와 일치하는 clean 상태인지 마지막으로 1회 더 확인할 것(본
    리뷰어가 종료 직전 확인한 결과는 clean). (2) 재발 방지책으로, 뮤턴트 기반 비-vacuity
    검증을 수행하는 sub-agent는 공유 워크트리의 추적 파일을 직접 in-place로 뮤테이션하지
    말고, 스크래치 디렉토리에 격리 복사본을 만들어 그 복사본을 대상으로 재구동하는 방식으로
    전환을 검토할 만하다 — 레이스 창을 구조적으로 제거.

- **[INFO]** spec fidelity — 관련 product `spec/` 문서 부재는 정상, 대체 SoT
  (`plan/in-progress/harness-guard-followups.md` §F)와 line-level 일치 재확인
  - 위치: `spec/**` (grep "mermaid-lint"/"bootstrap-session"/"dependabot" 매치 0건 — mermaid
    다이어그램 fenced block만 존재), `plan/in-progress/harness-guard-followups.md:189-231`
  - 상세: `.claude/` 하네스 개발도구는 product spec(`spec/`) 스코프 밖이며 CLAUDE.md의 "정보
    저장 위치" 표에도 대응 슬롯이 없다 — 직전 두 라운드의 판단과 일치. §F 체크리스트 3항목을
    직접 재대조: (1) `npm audit fix` → 이 환경에서 직접 `npm audit --prefix
    .claude/tools/mermaid-lint` 실행해 "found 0 vulnerabilities" 재확인, lockfile 파싱으로
    `undici@7.28.0`/`dompurify@3.4.12` 확인, `package.json` range 무변경(diff 0) 확인.
    (2) Dependabot npm ecosystem 등록 → `dependabot.yml`의 `directory:
    "/.claude/tools/mermaid-lint"`가 실제 `package.json` 위치와 일치, YAML 유효. (3) 마커를
    lockfile 해시에 결속 → `_lock_hash`/`want_hash`/`need_install` 로직이 설명과 정확히
    일치(아래 실측 검증 참고). 과대·과소서술 없음.
  - 제안: 없음(정상 확인).

- **[INFO]** 수렴 확인 — 직전 2라운드(12_06_58, 12_31_29)가 지적한 WARNING 4건이 현재 커밋에서
  코드 라인 단위로 실제 해소됨(주장이 아니라 재검증)
  - 위치: `.claude/tools/bootstrap-session.sh:13,34,63-90,124,142`(최종 커밋 `ead99225c`),
    `.claude/tests/test_bootstrap_mermaid_install.py`(신규 테스트), `.claude/tests/README.md:34`
  - 상세: (12_31_29 W1) "NO LOCK"/"one-time" 서술이 신규 재발 표면(정기 lockfile 변경)을 못
    따라간다는 지적 → 현재 파일 헤더(13행)·섹션2 헤더(34행)·"NO LOCK" 설계 단락(63-90행
    부근)·런타임 echo(135행, `"(one-time)"` 제거) 4곳 전부 "recurring, not one-off"로 정정됨을
    직접 확인. (W2) `want_hash`를 install **전** 스냅샷해 마커에 그대로 기록하면 npm이 install
    중 lockfile을 재작성할 때 무한 재설치로 발산할 수 있다는 지적(testing 리뷰어가 스텁으로
    실측 재현) → 현재 코드는 install 성공 **후** `$(_lock_hash)`를 **재호출**해 기록(사전
    계산한 `$want_hash` 재사용 안 함 — 142행에서 grep으로 직접 확인) — 회귀 테스트
    `test_npm_rewriting_lockfile_still_converges`를 이 환경에서 직접 실행해 PASS 확인(3회
    연속 rewrite 스텁 실행에도 npm 호출 1회만, 즉 수렴). (W3) 해셔(`shasum`/`sha256sum`) 둘
    다 부재 시 폴백 경로가 무테스트였다는 지적 → `test_missing_hasher_degrades_to_presence_only`
    신규 추가·PASS 확인(exit-127 스텁으로 재현: 최초 설치는 되나 이후 lockfile 변경 미감지,
    문서화된 열화와 일치). (W4) README 표·모듈 docstring이 신규 핵심 동작을 미요약했다는 지적
    → 둘 다 갱신 확인. W5(커버리지 매트릭스 무결성 가드)·W6(`jsdom`/`mermaid` `"*"` range
    좁히기)는 `plan/in-progress/harness-guard-followups.md:224-231`에 "§F 잔여 defer"로
    명시적으로 추적되며 조용히 누락된 것이 아니다 — 대상 1개뿐이라 실질 drift 없고
    선재/가설적 사유로 별건 defer는 적절한 스코프 관리.
  - 제안: 없음(수렴 확인). 이번 라운드가 Critical 0·코드 WARNING 0이므로 직전
    RESOLUTION(12_31_29)이 명시한 수렴 기준("다음 리뷰가 Critical 0 + 코드 WARNING 0이면
    수렴")을 충족한다.

- **[INFO]** 실측 검증(기능 완전성 근거) — 이 환경에서 직접 실행/확인
  - 위치: 전체 대상 파일
  - 상세: `.claude/tests/test_bootstrap_mermaid_install.py` 11/11 PASS(직전 라운드 9건에서 2건
    순증: `test_npm_rewriting_lockfile_still_converges`, `test_missing_hasher_degrades_to_presence_only`)
    · 전체 하네스 스위트 305/305 PASS(커밋 메시지 "harness 305 통과" 주장과 정확히 일치) ·
    `bash -n .claude/tools/bootstrap-session.sh` 문법 정상 · 마커 콘텐츠 포맷 변경(빈 파일→
    SHA-256 해시)이 3개 소비처(`_lib/mermaid_lint_ready.py::is_ready()`, `.githooks/pre-commit`,
    PostToolUse 훅) 모두 `os.path.isfile`/`[ -f ]` 존재-여부 판정만 사용함을 코드로 직접
    확인해 무회귀. `grep -rn "bootstrap-install-complete"`로 마커 파일명·포맷을 가정하는 다른
    숨은 소비처가 없음을 확인. TODO/FIXME/HACK/XXX 마커 대상 3파일 전체 0건.
  - 제안: 없음.

- **[INFO]** (경미, 비차단) README.md의 테스트명 글롭 축약이 신규 테스트 4개 함수명을 전부
  문자 그대로 매칭하지는 않음
  - 위치: `.claude/tests/README.md:34`
  - 상세: 신규 4개 테스트 중 `test_lockfile_change_retriggers_install`(→`` `test_lockfile_*` ``
    매칭)·`test_missing_hasher_degrades_to_presence_only`(→`` `test_*hasher*` `` 매칭) 2건만
    표 안의 축약 패턴에 문자 그대로 부합하고, `test_unchanged_lockfile_does_not_reinstall`·
    `test_npm_rewriting_lockfile_still_converges`는 두 패턴 어디에도 안 걸린다. 다만 바로 앞
    문장이 이 4건의 동작을 전부 산문으로 정확히 서술하므로 정보 손실은 없다 — 순수 표기
    축약의 정밀도 문제이며 기능·문서 정확성에 실질 영향 없음.
  - 제안: 극히 저우선. 필요하면 4개 테스트명을 전부 나열하거나 문구를 "네 신규 테스트가"로
    조정.

## 요약

이번 diff(커밋 `02d69e324`+`c5fdd1bb8`+`ead99225c`, §F 수렴 3라운드)의 핵심 요구사항 —
mermaid-lint npm 트리의 undici HIGH·dompurify moderate 취약점을 lockfile 갱신만으로 해소하고,
이 워크스페이스-밖 독립 트리를 Dependabot 대상으로 등록하며, bootstrap 설치완료 마커를
lockfile 해시에 결속해 향후 모든 lockfile-only 보안 PR이 이미 bootstrap된 checkout에도 실제로
전파되게 하는 것 — 은 코드·테스트·거버넌스 문서(plan §F) 전부와 line-level로 일치하며, 직전
2라운드가 지적한 WARNING 4건(설계주석 drift, install-전/후 해시 캡처 순서 버그, 해셔-부재
폴백 무테스트, README/docstring 동기화 누락)이 전부 코드 레벨에서 실제로 해소됐음을 이
환경에서 직접 재실행·재대조로 확인했다(신규 테스트 포함 11/11, 전체 하네스 305/305, npm
audit 0 vulnerabilities). CRITICAL은 없고, 코드 자체에 남은 WARNING도 없다 — 직전 라운드가
명시한 수렴 기준을 충족하는 것으로 판단한다. 다만 리뷰 도중 공유 워크트리의
`bootstrap-session.sh`에서 이 PR의 핵심 로직을 완전히 무력화하는 인플레이스 뮤턴트
(`elif false; then # MUTATED`)가 실제로 관측됐다 — 형제 sub-agent의 비-vacuity 검증 기법으로
추정되며 최종 확인 시점엔 자가복구돼 clean하지만, 복원 단계가 실패했다면 이 PR의 목적을
정확히 무효화하는 미커밋 상태가 작업 트리에 잔존할 뻔한, 실증된 레이스였다 — 이 자체는
개발자 커밋의 결함이 아니므로 본문에서 별도 WARNING("코드 결함 아님"으로 명시)으로 분리해
기록했다.

## 위험도

LOW

# Requirement Review — mermaid-lint undici HIGH·dompurify moderate 취약점 해소 + 마커 lockfile-해시 결속

대상 커밋: `02d69e324`(취약점 fix + Dependabot 편입) + `c5fdd1bb8`(마커를 lockfile 해시에 결속, §F 리뷰 W1/W2/I2 처리).
대상 파일 4개: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`.

검증 방법: 코드 트레이스(수동) + 실제 테스트 실행(`.claude/tests/test_bootstrap_mermaid_install.py` 9건,
`.claude/tests` 전체 303건) + presence-only 뮤턴트 재현(비-vacuity 확인) + `package-lock.json` JSON 파싱·버전
대조 + `dependabot.yml` YAML 구조 검증 + governing 문서(`plan/in-progress/harness-guard-followups.md` §F) 라인
단위 대조. 모두 이 로컬 환경에서 직접 실행/확인함 (아래 상세).

## 발견사항

- **[INFO]** 관련 spec 부재는 정상 — governing 문서는 `plan/in-progress/harness-guard-followups.md` §F
  - 위치: `spec/**` (grep 0건), `plan/in-progress/harness-guard-followups.md:189-219`
  - 상세: `spec/` 전체에서 `mermaid-lint`·`bootstrap-session`·`dependabot` 문자열 grep 결과 실질 매치
    0건(“mermaid” 매치는 spec 본문의 ```mermaid 다이어그램 블록일 뿐, 이 툴을 서술한 문서 아님) — harness
    개발-도구 영역은 product spec 스코프 밖이라는 이전 리뷰(12_06_58 INFO#4)의 판단과 일치. 대신 이 변경의
    실질 "요구사항 명세"는 `plan/in-progress/harness-guard-followups.md` §F 체크리스트다. 3항목 전부
    실제 코드와 직접 대조함: (1) "npm audit fix — undici 7.27.0→7.28.0, dompurify 3.4.7→3.4.12" ↔
    `package-lock.json`에서 `undici@7.28.0`·`dompurify@3.4.12` 확인(JSON 파싱 + grep, 아래 상세), (2)
    "Dependabot npm ecosystem 등록(`/.claude/tools/mermaid-lint`)" ↔ `dependabot.yml`의 `directory`
    필드가 정확히 `/.claude/tools/mermaid-lint`(실제 `package.json` 위치와 일치)이고 YAML 파싱 정상, (3)
    "마커를 lockfile 해시에 결속" ↔ `bootstrap-session.sh`의 `_lock_hash`/`want_hash`/`need_install` 로직이
    설명과 정확히 일치. 과대서술·언더서술 없음.
  - 제안: 없음(정상 상태 확인).

- **[WARNING]** `[SPEC-DRIFT]` 아님, 순수 코드 정확성 이슈 — "NO LOCK" 설계 근거 + 런타임 메시지의 "one-time/rare/first-install-only" 프레이밍이 이번 diff가 만든 새 노출 표면과 더는 맞지 않음
  - 위치: `.claude/tools/bootstrap-session.sh:73-75, 84-85`("first cold install", "rare first-install-only window" 로 경합을 한정하는 기존 주석) ↔ 같은 파일 `:112-134`(이번 diff가 추가한 `_lock_hash`/`need_install`, lockfile 해시 불일치 시 재설치) ↔ `:126`(`echo "bootstrap: installing mermaid-lint deps (one-time)…"`) ↔ `.github/dependabot.yml:19-22`(이번 diff가 신설한 주간 npm ecosystem 등록)
  - 상세: 직접 확인. "NO LOCK, deliberately" 단락(62-87행 부근)은 락을 뺀 근거로 "경합이 남는 건 여러 세션이
    *최초* cold install 순간에 동시 도달할 때뿐"이라는 스코프 제한을 명시적으로 전제한다. 그런데 이번 diff의
    핵심 기능인 `_lock_hash`/`need_install`(112-123행)은 **lockfile 해시가 바뀔 때마다** 동일한 무락(no-lock)
    경합 창을 재개방한다 — 이미 install을 마친 checkout도 더는 예외가 아니다. 게다가 같은 diff가 신설한
    `dependabot.yml`의 주간(weekly) npm ecosystem 등록은 바로 그 "lockfile이 바뀌는" 사건을 정기적으로
    발생시키는 것이 목적이다. `test_bootstrap_mermaid_install.py` 자신의 모듈 docstring이 "여러 워크트리
    세션을 동시에 띄우는 것이 이 저장소의 공식 워크플로"라고 명시하므로, "Dependabot PR 머지 직후 여러 세션이
    거의 동시에 SessionStart"라는 조합은 가상 시나리오가 아니라 상시 재현 가능한 경로다. 같은 결로, 126행의
    런타임 메시지 "(one-time)…"도 이제 부정확하다 — 이 문자열은 실제 세션 transcript에 노출되는데, 새 로직
    아래서는 lockfile이 바뀔 때마다 재출력될 수 있어 "one-time"이라는 표현이 실제 동작과 어긋난다. 기능적으로는
    이미 "convergence, not exactly-once"로 받아들여진 기존 잔여 리스크의 재사용이라 즉시 차단 사유는 아니지만
    (아키텍처/성능 리뷰어도 같은 지점을 독립적으로 지적함 — 3개 리뷰어 수렴), 파일 자신의 안전-근거 주석과
    사용자 노출 메시지가 새 steady-state 동작을 더 이상 정확히 서술하지 못한다.
  - 제안: "NO LOCK" 단락의 스코프 문구를 "첫 설치뿐 아니라 lockfile 변경(정기 보안 업데이트 포함)마다 반복
    가능"으로 갱신하고, 126행 메시지에서 "(one-time)"을 제거하거나 "(installing/updating)"류로 교체. 코드
    로직 자체는 정확하므로 fix는 주석·메시지 텍스트로 국한.

- **[WARNING]** 엣지 케이스 — `want_hash`가 `npm install` 실행 *전* 스냅샷이라, install이 lockfile을 되쓰는 경우 마커 해시가 install 후 실제 파일과 어긋날 수 있음
  - 위치: `.claude/tools/bootstrap-session.sh:115`(`want_hash=$(_lock_hash)`, install 이전 1회 계산) ↔ `:127-128`(install 성공 후 **같은** `$want_hash`를 마커에 기록)
  - 상세: `npm install --no-fund --no-audit --silent`는 `npm ci`/`--no-save`가 아니므로, 로컬 npm 버전 차이나
    lockfile 정규화 등으로 install 도중 `package-lock.json`이 다시 쓰이면 마커에 저장된 해시(install 이전
    스냅샷)와 install 이후 디스크의 실제 파일 내용이 어긋난다. side_effect 리뷰어가 독립적으로 지적한 지점과
    일치. 트레이스상 무한루프는 아니다 — 다음 SessionStart가 (install 후) 현재 파일을 재해시해 마커와 비교하므로
    어긋난 상태라면 불필요한 재설치가 1회 더 발생하고 그 시점에 수렴한다(self-correcting). 다만 파일 헤더가
    스스로 명시하는 "Idempotent and fast on repeat runs" 계약을 국소적으로 깬다.
  - 제안: 저확률·자가치유 경로라 즉시 차단 사유는 아님. 원한다면 install 후 `want_hash`를 재계산해 기록하도록
    한 줄 이동(`want_hash=$(_lock_hash)`를 install 성공 분기 안, `npm install` 직후로 재호출)하면 이 잔여
    드리프트를 완전히 제거 가능 — 별건 후속으로 무방.

- **[WARNING]** 문서 동기화 — `.claude/tests/README.md`의 커버리지 표 + 테스트 모듈 docstring이 새로 추가된 lockfile-해시 결속 테스트 2건을 반영하지 않음
  - 위치: `.claude/tests/README.md:34`, `.claude/tests/test_bootstrap_mermaid_install.py:1-23`(모듈 docstring)
  - 상세: documentation 리뷰어가 이미 상세히 다룬 지점과 수렴 확인. README 표는 이 저장소가 관련 커밋마다
    갱신해온 "파일별 커버리지 요약" 인덱스인데(직전 갱신은 바로 앞 커밋 `ceee1fa5b`), 이번 diff가 추가한
    `test_lockfile_change_retriggers_install`/`test_unchanged_lockfile_does_not_reinstall`(이 커밋의
    핵심 헤드라인 동작)이 표·docstring 어디에도 요약돼 있지 않다. 코드·테스트 자체는 정확하고 개별 테스트
    docstring도 충분히 상세하므로 갭은 "요약 레이어"에 한정 — 기능·보안·빌드 영향 없음.
  - 제안: README.md:34행에 기존 문체를 따라 한 문장 추가, 모듈 docstring에도 4번째 불릿 추가(둘 다
    documentation.md가 구체적 문구까지 제시함).

- **[INFO]** 엣지 케이스 — "해시 도구(`shasum`·`sha256sum`) 둘 다 부재" fallback 경로가 전용 회귀 테스트로 커버되지 않음
  - 위치: `.claude/tools/bootstrap-session.sh:100-103`(`_lock_hash`), `.claude/tests/test_bootstrap_mermaid_install.py`(전체 — 이 경로를 노리는 테스트 없음)
  - 상세: 코드 트레이스로 로직 정확성은 확인함 — `shasum`/`sha256sum` 둘 다 없으면 `want_hash=""`가 되고,
    `[ -n "$want_hash" ]`가 거짓이라 해시-불일치 재설치 분기가 통째로 비활성화되며 "마커 없으면 설치"라는
    구 presence-only 동작만 유지된다(문서화된 의도와 일치, 실측 확인). 다만 이 분기를 직접 exercise하는
    테스트는 없어(PATH에서 두 바이너리를 모두 숨기는 서브셋 부재) 향후 회귀 시 무신호로 깨질 수 있다. 실사용
    리스크는 매우 낮음(macOS/Linux 개발·CI 호스트에 `shasum`·`sha256sum` 중 하나가 없는 경우는 희귀).
  - 제안: 저우선. `PATH`에서 두 바이너리를 모두 제거한 env로 `_run()`하는 테스트 1건 추가 고려(다른 테스트와
    같은 패턴).

- **[INFO]** 외부 플랫폼 동작 서술의 정밀도 — "이 npm 트리의 CVE는 등록 전까지 영구 무신호였다" 서술이 GitHub Dependabot alerts의 정확한 동작 범위와 완전히 일치하는지 로컬에서 검증 불가
  - 위치: `.github/dependabot.yml:12-14` 주석, `plan/in-progress/harness-guard-followups.md:198-201`
  - 상세: GitHub의 Dependabot **alerts**(취약점 탐지 자체)는 일반적으로 dependency graph 기반으로 동작하며
    이론상 `dependabot.yml`의 `updates:` 등록과 무관하게 발생할 수 있다(반면 **scheduled version-update PR**과,
    등록된 ecosystem/directory에 대한 설정 적용은 `dependabot.yml` 등록에 의존). "등록 전까지 영구 무신호"라는
    표현이 이 구분을 정확히 반영하는지는 repo Settings(Dependabot alerts 활성 여부 등)에 대한 접근 없이는
    확정할 수 없다. 코드 변경(스케줄 npm ecosystem 등록) 자체는 정확하고 유효하므로 이는 순수 서술 정밀도
    이슈이며 기능 결함이 아니다. (동일 항목이 직전 리뷰 12_06_58 INFO#2로 이미 한 차례 지적됐고, 이번 diff는
    "security update" 표현을 "스케줄 version-update"로 이미 한 단계 정밀화했다 — 남은 것은 "영구 무신호"
    문구 자체의 재확인 정도.)
  - 제안: 확신이 없으면 그대로 두어도 무방(비차단). 정밀화하려면 repo Settings의 Dependabot alerts 토글
    상태를 실측 확인 후 문구 조정.

## 실측 검증 (기능 완전성 근거)

- `.claude/tests/test_bootstrap_mermaid_install.py` 9건 전체 통과(`pytest`, 이 환경에서 직접 실행), 신규 2건
  (`test_lockfile_change_retriggers_install`, `test_unchanged_lockfile_does_not_reinstall`) 포함.
- `.claude/tests/` 전체 스위트 303 passed / 108 subtests passed — 커밋 메시지의 "harness 303 통과" 주장과
  정확히 일치, 회귀 없음.
- 비-vacuity 재현: `bootstrap-session.sh`의 해시-불일치 재설치 분기(`elif [ -n "$want_hash" ] && ...`)를
  제거한 프리센스-온리 뮤턴트를 별도 scratch 사본에 적용해 실행 → `test_lockfile_change_retriggers_install`이
  기대대로 실패(`AssertionError: 1 != 2`)함을 직접 확인. 테스트가 실제로 이 동작을 판별함을 증명.
- `package-lock.json`: JSON 파싱 정상(151개 패키지), `node_modules/undici` = `7.28.0`, `node_modules/dompurify`
  = `3.4.12` — 커밋 메시지가 주장하는 패치 버전과 정확히 일치.
- `package.json`(`.claude/tools/mermaid-lint/`)의 `jsdom`/`mermaid` range는 `"*"`로 미변경 — "lockfile만
  갱신, breaking 없음" 주장과 일치.
- `.github/dependabot.yml`: YAML 파싱 정상, 신규 `npm` ecosystem 항목의 `directory: "/.claude/tools/mermaid-lint"`가
  실제 `package.json` 위치와 일치.
- 공유 SoT `.claude/hooks/_lib/mermaid_lint_ready.py`의 `is_ready()`는 마커 **파일 존재 여부만** 검사(내용
  무관) — 이번 diff가 마커 내용을 해시로 바꿔도 이 파일이 변경되지 않은 이유(3개 소비처 무영향)가 코드로
  확인됨.
- `PROJECT.md`(리뷰 payload 4파일 밖이지만 governing plan §F 체크리스트 항목이라 교차 확인): 의존성 거버넌스
  절에 Dependabot npm 경로 1문장 추가됨 — 직전 리뷰(12_06_58) WARNING#2와 정확히 대응.
- TODO/FIXME/HACK/XXX 마커: 4개 리뷰 대상 파일 전체 grep 0건.
- `bootstrap-session.sh`는 모든 경로에서 `exit 0`으로 종료(초입 조기 종료 포함) — "bootstrap must never block
  a session" 계약과 일치.

## 요약

이번 diff의 핵심 요구사항 — "① `.claude/tools/mermaid-lint` npm 트리의 undici HIGH·dompurify moderate
취약점을 lockfile 갱신만으로 해소, ② 이 워크스페이스-밖 독립 npm 트리를 Dependabot 대상으로 등록해 향후
CVE 무신호를 구조적으로 차단, ③ bootstrap 설치완료 마커를 lockfile 해시에 결속해 향후 모든 lockfile-only
보안 PR이 이미 bootstrap된 checkout에도 실제로 전파되도록 함" — 은 코드·테스트·거버넌스 plan(§F) 전부와
line-level로 일치하며, 직접 실행한 테스트(신규 2건 포함 9/9, 전체 스위트 303/303)와 뮤턴트 재현으로 비-vacuity까지
확인했다. spec/ 문서가 이 영역을 다루지 않는 것은 정상(harness 내부 도구, product spec 스코프 밖)이고 대체
SoT인 plan §F와의 대조에서 과대·과소 서술이 없다. CRITICAL 결함은 없다. 다만 세 갈래의 잔여 정확성 이슈가
있다 — (1) "NO LOCK"/"(one-time)" 서술이 이 diff가 스스로 만든 새 재발 표면(정기 lockfile 변경)을 더는
정확히 경계 짓지 못함(아키텍처·성능 리뷰어와 독립 수렴), (2) install-전 lockfile 스냅샷을 그대로 마커에
쓰는 구조가 극히 드문 경우 1회 추가 재설치로 자가치유하는 무해한 드리프트를 남길 수 있음(side_effect
리뷰어와 독립 수렴), (3) README.md 커버리지 표·모듈 docstring이 신규 핵심 테스트 2건을 요약하지 않음
(documentation 리뷰어와 수렴). 셋 다 코드 동작·보안·빌드에 영향 없는 주석/메시지/문서 정확성 문제이며
즉시 차단 사유가 아니다.

## 위험도

LOW

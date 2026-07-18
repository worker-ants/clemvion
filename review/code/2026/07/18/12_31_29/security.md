# Security 리뷰: mermaid-lint 마커-lockfile 해시 결속 (W1 후속조치) + 부수 문서 갱신

리뷰 대상(실제 `git diff origin/main` 로 확인, prompt 파일 목록과 일치):
`.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`, `PROJECT.md`.

## 검증 방법

- `git diff origin/main -- <5개 파일>` 로 실제 변경 hunk 를 직접 대조 (prompt 페이로드는 lockfile
  부분이 크기 제한으로 잘려 있어, 실제 워크트리 파일을 `Read`/`grep` 로 직접 확인).
- lockfile 전체(1615줄, 152개 패키지)의 `resolved` 호스트를 전수 추출해 `registry.npmjs.org`
  외 호스트가 없는지 확인(타이포스쿼팅·사설 미러 치환 여부).
- 동일 브랜치의 선행 리뷰 라운드(`review/code/2026/07/18/12_06_58`)의 SUMMARY/RESOLUTION/security.md
  를 대조해, 이번 라운드가 그 라운드의 WARNING #1(W1)·WARNING #2(W2)·INFO #2(I2)를 정확히
  대상으로 하는 후속조치인지, 그리고 그 결과가 실제로 반영됐는지 확인.
  (해당 라운드는 `npm audit --package-lock-only` 를 구 lockfile 로 라이브 재현해 undici HIGH 7건
  ·dompurify moderate 3건 → 0 을 이미 독립 검증했고, 커밋된 lockfile 이 `npm install
  --package-lock-only` 재생성본과 byte-identical 함도 확인함 — 본 라운드는 그 결론을 재신뢰하되
  이번 diff 자체(마커 로직·테스트·문서)를 처음부터 다시 정밀 검사했다.)
- `bootstrap-session.sh` 의 신규 `_lock_hash`/`need_install` 제어흐름을 수기로 traced through
  (빈 마커 마이그레이션, 해셔 부재 폴백, 동시성 미변경 여부).

## 발견사항

- **[INFO]** CVE 해소 버전 상향 — 실측 재현 근거와 정합, 신규 위험 없음
  - 위치: `.claude/tools/mermaid-lint/package-lock.json` (`undici` 7.27.0→7.28.0, `dompurify`
    3.4.7→3.4.12)
  - 상세: 두 패키지 모두 `resolved: https://registry.npmjs.org/...`, `integrity: sha512-...`
    필드가 그대로 존재하고 호스트가 공식 레지스트리다. 선행 라운드(12_06_58)가 구 lockfile 로
    `npm audit` 를 라이브 재현해 undici HIGH 7건(SOCKS5 TLS 인증서 검증 우회·Set-Cookie 헤더
    인젝션·WebSocket DoS·프록시 풀 재사용을 통한 cross-origin 라우팅 등)·dompurify moderate
    3건(`ALLOWED_ATTR` pollution 등)을 확인했고, 신 lockfile 이 `npm install
    --package-lock-only` 재생성본과 byte-identical 함도 확인했다 — 수동 변조·타이포스쿼팅
    가능성 배제. 신규 top-level/transitive 패키지 추가 없음(둘 다 기존 간접 의존성의 버전
    범프일 뿐). `jsdom`(`^7.25.0`)·`mermaid`(`^3.3.1`)의 선언 range 를 모두 만족하는
    patch/minor 업그레이드로 breaking 없음. OWASP A06:2021(Vulnerable and Outdated
    Components) 정정 조치로 타당하다.
  - 제안: 없음 — 이미 올바르게 조치됨

- **[INFO]** 마커-lockfile 해시 결속(W1 후속조치) — 로직 검증 결과 정상, 설계 의도대로 동작
  - 위치: `.claude/tools/bootstrap-session.sh` (`_lock_hash`, `want_hash`/`need_install` 판정,
    `printf '%s\n' "$want_hash" > "$marker"`)
  - 상세: 선행 라운드 W1("마커가 존재 여부만 검사해 이미 설치된 checkout·향후 lockfile-only
    보안 PR 전부에 이번 패치가 전파되지 않을 수 있음")을 정확히 겨냥한 수정이다. 제어흐름을
    직접 추적한 결과: (1) 마커 부재 시 무조건 설치, (2) 마커 존재 + 해셔 사용 가능 + 해시
    불일치 시 재설치, (3) 해시 도구 부재(`want_hash` 공백) 시 `-n "$want_hash"` 가드로 해시
    비교를 건너뛰어 presence-only 로 안전하게 폴백(설치 자체를 막지 않음), (4) 기존(패치 이전)
    빈 마커 checkout 은 저장된 값("")과 새 해시가 불일치해 1회성 재설치로 자동 수렴 — 코드
    주석이 서술한 동작과 실제 분기 로직이 정확히 일치한다.
    `printf '%s\n' "$want_hash"` 는 포맷 문자열이 아닌 인자 자리에 변수를 두는 올바른 패턴이라
    해시값에 우연히 `%` 가 섞여도(SHA-256 hex 출력 특성상 실질 불가능하지만) 포맷 문자열
    인젝션으로 이어지지 않는다. 해시는 SHA-256(무결성/변경-감지 목적으로 적절 — 패스워드
    해싱처럼 느린 KDF 가 필요한 용도가 아님) 이고 `shasum`/`sha256sum` 아웃풋을 `cut -d'
    '-f1` 로 안전하게 파싱한다.
  - 제안: 없음 — 이미 올바르게 조치됨

- **[INFO]** 신규 테스트(`test_lockfile_change_retriggers_install`,
  `test_unchanged_lockfile_does_not_reinstall`) — 격리·비-injection 확인
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py`
  - 상세: 두 테스트 모두 실제 undici 보안 범프 시나리오(`"undici":"7.27.0"` → `"7.28.0"`)를
    lockfile 본문에 그대로 재현해 마커-해시 결속을 정확히 겨냥한다. `npm` 은 PATH 앞단에
    스텁으로 격리되어(모듈 docstring: "npm is stubbed on PATH (never the network)") 테스트
    실행 중 실제 레지스트리 접근이 발생하지 않는다. `subprocess.run(["git", ...], *args)` 의
    인자는 전부 테스트 코드 내 하드코딩 리터럴이라 인젝션 벡터가 없고, `tempfile.mkdtemp()`
    로 실제 저장소 상태와 격리된다. 신규 코드에 시크릿·자격증명 없음.
  - 제안: 없음

- **[INFO]** `PROJECT.md`/`dependabot.yml` 문서 갱신 — 선행 라운드 W2·I2 를 정확히 해소
  - 위치: `PROJECT.md` (의존성 취약점 audit·핀 거버넌스 절에 pnpm 워크스페이스 밖 커버리지
    문장 추가), `.github/dependabot.yml`(신규 npm 항목 주석)
  - 상세: W2("PROJECT.md 가 신설된 Dependabot npm 경로를 언급하지 않아 불완전")는 정확히
    권고된 문장("워크스페이스 밖 독립 npm 트리는 dependabot.yml 의 npm ecosystem 항목이 별도
    커버")으로 해소됐다. I2("주석이 실제로는 스케줄 version-update 인데 'security update' 처럼
    읽힘")도 정확히 권고된 방향("스케줄 version-update(주간) + repo Settings 의 Dependabot
    security updates(스키마 밖, repo 토글) 는 별개 메커니즘")으로 정밀화됐다. 문서-실체 불일치가
    남지 않는다.
  - 제안: 없음

- **[INFO, residual — 이미 코드 주석에 투명하게 문서화됨]** 해싱 도구 완전 부재 호스트에서
  이번 PR 이 닫으려는 정확한 갭이 조용히 재발
  - 위치: `.claude/tools/bootstrap-session.sh` `_lock_hash()` 폴백 분기
  - 상세: `shasum`·`sha256sum` 이 둘 다 없는 호스트에서는 `want_hash` 가 항상 공백이 되어
    `-n "$want_hash"` 가드가 항상 거짓 → 해시 불일치 감지가 발동하지 않고 W1 이전의
    presence-only 동작으로 되돌아간다(마커만 있으면 lockfile 이 바뀌어도 재설치 안 함). 즉
    이런 호스트에서는 "미래 보안 PR(lockfile-only)마다 구조적으로 재발"하는 W1 의 원래 증상이
    그대로 남는다. 다만 이는 은닉된 결함이 아니라 diff 자체의 주석("Falls back to
    presence-only when no hashing tool is available, preserving the old behavior on such a
    host")에 이미 명시적으로 공개된 트레이드오프이고, macOS(perl `shasum`)·대부분의 GNU/Linux
    (`sha256sum` coreutils)·WSL 등 실제 개발/CI 호스트에서 두 도구 중 하나가 없는 경우는
    희귀해 실질 노출도는 낮다.
  - 제안: 조치 불요(비차단). 필요 시 `.claude/tools/mermaid-lint` 를 실행하는 CI/컨테이너
    이미지에 `coreutils`(또는 `perl`) 가용성을 한 번 확인해두면 이 폴백 분기가 실사용에서
    발동하지 않음을 재확인할 수 있다.

- **[INFO, pre-existing — 이 diff 범위 밖, 선행 라운드에서 이미 3회 별개로 triage 됨]**
  `package.json` 직접 의존성이 `"*"` (미고정)
  - 위치: `.claude/tools/mermaid-lint/package.json` (`jsdom`, `mermaid`) — lockfile 의
    root `""` 패키지 엔트리로 간접 확인, 이번 diff 는 이 파일을 건드리지 않음
  - 상세: `bootstrap-session.sh` 는 `npm ci` 가 아닌 `npm install` 을 사용한다. lockfile 이
    package.json 과 sync 상태인 한 `npm install` 은 커밋된 lockfile 의 정확한 버전을
    설치하므로 현재는 실질 위험이 낮지만, `npm ci` 대비 "lockfile 과 무관하게 최신을 끌어올
    가능성이 이론적으로 남는다"는 방어적 차이는 존재한다. 이 diff 가 새로 만든 문제는 아니며,
    선행 라운드(dependency INFO#5, security INFO, side_effect 미지적)에서 이미 "diff 범위
    밖·조치 불요"로 일관되게 triage 됐다.
  - 제안: 조치 불요(이번 diff 요구사항 아님). 별건으로 `npm install` → `npm ci` 전환과
    `package.json` range 명시(예: `"jsdom": "^29.0.0"`)를 함께 검토할 여지는 있으나, 이번
    PR 의 스코프(§F W1 후속조치)와는 무관.

- **[INFO]** 인젝션·시크릿·인증 — 신규 코드 전반에 걸쳐 문제 없음
  - 위치: `bootstrap-session.sh` 전체
  - 상세: `set -u` 유지, 모든 변수 확장이 quote 됨(`"$tool_dir"`, `"$marker"`,
    `"$fail_marker"` 등). reaper 호출부의 `${anchor:+--keep "$anchor"}` 는 quote 가 내부적으로
    보존되는 올바른 bash idiom(이번 diff 대상은 아니나 인접 코드로 재확인) — word-splitting·
    옵션 인젝션 위험 없음. `eval`/커맨드 문자열 조합 없음. 시크릿·API 키·비밀번호·인증서
    하드코딩 없음(lockfile `integrity` 필드는 공개 npm 패키지의 sha512 무결성 해시일 뿐 비밀
    아님). 에러 메시지(`echo ... >&2`)는 "install failed" 류 일반 텍스트만 노출, 민감 정보
    없음.
  - 제안: 없음

## 요약

이번 diff 는 선행 리뷰 라운드(2026/07/18 12_06_58)가 남긴 WARNING #1(설치완료 마커가
package-lock.json 내용과 무관해 보안 픽스가 기존 checkout·향후 lockfile-only 보안 PR 에
전파되지 않는 문제)·WARNING #2(PROJECT.md 거버넌스 절 갱신 누락)·INFO #2(dependabot 주석의
메커니즘 오기술)를 정확히 겨냥해 해소하는 후속조치다. 마커를 package-lock.json 의 SHA-256
해시에 결속하는 로직을 직접 traced-through 한 결과 빈-마커 마이그레이션·해셔 부재 폴백·
정상/변경 lockfile 판정 모든 분기가 설계 의도와 일치했고, 신규 테스트 2건이 정확히 그
시나리오(undici 보안 범프 예시)를 검증한다. `printf '%s\n'` 사용·SHA-256 의 적절한 용도
사용(변경-감지, 비밀번호 해싱 아님)·모든 변수 quote 등 셸 스크립팅 위생도 양호하다. 근본
취약점 수정 자체(undici HIGH 7건·dompurify moderate 3건 → 0)는 선행 라운드가 라이브 `npm
audit` 재현과 byte-identical lockfile 대조로 이미 독립 검증했고 이번 라운드에서도 diff·
resolved 호스트·integrity 필드를 재확인해 변조 흔적이 없음을 재차 확인했다. 신규로 도입된
인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화 사용은 없다. 유일한 잔여 사항(해싱
도구 완전 부재 호스트에서의 폴백, `package.json` 의 `"*"` range)은 둘 다 코드/선행 라운드에
이미 투명하게 문서화된 저노출 트레이드오프이며 이번 PR 의 스코프를 막을 사유가 아니다.

## 위험도
NONE

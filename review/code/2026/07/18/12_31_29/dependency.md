# 의존성(Dependency) 리뷰

대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`,
`.github/dependabot.yml`, `.claude/tools/mermaid-lint/package-lock.json`, `PROJECT.md`
(커밋 `02d69e324` fix(deps) + `c5fdd1bb8` fix(harness), 브랜치 `claude/mermaid-lint-undici-vuln-2956f1`)

## 발견사항

- **[INFO]** 취약점 수정을 `npm audit` 실측으로 독립 재검증 — 주장과 일치
  - 위치: `.claude/tools/mermaid-lint/package-lock.json` (`node_modules/undici`, `node_modules/dompurify`)
  - 상세: 커밋 메시지의 "undici HIGH·dompurify moderate 해소" 를 별도 임시 디렉터리에서 직접 재현했다. 수정 전 lockfile(부모 커밋 `22cc48ef3`, undici 7.27.0 / dompurify 3.4.7)로 `npm audit --json` 실행 시 undici 에 advisory **7건**(HIGH 3 · moderate 2 · low 2 — 대표 `GHSA-vmh5-mc38-953g` TLS 인증서 검증 우회 CVSS 7.4, `GHSA-vxpw-j846-p89q` WebSocket DoS, `GHSA-hm92-r4w5-c3mj` SOCKS5 프록시 풀 재사용을 통한 cross-origin 라우팅 등, 전부 fix range `<7.28.0`), dompurify 에 advisory **3건**(moderate 1 · low 2, 최대 fix range `<=3.4.10`)이 실제로 잡혔다. 수정 후 lockfile(undici 7.28.0 / dompurify 3.4.12)로 재실행하면 `"total": 0`(전 심각도 0건). 두 버전 모두 각 advisory 의 최소 fix 요구치를 정확히 충족하는 **최소 필요 버전** — 과잉 점프 없이 정밀하게 고쳤다.
  - 제안: 조치 불요(확인 완료). 다만 커밋 메시지의 "undici HIGH 7건" 표현은 다소 부정확 — 7건 중 개별 HIGH 는 3건뿐이고 나머지는 moderate 2·low 2 이며, npm 이 패키지 단위로 최고 심각도(HIGH)를 롤업해 보여준 것이다. 향후 보안수정 커밋에 GHSA ID(`GHSA-vmh5-mc38-953g` 등)를 인용해두면 추후 감사·재현이 더 쉬워진다.

- **[WARNING]** 신규 Dependabot npm 엔트리가 `package.json` 의 무제한(`*`) semver 범위와 결합 — 향후 major bump 가 diff 상 무징후
  - 위치: `.github/dependabot.yml` 신규 `directory: "/.claude/tools/mermaid-lint"` 항목 ↔ `.claude/tools/mermaid-lint/package.json`(본 리뷰의 변경 파일 목록엔 없으나, 리뷰 대상 lockfile 을 지배하는 선언 범위)
  - 상세: `package.json` 의 `dependencies` 는 `"jsdom": "*"`, `"mermaid": "*"` — 두 direct dependency 모두 완전 무제한 범위다(이 diff 가 만든 것은 아니고 PR #410 이래 기존 상태). 이 diff 이전엔 이 트리를 건드리는 자동화가 전무해 무해했지만, 이번 diff 로 Dependabot npm version-update(주간)가 **처음 활성화**된다. Dependabot 은 신버전이면 major 여부와 무관하게 PR 을 제안하는데, 범위가 `*` 라서 major bump PR 도 이번 undici/dompurify 수정처럼 **package.json 변경 없는 lockfile-only diff** 로 나타난다 — 리뷰어가 diff 만 보고 "이번 건이 patch 인지 major 인지" 구분할 신호가 없다. `^` 로 고정돼 있었다면 major bump 시 range 자체도 바뀌어야 해 diff 에서 즉시 드러났을 것이다. `PROJECT.md` 자체 버전 핀 정책("(a) 기본 caret")과도 어긋나는, 이 트리만의 예외 상태다.
  - 제안: 이번 PR 을 막을 사안은 아니나 후속(비긴급)으로 `jsdom`/`mermaid` 를 현재 lockfile-resolved major 에 맞춰 caret 로 좁히길 권장(`^29.1.1`, `^11.15.0`). 최소한 Dependabot PR 리뷰 시 "resolved 버전의 major 변경 여부"를 별도로 확인하는 습관을 문서화(README/PROJECT.md 한 줄).

- **[INFO]** 내부 마커 계약(`mermaid_lint_ready.py`) 무결성 — 소스 직접 확인, drift 없음
  - 위치: `.claude/tools/bootstrap-session.sh` (`_lock_hash`/마커 write 로직) ↔ `.claude/hooks/_lib/mermaid_lint_ready.py` (3개 reader 가 공유하는 SoT, 리뷰 대상 파일 목록 밖)
  - 상세: 이번 diff 로 마커 파일 **내용**이 이제 lockfile 의 sha256 을 담게 됐다. 공유 SoT reader `mermaid_lint_ready.py::is_ready()` 를 직접 열어 확인한 결과 `os.path.isfile(marker_path)` 존재 여부만 검사하고 내용은 전혀 읽지 않는다 — `.githooks/pre-commit`·PostToolUse lint guard 등 3개 reader 모두 이 모듈을 경유하므로 마커 콘텐츠 변경으로 인한 drift 는 없다. 커밋 메시지의 해당 주장과 정확히 일치.
  - 제안: 없음(확인됨).

- **[INFO]** 신규 테스트가 실제로 실행·통과하는지 직접 검증(비-vacuous)
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py::test_lockfile_change_retriggers_install`, `::test_unchanged_lockfile_does_not_reinstall`
  - 상세: `python3 -m pytest .claude/tests/test_bootstrap_mermaid_install.py` 를 직접 실행 → `9 passed`(신규 2건 포함, undici 7.27.0→7.28.0 형태의 가상 lockfile 변경을 시뮬레이션). 마커-lockfile해시 결속 로직이 실제로 동작함을 실측 확인했다 — 커밋이 주장하는 "harness 303 통과" 가 이 파일 범위에서 재현된다.
  - 제안: 없음(확인됨).

- **[INFO]** 라이선스 · 신규 의존성 · 호환성 — 문제 없음
  - 위치: `package-lock.json` 의 `node_modules/undici`, `node_modules/dompurify` 항목
  - 상세: 두 패키지 모두 라이선스 필드가 diff 전후 불변(undici=`MIT`, dompurify=`(MPL-2.0 OR Apache-2.0)`) — 버전 문자열과 `integrity`(SHA-512) 만 갱신됐다. 두 버전 모두 각 requiring 패키지의 선언 범위를 만족한다 — jsdom 이 요구하는 `undici: ^7.25.0` 를 7.28.0 이 만족, mermaid 가 요구하는 `dompurify: ^3.3.1` 를 3.4.12 가 만족 — breaking 위험 없음. `git diff`로 `node_modules/*` 키 추가/삭제를 확인했으나 **전혀 없음**(두 기존 엔트리의 in-place 갱신뿐) — 불필요한 신규 의존성 도입이 없다. 이 트리는 하네스 전용 dev-tooling(markdown mermaid 블록 정적 문법 검사)이라 프로덕션 번들 크기·빌드 산출물과 무관하며 라이선스가 최종 사용자에게 노출되지 않는다.
  - 제안: 없음.

- **[INFO]** Dependabot 스코프·"영구 무신호였다" 서술의 정확성 확인
  - 위치: `.github/dependabot.yml` 신규 항목, `PROJECT.md` 갱신 문장("단 위 audit 은 pnpm 워크스페이스만 커버한다…")
  - 상세: `.github/workflows/deps-security-checks.yml` 을 직접 열람 — `paths:` 트리거가 `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`package.json`(루트)/`codebase/**/package.json`/체크 스크립트만 대상이라 `.claude/tools/mermaid-lint/**` 는 전혀 매칭되지 않는다(주간 schedule cron 도 `pnpm audit` 만 수행, 이 npm 트리는 대상이 아님). "이 트리 CVE 가 등록 전까지 영구 무신호였다" 서술이 정확함을 확인했다. 신규 `directory: "/.claude/tools/mermaid-lint"` 경로도 실제 `package.json` 위치와 일치함을 확인.
  - 제안: 없음.

- **[INFO]** 새 소프트 의존성: 해시 도구(`shasum`/`sha256sum`) 가용성 가정
  - 위치: `.claude/tools/bootstrap-session.sh` `_lock_hash()`
  - 상세: lockfile 변경-감지가 `shasum`(macOS, perl 경유) 또는 `sha256sum`(GNU coreutils) CLI 존재를 전제한다. 둘 다 없는 호스트에서는 `want_hash` 가 빈 문자열이 되어 변경-감지 절반만 비활성화되고 "마커 없으면 설치"는 유지된다(코드 주석과 테스트 스위트 양쪽에서 명시적으로 다뤄지는 degrade 경로). 두 도구는 사실상 모든 macOS/Linux 개발·CI 환경에 기본 탑재라 실질 리스크는 낮다.
  - 제안: 없음(문서화·회귀 방지가 이미 충분).

## 요약

`.claude/tools/mermaid-lint` 독립 npm 트리(pnpm 워크스페이스 밖이라 기존 `deps-security-checks.yml`/Dependabot 어디에도 안 걸렸던 것을 `deps-security-checks.yml` 의 `paths:` 트리거를 직접 확인해 재검증함)의 실취약점 2건(undici HIGH 계열 7건, dompurify moderate 계열 3건)을 `npm audit fix` 로 정밀 해소한 diff다. `npm audit` 을 수정 전/후 lockfile 양쪽에 대해 독립적으로 재현한 결과 주장이 정확했고(수정 전 undici 7건·dompurify 3건 확인, 수정 후 0건), 두 버전 모두 각 advisory 의 최소 fix 요구치이자 requiring 패키지(jsdom, mermaid)가 선언한 semver 범위 내에 있어 breaking 위험이 없다. 신규 패키지 추가·라이선스 변경 없음, node_modules 트리 shape 불변. 후속 커밋의 마커-lockfile해시 결속 로직(재설치가 실제 보안 패치를 전파하도록 하는 메커니즘)은 공유 SoT `mermaid_lint_ready.py` 와의 계약을 깨지 않음을 소스 확인했고, 신규 테스트 2건은 직접 실행해 실동작(비-vacuous)함을 확인했다. 유일한 forward-looking 우려는 이번에 처음 켜지는 Dependabot npm 스케줄이 `package.json` 의 기존 `*` 와일드카드 범위와 만나 향후 major-bump PR 이 diff 상 patch bump 와 구분되지 않을 수 있다는 점 — 이번 PR 자체를 막을 사안은 아니고 caret 전환을 후속 과제로 권장한다.

## 위험도

LOW

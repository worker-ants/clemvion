# Dependency Review — mermaid-lint 설치 가드 + 공유 readiness SoT

## 스코프

리뷰 대상 6개 파일(`_lib/mermaid_lint_ready.py`, `lint_mermaid_posttooluse.py`,
`bootstrap-session.sh`, `.githooks/pre-commit`, 두 테스트 파일) 자체는 신규 외부
패키지·`requirements.txt`·`package.json` 변경을 포함하지 않는다(전부 Python
stdlib / bash / 기존 harness 내부 모듈). 그러나 이 diff의 실질 목적이 "mermaid-lint
도구(`.claude/tools/mermaid-lint`, `jsdom`+`mermaid` npm 의존)를 세션마다 안전하게
설치·판정하는 경로를 하드닝하는 것"이므로, 그 설치 대상인 `package.json`/
`package-lock.json`(diff 밖, 미변경)까지 실측 확인했다 — 이전 리뷰 라운드
(`review/code/2026/07/17/20_06_45`)가 "INFO, out of scope"로만 남긴 지점을 실제
`npm audit` 실행으로 검증해 새로운 사실을 확인했다.

## 발견사항

- **[WARNING]** `npm audit` 실행 결과 실제 취약점 2건 확인(dompurify moderate, undici HIGH) — 설치 시점엔 `--no-audit` 로 은폐됨
  - 위치: `.claude/tools/mermaid-lint/package-lock.json`(잠긴 버전: `dompurify@3.4.7`, `undici@7.27.0`), `.claude/tools/bootstrap-session.sh:367`(`npm install --no-fund --no-audit --silent`)
  - 상세: 이전 리뷰(20_06_45 security.md)는 `--no-audit`을 "취약점이 새로 생겨도 신호가 없다"는 가정형으로만 기록했으나, 실제로 이 tool_dir 에서 `npm audit --json`을 돌려보면 **지금 이미** 2건이 잡힌다 — `dompurify <=3.4.10`(moderate, GHSA-vxr8-fq34-vvx9 / GHSA-gvmj-g25r-r7wr / GHSA-cmwh-pvxp-8882, mermaid의 전이 의존)와 `undici 7.0.0–7.27.2`(**high**, CVSS 최대 7.5 — TLS 인증서 검증 우회 SOCKS5 ProxyAgent GHSA-vmh5-mc38-953g, WebSocket DoS GHSA-vxpw-j846-p89q, cross-origin 요청 라우팅 GHSA-hm92-r4w5-c3mj 등, jsdom의 전이 의존). 두 건 모두 `fixAvailable: true`이고 각각 상위 패키지(mermaid `^3.3.1`, jsdom `^7.25.0`)가 이미 선언한 semver 범위 안에서(`dompurify@3.4.12`, `undici@7.28.0`) 해소되므로 `package.json` 자체를 건드릴 필요조차 없다(`npm audit fix` 확인, 코드 변경 없이 lockfile만 갱신).
    실사용 경로상 실질 노출도는 낮다 — `lint-mermaid.mjs`는 `mermaid.parse()`만 호출하고(`.render()` 미사용이라 dompurify의 sanitize-bypass 코드경로가 실행되지 않음), jsdom은 정적 `new JSDOM("<!DOCTYPE html>...")` 로만 쓰여 실제 네트워크 요청을 발생시키지 않으므로(undici가 노출하는 취약점은 전부 "요청을 실제로 보낼 때"의 시나리오) 이 devtool의 좁은 사용 패턴에서 직접 트리거되는 경로는 아니다. 다만 "known-vulnerable dependency 사용 여부"를 확인해야 하는 항목 기준으로는 확정 사실이며, 그 확인 창구(`--no-audit`) 자체가 꺼져 있다는 점은 별개로 남는다.
  - 제안: 부트스트랩 흐름 변경 없이 `cd .claude/tools/mermaid-lint && npm audit fix`로 lockfile만 갱신(2건 모두 breaking 없음). `--no-audit`은 유지하더라도(설치 latency 목적上 합리적) 아래 CI 사각지대(다음 항목)를 메워 정기적으로라도 신호를 받을 것.

- **[WARNING]** `.claude/tools/mermaid-lint`의 npm 의존성 트리가 이 저장소의 모든 자동 보안 스캔 대상에서 빠져 있음
  - 위치: `.github/workflows/deps-security-checks.yml:19-32`(`paths`: `pnpm-workspace.yaml`/`pnpm-lock.yaml`/`package.json`/`codebase/**/package.json`만 나열, 주간 cron으로 `pnpm audit --audit-level=moderate` 실행), `.github/dependabot.yml`(`package-ecosystem: "github-actions"` 하나만 등록, `npm`/`npm-and-yarn` ecosystem 미등록)
  - 상세: 이 저장소는 이미 "의존성이 안 바뀌어도 신규 CVE는 매주 공시된다"는 정확한 교훈으로 `deps-security-checks.yml`에 주간 cron(`17 6 * * 1`) `pnpm audit`을 두었다(주석: "근거: review/code/2026/07/14/08_25_10 security WARNING"). 그러나 그 job은 `pnpm audit`이라 pnpm 워크스페이스(`pnpm-lock.yaml`) 하나만 감사하며, `.claude/tools/mermaid-lint`는 별도의 독립 npm 프로젝트(자체 `package.json`+`package-lock.json`, pnpm-workspace 미포함)라 이 스캔의 시야 밖이다. Dependabot도 `github-actions` ecosystem만 구독해 이 트리를 건드리지 않는다. 결과적으로 위 항목의 두 CVE는 물론, 앞으로 이 트리에 새로 생길 어떤 CVE도 — 사람이 수동으로 `cd .claude/tools/mermaid-lint && npm audit`을 실행하지 않는 한 — **영구히 무신호(silent)** 상태로 남는다. 이 diff가 공들여 막고 있는 "부분 설치가 영원히 '정상'으로 오판되는" 문제와 정확히 같은 모양(신호 없는 영속적 결함)이 의존성-보안 축에서는 이미 실현돼 있다.
  - 제안: `deps-security-checks.yml`의 `audit` job 옆에 `.claude/tools/mermaid-lint`용 스텝(`npm audit --audit-level=moderate`, cwd=해당 디렉터리) 하나만 추가하거나, `paths`에 `.claude/tools/mermaid-lint/package*.json`을 추가해 최소한 PR 시점엔 감지되게 할 것. 기존 주간 cron 패턴을 그대로 재사용하면 신규 job 설계 없이 좁게 확장 가능.

- **[INFO]** `.githooks/pre-commit` 단독 수정 시 `harness-checks.yml` 미트리거 가능 — cross-language 바인딩 테스트가 항상 실행된다는 보장이 약함
  - 위치: `.github/workflows/harness-checks.yml:7-30`(`paths` 목록에 `.claude/hooks/**`·`.claude/tools/**`·`.claude/tests/**` 등은 있으나 `.githooks/**`가 없음)
  - 상세: `.githooks/pre-commit`은 `.claude/hooks/_lib/mermaid_lint_ready.py`가 정의한 마커명·CLI 계약에 의존하는데, 그 결속은 오직 `test_mermaid_lint_ready.py::ConsumerBindingTest::test_precommit_reads_via_the_shared_helper`(소스 텍스트에 `"mermaid_lint_ready.py"` 문자열이 있는지 assert)로만 지켜진다 — bash가 Python 상수를 import할 수 없어 불가피한 설계이고, 이 자체는 리포의 기존 관례(`test_doc_sync_matrix` 등)와 일치한다. 문제는 이 테스트가 `harness-checks.yml`을 통해서만 실행되는데, 그 `paths`엔 `.githooks/**`가 없다는 것이다. **이번 PR 자체는** `_lib/mermaid_lint_ready.py`·`bootstrap-session.sh`·테스트 파일들을 함께 건드려 CI가 정상 트리거되므로 즉시 영향은 없다. 다만 향후 `.githooks/pre-commit`만 단독 수정하는 PR(예: mermaid 검사 블록만 손보는 변경)이 생기면 이 워크플로 자체가 아예 안 돌아 드리프트 감지가 조용히 빠질 수 있다 — 이 리포가 `.claude/commands/**`·`.claude/workflows/**`를 같은 이유로 이미 `paths`에 명시적으로 추가해 온 것과 동일한 클래스의 갭.
  - 제안: `harness-checks.yml`의 `paths`에 `.githooks/**` 추가.

- **[INFO]** `package.json`의 `jsdom`/`mermaid` 버전이 여전히 `"*"`(무제한) — diff 밖, 이전 리뷰에서도 지적된 미해결 사항
  - 위치: `.claude/tools/mermaid-lint/package.json:10-13`
  - 상세: `package-lock.json`(lockfileVersion 3)이 `jsdom@29.1.1`/`mermaid@11.15.0`로 고정해 두어 오늘 당장 임의 버전이 당겨지지는 않지만, `package.json` 자체엔 상한이 전혀 없다. lock 파일이 재생성되는 경로(삭제, `npm update`, npm major 업그레이드로 인한 lockfile 비호환 재작성 등)가 생기면 그 순간 "*"가 곧바로 유효 범위가 되어 신뢰 불가능한 latest 버전을 그대로 설치할 수 있다. 이번 diff가 하드닝하는 설치 경로(마커·락·throttle)는 "언제 설치할지"만 정교하게 통제할 뿐, "무엇을 설치할지"의 상한은 여전히 없다.
  - 제안: `package.json`에 실제 semver 범위(예: `"jsdom": "^29.1.1"`, `"mermaid": "^11.15.0"`)를 명시해 lock 파일과 무관하게 방어선을 하나 더 둘 것. 이번 PR 차단 사유는 아님(diff 밖 파일).

- **[INFO]** 라이선스 호환성 — 150개 전이 패키지 전수 확인, 문제 없음
  - 위치: `.claude/tools/mermaid-lint/package-lock.json`
  - 상세: `jsdom@29.1.1`·`mermaid@11.15.0` 및 전이 의존(총 150개) 라이선스 히스토그램은 MIT 97 · ISC 34 · BSD-3-Clause 8 · Apache-2.0 2 · MIT-0 2 · BSD-2-Clause 2 · `(MPL-2.0 OR Apache-2.0)` 1 · BlueOak-1.0.0 1 · CC0-1.0 1 · Unlicense 1 — 전부 permissive/약한-copyleft(MPL, 파일단위)라 이 리포(루트 `LICENSE` = AGPL-3.0, `CLA.md`/`LICENSE-COMMERCIAL.md` 병존하는 dual-license 구조)와 결합 문제가 없다. 딱 하나 lockfile 메타데이터상 `license` 필드가 비어 있던 `khroma@2.1.0`(mermaid의 전이 의존, `node_modules/khroma/package.json`엔 필드 없음)은 실제 설치 트리의 `node_modules/khroma/license` 파일을 직접 열어 MIT 임을 확인했다(단순 lockfile 메타데이터 누락, 실제 라이선스 이슈 아님). 어차피 이 도구는 `codebase/backend`·`codebase/frontend`로 배포되는 제품 코드가 아니라 로컬 devtool(`.claude/tools/`)이라 AGPL의 배포/네트워크-제공 트리거 자체가 해당하지 않는다.
  - 제안: 조치 불필요(참고 확인 완료).

- **[INFO]** 신규/불필요 의존성 없음 + harness Python "zero third-party dependency" 규약 전수 준수 (positive)
  - 위치: 리뷰 대상 6개 파일 전체, 대조: `.claude/tests/README.md`("the harness convention that its Python carries zero third-party dependencies — hooks must run on a bare `python3`")
  - 상세: `_lib/mermaid_lint_ready.py`는 `os`/`sys`만, `lint_mermaid_posttooluse.py`는 `json`/`os`/`re`/`subprocess`/`sys`(+ 내부 `_lib` 모듈)만, 두 테스트 파일은 `unittest`류 stdlib(+ 내부 `_harness` 헬퍼)만 import한다 — 전부 stdlib이며 신규 PyPI 패키지가 전혀 추가되지 않았다. `jsdom`/`mermaid`라는 실제 외부 의존성은 `.claude/tools/mermaid-lint/`라는 격리된 Node 서브프로젝트 안에만 존재하고, Python 훅 체인의 import 그래프로는 절대 새지 않는다 — 이 diff가 만든 게 아니라 기존 구조를 그대로 보존한 것이지만, 명시된 리포 규약과 정확히 맞아떨어짐을 확인했다. 표준 라이브러리·기존 모듈로 대체 가능한 불필요한 신규 의존성도 없다 — mermaid 구문을 재구현(자체 파서 작성)하는 대신 실제 렌더러가 쓰는 것과 동일한 `mermaid.parse()`를 재사용하는 설계는 "단일 진실 소스"를 지키는 합리적 선택이다.
  - 제안: 조치 불필요(현행 유지 권장). 향후 이 경계(harness Python은 stdlib-only, npm 의존은 `.claude/tools/mermaid-lint/`에만 격리)를 깨는 변경이 있다면 그 자체를 이 규약 위반으로 다뤄야 함.

- **[INFO]** 의존성 크기·설치 시간 — 150개 전이 패키지, `npm install` 자체엔 타임아웃 없음
  - 위치: `.claude/tools/bootstrap-session.sh:367`(`npm install --no-fund --no-audit --silent`, 타임아웃 래핑 없음) vs. `lint_mermaid_posttooluse.py:137`(`_NODE_TIMEOUT = 20.0`, 실제 린터 실행엔 타임아웃 있음)
  - 상세: `jsdom`+`mermaid`는 d3·cytoscape·katex·dompurify·roughjs·undici·css-tree 등 총 150개 전이 패키지를 끌어온다. 이번 diff의 마커+락 설계 덕에 메인 체크아웃당 정확히 1회만 설치되므로 제품 번들 크기·빌드 시간에는 영향이 없다(완전히 격리된 devtool 트리). 다만 그 1회 설치 자체엔 시간 상한이 없어, 네트워크가 느리거나 레지스트리가 불안정하면 그 세션의 부트스트랩이 (다른 세션을 막지는 않지만) 스스로는 무기한 대기할 수 있다 — 같은 파일이 `node` 린터 실행에는 20초 타임아웃을 엄격히 두고 있는 것과 비대칭적이다.
  - 제안: 참고용. 필요하면 `npm install`에도 (macOS엔 `timeout`이 기본 없으므로) `npm install --fetch-timeout=<n>` 류 npm 자체 옵션이나 백그라운드+워치독 패턴으로 상한을 둘 수 있으나, 현재 락 설계(살아있는 느린 설치는 훔치지 않음)와 상충하지 않게 설계해야 하므로 이번 PR 필수 사항은 아님.

## 요약

이번 diff의 6개 파일 자체는 신규 외부 패키지를 추가하지 않고, harness Python의 "zero third-party dependency" 규약도 전수 준수한다. 다만 diff의 실질 대상인 mermaid-lint 설치 경로를 실측한 결과, 그 npm 트리(`jsdom`+`mermaid`, 150개 전이 패키지)에는 이미 실제 취약점 2건(dompurify moderate, undici **high**)이 존재하며, 이 리포가 pnpm 워크스페이스에는 이미 갖춰 둔 주간 `npm/pnpm audit` 안전망이 이 디렉터리에는 구조적으로 미치지 않아(dependabot도 마찬가지) 향후 신규 CVE도 계속 무신호로 남을 것으로 보인다 — 실사용 경로(파싱 전용, 렌더/네트워크 미실행)상 당장의 악용 가능성은 낮지만, 이 PR이 공들여 없애는 "신호 없는 영속적 결함" 패턴이 의존성-보안 축에서는 이미 실현돼 있다는 점에서 기록해 둘 가치가 있다. 그 외 라이선스는 150개 패키지 전수 확인 결과 전부 permissive(1건 lockfile 메타데이터 누락은 실측으로 MIT 확인)라 문제 없고, `package.json`의 미고정 버전(`"*"`)은 이전 리뷰가 이미 지적한 diff 밖 미해결 사항으로 재확인했다. 종합하면 CRITICAL은 없고, 실질 차단 사유도 없다.

## 위험도

MEDIUM

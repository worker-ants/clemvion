# 의존성(Dependency) 리뷰 — mermaid-lint undici/dompurify 취약점 fix + Dependabot 편입

## 검증 방법

다음은 diff 텍스트를 읽는 데 그치지 않고, 실제 worktree
(`/Volumes/project/private/clemvion/.claude/worktrees/mermaid-lint-undici-vuln-2956f1`)에서
직접 재현·교차검증한 결과다.

- `npm ls undici` / `npm ls dompurify` — 실제 의존 체인 확인
- `npm audit` — fix 후 취약점 0건 재현
- 구 lockfile(`git show HEAD~1:...package-lock.json`)을 복원해 `npm audit --package-lock-only`
  재실행 — commit 메시지가 주장한 "undici HIGH 7건·dompurify moderate 3건"을 독립 재현
- `registry.npmjs.org`에서 undici@7.28.0·dompurify@3.4.12의 공식 `dist.integrity`를 조회해
  lockfile의 integrity 해시와 바이트 단위 대조 (supply-chain 무결성)
- jsdom/mermaid의 `package.json`에 선언된 undici/dompurify semver range와 새 버전이 만족하는지 확인
- `lint-mermaid.mjs`를 실제로 실행해 정상/malformed mermaid 블록에 대해 exit 0/1 스모크 테스트
- `.github/workflows/deps-security-checks.yml`의 path filter를 읽어 "이 npm 트리는 기존 보안
  스캔에서 빠져 있었다"는 커밋 근거가 사실인지 확인

## 발견사항

- **[INFO]** 새 의존성 없음 — 순수 lockfile 전용 취약점 패치
  - 위치: `.claude/tools/mermaid-lint/package-lock.json`
  - 상세: `undici`(jsdom의 transitive dep)와 `dompurify`(mermaid의 transitive dep) 둘 다 기존에
    이미 존재하던 간접 의존성이며, `package.json`의 직접 의존성(`jsdom`, `mermaid`) 목록은
    무변경이다. `npm ls`로 확인: `undici`←`jsdom@29.1.1`, `dompurify`←`mermaid@11.15.0`.
    새 top-level 패키지 추가·불필요 의존성 도입 모두 해당 없음.
  - 제안: 없음 (조치 불요)

- **[INFO]** 취약점 수정 — 주장된 CVE 건수·심각도를 독립 재현해 정확함을 확인
  - 위치: `.claude/tools/mermaid-lint/package-lock.json` (undici 7.27.0→7.28.0, dompurify
    3.4.7→3.4.12)
  - 상세: 구 lockfile을 복원해 `npm audit --package-lock-only`를 재실행한 결과:
    - `undici@7.27.0`: advisory 7건(aggregate **high**) — GHSA-vmh5-mc38-953g(SOCKS5 프록시
      TLS 인증서 검증 우회, high), GHSA-vxpw-j846-p89q(WebSocket DoS, high),
      GHSA-hm92-r4w5-c3mj(SOCKS5 pool 재사용을 통한 cross-origin 요청 라우팅, high),
      GHSA-p88m-4jfj-68fv(Set-Cookie 헤더 인젝션, moderate),
      GHSA-pr7r-676h-xcf6(캐시 화이트스페이스 우회를 통한 정보 노출, moderate),
      GHSA-35p6-xmwp-9g52·GHSA-g8m3-5g58-fq7m(low) — commit 메시지의 "HIGH 7건"과 정확히 일치.
    - `dompurify@3.4.7`: advisory 3건(aggregate **moderate**) — GHSA-cmwh-pvxp-8882
      (`ALLOWED_ATTR` pollution, moderate), GHSA-vxr8-fq34-vvx9·GHSA-gvmj-g25r-r7wr(low) —
      "moderate 3건"과 일치.
    - Fix 후 실제 worktree에서 `npm audit` 재실행 → `found 0 vulnerabilities`. 두 패키지
      모두 `fixAvailable: true`(boolean, `isSemVerMajor` 아님) — `--force` 없는 순수
      semver-호환 업그레이드였음도 확인.
  - 제안: 없음 — 수정이 정확하고 완결됨. 참고로 이 도구는 로컬 markdown의 mermaid 블록을
    parse-only로 정적 검사하는 harness CLI라(원격 fetch를 트리거하지 않음) 실제 익스플로잇
    가능성은 낮았지만, HIGH 등급 CVE를 lockfile-only·breaking-없음 비용으로 닫은 것은 정당한
    선제 조치.

- **[INFO]** 무결성(integrity) 해시 — 레지스트리 공식 메타데이터와 바이트 단위 일치, supply-chain 이상 없음
  - 위치: `package-lock.json`의 `resolved`/`integrity` 필드
  - 상세: `registry.npmjs.org/undici/7.28.0`·`registry.npmjs.org/dompurify/3.4.12`의
    `dist.integrity`를 직접 조회해 lockfile 값과 대조 — 둘 다 완전히 동일
    (`sha512-cRZYrTDwWznlnRiPjggAGxZXanty6M8RV1ff8Wm4LWXBp7/IG8v5DnOm74DtUBp9OONpK75YlPnIjQqX0dBDtA==`,
    `sha512-zQvGet8Z2sWbQhCmfFz/T5QWH2oBmjnqK3qvOjaqaNLrLEF912WamU+ohnTp0TCep/MFVHpdJuCZEdFOdTnEFg==`).
    타이포스쿼팅·변조된 tarball 치환 정황 없음.
  - 제안: 없음

- **[INFO]** 라이선스 — 변경 없음, 호환성 문제 없음
  - 위치: `package-lock.json`의 `license` 필드(두 hunk 모두 diff 컨텍스트 라인으로 그대로 유지)
  - 상세: `dompurify`="(MPL-2.0 OR Apache-2.0)", `undici`="MIT" — 버전만 올라갔을 뿐 라이선스
    선언 자체는 diff에서 건드리지 않았다(신규 패키지가 아니므로 신규 라이선스 유입도 없음).
    둘 다 permissive 계열로 프로젝트 라이선스(AGPL-3.0, `LICENSE` 확인)와 충돌 없음 — 게다가
    이 트리는 `.claude/tools/` 하위 harness lint 스크립트로 배포되는 제품 코드가 아니라
    로컬 git hook/CLI 전용이라 애초에 배포 라이선스 전이 이슈 자체가 발생하지 않는다.
  - 제안: 없음

- **[INFO]** semver 호환성 — 두 버전 모두 부모 패키지가 선언한 range 내부, breaking 없음
  - 위치: `node_modules/jsdom`(undici 의존 range `^7.25.0`), `node_modules/mermaid`(dompurify
    의존 range `^3.3.1`)
  - 상세: `undici@7.28.0`은 `^7.25.0`을, `dompurify@3.4.12`는 `^3.3.1`을 만족 — 부모 패키지의
    선언된 semver 계약을 벗어나지 않는 정상적인 patch/minor 업그레이드. `undici`의
    `engines.node: ">=20.18.1"`는 diff 컨텍스트 라인(변경 전부터 존재)이라 이번 bump로 새로
    생긴 제약이 아니며, 저장소 `.nvmrc`(24)·`harness-checks.yml`(node 22) 모두 이를 만족한다.
    실제로 `lint-mermaid.mjs`를 정상/malformed mermaid 픽스처로 재실행해 exit 0/1 동작이
    보존됨을 확인 — 기능 회귀 없음.
  - 제안: 없음

- **[INFO]** 의존성 크기·빌드 시간 영향 — 사실상 0
  - 위치: `package-lock.json`
  - 상세: `npm ls`로 두 패키지의 하위 트리를 확인한 결과 신규 서브 의존성 추가 없음
    (`undici`는 자체 의존성 0개, `dompurify`는 기존과 동일한 `optionalDependencies`
    `@types/trusted-types`만 유지). 이 트리는 브라우저로 배포되는 번들이 아니라 커밋 시점에
    실행되는 Node CLI(harness lint 훅)라 "번들 크기" 개념 자체가 적용되지 않고, 빌드/CI 시간
    영향도 2줄짜리 lockfile diff 수준으로 무시 가능.
  - 제안: 없음

- **[INFO]** 내부 의존성 — Dependabot 커버리지 갭이 실재했음을 확인, 등록은 정확·최소 범위
  - 위치: `.github/dependabot.yml` (신규 `package-ecosystem: "npm"`,
    `directory: "/.claude/tools/mermaid-lint"` 엔트리)
  - 상세: `.github/workflows/deps-security-checks.yml`의 `paths` 필터를 직접 읽어 확인한 결과
    `pnpm-workspace.yaml`·`pnpm-lock.yaml`·루트 `package.json`·`codebase/**/package.json`만
    감시하고 `.claude/tools/mermaid-lint/**`는 대상 밖이다. 게다가 `bootstrap-session.sh:99`가
    `npm install --no-fund --no-audit --silent`로 설치 시점 audit 신호까지 억제한다 — 즉
    "이 npm 트리는 등록 전까지 영구 무신호였다"는 commit/plan의 근거는 fabricated rationale이
    아니라 실측 사실이다(메모리의 "Rationale 기각된 대안은 실제 이력 필수" 원칙과 정합).
    새 엔트리는 YAML 문법 유효(PyYAML로 파싱 검증)하고 `package-ecosystem: "npm"`으로
    이 트리의 실제 패키지 매니저(독립 npm 트리, pnpm 워크스페이스 밖)와 정확히 일치 —
    나머지 모노레포가 pnpm임에도 이 엔트리만 npm으로 등록한 것은 혼동이 아니라 올바른 선택.
    기존 `github-actions` 엔트리와 중복·충돌 없음.
  - 제안: 없음 — 등록은 그대로 유효. (참고: Dependabot *version* update는 주 1회
    스케줄이라 최신 CVE가 최대 1주 지연 노출될 수 있으나, 기존 `github-actions` 엔트리와
    동일 cadence라 이 PR이 새로 만든 특이점은 아니다.)

- **[INFO]** (참고, 이 diff의 범위 밖) `package.json`의 `jsdom`/`mermaid` 의존성 range가 `"*"`
  - 위치: `.claude/tools/mermaid-lint/package.json:11-12` (이번 diff가 건드리지 않은 파일)
  - 상세: 직접 의존성 range가 와일드카드라 버전 고정의 실질적 backstop은 오직
    `package-lock.json`(정확한 버전 + integrity 고정, 이번에도 정상 유지됨)뿐이다. lockfile이
    보존되는 한 `npm install`은 결정적이지만, 향후 누군가 lockfile을 삭제하고 재생성하거나
    `npm update`/`npm install jsdom@latest`류를 실행하면 메이저 업그레이드가 무경고로 유입될
    여지가 있다. 이번 diff가 만든 문제도 아니고 이번 diff가 넓히는 문제도 아니므로 차단 사유는
    아니다.
  - 제안: (별건, 우선순위 낮음) 여유가 있을 때 `jsdom`/`mermaid`에 `^` range를 명시해 재현성을
    한 단계 더 강화하는 것을 고려. 지금 이 PR에서 요구하지는 않음.

- **[INFO]** plan 문서(`plan/in-progress/harness-guard-followups.md`) §F 체크리스트 갱신 — 실제
  변경과 일치
  - 위치: `plan/in-progress/harness-guard-followups.md` §F, 체크리스트, `git show HEAD --stat`
  - 상세: "undici 7.27.0→7.28.0(HIGH 7건), dompurify 3.4.7→3.4.12(moderate 3건) →
    0 vulnerabilities"라는 문서 서술을 위에서 독립 재현으로 확인했고, `git show --stat`으로
    실제 커밋이 정확히 이 3개 파일(package-lock.json/dependabot.yml/plan md)만 건드렸음을
    확인 — 과대 서술(overclaiming) 없음.
  - 제안: 없음

## 요약

`.claude/tools/mermaid-lint` 독립 npm 트리에서 `undici`(jsdom의 transitive dep, HIGH 등급
advisory 7건: SOCKS5 TLS 인증서 검증 우회·WebSocket DoS·cross-origin 요청 라우팅 등)와
`dompurify`(mermaid의 transitive dep, moderate 등급 advisory 3건: `ALLOWED_ATTR` pollution 등)
를 `npm audit fix`로 lockfile 전용 패치한 변경이다. 신규 의존성 추가·package.json range 변경·
라이선스 변경이 전혀 없는 순수 취약점 패치이며, 실제 worktree에서 `npm ls`/`npm audit`/레지스트리
integrity 대조/semver range 검증/기능 스모크테스트를 모두 독립 재현해 commit·plan 문서의 모든
정량적 주장(advisory 건수, 심각도, "0 vulnerabilities", 기능 무회귀)이 정확함을 확인했다.
동반된 `.github/dependabot.yml` 변경은 이 npm 트리가 기존 `deps-security-checks.yml`(pnpm 전용
path filter로 확인)과 `--no-audit` 설치 플래그(bootstrap-session.sh) 양쪽에서 실제로
"영구 무신호" 상태였다는 근거를 실측으로 뒷받침하며, `package-ecosystem: "npm"` 등록이 이
트리의 실제 패키지 매니저와 정확히 일치해 향후 신규 CVE에 대한 자동 커버리지 갭을 정당하게
해소한다. 의존성 관점에서 이 변경이 새로 도입하는 리스크는 없으며, 사전 존재하던 리스크
(취약 패키지, 무신호 스캔 커버리지)를 순감소시킨다. `package.json`의 `"*"` 와일드카드
range는 이 diff 밖의 pre-existing 조건으로 별도 저우선 후속 과제로만 남긴다.

## 위험도

NONE

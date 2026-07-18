# Security 리뷰: mermaid-lint undici/dompurify 취약점 해소 + Dependabot npm 편입

리뷰 대상: `.claude/tools/mermaid-lint/package-lock.json`, `.github/dependabot.yml`,
`plan/in-progress/harness-guard-followups.md` (커밋 `02d69e324`)

## 검증 방법

주장(커밋 메시지: undici HIGH 7건·dompurify moderate 3건 → 0)을 신뢰하지 않고 라이브 npm 레지스트리로
직접 재현·검증했다.

1. 변경 전 lockfile(부모 커밋)로 `npm audit --json` 실행 → 독립 재현 결과:
   - `undici` **high**: TLS certificate validation bypass via dropped requestTls in SOCKS5 ProxyAgent,
     HTTP header injection via Set-Cookie percent-decoding, WebSocket DoS via fragment count bypass,
     cross-origin request routing via SOCKS5 proxy pool reuse, HTTP response queue poisoning via
     keep-alive socket reuse, Set-Cookie SameSite downgrade via permissive substring matching,
     cross-user information disclosure via shared cache whitespace bypass (7건, 커밋 메시지와 일치)
   - `dompurify` **moderate**: Trusted Types policy survives `clearConfig()`, SAFE_FOR_TEMPLATES bypass
     in `<template>` DOM output, `ALLOWED_ATTR` pollution via `setConfig()`(3.4.7 훅 클론가드 우회) — 3건,
     커밋 메시지와 일치
2. 변경 후(현재 워크트리) `npm audit --json` → `{"vulnerabilities": {}, "total": 0}` 확인
3. 커밋된 `package-lock.json` 을 `package.json` + 기존 lockfile 로부터 `npm install
   --package-lock-only` 로 재생성 → 커밋본과 **byte-identical**. resolved URL(registry.npmjs.org)·
   integrity(sha512) 해시가 실제 레지스트리 응답과 정확히 일치 — 수동 편집·타이포스쿼팅 치환 등
   lockfile 변조 흔적 없음
4. `npm config get registry` → `https://registry.npmjs.org/` (사설/프록시 미러 아님, 공식 레지스트리)

## 발견사항

- **[INFO]** 의존성 버전 상향이 실제 CVE 를 해소함을 라이브 재현으로 확인(검증 방법 §1-2 참고)
  - 위치: `.claude/tools/mermaid-lint/package-lock.json` (`undici` 7.27.0→7.28.0, `dompurify`
    3.4.7→3.4.12)
  - 상세: 커밋 메시지가 주장한 취약점 개수·심각도가 독립 audit 재현과 정확히 일치했고, 변경 후
    0 vulnerabilities 도 확인했다. `package.json` 의 의존성 range(`"jsdom": "*"`, `"mermaid": "*"`)는
    무변경이라 lockfile 갱신만으로 breaking 없이 해소됨. OWASP A06:2021(Vulnerable and Outdated
    Components) 정정 조치로 타당하다.
  - 제안: 없음(이미 올바르게 조치됨)

- **[INFO]** 신규 Dependabot npm ecosystem 등록은 리액티브(주간)이며, 이 트리에 새 의존성이 추가되는
  시점을 선제 차단하는 PR 게이트는 없음
  - 위치: `.github/dependabot.yml` (`directory: "/.claude/tools/mermaid-lint"`)
  - 상세: 기존 `deps-security-checks.yml`(pnpm audit)의 `pull_request.paths` 트리거를 확인한 결과
    `pnpm-workspace.yaml`/`pnpm-lock.yaml`/루트 `package.json`/`codebase/**/package.json` 만
    스캔하며 `.claude/tools/mermaid-lint/**` 는 대상 밖이다 — 커밋이 서술한 "pnpm 워크스페이스 밖이라
    영구 무신호였다"는 진단은 실측과 일치한다. 이번 Dependabot 등록으로 갭은 좁아지지만, Dependabot
    security update 는 (a) 주간 스케줄이라 신규 CVE 공시 후 최대 ~1주 반응 지연이 있고 (b) 누군가
    `mermaid-lint/package.json` 에 신규 취약 의존성을 수동 추가하는 PR 자체를 막지는 못한다(사후
    탐지만). pnpm 워크스페이스의 `audit` job 처럼 PR 시점에 즉시 차단하는 능동 게이트는 아니다.
  - 제안: 이미 plan Rationale(`harness-guard-followups.md` §F)에 "CI job 복잡도 없음"이라는 트레이드오프로
    의식적으로 기록되어 있어 이번 PR 을 막을 사유는 아니다. 이 npm 트리가 dev 도구용(로컬 markdown
    정적 파싱, 아웃바운드 네트워크 호출 없음)이라는 낮은 노출도를 감안하면 현재 선택은 합리적이다.
    향후 이 트리가 커지거나 신뢰 경계가 바뀌면(§G 관련) `pnpm audit` 방식처럼 PR 시점 능동 게이트
    추가를 재고할 것.

- **[INFO]** `package.json` 의 `jsdom`/`mermaid` 의존성이 버전 미고정(`"*"`) — 이번 diff 가 도입한
  문제는 아니며 범위 밖(pre-existing)
  - 위치: `.claude/tools/mermaid-lint/package.json:11-12`
  - 상세: `"*"` 는 향후 `package-lock.json` 없이 `npm install` 하면 임의 최신 메이저를 받아들인다는
    뜻이라, 실질적 버전 고정은 lockfile 이 유일한 SoT 다. 이번 PR 은 lockfile 만 갱신했으므로 이
    구조 자체를 바꾸지 않았고 지적 대상도 아니다 — 리뷰 완전성을 위해 인접 컨텍스트로만 기록.
  - 제안: 조치 불요(이번 diff 범위 밖). 필요 시 별건으로 `package.json` range 명시 고려.

- **[INFO]** 하드코딩 시크릿·인증정보 없음
  - 위치: 3개 파일 전체
  - 상세: lockfile 의 `integrity` 필드는 공개 npm 패키지의 sha512 해시(비밀 아님)이고 정상 포맷.
    `dependabot.yml`·plan 문서 변경분에 토큰/자격증명 없음.

## 요약

이번 변경은 `.claude/tools/mermaid-lint` 독립 npm 트리(pnpm 워크스페이스 보안 스캔·Dependabot 어디에도
안 걸려 있던 사각지대)에서 실제로 존재하던 `undici` HIGH 취약점 7건(TLS 인증서 검증 우회·HTTP 헤더
인젝션·프록시 풀 재사용을 통한 cross-origin 라우팅 등)과 `dompurify` moderate 취약점 3건(Trusted
Types/SAFE_FOR_TEMPLATES 새니타이징 우회)을 해소하는 순수 방어적 조치다. 커밋 메시지의 주장을 그대로
믿지 않고 부모 커밋 lockfile 로 `npm audit` 를 라이브 재현해 취약점 목록·개수가 정확히 일치함을
확인했고, 변경 후 0 vulnerabilities 도 재현했으며, 커밋된 lockfile 이 `npm install
--package-lock-only` 재생성 결과와 byte-identical 함을 확인해 수동 변조·타이포스쿼팅 치환 가능성도
배제했다. 새로 추가된 Dependabot npm ecosystem 등록은 이 트리를 향후 자동 스캔 대상에 편입시키는
정당한 구조 개선이며, 유일한 잔여 갭(리액티브·주간 스케줄이라 PR 시점 능동 차단은 아님)은 plan
Rationale 에 이미 의식적 트레이드오프로 문서화되어 있고 이 도구의 낮은 노출도(로컬 정적 파싱,
아웃바운드 네트워크 없음)를 고려하면 현재로선 수용 가능하다. 새로 도입된 취약점이나 하드코딩 시크릿,
인증/인가·인젝션 문제는 발견되지 않았다.

## 위험도
NONE

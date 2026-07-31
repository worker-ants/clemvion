# 의존성(Dependency) 리뷰 — audit-residual (pnpm audit 잔여 17건 정리)

## 발견사항

- **[WARNING]** `CVE-2026-14257` 의 ignoreCves 주석이 다른 CVE 를 설명한다 (복붙 오류)
  - 위치: `scripts/check-pnpm-security-config.py:77`
  - 상세: `EXPECTED_IGNORED_CVES` 에 신규 추가된 `"CVE-2026-14257"` 항목의 인라인 주석이
    `# js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.` 로 되어 있다. 이는 바로 위
    `CVE-2026-53550`(js-yaml, moderate) 을 설명하는 주석이며, `CVE-2026-14257` 은 실제로는
    **brace-expansion 무한 확장 DoS/OOM, high(CVSS 7.5)**, 경로도 `@eslint/eslintrc`·`jest` 계열이다
    — `pnpm-workspace.yaml` 의 `auditConfig.ignoreCves` 주석(76~87행) 및
    `plan/in-progress/audit-residual-triage.md` §1.3 과 명백히 불일치한다. 실제 파일을 열어 재확인함
    (`Read`/`grep` 으로 76~77행 대조).
    기능적으로는 `EXPECTED_IGNORED_CVES` 가 `set` 이라 문자열 값(“CVE-2026-14257”)만 비교되므로
    config-guard 판정 자체는 영향받지 않는다(직접 재실행해 `OK` 확인). 다만 이 파일의 존재 목적이
    "근거를 남겨 다음 사람이 재조사하지 않게" 하는 것인데, 정작 이 주석은 심각도(high→moderate 오인)와
    영향 패키지를 모두 틀리게 안내해 그 목적을 정면으로 해친다.
  - 제안: 주석을 `# brace-expansion 무한 확장 DoS/OOM, eslintrc/jest 경로, high(CVSS 7.5).` 류로
    정정. `pnpm-workspace.yaml` 의 상세 주석과 완전히 동기화하지 않더라도 최소한 CVE 성격(패키지·심각도)만은
    일치시켜야 한다.

- **[WARNING]** 신규 override 2건이 직접 소비처가 선언한 호환 범위를 벗어난 major 상향을 강제한다
  - 위치: `pnpm-workspace.yaml:45`(`"@hono/node-server": ^2.0.5`), `pnpm-workspace.yaml:48`(`sharp: ^0.35.0`)
    — 대응 baseline: `scripts/check-pnpm-security-config.py:57`, `scripts/check-pnpm-security-config.py:60`
  - 상세: 실제 설치 트리에서 직접 확인한 결과:
    - `@modelcontextprotocol/sdk@1.29.0`(backend 직접 의존)의 자체 `package.json` 은
      `"@hono/node-server": "^1.19.9"` 를 선언한다. 그런데 workspace override 는 `^2.0.5` 를 강제해
      lockfile 상 `1.19.14 → 2.0.12`(**major 1→2**)로 상향된다. SDK 가 스스로 선언한 호환 범위 밖이다.
    - `next@16.2.11` 의 `optionalDependencies` 는 `"sharp": "^0.34.5"` 를 선언한다(0.x semver 라 캐럿이
      `<0.35.0` 로 상한을 건다). override 는 `^0.35.0` 을 강제해 `0.34.5 → 0.35.3` 으로 그 상한을 넘는다.
    - plan 문서의 Rationale(`plan/in-progress/audit-residual-triage.md:131-133`)은 "왜 major 점프를
      피했나" 를 `protobufjs`·`fast-uri`·`linkify-it` 3건만 들어 설명하는데, 실제 diff 에서 major(또는
      0.x 유사-major) 경계를 넘는 것은 이 2건(`@hono/node-server`, `sharp`)이며 서술에서 빠져 있다.
    - 완화 근거(직접 검증): `@hono/node-server` 는 `codebase/backend/src/modules/mcp/mcp-client.service.ts`
      가 `@modelcontextprotocol/sdk/client/*` 서브모듈만 import 하고 `/server/*` 는 저장소 전체에서
      import 되지 않아, v2 API 는 현재 도달 불가능한 경로다(리스크는 낮지만 향후 서버 기능을 추가하면
      드러날 수 있는 잠재 함정). 반면 `sharp` 는 `codebase/frontend/src/app/(main)/w/[slug]/profile/security/page.tsx`
      가 `next/image` 를 사용해 실제 런타임(이미지 최적화 파이프라인)에 걸려 있다 — 이쪽은 완화 근거가
      "빌드+e2e(260/260) 통과" 뿐이며, e2e 가 해당 페이지의 이미지 렌더링을 구체적으로 커버하는지는
      본 리뷰에서 확인하지 못했다. Node 엔진 요건(`@hono/node-server`≥20, `sharp`≥20.9.0)은 이 저장소가
      `>=24` 를 전역 고정하고 있어 문제되지 않는다(package.json/.nvmrc/Dockerfile/CI 전부 24 확인).
  - 제안: 두 항목 모두 실제로 문제없이 동작함을 최소 1회 명시적으로 검증(예: `next start` 로 해당 보안
    설정 페이지의 아바타/이미지 최적화 응답을 직접 확인, 또는 e2e 스펙에 해당 페이지 방문 확인)하고,
    plan 의 Rationale 에 이 2건도 "major/0.x 경계를 넘었지만 왜 허용 가능한지" 를 명시적으로 추가한다.
    (다른 16건과 달리 이 2건은 "patch 요건이 현재 major 안" 논리가 적용되지 않는 예외이므로).

- **[INFO]** 신규 의존성 없음 · 라이선스 충돌 없음
  - 위치: `pnpm-workspace.yaml:45-53` (신규 override 9건 전체)
  - 상세: 이번 변경은 새 패키지를 그래프에 추가하는 것이 아니라 **이미 존재하던 전이/선택적 의존성**의
    버전 하한을 pnpm override 로 강제하는 것뿐이다(`sharp`·`@hono/node-server`·`svgo`·`linkify-it`·
    `@opentelemetry/propagator-jaeger`·`js-yaml`·`brace-expansion` 모두 diff 이전 lockfile 에 이미
    존재). `npm view <pkg> license` 로 13개 패키지 전수 확인한 결과 전부 MIT/Apache-2.0/BSD-3-Clause 등
    permissive 라이선스로, 프로젝트와 호환되지 않는 라이선스(GPL/AGPL 계열 등)는 없다.

- **[INFO]** 버전-레인지 스코프 override 의 경계가 실제 lockfile 과 정확히 일치함을 확인
  - 위치: `pnpm-workspace.yaml:50-53` (`js-yaml@>=4.0.0 <4.3.0`, `js-yaml@>=3.0.0 <3.15.0`,
    `brace-expansion@<2.0.0`, `brace-expansion@>=3.0.0 <5.0.8`)
  - 상세: diff 전후 `pnpm-lock.yaml` 스냅샷을 직접 대조했다. `js-yaml` 은 상향 대상(3.14.2, 4.2.0)만
    사라지고 이미 패치된 형제 버전(3.15.0, 4.3.0)은 건드리지 않는다. `brace-expansion` 도 마찬가지로
    1.x(1.1.15→1.1.18)·5.x(5.0.6→5.0.9) 만 이동하고, 수용 대상인 2.1.4(§1.3 ignoreCves)는 두 스코프
    어디에도 걸리지 않아 의도대로 보존된다. `npm view brace-expansion versions` 로 재확인한 결과
    1.x/2.x 계열의 실제 최신판도 plan 문서의 주장(1.1.18 / 2.1.4)과 정확히 일치했다. 기존
    `undici@>=7.0.0 <7.28.0` 선례와 문법이 일관된다.

- **[INFO]** `@opentelemetry/core` 가 두 버전(2.8.0 / 2.10.0)으로 공존하게 됨 — 경미한 크기 증가
  - 위치: `pnpm-lock.yaml:2509`(신규 `@opentelemetry/core@2.10.0` 스냅샷), 기존 `2.8.0` 은
    `pnpm-lock.yaml:2515` 부근에 그대로 잔존
  - 상세: `@opentelemetry/propagator-jaeger` 를 `2.8.0→2.10.0` 으로 올리며 그 의존인 `@opentelemetry/core`
    도 `2.10.0` 을 새로 resolve 했지만, `propagator-b3` 등 다른 소비처는 여전히 `2.8.0` 을 참조해 두
    버전이 node_modules 에 공존한다. `@opentelemetry/api`(전역 registry 충돌에 민감한 패키지)는
    `1.9.1` 단일 버전으로 유지되어 있어 실제 런타임 충돌(중복 등록 경고 등) 가능성은 낮다. 번들
    크기·설치 크기에 미미한 증가만 있다 — 조치 불요, 참고용.

- **[INFO]** `pnpm audit --audit-level=moderate` exit code 독립 재현 — 0 확인 (게이트 통과 주장 검증됨)
  - 위치: `pnpm-workspace.yaml:70-88` (`auditConfig.ignoreCves`), CI 트리거는
    `.github/workflows/deps-security-checks.yml:70-71`
  - 상세: CI 와 동일한 커맨드(`pnpm audit --audit-level=moderate`, `--json` 없이)를 직접 실행해
    `exit=0` 을 재확인했다. 다만 사람이 읽는 요약 텍스트는 `"2 vulnerabilities found. Severity: 2 high
    (1 ignored)"` 로 출력되어 언뜻 "아직 뭔가 남았나?" 로 오독하기 쉽다 — 두 findings 는 모두
    `CVE-2026-14257`(brace-expansion, 경로 2개)이며 ignoreCves 로 이미 수용된 동일 CVE 이므로 exit
    code 는 정상적으로 0 이다. 이는 pnpm CLI 자체의 리포팅 표현 방식이며 이 PR 의 결함은 아니다 — 다만
    향후 CI 로그를 읽는 사람이 혼동하지 않도록 알아두면 좋다.
  - 제안: 조치 불요(정보 제공 목적).

- **[INFO]** config-guard 3-place 동기화 및 baseline 수치 재검증 완료
  - 위치: `scripts/check-pnpm-security-config.py:37-78`, `pnpm-workspace.yaml:25-88`
  - 상세: `python3 scripts/check-pnpm-security-config.py` 직접 재실행 결과
    `OK: overrides 28건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 2건 baseline 일치` 로
    plan 문서의 "실측 검증" 섹션(93-98행) 과 정확히 일치했다. `pnpm install --frozen-lockfile` 도
    직접 재실행해 통과를 확인했다(manifest/lockfile 정합).

- **[INFO]** 내부 의존성(`@workflow/*` 워크스페이스 패키지) 변경 없음
  - 상세: 이번 diff 는 외부 전이 의존성의 override/lockfile 갱신에 한정되며, 프로젝트 내부 패키지 간
    의존 그래프(`codebase/packages/*`)에는 영향이 없다.

## 요약

새 패키지 도입 없이 기존 전이 의존성 13종의 버전 하한을 pnpm override 로 재조정하는 순수 보안 유지보수
PR 이다. 라이선스(전수 MIT/Apache-2.0/BSD-3), 버전-레인지 스코프의 정확성, `pnpm audit` exit code,
`check-pnpm-security-config.py` baseline 수치를 모두 독립적으로 재현·검증했고 전부 plan 문서의 주장과
일치했다 — 서술의 신뢰도는 높다. 다만 두 가지 실질 결함을 발견했다: (1) 신규 `ignoreCves` 항목
`CVE-2026-14257` 의 주석이 다른 CVE(js-yaml, moderate)를 설명하는 복붙 오류로, 보안 판단 이력 문서로서의
신뢰성을 해친다. (2) `@hono/node-server`·`sharp` 두 override 가 각각 직접 소비처(`@modelcontextprotocol/sdk`,
`next`)가 스스로 선언한 호환 버전 범위를 벗어나는 major(또는 0.x 유사-major) 상향을 강제하는데, plan 의
Rationale 은 이 두 건을 언급하지 않는다 — 직접 조사 결과 `@hono/node-server` 는 현재 도달 불가능한 코드
경로라 위험이 낮지만, `sharp` 는 `next/image` 실사용 경로에 걸려 있어 완화 근거가 "빌드+e2e 통과" 수준에
그친다. 둘 다 병합을 막을 CRITICAL 은 아니지만 병합 전 코멘트 정정과 sharp 경로의 명시적 동작 확인을
권장한다.

## 위험도

MEDIUM

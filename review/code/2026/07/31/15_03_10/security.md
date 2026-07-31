STATUS=success reviewer=security
===REPORT_MARKDOWN_BELOW===
# Security Review — pnpm audit 잔여 17건 정리 (audit-residual)

## 발견사항

- **[CRITICAL]** `ignoreCves`로 수용한 CVE-2026-14257(brace-expansion 무한확장 DoS, high/CVSS 7.5)의
  "두 경로 모두 dev 전용 전이 의존" 근거가 사실과 다르다 — 실측 결과 **프로덕션 의존성 경로**
  (`@nestjs-modules/mailer`)로도 동일 취약 패키지에 도달한다.
  - 위치: `pnpm-workspace.yaml:77-88` (핵심 주장은 82행 "두 경로 모두 **dev 전용 전이 의존**이다:",
    경로 나열은 83-84행, 근거는 85행). 동일 주장이 `plan/in-progress/audit-residual-triage.md:76`
    (경로 나열 79-80행, 근거 83-84행)에도 그대로 중복 기재.
  - 상세: 저장소 root에서 `pnpm audit --prod --json` (= `pnpm --filter=backend deploy --prod`
    가 만드는 프로덕션 이미지와 동일한 의존성 그래프만 조회, `codebase/backend/Dockerfile:64`)
    를 실행하면 문서에 없는 **세 번째 경로**가 나온다:
    `codebase__backend>@nestjs-modules/mailer>mjml>mjml-core>js-beautify>editorconfig>minimatch>brace-expansion`
    (advisory id 1124334, module `brace-expansion@2.1.4` — plan/워크스페이스가 추적 중인
    CVE-2026-14257과 동일 패키지·동일 취약 버전, `minimatch@9.0.9` 를 통해 도달. 이는 문서가 이미
    알고 있던 "jest 경로"의 `brace-expansion@2.1.4` 와 정확히 같은 버전이지만 **경유지가 다르다**).
    `@nestjs-modules/mailer`는 `codebase/backend/package.json:33`의 `"dependencies"`(28행~)
    항목이지 `devDependencies`(93행~)가 아니다 — 즉 프로덕션 이미지 node_modules 에 실제로 설치된다.
    문서가 근거로 든 "프로덕션 이미지에 jest/eslint 스택이 없다"(85행)는 이 경로와 무관한 진술이다
    (mjml/mailer는 jest도 eslint도 아니다). 재현: `pnpm audit --prod --json` 을 반복 실행해도
    (2회) 동일하게 재현되어 네트워크 플레이키에 의한 우연이 아님을 확인. 참고로 CI가 실제로 실행하는
    커맨드인 flag 없는 기본 `pnpm audit`(`.github/workflows/deps-security-checks.yml:71`)로는 이
    경로가 전혀 나타나지 않는다(`--prod`/기본 모드가 서로 다른 action 집합을 반환하는 pnpm 자체의
    리포팅 특성으로 보이며 원인은 불명) — 즉 저자의 "실측 검증" 커맨드(`pnpm audit
    --audit-level=moderate`, flag 없음)로는 이 경로의 존재를 원천적으로 알 수 없었다.
    다만 실런타임 도달 가능성은 낮아 보인다: `codebase/backend/src/modules/mail/mail.module.ts`의
    `MailerModule.forRootAsync(...)` 는 `template`/adapter 옵션을 전혀 설정하지 않는다 — 즉 현재
    코드는 MJML(또는 다른) 템플릿 어댑터를 활성화하지 않고 순수 SMTP transport만 사용한다(grep 결과
    `codebase/backend/src` 어디에도 "mjml" 참조 없음). 그럼에도 `mjml`·`js-beautify`·`editorconfig`
    ·`brace-expansion` 은 `@nestjs-modules/mailer` 자신의 package.json이 일반 `dependencies`로
    선언하므로 실사용 여부와 무관하게 프로덕션 이미지에 물리적으로 설치된다 — SBOM/이미지 스캐너는
    이를 "프로덕션에 없음"이 아니라 "프로덕션에 있음"으로 잡는다. 이 CVE 자체는 이 PR이 새로 만든
    게 아니라 이미 있던 것이지만, 이 PR이 하는 일은 정확히 "audit 게이트가 이 CVE로 인해 붉었던
    상태" → "`ignoreCves`로 공식 수용해 초록으로 만드는 것"이다. 그 공식 수용의 근거 문서(사유·영향
    경로·해소 조건을 요구하는 이 저장소 자신의 정책, `scripts/check-pnpm-security-config.py:17-18`
    참고)가 경로 하나를 놓친 채 부정확하면, 게이트가 통과하는 순간부터 아무도 이 항목을 다시
    들여다볼 유인이 없어져 그 부정확성이 영구적으로 은폐될 위험이 크다.
  - 제안: (1) `pnpm-workspace.yaml`의 ignoreCves 주석·plan 문서·
    `scripts/check-pnpm-security-config.py`의 미러 주석을 3경로 모두 반영하도록 정정하고, mailer/mjml
    경로가 프로덕션 의존성 트리에 실재함을 명시. (2) `mail.module.ts`가 어떤 template adapter도
    쓰지 않는 것이 확인됐으므로, 이 참에 mjml/liquidjs/nunjucks/pug/handlebars 전체 템플릿-엔진
    서브트리가 정말 필요한지 재검토 — 불필요하면 더 가벼운 mailer 구성으로 교체해 이 취약 서브트리
    자체를 제거하는 편이 CVE마다 개별 대응하는 것보다 근본적이다. (3) 향후 이런 잔여 audit 정리
    작업의 "실측 검증" 단계에 `pnpm audit --prod`(플래그 없는 기본 실행과 다른 경로 집합을 보고하는
    것이 확인됐으므로) 실행을 추가해 재발을 막을 것.

- **[WARNING]** `EXPECTED_IGNORED_CVES`에서 `CVE-2026-14257` 주석이 실제로는 `CVE-2026-53550`
  (js-yaml)의 설명이 잘못 붙은 것으로 보이고, 그 결과 severity 도 "moderate"로 오기재됨(실제는
  high, CVSS 7.5).
  - 위치: `scripts/check-pnpm-security-config.py:76-77`
  - 상세: 77행 `"CVE-2026-14257",  # js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.`
    주석은 js-yaml/gray-matter를 설명하지만, CVE-2026-14257 은 brace-expansion 무한 확장
    DoS(high, CVSS 7.5)다 — `pnpm-workspace.yaml:77`과 plan §1.3 (동일 파일 69행)에서 일관되게
    확인됨. 반대로 76행의 `"CVE-2026-53550"`은 이번 diff에서 기존에 붙어있던 주석
    (`# js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.`)을 잃었다 — 편집 중 주석이
    아래 줄로 밀린 전형적인 복붙 실수로 보인다. 런타임 동작에는 영향 없음(Python set 리터럴의
    주석은 `_check_set`/키 비교 로직에 관여하지 않음, 41-108행) — 하지만 이 파일 자신의 목적이
    "신규 CVE 를 사유 없이 억제 금지(수용은 반드시 근거·영향경로·해소 조건과 함께)"(18-22행)이므로
    주석의 정확성 자체가 그 거버넌스의 신뢰성이다. 틀린 주석은 향후 이 CVE를 재검토하는 사람에게
    실제보다 낮은 심각도와 잘못된 대상 패키지를 암시해 오판을 유도할 수 있다(위 CRITICAL 항목과
    맞물리면 특히 나쁘다 — 정확한 근거가 가장 필요한 항목의 주석이 가장 부정확하다).
  - 제안: 76/77행 주석을 스왑하거나 각각 정확한 한 줄 요약으로 재작성.

- **[INFO]** `ignoreCves`의 `CVE-2026-53550`(js-yaml) 억제 항목이 이번 PR 이후로는 사실상
  무효(inert)해짐.
  - 위치: `pnpm-workspace.yaml:88` / `scripts/check-pnpm-security-config.py:76`
  - 상세: 이번 PR의 `js-yaml@>=3.0.0 <3.15.0: ^3.15.0` 스코프 오버라이드로 취약 버전
    (`js-yaml@3.14.2`)이 더 이상 해소되지 않는다(lockfile에서 완전히 제거됨, `pnpm-lock.yaml`
    diff 확인) — 즉 audit이 애초에 이 CVE를 보고하지 않으므로 ignoreCves 엔트리는 죽은 설정이
    됐다. 저자도 plan 문서에서 "CVE-2026-53550 자체의 ignore 엔트리는 건드리지 않았다(...제거
    판단은 이 PR 범위 밖)"이라고 명시적으로 스코프 아웃했으므로 이 PR의 결함은 아니다.
  - 제안: 후속 정리 항목으로 트래킹(낮은 우선순위, 위 WARNING 수정과 함께 처리하면 효율적).

- **[INFO]** 그 외 항목은 실측으로 정합성이 확인됨 — 참고용, 조치 불필요.
  - 하한 상향 4건(`liquidjs`/`protobufjs`/`fast-uri`/`hono`)과 신규 오버라이드 9건 모두 lockfile
    resolution 이 override range 를 만족하고 다운그레이드가 없음을 diff 대조로 확인.
    `js-yaml`/`brace-expansion` 의 버전-레인지 스코프도 major 계열 충돌 없이 올바르게 분리됨.
  - `scripts/check-pnpm-security-config.py` 는 `yaml.safe_load` 사용(임의 객체 역직렬화 RCE
    방지), 셸/eval 호출·사용자 입력 없음, 경로도 `__file__` 기준 고정 상대경로 — 인젝션 표면 없음.
  - `.github/workflows/deps-security-checks.yml` 가 config-guard·audit 두 job 을 PR/push/주간
    스케줄로 실제 강제하고 있음을 확인(파일 열람으로 검증, 문서상 주장과 일치).
  - `sharp@0.35.x` 의 `engines.node` 요건이 `>=20.9.0`으로 상향됐으나 저장소의 모든
    Dockerfile/CI가 Node 24 를 사용해 호환성 문제 없음(확인됨).
  - lockfile·config·plan 문서 어디에도 하드코딩된 시크릿·자격증명·평문 HTTP 레지스트리 URL 없음
    (grep 확인). 인젝션·인증/인가·암호화·에러 처리 관련 코드 변경 자체가 없음(순수 의존성 버전
    관리 diff).

## 요약

이번 변경은 `pnpm audit` 잔여 17건을 오버라이드 하한 상향(4)·신규 오버라이드(9)·해소 불가 1건의
`ignoreCves` 수용으로 정리하는 순수 의존성 보안 설정 PR이다. 16건은 실측(package.json 경계,
Dockerfile `--prod` deploy, lockfile resolution 체인, CI 워크플로 실제 내용)으로 교차검증한 결과
버전 하한·스코프·CI 강제가 모두 정확했다. 다만 유일하게 "수용"으로 처리한 CVE-2026-14257
(brace-expansion 무한확장 DoS, high/CVSS 7.5)의 문서화된 근거("두 경로 모두 dev 전용 전이
의존")는 `pnpm audit --prod` 로 독립 검증한 결과 사실이 아니다 — `@nestjs-modules/mailer`를
경유하는 세 번째 경로가 프로덕션 의존성 트리에 실재한다. 현재 mail 모듈이 어떤 템플릿 어댑터도
활성화하지 않아 즉시 런타임에서 트리거되기는 어려워 보이지만, 이 CVE를 "공식 수용"한 근거 문서
자체가 부정확한 채로 게이트를 초록으로 만드는 것은 이 저장소 자신이 요구하는 거버넌스 정책
("근거·영향경로·해소 조건" 명시)을 충족하지 못하며, 한 번 초록이 되면 아무도 재검토하지 않을
가능성이 높아 위험이 조용히 고착될 수 있다. 부수적으로 baseline 스크립트의 CVE 주석이 서로
뒤바뀌어 severity 표기까지 틀어진 것도 같은 계열의 문제(정확성이 곧 신뢰성인 거버넌스 파일의
정확성 결함)다. 인젝션·시크릿·인증/인가·암호화 관련 신규 위험은 없다.

## 위험도

HIGH

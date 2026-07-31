# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — `pnpm audit` 잔여 취약점 정리 PR 자체는 스코프가 잘 통제된 순수 의존성 변경이나, `ignoreCves` 로 공식 수용한 CVE-2026-14257(brace-expansion, high/CVSS 7.5)의 "두 경로 모두 dev 전용" 근거가 `pnpm audit --prod` 실측 결과 사실이 아니며(프로덕션 경로 `@nestjs-modules/mailer` 존재), 이 부정확한 근거로 게이트가 초록으로 고착될 위험이 있어 병합 전 정정이 필요하다. forced reviewer(dependency·security·scope) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 (CVE 억제 근거 오류) | `ignoreCves` 로 수용한 CVE-2026-14257(brace-expansion 무한확장 DoS/OOM, high·CVSS 7.5)의 "두 경로 모두 **dev 전용 전이 의존**" 근거가 사실과 다르다. `pnpm audit --prod --json` 을 2회 재현한 결과, 문서에 없는 세 번째 경로 `@nestjs-modules/mailer>mjml>mjml-core>js-beautify>editorconfig>minimatch>brace-expansion@2.1.4` 가 **프로덕션** 의존성 트리에 실재한다(`@nestjs-modules/mailer` 는 `package.json` 의 `dependencies`, `devDependencies` 아님). 다만 `mail.module.ts` 의 `MailerModule.forRootAsync()` 가 템플릿 어댑터를 전혀 설정하지 않아(grep 결과 소스 내 "mjml" 참조 없음) 즉시 런타임 트리거 가능성은 낮음. CI 가 실제 실행하는 flag 없는 `pnpm audit` 으로는 이 경로가 나타나지 않아 `--prod` 없이는 원천적으로 발견 불가능했다. | `pnpm-workspace.yaml:77-88`(핵심 주장 82행, 경로 나열 83-84행) · `plan/in-progress/audit-residual-triage.md:76-84` · (연동) `scripts/check-pnpm-security-config.py:76-77` | ① 3개 문서(workspace 주석·plan·check-script 주석) 모두 3번째 경로(mailer/mjml)를 반영해 정정. ② mail 모듈이 템플릿 어댑터를 쓰지 않는 점을 근거로 mjml/liquidjs/nunjucks/pug/handlebars 서브트리 전체 필요성 재검토(제거 시 취약 서브트리 원천 제거). ③ 향후 유사 audit 정리 작업의 검증 절차에 `pnpm audit --prod` 실행을 표준 단계로 추가. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정확성 (CVE 주석, 3개 reviewer 공통 확인) | `EXPECTED_IGNORED_CVES` 의 `CVE-2026-14257` 인라인 주석이 실제로는 바로 위 `CVE-2026-53550`(js-yaml, moderate)의 설명이 잘못 붙은 것 — 편집 중 복붙 실수로 보인다. `CVE-2026-14257` 은 실제로 brace-expansion 무한확장 DoS, **high**(CVSS 7.5) 이며 severity 도 오기재됐다(moderate로 표기). Python `set` 비교라 config-guard 판정 자체엔 영향 없으나(재실행으로 `OK` 확인), 정확한 근거가 가장 필요한 CRITICAL 항목(#1)의 근거 문서가 가장 부정확한 상태라는 점이 특히 우려된다. | `scripts/check-pnpm-security-config.py:76-77` | 76/77행 주석을 각 CVE 에 맞게 재작성: 76행(`CVE-2026-53550`) → js-yaml/gray-matter/moderate 설명 복원, 77행(`CVE-2026-14257`) → brace-expansion/high 설명(위 CRITICAL #1 정정 시 함께 처리). |
| 2 | 의존성 버전 (Major/0.x 경계 초과 override) | 신규 override 2건이 직접 소비처가 스스로 선언한 호환 범위를 벗어난 상향을 강제한다. (a) `@hono/node-server: ^2.0.5` — `@modelcontextprotocol/sdk@1.29.0` 자신은 `^1.19.9` 선언(1→2 major 점프, lockfile `1.19.14→2.0.12`). (b) `sharp: ^0.35.0` — `next@16.2.11` 의 `optionalDependencies` 는 `^0.34.5` 선언(0.x 캐럿 상한 `<0.35.0` 초과, `0.34.5→0.35.3`). `@hono/node-server` 는 `mcp-client.service.ts` 가 `/client/*` 서브모듈만 import 해 `/server/*`(v2 API) 경로가 현재 도달 불가능하지만, `sharp` 는 `next/image` 를 사용하는 `profile/security/page.tsx` 실사용 경로에 걸려 있고 완화 근거가 "빌드+e2e(260/260) 통과" 뿐 — 해당 페이지 이미지 렌더링을 e2e 가 구체적으로 커버하는지는 미확인. plan Rationale(131-133행)은 major 점프 예시로 다른 3건만 들고 이 2건은 언급하지 않는다. | `pnpm-workspace.yaml:45`(`@hono/node-server`) · `pnpm-workspace.yaml:48`(`sharp`) — baseline 대응: `scripts/check-pnpm-security-config.py:57,60` | `sharp` 경로는 병합 전 `next start` 로 해당 보안 설정 페이지의 이미지 최적화 응답을 직접 확인하거나 e2e 스펙에 방문 확인을 추가. plan Rationale 에 이 2건도 "major/0.x 경계를 넘었지만 왜 허용 가능한지" 명시. |
| 3 | 스코프/문서화 (lockfile 부수 drift 미설명) | `codebase/frontend/package.json` 은 이번 PR 이 건드리지 않았지만, merge-base 시점부터 그 파일의 `postcss: ^8.5.18` 선언과 `pnpm-lock.yaml` 의 importer specifier(`^8.5.14`)가 이미 어긋나 있었다(직전 PR #1034 의 "무변경" 서술과 실측 불일치, `git show` 로 확인). 이번 override 작업에 필요했던 `pnpm install` 이 이 잔존 drift 를 부수적으로 `^8.5.18` 로 정정했다(해소 버전 자체는 8.5.25 로 동일, frozen-lockfile 통과 — 기능적 위험은 낮음). plan §2 는 별개 필드인 `next>postcss` 오버라이드(의도적으로 `^8.5.14` 유지, `#1036` 이관)만 다뤄, 이름이 겹치는 이 부수 diff 를 설명하지 않아 혼동 소지가 있다. 동일 클래스가 직전 PR(`a41a0456e`, review `2026/07/31/13_08_31`)에서 이미 WARNING 으로 지적되어 "blast radius 표" 로 조치된 전례가 있으나 이번 plan 은 그 관례를 따르지 않았다. | `pnpm-lock.yaml:506`(`specifier: ^8.5.18`, 이전 `^8.5.14`) · `plan/in-progress/audit-residual-triage.md` §2 | plan `§1.4` 또는 `§2` 에 "frontend package.json 미변경, 기존 lockfile-manifest drift 를 `pnpm install` 이 부수 해소, `next>postcss` 오버라이드와는 별개 필드" 한 문단 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 라이선스/신규 의존성 | 신규 패키지 추가 없음(기존 전이/선택적 의존성의 버전 하한 강제뿐). 13개 패키지 전수 `npm view license` 확인 결과 전부 MIT/Apache-2.0/BSD-3-Clause 등 permissive, 충돌 없음. 내부 workspace 패키지(`@workflow/*`) 변경도 없음. | `pnpm-workspace.yaml:45-53` | 조치 불요 |
| 2 | 버전 범위 정합성 | `js-yaml`(`>=4.0.0 <4.3.0`, `>=3.0.0 <3.15.0`)·`brace-expansion`(`<2.0.0`, `>=3.0.0 <5.0.8`) 스코프 override 경계가 diff 전후 lockfile 스냅샷과 정확히 일치. 수용 대상 `brace-expansion@2.1.4` 는 두 스코프 어디에도 걸리지 않아 의도대로 보존됨. 기존 `undici` 선례와 문법 일관. | `pnpm-workspace.yaml:50-53` | 조치 불요 |
| 3 | 패키지 중복 | `@opentelemetry/propagator-jaeger` 상향으로 `@opentelemetry/core` 가 2.8.0/2.10.0 두 버전으로 공존(다른 소비처는 여전히 2.8.0 참조). `@opentelemetry/api` 는 단일 버전(1.9.1) 유지되어 런타임 충돌 가능성은 낮음. 번들/설치 크기 미미한 증가. | `pnpm-lock.yaml:2509` 부근 | 조치 불요 |
| 4 | CI/감사 표현 | `pnpm audit --audit-level=moderate` 재현 결과 exit 0 확인(게이트 통과 주장 검증됨). 다만 사람이 읽는 요약이 `"2 vulnerabilities found... 1 ignored"` 로 출력돼 오독 소지 — 둘 다 이미 ignoreCves 로 수용된 동일 CVE-2026-14257(경로 2개)이며 pnpm CLI 리포팅 방식일 뿐 이 PR 의 결함은 아님. | `pnpm-workspace.yaml:70-88` · `.github/workflows/deps-security-checks.yml:70-71` | 조치 불요(정보 제공) |
| 5 | 설정 가드 검증 | `check-pnpm-security-config.py` 직접 재실행 결과 `OK: overrides 28건 · onlyBuiltDependencies 5건 · ignoreCves 2건` baseline 일치, plan 문서 실측 검증 섹션과 정확히 일치. `pnpm install --frozen-lockfile` 도 통과. 스크립트는 `yaml.safe_load` 사용(RCE 방지), 셸/eval·사용자 입력 없음. CI 워크플로가 config-guard·audit 두 job 을 PR/push/주간 스케줄로 실제 강제함을 파일로 확인. | `scripts/check-pnpm-security-config.py:37-78` | 조치 불요 |
| 6 | 잔여 정리 항목 | `ignoreCves` 의 `CVE-2026-53550`(js-yaml) 억제 항목이 이번 PR 의 `js-yaml@>=3.0.0 <3.15.0: ^3.15.0` 오버라이드로 취약 버전이 lockfile 에서 완전히 제거돼 사실상 무효(inert)해짐. plan 문서가 "제거 판단은 이 PR 범위 밖" 이라 명시적으로 스코프 아웃해 이 PR 의 결함은 아님. | `pnpm-workspace.yaml:88` · `scripts/check-pnpm-security-config.py:76` | 후속 정리 항목으로 트래킹(낮은 우선순위, 위 WARNING #1 수정과 함께 처리 권장) |
| 7 | 기타 실측 검증 | 하한 상향 4건(`liquidjs`/`protobufjs`/`fast-uri`/`hono`)·신규 오버라이드 9건 모두 lockfile resolution 이 override range 충족, 다운그레이드 없음. `sharp@0.35.x` 의 `engines.node >=20.9.0` 요건은 저장소 전역 Node 24 고정으로 문제없음(package.json/.nvmrc/Dockerfile/CI 전부 확인). 시크릿·평문 HTTP 레지스트리 URL 없음. 인증/인가/암호화/에러 처리 코드 변경 없음(순수 의존성 diff). | 다수 파일(개별 검증) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | CVE-2026-14257 "dev 전용" 근거가 실측과 불일치(프로덕션 mailer 경로 실재) — CRITICAL 승격; CVE 주석 뒤바뀜(WARNING) |
| dependency | MEDIUM | CVE 주석 복붙 오류; `@hono/node-server`·`sharp` override 가 소비처 선언 범위(major/0.x 경계) 초과 |
| scope | LOW | `postcss` lockfile 부수 drift 가 plan 에 미설명; CVE 주석 복붙 오류(교차 확인) |

## 발견 없는 에이전트

없음 — forced 3개 에이전트(dependency, security, scope) 전원 실질 발견사항 보고.

## 권장 조치사항

1. (최우선·CRITICAL) `pnpm-workspace.yaml`·`plan/in-progress/audit-residual-triage.md`·`scripts/check-pnpm-security-config.py` 의 CVE-2026-14257 수용 근거를 "두 경로 모두 dev 전용"에서 세 번째 프로덕션 경로(`@nestjs-modules/mailer>mjml>...>brace-expansion`)를 포함하도록 정정. mail 모듈이 템플릿 어댑터를 쓰지 않는 사실을 근거로 mjml 서브트리 제거 여부 재검토.
2. `scripts/check-pnpm-security-config.py:76-77` 의 CVE 주석 스왑 및 severity(high) 정정 — 1번과 함께 처리하면 효율적.
3. `sharp` override(`pnpm-workspace.yaml:48`)가 `next/image` 실사용 경로에 걸려 있으므로 병합 전 해당 페이지 이미지 렌더링 동작을 명시적으로 확인. `@hono/node-server` 는 현재 도달 불가능한 경로임을 plan Rationale 에 명시.
4. plan `§1.4`/`§2` 에 `codebase/frontend` 의 `postcss` specifier 부수 drift 설명 문단 추가, `next>postcss` 오버라이드와의 구분 명시.
5. (낮은 우선순위) 무효화된 `CVE-2026-53550` ignoreCves 엔트리 제거를 후속 정리 항목으로 트래킹.
6. 향후 audit 잔여 정리 작업의 표준 검증 절차에 `pnpm audit --prod` 실행을 추가해 이번과 같은 프로덕션 경로 누락 재발을 방지.

## 라우터 결정

라우터 미사용(`routing=skipped`). 전체 reviewer 강제 포함(router_safety whitelist) 으로 실행됨.

- **실행**: `dependency, security, scope` (3명, 전원 forced)
- **제외**: 없음
- **강제 포함(router_safety)**: `dependency, scope, security` (전원 결과 확보됨 — 누락 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |
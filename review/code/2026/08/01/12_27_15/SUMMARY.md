# Code Review 통합 보고서

## 전체 위험도
**LOW** — `eslint-plugin-unicorn` 을 dependabot 의 의도치 않은 16-major bump(`^72.0.0`, eslint peer 불일치)에서 원래 pin(`^56.0.1`)으로 되돌리는 순수 devDependency/설정 revert. Critical 없음. 강제(forced) 화이트리스트 8개 reviewer(security, requirement, scope, side_effect, maintainability, testing, documentation, dependency) 전원이 실제 실행되어 전문을 확보했으며 누락 없음 — "강제 미이행"에 해당하는 항목 없음. 최고 위험도는 WARNING 3건(문서/테스트/유지보수성 계열, 전부 비차단성 구조적 갭)이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `PROJECT.md` 의 "빌드 툴체인 major 자동 bump 차단" 정책 문단이 "현재 typescript 1건"으로 남아 있는데, 이번 변경으로 dependabot ignore 항목이 typescript + eslint-plugin-unicorn 2건이 됐다. 이 PR 이 고치려는 "코드-문서 drift" 와 같은 클래스의 갭이 상위 SoT 문서에 새로 생김 | `PROJECT.md:49` | "typescript·eslint-plugin-unicorn 2건"으로 갱신하고 근거를 한 줄 추가. 향후 항목 추가 시 `.github/dependabot.yml` 의 ignore 블록 개수와 동기화하라는 2-place 결속 문구를 남길 것 |
| 2 | Testing | 직전 동일 클래스 사고(#1047, typescript)에서는 `typescript-toolchain-guard.ts`/`.test.ts` 형태의 자동 회귀 가드를 커밋했는데, 이번 unicorn 사고에는 동일 패턴이 적용되지 않음. 재발 방지 수단이 dependabot ignore(자체 재-bump만 차단) + 사람이 읽는 comment + plan 문서의 1회성 수동 mutation 검증(prose 증거) 뿐이라, 사람이 직접 버전을 올리는 경로는 CI 게이트 없이 무방비. plan 문서 스스로 "미충족 peer 가 CI 실패로 취급되지 않는다"고 인정 | `codebase/backend/eslint.config.mjs:17`, `.github/dependabot.yml:75`, `plan/in-progress/eslint-unicorn-peer-restore.md` 후속 검토 절 | `typescript-toolchain-guard` 와 동일한 순수-코어 + 실측-대조 패턴으로, 설치된 unicorn 의 peer eslint range 를 읽어 backend 선언 range 와 비교하는 자동 가드(vitest 등 상시 게이트)를 추가. 최소로는 `unicorn/catch-error-name` fixture 에 `ESLint.lintText` 를 돌려 위반 1건을 assert 하는 unit 테스트만 추가해도 이번 수동 mutation 검증을 CI 에 상시 반영 가능 |
| 3 | Maintainability | 동일한 "unicorn 버전별 eslint peer floor" registry 실측 표가 `dependabot.yml`(4구간 축약)·`eslint.config.mjs`(6구간)·plan 문서(6구간) 세 곳에 중복 기재되어 있고, 세분화 수준이 이미 갈려 있음. 향후 값 갱신 시 한 곳만 고치고 나머지가 stale 하게 남을 구조적 위험 | `.github/dependabot.yml:86`, `codebase/backend/eslint.config.mjs:20-21`, `plan/in-progress/eslint-unicorn-peer-restore.md:40-47` | `eslint.config.mjs`(코드에 가장 가까운 곳)를 SoT 로 두고 나머지는 "표는 eslint.config.mjs 참고"로 축약 참조하도록 정리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | devDependency(`eslint-plugin-unicorn`) 16-major 다운그레이드는 프로덕션 런타임 번들 밖(빌드/린트 전용)이라 배포 애플리케이션 공격 표면에 직접 영향 없음. registry 실측 근거로 임의 변경 아님을 확인 | `codebase/backend/package.json:119` | 조치 불요. 필요 시 `pnpm audit --prod` 로 프로덕션 dep 만 주기 점검 |
| 2 | Security | dependabot major-bump ignore 는 GitHub 의 별도 "Dependabot security updates" 토글에는 영향 없음(일반 버전업 PR만 억제). 이미 plan/주석에 트레이드오프로 명시됨 | `.github/dependabot.yml:90-91`, `:72-73`(typescript 기존 항목) | 조치 불요 |
| 3 | Security / Side effect | `pnpm-lock.yaml` 변경은 `eslint-plugin-unicorn` 서브트리에만 격리된 기계적 재계산(다른 워크스페이스·production 의존성 무영향), integrity 해시 정상, 하드코딩 크리덴셜 없음 | `pnpm-lock.yaml` snapshots 섹션 | 조치 불요 |
| 4 | Requirement | 관련 spec 문서 부재는 예상된 결과 — 빌드 툴체인/CI 설정 변경이라 `spec/` 비대상, plan frontmatter `spec_impact: none` 과 일치 | `spec/` (해당 없음) | 조치 불요 |
| 5 | Requirement | plan 문서의 "3년 가까이 유효한 근거다" 서술이 실측(v57 릴리스일 2025-02-17, 경과 약 1.5년)과 정량적으로 어긋남. 표 자체 값은 registry 재조회 결과 전부 정확 | `plan/in-progress/eslint-unicorn-peer-restore.md:49` | 코드 변경 정확성엔 무영향. 추후 편집 기회에 "v57 릴리스 이후 계속 유효" 등 실측 가능한 표현으로 다듬기 |
| 6 | Side effect | 다운그레이드로 구식 transitive devDependency ~15개(`hosted-git-info@2.8.9`, `semver@5.7.2` 등)가 재유입되지만 unicorn 서브트리 전용이며 알려진 취약점 없음(`hosted-git-info` 는 CVE-2021-23362 패치 버전) | `pnpm-lock.yaml` | 조치 불요. 향후 SCA 스캔에서 신규 패키지 발견 시 본 PR 기인임을 인지 |
| 7 | Side effect | dependabot 의 향후 `eslint-plugin-unicorn` major bump 자동 PR 생성이 억제됨(의도된 이벤트 억제), eslint 10 상향 전까지 유지 필요 — 향후 pin 해제 PR 에서 이 ignore 항목도 함께 제거해야 함이 plan 문서에 결속되어 있음 | `.github/dependabot.yml:90-91` | 조치 불요, 결속 확인됨 |
| 8 | Testing | 이번 변경분에는 신규 애플리케이션 코드가 없어 Mock/격리/DI 관점은 N/A. 전체 테스트 스위트(lint/unit/build/e2e) PASS 근거가 plan 문서에 구체적으로 기록됨 | plan 문서 TEST WORKFLOW 절 | 조치 불요 |
| 9 | Documentation | `CHANGELOG.md` 엔트리 없음 — 확립된 선례(spec/제품 대상 변경만 기재, 직전 typescript 롤백 #1058 도 미기재)와 일치 | `CHANGELOG.md` | 조치 불요 |
| 10 | Documentation | `eslint.config.mjs` ↔ `dependabot.yml` 주석이 서로 명시적으로 참조하며 결속을 남긴 점은 이번 diff 중 가장 잘된 문서화 사례(registry 실측 표·날짜 포함) | `codebase/backend/eslint.config.mjs:17-26`, `.github/dependabot.yml:75-91` | 참고만, 조치 불요 |
| 11 | Maintainability | `eslint.config.mjs` 신규 주석 블록의 문단 구분 스타일(빈 `//` 줄)이 파일 내 기존 주석 블록들과 다름 | `codebase/backend/eslint.config.mjs:17-26` | 다음에 이 주석을 손댈 기회에 기존 스타일에 맞추는 것 고려 |
| 12 | Dependency | `^56.0.1` 은 exact pin 이 아니라 caret range — "고정(pin)"이라는 표현과 실제 동작(56.x 대역 minor/patch 자동 갱신 허용) 사이 어휘 차이로 오해 소지 | `codebase/backend/package.json:119`, `.github/dependabot.yml:90-91` | 주석에 "^56 대역 고정(범위 내 minor/patch 는 허용)" 처럼 보강 고려 |
| 13 | Dependency | 재도입되는 transitive 트리는 `#1049` 이전에 이미 운영 검증됐던 조합과 동일 — 신규 취약점 유입 위험 낮음 | `pnpm-lock.yaml` | 조치 불요. 원하면 `pnpm audit` 1줄을 TEST WORKFLOW 체크리스트에 추가 |
| 14 | Dependency | 변경 범위가 backend 워크스페이스에만 국한(frontend/channel-web-chat/packages 는 해당 dep 없음), `--strict-peer-dependencies` 미도입 등 근본 게이팅 갭은 plan "후속 검토" 절에 이미 명시적으로 defer 됨 | `pnpm-lock.yaml` importers 섹션, `plan/in-progress/eslint-unicorn-peer-restore.md:105-112` | 조치 불요 |
| 15 | Scope | `.github/dependabot.yml` 의 unicorn ignore 주석(17줄)이 실제 YAML 변경(2줄)보다 길지만, 기존 `typescript` ignore 항목과 동일 스타일이라 컨벤션 준수임 | `.github/dependabot.yml:75-89` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | devDependency-only 변경, 런타임/공격 표면 영향 없음 |
| requirement | NONE | 5개 파일 모두 목적과 1:1 대응, registry·git log 독립 재현 검증 완료 |
| scope | NONE | 목적 외 변경 없음, 후속 개선은 plan 에 defer 로 명확히 분리 |
| side_effect | NONE | 함수 시그니처/API/전역상태/네트워크 무영향, lockfile 재계산은 unicorn 서브트리 격리 |
| maintainability | LOW | registry 실측 표가 3곳(dependabot.yml/eslint.config.mjs/plan)에 중복 기재되어 SoT 분산 |
| testing | LOW | #1047 사고 때 만든 자동 회귀 가드 패턴이 이번엔 미적용, CI 게이트 부재 |
| documentation | LOW | `PROJECT.md` 의 "typescript 1건" 카운트가 이번 변경(2건)을 반영 못해 stale |
| dependency | LOW | caret range를 "고정"으로 표현한 어휘상 미세 오해 소지, 그 외 전부 양호 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 1건 이상(INFO 이상)의 발견사항을 보고했다. 단, security/requirement/scope/side_effect 4개 reviewer 는 실질 결함 없이 참고성 INFO만 보고(각 위험도 NONE).

## 권장 조치사항
1. `PROJECT.md:49` 의 "빌드 툴체인 major 자동 bump 차단" 문단을 "typescript·eslint-plugin-unicorn 2건"으로 갱신한다(Documentation WARNING #1).
2. `typescript-toolchain-guard.ts`/`.test.ts` 와 동일한 패턴으로, 설치된 `eslint-plugin-unicorn` peer eslint range 와 backend 선언 range 를 비교하는 자동 회귀 가드를 추가한다(Testing WARNING #2) — 최소 단위로 `unicorn/catch-error-name` fixture 에 대한 unit assertion 만으로도 가치가 크다.
3. `dependabot.yml`/`eslint.config.mjs`/plan 문서에 중복 기재된 registry 실측 표를 `eslint.config.mjs` 단일 SoT + 나머지 참조 형태로 정리해 향후 drift 위험을 줄인다(Maintainability WARNING #3).
4. (선택) `package.json`/`dependabot.yml` 주석에 "^56 대역 고정(범위 내 minor/patch 허용)"과 같이 caret range 의 실제 동작을 명시해 오해 소지를 줄인다(Dependency INFO #12).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (8명, 전원 router_safety 에 의해 강제 포함)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(누락 없음)
  - **제외**: 6명 (표 참조)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | diff 가 devDependency 버전/lockfile/설정 주석뿐이며 런타임 성능 경로(알고리즘·쿼리·핫패스) 변경 없음 |
  | architecture | 신규/변경 모듈 구조·레이어 경계 없음, 순수 툴체인 pin 복원 |
  | database | DB 스키마·쿼리·마이그레이션 관련 파일 없음 |
  | concurrency | 동시성/락/트랜잭션 관련 코드 변경 없음 |
  | api_contract | 공개 API 엔드포인트·요청/응답 스키마 변경 없음 |
  | user_guide_sync | 사용자向 기능 변경 없음(개발 툴체인 설정), 사용자 가이드 동기화 대상 아님 |
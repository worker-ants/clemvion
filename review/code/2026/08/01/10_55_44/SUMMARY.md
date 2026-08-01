# Code Review 통합 보고서

## 전체 위험도
**LOW** — TypeScript 7.0.2 → 5.x 롤백(Jenkins 빌드 전면 실패 복구) + dependabot major-ignore + 회귀 방지 가드 신설. **9개 reviewer(강제 8명 포함) 전원 실행·결과 확보, Critical/Warning 0건**, INFO 수준 개선 제안만 존재하는 순수 인프라/의존성 변경. 런타임 애플리케이션 코드(인증·API·DB·프론트엔드 렌더링)는 전혀 건드리지 않았다. 병합을 막을 사유 없음.

## Critical 발견사항

없음.

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 경고 (WARNING)

없음.

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | TS 5.7.3/5.9.3 다운그레이드가 상위 버전에서 패치된 CVE 를 재도입하는지는 이 리뷰에서 실측하지 않음(오프라인 지식상 알려진 CVE 없음, devDependency 라 런타임 노출도 없음) | `codebase/*/package.json`(typescript 필드), `pnpm-lock.yaml`(`typescript@5.9.3`) | 머지 전 `pnpm audit` 1회 실행해 typescript 및 재결선된 전이 의존에 신규 HIGH/CRITICAL 없는지 확인(기존 `deps-security-checks.yml` 정기 실행으로 자동 커버될 수 있음) |
| 2 | SECURITY/DEPENDENCY | dependabot `ignore` 는 scheduled version-update 만 확실히 차단 — security-update 는 별도 토글이라 (a) major 로만 나오는 보안 패치를 이 규칙이 막아 자동 수신을 방해할 수도, (b) 반대로 security-update 경로가 이 ignore 를 우회해 major PR 을 낼 수도 있는 이론적 gap 존재(주석에 이미 인지·완화 조건 명시됨) | `.github/dependabot.yml:47-73` | 차단 사유 아님. 재활성 조건을 사람이 주기적으로 재확인하도록 plan/backlog 에 남겨두는 것 권장(이미 `plan/in-progress/typescript-7-rollback.md` 에 경위 기록됨) |
| 3 | ARCHITECTURE | 신규 가드가 `ROOT`/`listAtPath` 두 심볼만 필요하지만, 무관한 책임(내부 패키지 등록 목록 검사)을 가진 형제 모듈 `internal-package-registration-guard.ts` 전체 export 표면에 의존(ISP 위반, 은닉 결합) — 형제 모듈이 리팩터되면 의미상 무관한 이 가드가 덩달아 깨질 수 있음 | `typescript-toolchain-guard.ts:14`(import), `:6-9`(재사용 근거 주석) | 공유 프리미티브를 중립 모듈(예: `repo-guards/__tests__/_shared.ts`)로 분리해 양쪽이 대칭적으로 import |
| 4 | ARCHITECTURE | monorepo 전역 가드가 물리적으로 frontend 워크스페이스에 귀속되는 패턴이 반복(root CI 부재 → `pnpm --filter frontend test` 가 유일한 실동 게이트라는 기존 선례 계승, 이번 PR 이 새로 만든 문제 아님) | `typescript-toolchain-guard.ts:101-117`, `typescript-toolchain.test.ts:35-40` | 당장 조치 불요. 세 번째 유사 가드 추가 전 전용 위치(예: 루트 스크립트 디렉터리) 승격 검토 |
| 5 | ARCHITECTURE | 사고의 구조적 원인(typescript 버전 선언이 10개 `package.json` 에 중복)은 탐지(가드)로만 방어되고 제거되지는 않음 — 저장소가 이미 pnpm 10.23 을 쓰므로 `catalog:` 프로토콜로 근본 해소 가능 | `.github/dependabot.yml:72-73`, 10개 workspace `package.json` | 후속 plan 항목으로 "공유 devDependency `catalog:` 마이그레이션 검토" 등록 고려(이번 P0 스코프 밖) |
| 6 | REQUIREMENT | `typescriptRangeOf` 가 devDependencies/dependencies 중 우선순위(dev 우선)로 하나만 반환 — 두 필드가 서로 다른 typescript 값을 선언하면 lockstep/능력 검사가 `dependencies` 쪽을 못 봄(현재 10개 워크스페이스 전부 devDependencies 만 사용해 도달 불가) | `typescript-toolchain-guard.ts:66-68` | 조치 불요(현재 도달 불가 분기). 향후 워크스페이스가 `dependencies.typescript` 를 추가하면 재검토 |
| 7 | SCOPE | `pnpm-lock.yaml` 재생성 과정에서 typescript 와 무관해 보이는 `eslint-plugin-import` peer 해석 키 표기가 변경 — `pnpm install` 이 전체 의존성 그래프를 재계산하며 나타나는 잘 알려진 부작용이지 수작업 편집이 아님(문자열 필터링으로 typescript 변경분 외 설명 안 되는 항목 없음을 확인) | `pnpm-lock.yaml:16019` 등(16039, 16076 동일 패턴) | 액션 불요. 향후 리뷰어가 "무관한 패키지명이 diff 에 등장"만 보고 스코프 이탈로 오판하지 않도록 기록 |
| 8 | SCOPE | 회귀 가드 신설(신규 파일 2개, +393줄)이 "롤백"보다 넓은 "재발 방지" 목적을 포함 — 다만 plan 문서 제목·Overview 에서 착수 전부터 명시적으로 선언된 스코프이며 기존 형제 가드(`internal-package-registration-guard.ts`)의 명명·분리·재사용 규약을 그대로 따라 중복 로직 없음 | `typescript-toolchain-guard.ts`, `typescript-toolchain.test.ts`(전체 신규) | 액션 불요. "P0 롤백 PR 치고 diff 가 크다"는 표면적 인상만으로 스코프 위반 판정하지 않도록 근거 기록 |
| 9 | SIDE_EFFECT | `loadTypescriptFrom` 이 테스트 실행 중 실제 `typescript` 패키지를 동적 `require()`(의도된 재현 설계, 신뢰 경계 내 — `@nestjs/cli` 의 로더 방식과 동일)하는데, `try/catch` 가 module-not-found 뿐 아니라 로드 중 임의 런타임 예외까지 전부 삼켜 `null`(미설치와 동일 취급)로 처리 | `typescript-toolchain-guard.ts:169-176` | 별도 조치 불요(전 워크스페이스가 동시에 손상 상태가 아닌 한 하류 vacuity 가드가 완전 무력화를 막음). fail-closed 강화하려면 `MODULE_NOT_FOUND` 코드만 `null` 처리하고 나머지는 재throw(이번 PR 스코프 밖) |
| 10 | SIDE_EFFECT | 워크스페이스 실측 파일시스템 I/O(`discoverWorkspaceDirs`/`typescriptDecls`)가 `it()` 이 아닌 `describe()` 본문에서 테스트 수집 시점에 즉시 실행됨(전부 read-only, 형제 가드 `internal-package-registration.test.ts` 와 동일한 기존 패턴) | `typescript-toolchain.test.ts:45-47` | 별도 조치 불요 — 저장소 기존 관례와 일관 |
| 11 | MAINTAINABILITY | 매니페스트 판독(`existsSync`+`readFileSync`+`JSON.parse`) 3줄 패턴이 형제 가드 모듈 간 소폭 중복 — 정확히 같은 문제 유형("파서 두 벌 두면 드리프트")을 근거로 `ROOT`/`listAtPath` 는 재사용했지만 이 3줄은 각자 인라인으로 남음(반환 형태·base 디렉터리가 달라 당장 심각하진 않음) | `typescript-toolchain-guard.ts:137-141`(`readManifestAt`) vs `internal-package-registration-guard.ts:82-86` | 시급하지 않음. 세 번째 소비처 생기면 `readJsonIfExists<T>` 같은 공용 헬퍼로 추출 검토 |
| 12 | MAINTAINABILITY | `loadTypescriptFrom` 반환 타입 `unknown \| null` 이 TypeScript 상 `unknown` 과 완전히 동치(null 은 이미 unknown 의 부분집합) — 같은 파일의 다른 함수들이 "구체 타입 \| null" 로 실질적으로 좁혀주는 것과 나란히 보면 형식만 같고 의미 없는 유니온이라 약간의 혼동 여지 | `typescript-toolchain-guard.ts:169` | `: unknown` 으로 단순화하거나 현행 유지(무해, 선택 사항) |
| 13 | MAINTAINABILITY | 동일 인시던트 서사(TS7 compiler API 소실 → nest build·sdk prepare 실패)가 `dependabot.yml` 주석·plan 문서·테스트 파일 헤더 3곳에 각각 완결된 문단으로 중복 — 저장소 기존 관행과 일치하는 의도된 트레이드오프이나, 사람이 손으로 유지하는 텍스트라 원인 분석이 정정되면 3곳을 동시에 고쳐야 하는 drift 위험 | `.github/dependabot.yml:48-71`, `plan/in-progress/typescript-7-rollback.md:13-74`, `typescript-toolchain.test.ts:15-43` | 즉각 조치 불요. 원인 서술이 바뀔 경우 세 위치 동시 갱신 유념 |
| 14 | TESTING | `discoverWorkspaceDirs` 의 fail-closed throw 분기(발견 vacuity 방지)가 synthetic 유닛 테스트로 직접 겨냥되지 않음 — 실제 I/O(`fs.readFileSync(WORKSPACE_YAML)`)와 결합돼 있어 저장소가 정상인 한 자연 발동 안 함(다만 `patterns === null` 상태에서 `.length` 접근은 JS 상 이미 TypeError 라 완전 침묵 통과는 아님). 형제 가드에도 이미 존재하는 기존 갭 패턴 | `typescript-toolchain-guard.ts:102-117`(throw: 105-110) | 낮은 우선순위. `validateWorkspacePatterns(patterns): string[]` 순수 함수로 분리하면 synthetic null/`[]` 입력으로 직접 커버 가능 |
| 15 | TESTING | `parseMajor`/`missingCompilerApi` 가 prerelease 태그(`^5.7.3-beta.1`)·배열 입력 같은 지엽적 형태를 검증하지 않음 — JSDoc 이 "저장소가 실제 쓰는 형태만" 처리한다고 명시적으로 스코프를 좁혔고 실측(10개 매니페스트 전부 단일 caret/tilde range)과 일치해 실질 위험 없음 | `typescript-toolchain.test.ts:100-128`, `:130-149` | 없음(참고용). 향후 워크스페이스가 복합 range 를 쓰게 되면 그때 fixture 추가 |
| 16 | DOCUMENTATION | `missingCompilerApi` JSDoc 의 "이 경로" 지시어가 문장 순서상 바로 앞의 non-object 분기를 가리키는 것처럼 읽히지만, 실제 TS7 스텁(`{version, versionMajorMinor}`)은 객체이므로 두 번째 분기(filter 경로)를 탐 — 코드·테스트 자체는 정확하나 서술이 향후 다른 실패 형태를 다룰 사람에게 오판 여지를 줌 | `typescript-toolchain-guard.ts:42-43` | "이 경로" 를 "아래 filter 경로" 로 명시하거나, 두 분기를 명확히 갈라 서술 |
| 17 | DOCUMENTATION | 이번에 신설된 세 번째 의존성 거버넌스 축(major-version dependabot ignore)이 `PROJECT.md` 의존성 거버넌스 섹션(기존 caret/exact 핀 정책, audit 수용 거버넌스 2축만 캐논화)에는 반영되지 않고 `dependabot.yml` 내부 주석에서만 발견 가능 | `PROJECT.md:47-48`, `.github/dependabot.yml:47-73` | `PROJECT.md` 에 "major-version 자동 bump 차단(`dependabot.yml` ignore)" 한 줄과 이번 typescript 사례를 근거 포인터로 추가(필수 아님, 현재도 `dependabot.yml` 주석만으로 추적 가능) |
| 18 | DEPENDENCY | 별개 PR(#1049)이 남긴 `eslint-plugin-unicorn@72.0.0` 의 peer(`eslint >=10.4`) 미충족(설치된 `eslint@9.39.4`) — 이번 diff 는 `eslint-plugin-unicorn` 을 건드리지 않으며 lint 는 현재 PASS, plan 문서가 스코프 밖으로 투명하게 이연함 | `plan/in-progress/typescript-7-rollback.md:149-159` | 별도 후속 PR(eslint 9→10)로 트래킹 — plan 문서에 이미 기재됨. 추가 조치 불요 |
| 19 | DEPENDENCY | typescript range 표기가 워크스페이스 전역에서 `^5.7.3`(8곳)/`^5`(2곳)로 상이 — `#1047` 이전 값을 정확히 복원한 결과라 이 PR 이 만든 드리프트가 아니며, 신설 가드(`majorSpread`)는 major 숫자만 lockstep 검사해 이 minor/patch 폭 차이는 가드 대상 밖(실제 사고 원인과 무관) | `codebase/frontend/package.json:89`, `codebase/channel-web-chat/package.json:32` 등 vs `codebase/backend/package.json:129` 등 8개 파일 | 조치 불요(인지용) |
| 20 | SECURITY | `expandWorkspaceGlobs`/`readManifestAt` 가 `pnpm-workspace.yaml` 의 `packages:` 항목(글롭이 아닌 고정 경로)을 검증 없이 그대로 `path.join(ROOT, dir, ...)` 에 사용 — 이론상 `..` 상위 이탈 세그먼트가 가능하나, 빌드/테스트 전용 코드이고 `pnpm-workspace.yaml` 자체가 이미 저장소 신뢰 경계 안이라(조작 가능한 공격자는 이미 빌드 스크립트 직접 변조 가능) 실질적 권한 상승 경로 아님 | `typescript-toolchain-guard.ts:84-87`(`expandWorkspaceGlobs`), `:137-141`(`readManifestAt`) | 실질 위험 없어 조치 불요. 원한다면 방어적으로 `dir` 에 `..` 세그먼트 부재를 assert 추가 가능 |

### 참고: "문제 없음"으로 확인된 항목 (조치 불요, 기록용)

- **security**: 하드코딩 시크릿·자격증명 없음(diff 15개 파일 전수 확인). 인젝션/인증·인가/암호화/에러 노출은 해당 없음(런타임 코드 미변경). 공급망 측면 오히려 개선 — TS7 이 끌어온 `@typescript/typescript-{os}-{arch}` 네이티브 바이너리 optionalDependency 약 20종이 lockfile 에서 전량 제거.
- **requirement**: 관련 `spec/` 문서 없음이 정상(제품 정의 영역 아님). `PROJECT.md §버전 핀 정책`(caret 유지)과 정확히 부합. 기능 완전성·엣지케이스·에러 시나리오·반환값 전 항목 정확 구현(런타임 실측으로 `getParsedCommandLineOfConfigFile` 함수 복귀 확인).
- **scope**: `git diff --stat` 로 15개 변경 파일이 프롬프트 나열분과 정확히 일치, 숨은 파일 변경 없음. 미사용 import 없음.
- **dependency**: 신규 외부 의존성 없음(오히려 설치 풋프린트 감소). 버전 고정 정책(caret) 준수 확인. 취약점 재도입 없음(복원한 5.9.3 은 `#1047` 이전 main 실사용 버전). `typescript-eslint` peer range(`>=4.8.4 <6.1.0`) 가 TS7 을 원천 배제한다는 plan 문서 주장을 `node_modules` 직접 대조로 실측 검증. 내부 모듈 재사용(`ROOT`/`listAtPath`)으로 파서 중복 회피.
- **testing**: 실제 테스트 구동으로 plan 문서 수치 전부 재현 — frontend 5801/5801, backend 8360/8360, channel-web-chat 409/409, `nest build`/`sdk prepare` exit 0. mutation-testing 결과(4종, 1/1/4/1 failed)를 코드 추적으로 독립 재계산해 정확히 일치 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | CVE 재도입 미실측(권고: `pnpm audit`), dependabot ignore 의 security-update 상호작용 불확실성, 워크스페이스 경로 결합 이론적 gap. 하드코딩 시크릿 없음, 공급망 오히려 개선 |
| architecture | LOW | 신규 가드의 형제 모듈 비대칭 결합(ISP), monorepo 전역 가드의 frontend 물리적 귀속 반복(기존 선례), 버전 10중 복제라는 근본원인은 탐지로만 방어(catalog: 로 해소 가능) |
| requirement | NONE | Critical/Warning 없음. 기능 완전성·엣지케이스 전부 정확, spec 대상 없음(정상), PROJECT.md 버전 핀 정책과 정합 |
| scope | NONE | 전 변경이 선언된 "롤백+재발방지" 목적에 정확히 수렴, lockfile 의 무관해 보이는 diff 는 pnpm install 부작용으로 설명됨 |
| side_effect | LOW | `loadTypescriptFrom` catch-all 이 임의 예외를 삼킴, `describe()` 본문 즉시 I/O 실행. env/네트워크/전역변수/시그니처 부작용 없음, 롤백 완전성 실측 확인 |
| maintainability | LOW | 매니페스트 판독 로직 소폭 중복, 반환 타입 `unknown\|null` 사소한 무의미 유니온, 인시던트 서사 3곳 반복(drift 위험) |
| testing | LOW | fail-closed throw 분기 synthetic 미커버, 지엽적 입력 형태(prerelease/배열) 미검증. 실측: 전 워크스페이스 스위트 PASS, mutation 결과 재계산 일치 |
| documentation | LOW | JSDoc "이 경로" 지시어 혼동 여지, 신규 거버넌스 축이 PROJECT.md 미반영. 그 외 문서-코드-계획 3자 정합 우수 |
| dependency | NONE | 신규 외부 의존성 없음, security-update 경로 우회 이론적 gap, 별개 PR(#1049) 잔존 peer 미충족은 투명하게 스코프 밖 |

## 발견 없는 에이전트

없음 — 9개 reviewer 전원이 최소 1건 이상의 INFO 관찰사항을 보고했다(단, CRITICAL/WARNING 은 전원 0건이며, requirement/scope/dependency 3명은 종합 위험도를 NONE 으로 판정).

## 권장 조치사항

1. (권장, 머지 전) `pnpm audit` 을 5.9.3 고정 lockfile 기준으로 1회 실행해 typescript 및 재결선된 전이 의존(`@nestjs/schematics`, `ts-jest`, `ts-node`, `typescript-eslint` 등)에 신규 HIGH/CRITICAL 이 없는지 확인(security #1).
2. (선택, 후속 PR) `typescript-toolchain-guard.ts` 가 `internal-package-registration-guard.ts` 전체에 의존하는 비대칭 결합을 완화하기 위해 `ROOT`/`listAtPath` 를 중립 공유 모듈로 분리(architecture #3).
3. (선택, 후속 PR) `PROJECT.md` 의존성 거버넌스 섹션에 "major-version dependabot ignore" 축 한 줄과 이번 typescript 사례를 근거 포인터로 추가(documentation #17).
4. (선택, 경미) `missingCompilerApi` JSDoc 의 "이 경로" 지시어를 "아래 filter 경로" 등으로 명확화(documentation #16).
5. (후속 plan 항목) 버전 선언 10중 복제라는 구조적 근본원인 해소를 위해 pnpm `catalog:` 마이그레이션 검토를 backlog 에 등록(architecture #5).
6. (이미 트래킹됨, 조치 불요) 별개 PR(#1049)의 `eslint-plugin-unicorn` peer 미충족은 plan 문서에 이미 후속 PR 로 이연 기재됨 — 그대로 진행(dependency #18).

이 중 1번만 머지 전 권장이며 나머지는 전부 선택/후속 사항이다. Critical·Warning 이 없어 이 PR 자체를 막을 조치는 없다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `dependency, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — **forced 전원 결과 확보됨** (architecture 만 router 의 통상 판단으로 선택되고 나머지 8명은 안전 강제 whitelist 로 포함).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 개별 사유는 router 산출에 미포함. diff 성격상 추정: 순수 devDependency 버전 롤백 + 빌드타임 가드로 런타임 성능 경로 비해당(9개 reviewer 가 독립적으로 "런타임 코드 미변경" 확인) |
  | database | 개별 사유는 router 산출에 미포함. DB 스키마/쿼리 변경 없음 |
  | concurrency | 개별 사유는 router 산출에 미포함. 동시성/락/트랜잭션 코드 변경 없음 |
  | api_contract | 개별 사유는 router 산출에 미포함. API 엔드포인트/스키마 변경 없음 |
  | user_guide_sync | 개별 사유는 router 산출에 미포함. 사용자 가시 기능 변경 없음(빌드 인프라 전용 변경) |
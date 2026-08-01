# 보안(Security) 리뷰

## 리뷰 대상 요약

TypeScript 를 `7.0.2` → `5.7.3`/`5.9.3` 으로 롤백(dependabot #1047 이 유발한 main 빌드 전면 실패 복구) +
`dependabot.yml` 에 typescript major 무시 규칙 추가 + 회귀 방지용 "TS 툴체인 계약 가드"(순수 로직 +
vitest) 신규 + `pnpm-lock.yaml` 재생성 + 작업 plan 문서. 10개 워크스페이스 매니페스트, dependabot 설정,
신규 가드 파일 2개, lockfile, plan 문서가 대상이며 애플리케이션 런타임 코드(인증·인가·API 핸들러·DB
쿼리·프론트엔드 렌더링 경로)는 전혀 건드리지 않는다.

## 발견사항

- **[INFO]** typescript 다운그레이드(7.0.2→5.7.3/5.9.3)로 인한 알려진 CVE 재도입 여부는 이 리뷰에서
  실측하지 않았다(오프라인 지식 기준으로는 TypeScript 컴파일러 npm 패키지에 5.x→7.x 구간을 겨냥한
  널리 알려진 CVE 없음. 순수 devDependency 로 빌드타임에만 실행되고 런타임 공격 표면에 노출되지 않아
  영향도 자체도 낮음).
  - 위치: `codebase/backend/package.json:129`, `codebase/channel-web-chat/package.json:32`,
    `codebase/frontend/package.json:89`, `codebase/packages/*/package.json` (typescript 필드),
    `pnpm-lock.yaml` (`typescript@5.9.3` 스냅샷)
  - 상세: 다운그레이드 자체는 사고(#1047) 복구를 위한 의도된 조치이고 plan 문서에 근거가 상세히
    기록돼 있다. 다만 "다운그레이드가 상위 버전에서 고쳐진 보안 이슈를 되살리지 않는가"는 이 코드
    diff 만으로는 확정할 수 없는 외부 정보(CVE DB)에 의존한다.
  - 제안: PR 머지 전 `pnpm audit` (또는 동등한 SCA 스캔)을 5.9.3 고정 lockfile 기준으로 1회 실행해
    typescript 자체 및 그 결과로 되돌아간 전이 의존(`@nestjs/schematics`, `ts-jest`, `ts-node`,
    `typescript-eslint` 등 lockfile 상 `typescript@7.0.2`→`5.9.3` 재결선된 패키지들) 에 신규
    HIGH/CRITICAL 권고가 없는지 확인. (이미 `.github/dependabot.yml` 의 `deps-security-checks.yml`
    체계에 편입돼 있다면 다음 정기 실행에서 자동 커버되므로 별도 조치 불요.)

- **[INFO]** `dependabot.yml` 의 typescript major 자동 업데이트 영구 차단이 향후 "메이저 버전에서만
  릴리스되는" 보안 패치의 자동 수신을 막을 수 있다.
  - 위치: `.github/dependabot.yml:47-73` (`ignore: dependency-name: "typescript"`,
    `update-types: ["version-update:semver-major"]`)
  - 상세: 커밋 주석에 minor/patch 는 계속 받고("security updates 도 patch 로 오는 한 영향 없음")
    재활성 조건(`getParsedCommandLineOfConfigFile` 이 다시 함수가 되고 4개 소비자가 지원할 때)까지
    명시돼 있어 이미 잘 완화된 설계다. 다만 이 조건은 사람이 주기적으로 재확인해야만 성립하는
    수동 프로세스이며, 코드/CI 어디에도 "재확인 시점" 을 강제하는 장치는 없다.
  - 제안: 현 설계로 충분하나, 장기적으로 잊혀지지 않도록 plan/backlog 등에 주기적 재검토
    항목으로 남겨두는 것을 권장(이미 `plan/in-progress/typescript-7-rollback.md` 에 경위가
    상세히 기록돼 있어 최소 요건은 충족).

- **[INFO]** 신규 가드 `loadTypescriptFrom` 이 `createRequire` + `req.resolve`/`req(...)` 로 각
  워크스페이스 디렉터리 컨텍스트에서 `typescript` 모듈을 동적으로 로드해 실행한다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` 함수
    `loadTypescriptFrom` (168~176행)
  - 상세: 모듈 지정자가 하드코딩 문자열 `"typescript"`이고 `dir` 는 `pnpm-workspace.yaml`(신뢰
    경계 안의 저장소 파일)에서 유도된 고정 목록이므로 외부/공격자 입력이 개입할 여지가 없다.
    devDependency 를 require 하는 것은 테스트 실행 자체의 정상 동작(어차피 vitest/jest 러너가 같은
    node_modules 를 로드)과 동일한 신뢰 경계라 새로운 공격 표면을 추가하지 않는다. 정보 제공
    목적으로만 기록한다.
  - 제안: 조치 불요.

- **[INFO]** `expandWorkspaceGlobs`/`discoverWorkspaceDirs`/`readManifestAt` 가 `pnpm-workspace.yaml`
  의 `packages:` 항목을 검증 없이 `path.join(ROOT, dir, ...)` 에 그대로 사용한다(글롭이 아닌 고정
  경로 항목은 `..` 같은 상위 이탈 세그먼트를 걸러내지 않음).
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` 함수
    `expandWorkspaceGlobs`(84~87행, `*` 미포함 분기가 검증 없이 그대로 push) 및
    `readManifestAt`(137~141행)
  - 상세: 이론적으로 `pnpm-workspace.yaml` 에 `../../etc` 류 항목이 있으면 `ROOT` 밖 파일을
    읽으려 시도할 수 있다. 그러나 (1) 이 코드는 `__tests__/` 아래의 빌드타임/테스트타임 전용
    가드이고 네트워크·사용자 입력에 노출되지 않으며, (2) `pnpm-workspace.yaml` 자체가 이미
    저장소 신뢰 경계 안의 파일이라, 이를 조작할 수 있는 공격자는 이미 빌드 스크립트를 직접
    변조할 수 있는 권한을 가진다 — 실질적인 권한 상승 경로가 아니다.
  - 제안: 실질 위험이 없어 조치 불요. 원한다면 방어적 코딩 차원에서 `dir` 에 `..` 세그먼트가
    없는지 assert 하는 정도는 추가할 수 있으나 이 PR 스코프의 필수 사항은 아니다.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음 — diff 전체(15개 파일)에 API 키·비밀번호·토큰·인증서
  패턴 없음. `pnpm-lock.yaml` 에 등장하는 `sha512-...` 문자열은 npm 패키지 integrity 해시로,
  시크릿이 아니라 공개 무결성 검증값이다.

- **[INFO]** 인젝션(SQL/XSS/커맨드/LDAP)·인증/인가·암호화·에러 처리(민감정보 노출) 항목은 해당 없음
  — 이번 변경은 런타임 애플리케이션 코드(컨트롤러·서비스·DB 접근·프론트엔드 렌더링)를 전혀 건드리지
  않고 devDependency 버전·CI 설정·빌드타임 전용 테스트 가드에 국한된다.

- **[INFO]** 공급망 측면에서는 오히려 개선 — TS7 이 끌어온 `@typescript/typescript-{os}-{arch}`
  네이티브 바이너리 optionalDependency 20종이 lockfile 에서 전부 제거된다(`pnpm-lock.yaml` 의
  `@typescript/typescript-*@7.0.2` 블록 삭제 다수). 의존성 개수·바이너리 공급망 표면이 순감소한다.

## 요약

이번 변경은 dependabot 이 유발한 TypeScript 7 major 상향으로 인한 main 빌드 전면 실패를 5.x 계열로
롤백하고, 재발 방지를 위한 dependabot ignore 규칙과 능력 기반(버전 숫자가 아닌 JS compiler API
표면 검사) 회귀 가드를 추가하는 순수 인프라/의존성 변경이다. 인증·인가·암호화·입력 검증·에러 노출 등
OWASP Top 10 이 다루는 런타임 공격 표면은 전혀 손대지 않았고, 하드코딩된 시크릿도 없다. 신규 가드
코드(`typescript-toolchain-guard.ts`)는 로컬 저장소 파일만 읽는 빌드/테스트 전용 순수 로직이라
외부 입력이 개입할 경로가 없으며, 이론적인 경로 처리 이슈도 신뢰 경계 밖에서 도달 불가능해 실질
위험이 없다. 유일하게 추적할 가치가 있는 항목은 "다운그레이드가 상위 버전에서 고쳐진 CVE를 되살리지
않는지"를 `pnpm audit` 등으로 사후 확인하는 것과, typescript major ignore 규칙이 장기적으로
방치되지 않도록 하는 것 정도이며 둘 다 CRITICAL/WARNING 수준의 실제 결함이 아니다.

## 위험도

LOW

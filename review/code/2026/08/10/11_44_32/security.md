# 보안(Security) Review

## 리뷰 범위

`codebase/frontend/src/lib/repo-guards/__tests__/**` 하위 repo-guard(레포 내부 drift 검사용
test-time 유틸) 리팩터링 6개 TS 파일 + 대응 plan 문서 1개, 그리고 직전 리뷰 라운드
(`review/code/2026/08/10/11_22_14/`)의 산출물(SUMMARY/RESOLUTION/각 리뷰어 리포트 등 신규 md/json
파일) 7개. 후자는 애플리케이션 코드가 아니라 리뷰 아카이브 텍스트라 보안 관점의 실질 표면이 없다
(비밀번호·토큰·PII 등 민감정보 포함 여부만 확인 — 없음).

핵심 검토 대상 6개 TS 파일은 전부 `src/lib/repo-guards/__tests__/` 아래 있고, `tsconfig.json`
의 `exclude: ["src/**/__tests__/**"]`(40행, 직접 확인)에 걸려 `tsc`/`next build` 산출물(프로덕션
번들)에 포함되지 않는다. vitest 를 통해 로컬/CI 테스트 스테이지에서만 실행되는 dev-tooling 코드이며,
처리하는 입력은 전부 저장소 자체 파일(`pnpm-workspace.yaml`, `package.json`, `.claude/test-stages.sh`,
`.github/workflows/packages-checks.yml`)이다. 네트워크·외부 사용자 입력·DB·인증 경로와 접점이 없다.

## 발견사항

- **[INFO]** 정규식 생성 시 문자열 보간 — 입력이 하드코딩 상수로 한정된 경우에만 안전
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:155`
    (`fnBody` 의 `new RegExp(\`^${fn}\\(\\)\\s*\\{\\s*$\`, "m")`), 동 파일 `:290`
    (`missingFromStage` 의 `new RegExp(\`_run_internal\\s+${script}\\b\`)`)
  - 상세: `fn`/`script` 를 이스케이프 없이 `RegExp` 생성자 문자열에 직접 보간한다. 일반적으로
    외부/사용자 입력이 정규식 메타문자로 흘러 들어가면 ReDoS 또는 의도치 않은 패턴 매치(정규식
    injection)로 이어질 수 있는 형태다. 다만 실제 호출부를 추적하면 `fn`/`script` 는
    `internal-package-registration.test.ts`/`typescript-toolchain.test.ts` 의 하드코딩 상수
    (`"cmd_lint"`/`"cmd_unit"`/`"cmd_build"`, `"lint"`/`"test"`/`"build"`)에서만 온다 — 외부·사용자
    입력 경로가 없다. 이번 diff 는 이 두 호출 지점 자체를 신규 도입한 것이 아니라(리팩터 전부터
    존재) 문자열만 실질적으로 동일하게 유지했다.
  - 제안: 현재는 조치 불필요(실질 위험 없음). 향후 `fn`/`script` 가 동적/외부 소스(예: YAML 에서
    읽은 문자열)로 바뀌는 변경이 생기면, 그 시점에 정규식 메타문자 이스케이프 헬퍼를 추가할 것.

- **[INFO]** YAML/셸 서브셋 파서는 "blind" 텍스트 변환(정규식 기반)이며 완전한 파서가 아님 — 설계상
  경계이지 결함은 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts`
    (`listAtPath:104`/`blockRange:74`/`findKeyLine:87`), 동 저장소 자매 함수
    `internal-package-registration-guard.ts:202`(`explicitFilterCalls`),
    `internal-package-registration-guard.ts:242`(`blockScalarAtPath`)
  - 상세: 두 파일 모두 헤더 주석에 스스로 경계를 명시한다 — 이스케이프된 따옴표(`\"`), 명령치환
    (`$(...)`), 중첩 인용 등은 지원하지 않는 "blind" 휴리스틱 변환이다. 대상 입력이 전부 신뢰된
    레포 내부 설정 파일(`pnpm-workspace.yaml`/`packages-checks.yml`/`test-stages.sh`)로 한정돼 있고,
    추출 실패는 `null`/`[]` → 상위 vacuity 단언에서 fail-closed 로 처리되므로(예:
    `typescript-toolchain-guard.ts:122` `validateWorkspacePatterns`), 이 근사 파싱을 우회해 조용히
    통과시키는 것보다 "깨져서 알리는" 쪽으로 설계돼 있다. 이 경계는 이 저장소가 과거(`#970`) 정밀
    파서를 시도했다가 무한 표면 문제로 blind 정규식으로 되돌아간 전례와 일치하는 의도된 설계다.
    입력 소스가 신뢰된 레포 파일이 아니라 외부/사용자 제공 텍스트(예: PR 작성자가 자유롭게 채운
    YAML 을 CI 가 그대로 파싱)로 바뀌는 시나리오가 생기면 이 근사 파서로는 우회·오탐 여지가 생길
    수 있다는 점만 참고로 남긴다.
  - 제안: 현재 범위(레포 자체 설정 파일, 신뢰된 입력)에서는 조치 불필요.

- **[INFO]** 신규 `_shared.ts` 가 `repoRoot`/`ROOT` 를 통해 파일시스템 경로를 조합하지만 경로
  구성 요소가 전부 상수라 경로 탐색(path traversal) 벡터 없음 — 방어적 확인 기록
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:40`(`repoRoot`), `:54`(`ROOT`);
    `internal-package-registration-guard.ts:53-55`(`PACKAGES_DIR`/`TEST_STAGES`/`PACKAGES_CHECKS`),
    `typescript-toolchain-guard.ts:22`(`WORKSPACE_YAML`)
  - 상세: `repoRoot()` 는 `pnpm-workspace.yaml` marker 를 기준으로 위쪽 디렉터리만 순회하며
    (`MAX_ROOT_SEARCH_DEPTH` 상한 + `path.dirname(dir) === dir` 조기 종료), 외부에서 주입 가능한
    변수가 없다(`startDir` 기본값은 `__dirname`, DI 로 열린 `exists`/`startDir` 인자는 테스트에서만
    합성 값으로 쓰인다). `ROOT` 를 기준으로 조합되는 모든 경로(`PACKAGES_DIR`/`TEST_STAGES`/
    `PACKAGES_CHECKS`/`WORKSPACE_YAML`)는 `path.join` 에 리터럴 세그먼트만 넘긴다 — 사용자 입력이
    경로 세그먼트로 들어가는 지점이 없어 `../` 류 경로 탐색이 성립하지 않는다.
  - 제안: 결함 아님, 조치 불필요.

## 점검 관점별 확인

1. **인젝션**: SQL/커맨드/LDAP 대상 코드 없음. `child_process`/`exec` 호출 없음. `fs.readFileSync`/
   `fs.readdirSync`/`fs.existsSync` 경로는 전부 `ROOT`(marker 탐색으로 계산된 레포 루트) 기준
   하드코딩된 상대 경로 조합이며 외부 입력이 개입하지 않는다. 위 INFO 두 건(정규식 보간, blind
   파서)은 실질 위험이 아니라 향후 입력 소스 변화 시 참고할 설계 경계다.
2. **하드코딩된 시크릿**: 없음(전수 grep 확인 — API key/password/token/bearer/PEM 패턴 0건).
3. **인증/인가**: 해당 없음 — 빌드/테스트 전용 dev-tooling 이며 런타임 애플리케이션의 인증·인가
   경로와 접점이 없다.
4. **입력 검증**: 처리 대상이 신뢰된 레포 자체 파일이라 사용자 입력 검증 이슈가 아니다. 오히려
   추출 실패(`null`/`[]`)를 빈 값으로 흘려보내지 않고 throw 로 fail-closed 하도록 이번 리팩터가
   강화했다(`validateWorkspacePatterns` 신설, `repoRoot`/`discoverWorkspaceDirs` DI 로 그 fail-closed
   분기를 합성 테스트로 실제 겨냥) — 보안 관점에서도 긍정적 방향의 변경이다.
5. **OWASP Top 10**: 웹 요청 처리 경로가 아니라 해당 사항 없음.
6. **암호화**: 해시/암호화/평문 전송 관련 코드 없음.
7. **에러 처리**: `repoRoot`/`fnBody`/`validateWorkspacePatterns` 등의 `Error` 메시지는 로컬
   디렉터리 경로·YAML 키 이름 등 진단 정보만 담고 있고, CI/로컬 테스트 실행 로그에만 노출된다.
   사용자 대면 응답이나 프로덕션 로그 경로가 아니며 자격증명·PII 등 민감정보 없음.
8. **의존성 보안**: 이번 diff 는 신규 외부 의존성을 추가하지 않는다. 오히려 헤더 주석(`_shared.ts`,
   `internal-package-registration-guard.ts`)에 `js-yaml` 을 의도적으로 피하고 서브셋 파서를 자체
   구현했다고 명시돼 있다(전이 의존 hoist 불안정성 회피 목적) — 신규 공급망 표면 없음.

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 `__tests__/` 아래 repo-guard(내부 drift 검사) 순수
로직을 두 형제 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`) 간
공유 모듈(`_shared.ts`)로 분리하고, 기존에 합성 입력으로 겨냥 불가능했던 fail-closed 분기
(`repoRoot`, `validateWorkspacePatterns`)를 의존성 주입으로 테스트 가능하게 만든 리팩터링이다. 모든
입출력이 레포 자체 설정 파일(로컬 파일시스템, 신뢰된 소스)에 국한되고, `tsconfig.json` exclude 로
프로덕션 빌드/번들에서 물리적으로 배제되며, 네트워크·사용자 입력·인증·시크릿·암호화 경로와 접점이
없어 공격 표면이 사실상 없다. 정규식 문자열 보간과 blind YAML/셸 서브셋 파서는 통상 경계해야 할
패턴이지만 입력이 하드코딩 상수/신뢰된 레포 파일로 한정돼 있어 실질 위험으로 이어지지 않으며, 두
경우 모두 향후 입력 소스가 바뀔 경우를 대비한 참고 사항으로만 기록한다. 하드코딩된 시크릿, 인증/
인가 우회, 안전하지 않은 암호화, 민감정보 노출, 취약 의존성 추가 등 실질적 보안 결함은 발견되지
않았다.

## 위험도

NONE

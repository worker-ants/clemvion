# 보안(Security) Review

## 리뷰 범위

`codebase/frontend/src/lib/repo-guards/__tests__/**` 하위 repo-guard(레포 내부 drift 검사용
test-time 유틸) 리팩터링 + 대응 plan 문서 갱신. 대상 6개 TS 파일은 전부 `__tests__/` 아래
있고 tsconfig exclude 로 프로덕션 빌드에도 포함되지 않으며, vitest 를 통해 로컬/CI 테스트
스테이지에서만 실행된다. 처리하는 입력은 전부 **레포 내부 파일**(`pnpm-workspace.yaml`,
`package.json`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`) 이며,
네트워크·외부 사용자 입력·DB·인증 경로와 접점이 없다.

## 발견사항

발견된 Critical/Warning 없음. 참고용 INFO 2건만 기재한다.

- **[INFO]** 정규식 생성 시 문자열 보간(`RegExp` constructor injection 형태이나 무해)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:155`
    (`const open = new RegExp(\`^${fn}\\(\\)\\s*\\{\\s*$\`, "m")`), 동 파일:290
    (`const viaInternal = new RegExp(\`_run_internal\\s+${script}\\b\`).test(body)`)
  - 상세: `fn`/`script` 를 이스케이프 없이 `RegExp` 문자열에 직접 보간한다. 일반적으로
    사용자 입력이 정규식 메타문자로 흘러 들어가면 ReDoS/정규식 injection 소지가 되는
    패턴이지만, 이 값들은 `internal-package-registration.test.ts`/`typescript-toolchain.test.ts`
    의 하드코딩된 `STAGES` 상수(`"cmd_lint"`/`"cmd_unit"`/`"cmd_build"`, `"lint"`/`"test"`/`"build"`)
    에서만 오며 외부·사용자 입력 경로가 없다. 실질 위험은 없음 — 코드 스멜 수준의 방어적
    코딩 관점 참고사항.
  - 제안: 조치 불필요(리스크 없음). 추후 이 값들이 동적/외부 소스에서 오게 바뀔 경우
    `RegExp` 이스케이프(예: 메타문자 escape 헬퍼)를 추가할 것.

- **[INFO]** YAML/셸 서브셋 파서는 "blind" 텍스트 변환(정규식 기반)이며 완전한 파서가 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (`listAtPath`/`blockRange`/`findKeyLine`),
    `internal-package-registration-guard.ts:202-217`(`explicitFilterCalls`)
  - 상세: 파일 자체 주석에 이미 경계가 명시돼 있듯(따옴표 escape `\"`, 명령치환 `$(...)` 등
    미지원), 이 파서들은 신뢰된 레포 내부 설정 파일만 대상으로 하는 fail-closed 휴리스틱이라
    보안 문제로 보지 않는다. 입력이 외부/사용자 제공으로 바뀌는 시나리오가 생긴다면(예:
    PR 작성자가 임의로 채운 YAML 을 CI 가 파싱) 이 근사 파서로는 우회·오탐 여지가 생길 수
    있음을 참고로 남긴다.
  - 제안: 현재 범위(레포 자체 설정 파일)에서는 조치 불필요.

## 점검 관점별 확인

1. **인젝션**: SQL/커맨드/LDAP/경로 탐색 대상 코드 없음. `fs.readFileSync`/`fs.readdirSync`
   경로는 전부 `ROOT`(marker 탐색으로 계산된 레포 루트) 기준 하드코딩된 상대 경로 조합이고
   외부 입력이 개입하지 않는다. `child_process`/`exec` 호출 없음.
2. **하드코딩된 시크릿**: 없음.
3. **인증/인가**: 해당 없음(빌드/테스트 전용 유틸, 런타임 앱 경로와 무관).
4. **입력 검증**: 처리 대상이 레포 자체 파일이라 사용자 입력 검증 이슈 아님. 오히려
   추출 실패 시 `null`/`[]` → throw 로 fail-closed 하게 설계되어 있어(vacuity 방지) 긍정적.
5. **OWASP Top 10**: 해당 사항 없음(웹 요청 처리 경로 아님).
6. **암호화**: 해시/암호화/평문 전송 관련 코드 없음.
7. **에러 처리**: `repoRoot`/`fnBody`/`validateWorkspacePatterns` 등의 `Error` 메시지는 로컬
   디렉터리 경로·YAML 키 이름 등 진단 정보만 담고 있고, 이는 테스트 실행 로그(CI/로컬)에만
   노출된다. 민감정보(자격증명·PII) 없음.
8. **의존성 보안**: 이번 diff 는 신규 외부 의존성을 추가하지 않는다(`js-yaml` 을 의도적으로
   피하고 서브셋 파서를 자체 구현한 것도 헤더 주석에 명시돼 있음 — 전이 의존 hoist 불안정성
   회피 목적).

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 `__tests__/` 아래의 repo-guard(내부 drift
검사) 순수 로직을 두 파일 간 공유 모듈(`_shared.ts`)로 분리하고, 기존에 합성 입력으로
겨냥 불가능했던 fail-closed 분기(`repoRoot`, `validateWorkspacePatterns`)를 의존성 주입으로
테스트 가능하게 만든 리팩터링이다. 모든 입출력이 레포 자체 설정 파일(로컬 파일시스템, 신뢰된
소스)에 국한되고 네트워크·사용자 입력·인증·시크릿·암호화 경로와 접점이 없어 공격 표면이
사실상 없다. 위에 남긴 INFO 2건은 실질 위험이 아니라 향후 입력 소스가 바뀔 경우를 대비한
참고 사항이다.

## 위험도

NONE

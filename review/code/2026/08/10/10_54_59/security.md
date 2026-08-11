# 보안(Security) 리뷰

## 리뷰 대상

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` (리팩터: `_shared.ts` re-export)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (테스트 추가)
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts` (리팩터: `_shared.ts` 사용 + `validateWorkspacePatterns` 분리)
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts` (테스트 추가)
- `plan/in-progress/typescript-toolchain-followups.md` (plan 문서, 코드 아님)

## 컨텍스트 판단

전 파일이 `src/**/__tests__/**` 아래에 있어 tsc/next build 및 프로덕션 번들에서 제외되고, vitest 로만
실행되는 **repo 내부 개발 도구(가드 스크립트)** 다. 처리하는 입력은 전부 이 저장소 자신의 커밋된
파일(`pnpm-workspace.yaml`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`,
`package.json` 매니페스트들)이며, 외부 사용자·네트워크·DB 로부터 오는 입력은 전혀 없다. 즉 공격
표면(attack surface)이 존재하지 않는 코드 — 신뢰 경계는 "이 저장소에 커밋 권한이 있는 사람"과
동일하다.

## 항목별 점검

1. **인젝션**: `child_process.exec/spawn` 등 커맨드 실행 호출 없음. SQL/LDAP 없음. 동적으로 구성하는
   `RegExp`(`new RegExp(`_run_internal\\s+${script}\\b`)`, `new RegExp(`^${fn}\\(\\)\\s*\\{\\s*$`, "m")`)
   는 보간 값(`script`, `fn`)이 코드 내 고정 상수 배열 `STAGES`(`lint`/`test`/`build`, `cmd_lint`/
   `cmd_unit`/`cmd_build`)에서만 오므로 외부/사용자 입력이 섞일 여지가 없다. 경로 조합
   (`path.join(ROOT, dir, "package.json")` 등)도 `ROOT` 는 marker 탐색으로 얻은 고정 절대경로이고
   `dir` 은 `fs.readdirSync` 로 실측한 실제 디렉터리명이라 경로 탈출 벡터가 아니다.
2. **하드코딩된 시크릿**: 없음. API 키/비밀번호/토큰류 없음.
3. **인증/인가**: 해당 없음 — 런타임 서비스가 아닌 로컬 빌드/테스트 스크립트.
4. **입력 검증**: 입력이 신뢰된 저장소 내부 파일이므로 보안 관점의 "새니타이징" 대상이 아니다.
   다만 코드 자체가 강조하는 "fail-closed"(파싱 실패 시 `null`/`[]` → vacuity 단언에서 red,
   `validateWorkspacePatterns` throw)는 **정확성/가용성** 관심사(가드가 조용히 무력화되지 않게)이지
   보안 취약점 방어는 아니다 — 문제로 카운트하지 않음.
5. **OWASP Top 10**: 해당 없음(웹 애플리케이션 런타임 코드가 아님).
6. **암호화**: 암호화/해시 관련 코드 없음.
7. **에러 처리**: `throw new Error(...)` 메시지들이 `__dirname`, 파일 경로, 함수명 등을 포함하지만
   이는 로컬 개발자/CI 로그에만 노출되는 내부 진단 메시지이며 비밀번호·토큰·PII 등 민감정보는
   포함하지 않는다. 문제 없음.
8. **의존성 보안**: 신규 외부 의존성 추가 없음(`node:fs`, `node:path`, `node:module` 내장 모듈만
   사용). `internal-package-registration-guard.ts` 헤더 주석은 오히려 `js-yaml` 같은 전이 의존을
   **의도적으로 피하고** 자체 YAML 서브셋 파서를 쓰는 이유를 설명한다 — 의존성 표면을 늘리지 않는
   방향이라 긍정적.

## 참고 (정보성, 조치 불요)

- `internalPackages`(`/^INTERNAL_PACKAGES=\(([\s\S]*?)^\)/m`)와 `explicitFilterCalls` 의 정규식들은
  중첩 정량자가 없는 선형 패턴이라 이번 저장소가 겪은 ReDoS 이력(MULTILINE+`\s` 이차 배율) 클래스와
  형태가 다르며, 어차피 입력이 신뢰된 로컬 파일(`test-stages.sh`, 수 KB)로 크기가 유계라 실질 위험이
  없다.
- 이 리뷰 대상 diff 는 순수 리팩터(공유 프리미티브 분리·`validateWorkspacePatterns` 추출) + 테스트
  보강이며, 파서 로직 자체의 정규식/추출 알고리즘은 이전 리뷰에서 이미 다룬 기존 코드를 그대로
  옮긴 것이다(신규 위험 도입 없음).

## 발견사항

없음.

## 요약

리뷰 대상은 전부 `__tests__/` 아래의 빌드/테스트 제외 대상 repo-guard 스크립트로, tsc/next 빌드와
프로덕션 런타임에 포함되지 않고 외부 사용자 입력을 전혀 받지 않는다(오직 저장소 자신의 커밋된
설정 파일만 읽는다). 커맨드 실행·시크릿·인증/인가·암호화·SQL/XSS 등 OWASP 관련 공격 표면이
구조적으로 존재하지 않으며, 이번 diff 는 기존 파서 로직을 두 가드가 공유하는 중립 모듈(`_shared.ts`)
로 옮기고 fail-closed 검증(`validateWorkspacePatterns`)을 순수 함수로 분리 + 테스트를 보강한
리팩터/테스트 강화 커밋이다. 신규 보안 결함을 도입하지 않았다.

## 위험도

NONE

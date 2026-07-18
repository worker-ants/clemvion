# 보안(Security) 리뷰 — 내부 패키지 등록 목록 drift 가드

## 리뷰 대상
1. `.claude/test-stages.sh` — 주석만 추가(코드 변경 없음)
2. `.github/workflows/packages-checks.yml` — 주석만 추가(코드 변경 없음)
3. `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — 신규 vitest 테스트 파일(489 lines). `.claude/test-stages.sh`·`packages-checks.yml`·`codebase/packages/*`·`codebase/backend/package.json` 을 정적으로 읽어 상호 drift 를 검증하는 회귀 가드.

## 분석 요약

이 변경은 순수 개발 도구/CI 하네스 영역의 테스트 코드이며, 프로덕션 런타임 코드·네트워크 경계·사용자 입력·인증 흐름을 전혀 건드리지 않는다. 파일이 읽는 모든 경로(`pnpm-workspace.yaml`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/packages/*/package.json`, `codebase/backend/package.json`)는 저장소 내 고정 상대 경로에서 파생되며, 외부/사용자 제공 입력이 전혀 개입하지 않는다.

### 발견사항

- **[INFO]** 정규식 기반 파서의 ReDoS 이론적 표면 — 실질 위험 없음
  - 위치: `internal-package-registration.test.ts` L410(`internalPackages`), L921/924(`fnBody`), L956(`explicitFilterCalls`)
  - 상세: `/^INTERNAL_PACKAGES=\(([\s\S]*?)^\)/m` 류의 lazy/greedy 정규식은 일반적으로 catastrophic backtracking 취약 패턴(중첩 quantifier)이 아니며, 입력도 저장소 내 고정 파일(수백 라인 규모)이라 공격자가 제어할 수 있는 입력이 아니다. 실행 주체도 로컬 개발자/CI 뿐이라 DoS 로 이어질 공격 경로가 없다.
  - 제안: 조치 불필요. 참고용으로만 기록.

- **[INFO]** `new RegExp(...)` 동적 구성이지만 인젝션 불가
  - 위치: L921 `new RegExp(`^${fn}\\(\\)\\s*\\{\\s*$`, "m")`, L1040(구 라인 기준) `new RegExp(`_run_internal\\s+${script}\\b`)`
  - 상세: 두 곳 모두 보간되는 `fn`/`script` 값은 파일 내부에 하드코딩된 `STAGES` 상수(`cmd_lint`/`cmd_unit`/`cmd_build`, `lint`/`test`/`build`)에서만 오며, 외부 입력이나 파일에서 읽은 값이 아니다. 따라서 RegExp 인젝션(정규식 구문 조작을 통한 우회)의 공격 표면이 없다.
  - 제안: 조치 불필요.

- **[INFO]** GitHub Actions 컴포넌트가 major-version 태그로 고정(`actions/checkout@v7` 등)
  - 위치: `.github/workflows/packages-checks.yml` (diff 대상 아님 — 전체 컨텍스트에서만 확인, 이번 변경으로 도입된 것 아님)
  - 상세: 태그 고정은 커밋 SHA 고정 대비 supply-chain 관점에서 약한 방식(업스트림이 태그를 재지정하면 다른 코드가 실행될 수 있음)이나, 이 파일 자체가 "repo 레벨에서 Actions 가 꺼져 있어 런 수 0(inert)"이라고 본 diff 의 주석이 명시하고 있어 현재 실행되지 않는다. 또한 이 워크플로 잡은 diff 대상이 아니라 기존 상태 그대로다.
  - 제안: 조치 불필요(이번 변경 스코프 밖, 실행되지도 않음). 향후 Actions 재활성화 시점에 SHA pinning 검토를 별도 백로그로 고려 가능.

- **[INFO]** 하드코딩 시크릿/자격증명 없음
  - 위치: 전체 diff
  - 상세: 세 파일 모두 API 키, 토큰, 비밀번호, 인증서 등 민감정보 리터럴이 없다.

- **[INFO]** 에러 메시지에 민감정보 노출 없음
  - 위치: `internal-package-registration.test.ts` 의 각 `throw new Error(...)` / `expect(..., message)`
  - 상세: 에러 메시지는 전부 저장소 내부 파일 경로·패키지명·함수명 등 비-민감 개발 메타데이터이며, 이 테스트는 로컬/CI 개발자 콘솔에만 노출된다(사용자 대면 에러 경로 아님).

## 발견 없음 항목 (관점별 확인)
- 인젝션(SQL/XSS/커맨드/LDAP/경로탐색): 해당 없음 — DB·웹·쉘 실행 인터페이스 없음, 파일 읽기 경로는 전부 고정.
- 인증/인가: 해당 없음 — 인증 흐름 미포함.
- 입력 검증: 해당 없음 — 사용자 입력 처리 없음(저장소 정적 파일만 읽음).
- 암호화: 해당 없음.
- 의존성 보안: 변경 없음(신규 의존성 추가 없음, 기존 vitest/node:fs/node:path 표준 사용).

## 위험도
NONE

# 보안(Security) 리뷰

## 대상 요약

- `.claude/test-stages.sh`: 주석 추가만 (동작 변경 없음)
- `.github/workflows/packages-checks.yml`: 주석 추가만 (동작 변경 없음)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`: 신규 vitest 가드 — 리포 내 정적 파일(`test-stages.sh`, `packages-checks.yml`, `package.json`)을 읽어 4곳의 "내부 패키지 등록 목록" drift 를 검증

세 파일 모두 사용자 요청을 처리하는 애플리케이션 코드가 아니라, 로컬/CI 빌드·테스트 파이프라인 설정과 그 정합성을 검증하는 개발자 도구(dev-only test tooling)다. 외부 입력, 인증/세션, DB, 네트워크 응답 처리, 렌더링 등 OWASP Top 10 이 직접 적용되는 표면이 없다.

## 세부 검토

1. **인젝션 취약점** — 신규 테스트 파일은 `fs.readFileSync`/`JSON.parse`/정규식으로 리포 내 신뢰된 파일(자신의 코드베이스)만 읽는다. 외부 입력이나 네트워크 응답을 파싱하지 않으므로 SQL/XSS/커맨드/LDAP 인젝션 표면이 없다. `child_process` 호출이 없어 커맨드 인젝션도 해당 없음. `packages-checks.yml` 의 `matrix.pkg` 는 워크플로 내부에 정적으로 선언된 값이며 PR 제목/본문 등 외부 제어 가능한 문자열에서 오지 않으므로 GitHub Actions 스크립트 인젝션(`${{ }}` 오용) 위험도 없음.
2. **하드코딩된 시크릿** — 세 파일 어디에도 API 키/비밀번호/토큰/인증서 없음. `test-stages.sh` 의 `NEXT_PUBLIC_API_URL=http://localhost:3011/api` 등은 로컬 더미 build-arg 로 명시(주석에도 "dummy build-arg" 로 문서화)돼 실제 배포 값이 아님.
3. **인증/인가** — 해당 없음(CI/테스트 도구, 인증 로직 없음).
4. **입력 검증** — `repoRoot()` 는 `pnpm-workspace.yaml` 존재 여부로 마커 탐색을 하며 최대 12단계로 상한을 두고 실패 시 throw(fail-closed) 한다. YAML/셸 파서(`fnBody`, `listAtPath` 등)는 자신이 다루는 문법 서브셋을 벗어나면(중첩 블록 등) 명시적으로 throw 하도록 설계돼 "조용한 오탐/거짓 통과"를 스스로 차단한다 — 신뢰 경계가 없는 내부 파일 파싱 목적에 적절.
5. **OWASP Top 10** — 해당 사항 없음(웹 요청/응답 경로 아님).
6. **암호화** — 해당 없음(해시/암호화 로직 없음).
7. **에러 처리** — 테스트 실패 메시지가 파일 경로·목록 내용을 포함하지만, 이는 로컬 개발자/CI 로그에만 노출되는 진단 정보이며 민감정보(자격증명 등)가 아니다.
8. **의존성 보안** — `packages-checks.yml` 의 `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v6` 는 커밋 SHA 가 아닌 메이저 버전 태그로 고정되어 있어 일반적인 GitHub Actions 서플라이체인 모범사례(SHA pin) 관점에서는 아쉬운 지점이나, 이는 이번 diff 로 새로 도입된 것이 아니라 기존 파일에 이미 있던 부분(diff 는 주석만 추가)이고, 또한 리포 설명에 따르면 Actions 자체가 repo 레벨에서 비활성화되어 현재 실행되지 않는 inert 워크플로다. 새로운 위험을 추가하지 않으므로 정보성으로만 기록.

## 발견사항

- **[INFO]** GitHub Actions 액션이 메이저 버전 태그로 고정(SHA 미고정)
  - 위치: `.github/workflows/packages-checks.yml` (`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v6` — 이번 diff 범위 밖, 기존 코드)
  - 상세: 일반적 공급망 보안 모범사례는 액션을 커밋 SHA 로 고정한다. 다만 이번 변경(주석 추가)과 무관하고, 해당 워크플로는 현재 리포 레벨에서 Actions 가 꺼져 있어 inert 상태(주석에 명시)이므로 즉각적 위험은 없음.
  - 제안: 별도 백로그로 다룰 사항(Actions 재활성화 시점에 검토 권장), 이번 PR 의 blocking 사유는 아님.

발견된 CRITICAL/WARNING 없음.

## 요약

이번 변경분은 애플리케이션 로직이 아닌 CI/테스트 파이프라인 문서화(주석) 및 리포 내부 파일 간 "등록 목록 drift" 를 검증하는 신규 vitest 가드로 구성되어 있다. 신규 테스트 코드는 외부 입력이 아닌 신뢰된 로컬 리포 파일만 파싱하며, 파싱 실패/공집합 상황을 vacuity 테스트로 명시적으로 fail-closed 처리해 "조용한 무력화"를 스스로 방지하는 설계다. 시크릿 하드코딩, 인젝션, 인증/인가, 암호화, 에러 노출 등 전통적 보안 취약점 클래스에 해당하는 신규 위험은 발견되지 않았다. GitHub Actions 버전 고정 방식(SHA 미고정)은 일반 모범사례상 아쉬운 점이나 이번 diff 로 도입된 것이 아니고 현재 inert 상태라 정보성으로만 기록한다.

## 위험도

NONE

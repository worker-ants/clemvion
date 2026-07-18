# 보안(Security) 코드 리뷰

## 리뷰 범위

- `.claude/test-stages.sh` — 주석 추가만 (로직 변경 없음)
- `.github/workflows/packages-checks.yml` — 주석 추가만 (로직 변경 없음)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` (신규) — 내부 패키지 등록 목록 drift 를 검출하는 순수 파서/비교 로직
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (신규) — 위 로직의 실측 대조 + 합성 fixture 테스트

전 변경분은 **개발/CI 시점에만 실행되는 저장소 내부 tooling**(테스트 인프라 drift 가드)이며, 런타임 애플리케이션 코드·네트워크 경계·사용자 입력 경로에 포함되지 않는다. `fs.readFileSync`/`readdirSync` 가 읽는 대상은 모두 저장소 내 고정 경로(`package.json`, `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`)이며 외부(사용자)에서 통제 가능한 입력이 아니다.

## 발견사항

- **[INFO]** 개발 tooling — 공격 표면 사실상 없음
  - 위치: `internal-package-registration-guard.ts` 전체
  - 상세: `repoRoot()`, `discoverPackages()`, `backendWorkflowDeps()` 등은 모두 vitest 실행 시점에 로컬 저장소의 신뢰된 파일만 읽는다. 이 코드를 조작하려면 이미 저장소에 대한 쓰기 권한(=신뢰된 컨트리뷰터 권한)이 필요하므로, 이 파일 자체가 새로운 신뢰 경계를 만들지 않는다. 정규식 기반 bash/YAML 서브셋 파서(`fnBody`, `explicitFilterCalls`, `listAtPath` 등)에 ReDoS 로 이어질 수 있는 backtracking 패턴이 있는지 확인했으나, 입력 크기가 저장소 내 고정 파일(수십~수백 줄)로 제한되고 non-greedy/anchored 패턴이라 실질적 DoS 벡터는 없다.
  - 제안: 조치 불요. (참고용 기록)

- **[INFO]** `throw new Error(...)` 메시지에 내부 경로·구조 정보 포함
  - 위치: `internal-package-registration-guard.ts` `repoRoot()`, `fnBody()` 등의 에러 메시지
  - 상세: 에러 메시지가 `__dirname`, 함수명, 저장소 구조를 노출하지만 이는 vitest 실행 시 로컬/CI 콘솔에만 출력되며 최종 사용자에게 도달하는 에러 경로(API 응답 등)가 아니다. "민감 정보 노출" 관점의 실질 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** `packages-checks.yml` — 현재 GitHub Actions repo-level 비활성 상태에서의 CI 신뢰 공백
  - 위치: `.github/workflows/packages-checks.yml` 헤더 주석, `internal-package-registration.test.ts` 헤더 주석
  - 상세: 주석에 명시된 대로 이 워크플로는 저장소 레벨에서 Actions 가 꺼져 있어 실제로 실행되지 않는다(런 수 0). 이는 보안 취약점이라기보다 CI 커버리지 공백이며, 이번 변경(신규 vitest 가드)이 그 공백을 로컬 게이트로 보완하려는 목적이므로 오히려 개선 방향이다. 다만 "CI 가 이 워크플로를 신뢰성 있게 강제하고 있다"는 잘못된 인상을 주지 않도록 문서화가 이미 명확히 돼 있어 문제 없음.
  - 제안: 조치 불요.

인젝션(SQL/XSS/커맨드/LDAP/경로 탐색), 하드코딩된 시크릿, 인증/인가, 사용자 입력 검증, 암호화, 의존성 취약점 관점에서 해당사항 없음 — 이 변경분은 사용자 입력을 처리하지 않고, 네트워크 요청을 만들지 않으며, 시크릿/자격증명을 다루지 않고, 인증/인가 로직에 영향을 주지 않는다.

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 CI/로컬 테스트 인프라의 drift 가드(내부 공유 패키지가 lint/unit/build 3단계 및 CI 워크플로 목록에서 누락되지 않도록 검증하는 순수 파서/비교 로직과 그 테스트)이며, 사용자 입력·네트워크 경계·인증/인가·시크릿 처리와 접점이 없다. 정규식 기반 파서의 입력이 고정된 저장소 내부 파일로 제한되어 ReDoS 등 실질적 공격 벡터도 확인되지 않았다. 보안 관점에서 이번 diff 는 무해하다.

## 위험도

NONE

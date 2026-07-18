# Security Review — 내부 패키지 등록 목록 drift 가드 (#968 후속)

## 리뷰 대상
- `.claude/test-stages.sh` (주석 추가만)
- `.github/workflows/packages-checks.yml` (주석 추가만)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts` (신규 — 파서/비교 순수 로직)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (신규 — 실측 대조 + 합성 fixture 테스트)

성격: CI/로컬 테스트 러너 커버리지 drift 를 잡는 개발자 도구용 정적 가드. 런타임 프로덕션 경로·사용자 입력·네트워크 경계와 무관하며, 파싱 대상은 저장소 자신의 신뢰된 파일(`test-stages.sh`, `packages-checks.yml`, `package.json`)뿐이다. 외부에서 공급되는 데이터를 처리하지 않는다.

### 발견사항

- **[INFO]** 파일 경로 계산에 신뢰 경계 없음(정보성, 실질 위험 아님)
  - 위치: `internal-package-registration-guard.ts` `repoRoot()`, `discoverPackages()`, `backendWorkflowDeps()`
  - 상세: `fs.readFileSync`/`fs.readdirSync` 가 `__dirname` 기준 상위 탐색과 고정 상대경로(`codebase/packages`, `codebase/backend/package.json`)로 파일을 읽는다. 경로 세그먼트가 외부 입력에서 오지 않으므로 경로 탐색(path traversal) 공격 표면이 없다. 저장소 자신의 파일만 읽는 테스트 전용 코드이므로 문제 없음 — 향후 이 유틸을 사용자 입력(예: PR 제목, 브랜치명 등)과 결합해 확장할 경우에만 재검토 필요.
  - 제안: 현재로선 조치 불필요. 재사용 시 입력 출처 문서화 권장.

- **[INFO]** 정규식 기반 bash/YAML 파서 — ReDoS 이론적 표면
  - 위치: `internalPackages()`, `fnBody()`, `explicitFilterCalls()`, `listAtPath()` 의 정규식들 (예: `/^INTERNAL_PACKAGES=\(([\s\S]*?)^\)/m`)
  - 상세: 백트래킹 정규식 엔진에서 중첩 quantifier 는 이론상 ReDoS 위험이 있으나, 입력이 고정된 저장소 파일(`test-stages.sh`, `packages-checks.yml`)이고 크기가 작고 커밋 리뷰를 거치므로 공격자가 이 파서에 임의의 대형/적대적 문자열을 주입할 경로가 없다. 실질 위험 없음.
  - 제안: 조치 불필요 (테스트 전용, 신뢰 입력).

- **[INFO]** `os.exec`/`child_process` 미사용 — 오히려 긍정적 설계
  - 위치: 전체 신규 파일
  - 상세: 이 가드는 `.claude/test-stages.sh` 내용을 "실행"하지 않고 순수 텍스트 파싱만 한다(`pnpm --filter` 셸 호출을 흉내내되 실제 실행하지 않음). 커맨드 인젝션 표면이 원천 차단되어 있다.
  - 제안: 해당 없음(권장 사항 없음, 현재 설계 유지 권장).

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 4개 파일 전체
  - 상세: API 키, 토큰, 비밀번호, 인증서 등 민감정보 패턴 미발견. `packages-checks.yml` 는 GitHub Actions 표준 액션(`actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v6`)만 사용하며 시크릿 참조가 없다.
  - 제안: 해당 없음.

- **[INFO]** 에러 메시지에 민감정보 노출 없음
  - 위치: `fnBody()`, `repoRoot()` 의 `throw new Error(...)` 호출들
  - 상세: 에러 메시지는 함수명·파일 상대 경로 등 저장소 구조 정보만 포함하며(예: `fnBody: ${fn} 선언을 찾지 못함`), 비밀값·사용자 데이터·스택 트레이스 상의 자격증명이 노출되지 않는다. 이 코드는 CI/로컬 개발자에게만 노출되는 테스트 출력이므로 위협 모델상 문제 없음.
  - 제안: 해당 없음.

- **[INFO]** 의존성 변경 없음
  - 위치: `packages-checks.yml`, 신규 ts 파일들
  - 상세: 새 npm 패키지나 GitHub Action 버전 변경이 diff 에 없다(코멘트만 추가). `js-yaml` 을 의도적으로 피하고 자체 경량 파서를 사용한다는 설계 근거가 코드 주석에 명시돼 있어 불필요한 전이 의존성 도입도 회피했다.
  - 제안: 해당 없음.

### 요약
이번 변경은 프로덕션 런타임 코드가 아니라 CI/로컬 테스트 러너의 "패키지 등록 목록 drift" 를 잡는 개발자용 정적 가드(주석 2건 + 순수 파서/비교 로직 신규 테스트 파일 2건)이다. 사용자 입력·네트워크 경계·인증/인가·암호화·시크릿 저장이 전혀 관여하지 않으며, 파싱 대상은 저장소 자신의 신뢰된 파일뿐이고 `child_process` 실행이나 동적 코드 평가(`eval` 등)도 없다. 인젝션·시크릿 노출·인증 우회·암호화 취약점 등 OWASP Top 10 관점에서 실질적 위험은 발견되지 않았다. 위에 기록한 항목은 모두 이론적 표면을 문서화한 INFO 수준이며 조치가 필요하지 않다.

### 위험도
NONE

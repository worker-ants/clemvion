# 보안(Security) 리뷰

## 발견사항

### 파일 1: codebase/backend/README.md

- **[INFO]** 배포 주의 불릿 항목이 실제 `assertProductionConfig` 거부 조건과 정확히 정합
  - 위치: diff `+` 라인 전체
  - 상세: `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `JWT_SECRET < 32`, `MCP_ALLOW_INSECURE_URL` 4가지 거부 조건이 구현(`production-guards.ts`)과 1:1 대응한다. 문서가 실제 가드를 정확하게 반영하므로 운영자가 잘못된 안내를 따라 잘못 배포할 위험이 낮아졌다.
  - 제안: 없음. 현행 설명으로 충분.

---

### 파일 2: codebase/backend/src/common/config/production-guards.spec.ts

- **[INFO]** 테스트 픽스처에 사용된 `VALID_JWT` / `VALID_ENC` 값이 안전한 더미 값
  - 위치: 파일 전체, lines 200-201
  - 상세: `VALID_JWT = 'a-real-long-random-production-jwt-secret-0123456789'`(50자)와 `VALID_ENC = 'fedcba9876543210...'`(64 hex chars)는 실제 비밀이 아닌 테스트 전용 더미 값이다. `INSECURE_JWT_SECRETS` 블랙리스트에 포함되지 않고, 충분한 길이 조건을 충족하는 유효한 테스트 입력이므로 하드코딩 시크릿 해당 없음.
  - 제안: 없음.

- **[INFO]** `beforeAll` 이동으로 Jest 수집 단계 side-effect 해소
  - 위치: diff `+beforeAll(() => { ... })` 블록
  - 상세: 파일 최상위의 동기 `fs.readFileSync` 호출이 Jest 수집 단계에서 파일 부재 시 전체 스위트 로드를 막는 문제를 `beforeAll` 로 이동해 해결했다. 보안 관점에서 fs 경로(`path.resolve(__dirname, '../../../.env.example')`)는 상대 경로이지만 `__dirname` 기준으로 고정되어 경로 탐색(path traversal) 위험 없음.
  - 제안: 없음.

- **[INFO]** `jwtConfig()` 직접 호출 시 `process.env.JWT_SECRET` 복원 처리 정확
  - 위치: lines 396-405 (`try/finally`)
  - 상세: `delete process.env.JWT_SECRET` 후 `finally` 에서 원래 값을 복원하는 패턴은 테스트 격리 측면에서 적절하다. 테스트 환경에서의 환경변수 누수를 방지한다.
  - 제안: 없음.

---

### 구현 파일 참조: codebase/backend/src/common/config/production-guards.ts

리뷰 대상 변경이 diff 에 포함되어 있지 않으나 테스트 대상 구현이므로 보안 관점 참조 검토.

- **[INFO]** `fail-closed` 가드 설계 양호
  - 위치: `assertProductionConfig` 함수 전체
  - 상세: `NODE_ENV !== 'production'` early-return, 블랙리스트 Set 기반 검사, 길이 하한(32자) 적용, `isFlagOn` 의 엄격한 `'true'|'1'` 만 ON 처리 모두 안전하다. 첫 위반에서 즉시 throw 하는 fail-fast 전략이 부팅 거부를 보장한다.
  - 제안: 없음.

- **[INFO]** `jwt.config.ts` dev fallback 평문 노출
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/prod-fail-closed-guards/codebase/backend/src/common/config/jwt.config.ts` line 4
  - 상세: `process.env.JWT_SECRET || 'dev-jwt-secret'` — `'dev-jwt-secret'` 가 소스 코드에 리터럴로 존재한다. 해당 값은 `INSECURE_JWT_SECRETS` 에 등재되어 production 부팅 시 차단되므로 실질적 위험은 없다. 단, dev fallback 이 소스에 평문으로 노출된다는 사실은 개발자가 인지해야 한다.
  - 제안: 현재 `assertProductionConfig` 차단이 충분한 방어선이다. dev fallback 값은 `INSECURE_JWT_SECRETS` 와 동기화를 유지해야 하며, 이를 검증하는 테스트(`blacklist Set sync` describe 블록)가 이미 존재한다.

---

## 요약

이번 변경은 README 배포 주의 문서의 정확도 향상과 테스트 fragility 수정이 핵심이다. 보안 관점에서 새로운 취약점은 발견되지 않았다. `assertProductionConfig`의 fail-closed 가드 구현이 인증 우회(CWE-521), 예시 키 평문화, SSRF 방어 우회(MCP_ALLOW_INSECURE_URL), 비보안 stub 부팅 등 4가지 운영 위협을 모두 커버하며, 각 조건이 테스트로 완전히 검증된다. `beforeAll` 이동은 테스트 격리를 강화해 보안 가드 테스트 자체의 신뢰성을 높인다. `jwt.config.ts`의 `'dev-jwt-secret'` 리터럴은 소스 노출이 있으나 production 블랙리스트에 등재되어 실질 위험이 차단되어 있다.

## 위험도

NONE

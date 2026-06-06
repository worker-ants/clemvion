# 보안(Security) 리뷰 — exec-park-durable-resume (11_36_39)

## 발견사항

### [WARNING] LLM_STUB_MODE 프로덕션 부트스트랩 가드 추가 확인 — 현재 diff에 fix 반영됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/main.ts` (새 블록 L206–211)
- 상세: 이전 리뷰(11_22_25)에서 `LLM_STUB_MODE` 프로덕션 가드 부재(W1)를 지적했고, 현재 diff에서 `main.ts`에 `NODE_ENV === 'production' && LLM_STUB_MODE === 'true'` 시 `throw new Error(...)` 가드가 추가되어 있다. `OAUTH_STUB_MODE`와 동일 패턴으로 구현되었다. 가드 자체는 올바르나 한 가지 잔류 위험이 있다: `NODE_ENV`가 `'production'` 이 아닌 `'staging'`, `'prod'` 등 비표준 값으로 설정된 경우 가드가 우회된다. 이는 `OAUTH_STUB_MODE` 선례와 동일한 한계이므로 해당 환경 명명 규약을 명확히 하면 충분하다.
- 제안: 현재 구현은 기존 선례와 일치하며 허용 가능. 배포 환경이 `NODE_ENV=production` 외의 값을 사용하지 않는다는 운영 규약을 문서화할 것.

---

### [WARNING] e2e 테스트에서 JWT 직접 mint — 운영 토큰 검증 강도 확인 필요 (pre-existing, 미해결)
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` `mintInteractionToken()` (line 700–707)
- 상세: e2e 테스트가 `jsonwebtoken.sign`으로 `sub=executionId, aud='interaction', jti=randomUUID(), expiresIn=3600, algorithm='HS256'` 페이로드를 직접 mint하여 EIA 엔드포인트(`/api/external/executions/:id/interact`)를 인증한다. 이 패턴은 서버가 외부에서 forge된 토큰을 수락한다는 것을 의미한다. 운영 코드의 `InteractionTokenService` 토큰 검증이 서명+페이로드 구조만 확인하고 발급 기록(DB/Redis)과 대조하지 않을 경우, 동일 `JWT_SECRET`을 습득한 공격자가 임의 `executionId`를 대상으로 interaction 토큰을 위조할 수 있다. e2e에서 테스트가 통과한다는 것 자체가 현재 서버가 발급 기록 없이 서명 검증만으로 토큰을 수락함을 암시한다.
- 제안: `InteractionTokenService.validateToken`(또는 해당 Guard)이 `jti` 기반 단회성 또는 발급 기록 조회를 수행하는지 별도 확인. 수행하지 않는다면 EIA 보안 리뷰를 별도 태스크로 등록할 것. 본 PR 범위는 아니지만 향후 위험으로 추적 필요.

---

### [WARNING] docker-compose.e2e.yml 평문 시크릿 하드코딩 (pre-existing, 의도적)
- 위치: `docker-compose.e2e.yml` lines 1730–1831 (ENCRYPTION_KEY, JWT_SECRET 등)
- 상세: `ENCRYPTION_KEY`(`0123456789abcdef0123456789abcdef`)는 순차 문자열로 엔트로피가 극히 낮다. AES 키로 사용 시 약 13비트 수준의 유효 엔트로피를 가진다. `JWT_SECRET`(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)은 리포지토리에 공개된다. 두 값 모두 "e2e 전용, 운영 금지" 주석이 있고 격리된 ephemeral 환경에서만 사용되므로 현재 설계상 허용 가능하다. 단, CI 시크릿 스캐너(gitleaks, truffleHog)가 활성화된 경우 이 파일에서 false positive가 발생하므로 명시적 예외 처리가 필요하다.
- 제안: `.gitleaks.toml` 또는 시크릿 스캐너 설정에 `docker-compose.e2e.yml`을 예외 목록으로 추가하거나 `# gitleaks:allow` 인라인 주석 적용.

---

### [INFO] JWT_SECRET fallback 리터럴 2곳 중복 (이월된 W8)
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` line 679; `docker-compose.e2e.yml` line 1827
- 상세: `'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'`가 두 파일에 중복된다. 동기화 실패 시 e2e 인증이 무음으로 실패한다. RESOLUTION.md에서 follow-up 이월로 분류됨.
- 제안: `test/helpers/e2e-constants.ts`에 `E2E_JWT_SECRET` 상수를 export하고, 테스트 파일에서 `process.env.JWT_SECRET ?? E2E_JWT_SECRET` 형태로 참조. docker-compose SoT 주석 병행.

---

### [INFO] LLM_STUB_MODE env 비교 대소문자 민감성
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` (LLM_STUB_MODE 분기); `codebase/backend/src/main.ts` (부트스트랩 가드)
- 상세: 두 곳 모두 `=== 'true'` 소문자 비교만 수행한다. `'True'`, `'TRUE'`, `'1'`은 stub을 활성화하지 못한다. `OAUTH_STUB_MODE` 선례와 동일 패턴이므로 프로젝트 일관성은 유지된다.
- 제안: 낮은 우선순위. 일관성 유지 관점에서 현 상태 허용. 변경 시 `OAUTH_STUB_MODE` 동시 수정 필요.

---

### [INFO] StubLlmClient echo 응답에 사용자 입력 포함 — XSS 경로 확인
- 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` line 61
- 상세: `[stub] received: ${userMessage.slice(0, 200)}`를 chat 응답으로 반환한다. 이 응답이 WebSocket 이벤트를 통해 프론트엔드로 전달될 경우, 렌더링 레이어에서 HTML 이스케이프 없이 출력하면 XSS 취약점이 된다. 단, stub은 `LLM_STUB_MODE=true` 환경에서만 활성화되고 해당 환경은 프로덕션 아님 — 프로덕션 LLM 응답도 동일 emit 경로를 거치므로 프로덕션 경로의 XSS 보호가 stub에도 자동으로 적용된다. 실질적 위험은 없다.
- 제안: 조치 불필요. 프로덕션 LLM 응답과 동일 emit 경로를 사용하므로 출력 인코딩은 공유된다.

---

### [INFO] jsonwebtoken 9.0.3 직접 선언 — 알려진 취약점 없음
- 위치: `codebase/backend/package.json` devDependencies `"jsonwebtoken": "9.0.3"`
- 상세: jsonwebtoken 9.0.x 계열은 8.5.1 이하에서 발생한 CVE-2022-23529(알고리즘 혼용 공격), CVE-2022-23540/41(options 객체 인젝션) 등이 패치된 버전이다. 9.0.3을 pin하는 것은 보안상 적절하다. `@nestjs/jwt`도 동일 버전을 사용하므로 이중 설치 없이 deduplication된다.
- 제안: 조치 불필요. 단, 향후 9.x 신규 CVE 모니터링 필요.

---

### [INFO] sanitizeLlmErrorMessage 적용 일관성
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `testConnection()`, `listModels()`
- 상세: 이번 변경에서 추가된 stub 분기(`createClient`)는 에러를 외부로 노출하지 않는다. 기존 외부 노출 메서드에는 `sanitizeLlmErrorMessage` 적용이 유지되고 있다. LLM API 키, 인증 토큰 등이 에러 메시지에 포함될 경우 sanitize 유틸이 필터링하므로 민감 정보 노출 위험이 적절히 관리된다.
- 제안: 현 패턴 유지.

---

## 요약

이번 변경(PR-B2a: LLM stub + e2e 멀티턴)은 신규 보안 취약점을 도입하지 않았다. 이전 리뷰(11_22_25)에서 지적된 W1(LLM_STUB_MODE 프로덕션 가드 부재)이 `main.ts`에 `OAUTH_STUB_MODE` 동일 패턴으로 수정되었고, W9(`jsonwebtoken` 직접 선언)도 `package.json`에 반영되었다. 잔류하는 보안 관심사는 두 가지다: (1) e2e 테스트가 JWT를 직접 mint하여 서버가 발급 기록 없이 서명만으로 interaction 토큰을 수락함을 확인하는 설계 — EIA 서비스 자체의 `jti` 기반 revoke/단회성 메커니즘 유무에 따라 운영 토큰 위조 위험이 결정된다(PR 범위 외 기존 설계, 후속 추적 권고). (2) docker-compose.e2e.yml의 낮은 엔트로피 `ENCRYPTION_KEY`와 공개된 `JWT_SECRET` — e2e 격리 전용이고 의도적으로 문서화되어 있으나 CI 시크릿 스캐너 예외 관리가 필요하다.

## 위험도

LOW
